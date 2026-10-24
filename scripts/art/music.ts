/**
 * Makes the slice's music with Google's Lyria on the Gemini key (docs/assets/AUDIO.md, D-45), the
 * request adapted from Starman Control's scripts/music/lyria.ts. The briefs and every record are in
 * art/audio.json; the finished pieces go to public/assets/audio/music/ with the game's manifest.
 *
 *   node scripts/art/music.ts generate [id ...]  # Lyria candidates not made yet (--again makes new ones)
 *   node scripts/art/music.ts pick [id ...]      # Gemini listens to each piece's candidates and picks one
 *   node scripts/art/music.ts build [id ...]     # finds a loop, levels, encodes; writes the manifest
 *   node scripts/art/music.ts all
 *
 * A piece's "pick" (a candidate number) overrules Gemini's choice. A looping piece plays from the top
 * once, then between loopStart and loopEnd: the music either side of both points was found to match,
 * and the join is crossfaded.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { requireKey } from './env.ts';
import {
  decode,
  EAR_MODEL,
  encodeMp3,
  fade,
  findLoop,
  forEar,
  gain,
  loopBetween,
  loudness,
  type ManifestEntry,
  normalise,
  PUBLIC_AUDIO,
  peakDb,
  pool,
  RECORDS,
  ROOT,
  rank,
  seconds,
  sha256,
  slice,
  trimQuiet,
  updateManifest,
  updateRecords,
} from './sound.ts';

const MUSIC_LUFS = -18;
const CEILING_DB = -1.5;
const BITRATE = '128k';
const CROSSFADE_S = 1.5;
/** A loop inside a piece only where the band levels either side of both points differ by at most this (dB). */
const MATCH_DB = 4;
const WHOLE_CROSSFADE_S = 3;

interface MusicBrief {
  id: string;
  what: string;
  subject: string;
  loop?: { minS: number; maxS: number };
  pick?: number;
  /** Who chose `pick`, and how. */
  pickNote?: string;
  candidates?: number;
}
interface Record_ {
  lyria: { model: string; candidates: number; style: string; licence: string };
  music: MusicBrief[];
}

const record = JSON.parse(readFileSync(RECORDS, 'utf8')) as Record_;
const [command = 'help', ...rest] = process.argv.slice(2);
const again = rest.includes('--again');
const wanted = rest.filter((a) => !a.startsWith('--'));
const briefs = record.music.filter((b) => wanted.length === 0 || wanted.includes(b.id));
const OUT = resolve(ROOT, 'art', 'out', 'music');
const promptFor = (b: MusicBrief) => `${record.lyria.style}\n\n${b.subject}`;
const candidates = (id: string) =>
  existsSync(join(OUT, id))
    ? readdirSync(join(OUT, id))
        .filter((f) => /^\d+\.(mp3|wav)$/.test(f))
        .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    : [];

/**
 * One Lyria request, tried again up to twice when its filter refuses: in Control the same prompt
 * was refused once and taken the next time (21 October 2026), and here the combat brief was refused
 * once as "prohibited content" and taken on the next try (24 October 2026).
 */
async function lyria(prompt: string): Promise<{ bytes: Uint8Array; mime: string; note?: string }> {
  const key = requireKey('GEMINI_API_KEY');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: record.lyria.model,
        input: [{ type: 'text', text: prompt }],
        response_format: { type: 'audio' },
        store: false,
      }),
    });
    if (res.ok) {
      type Block = { type?: string; text?: string; data?: string; mime_type?: string };
      const body = (await res.json()) as { status?: string; steps?: { type?: string; content?: Block[] }[] };
      const blocks = (body.steps ?? []).filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []);
      const audio = blocks.filter((b) => b.type === 'audio' && b.data).at(-1);
      if (!audio?.data) throw new Error(`Lyria returned no audio (status ${body.status ?? 'unknown'})`);
      const note = blocks
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text)
        .join(' ')
        .trim();
      return {
        bytes: new Uint8Array(Buffer.from(audio.data, 'base64')),
        mime: audio.mime_type ?? 'audio/mpeg',
        note: note || undefined,
      };
    }
    const text = await res.text();
    if (attempt < 2 && (/content_blocked|prohibited_content/.test(text) || res.status === 429 || res.status >= 500)) {
      console.log('  refused or busy; trying again');
      await new Promise((d) => setTimeout(d, 5000));
      continue;
    }
    throw new Error(`Gemini answered ${res.status}: ${text.slice(0, 400)}`);
  }
}

async function generate(): Promise<void> {
  const jobs = briefs.flatMap((b) =>
    Array.from({ length: b.candidates ?? record.lyria.candidates }, (_, i) => ({ b, n: i + 1 })),
  );
  await pool(jobs, 3, async ({ b, n }) => {
    const dir = join(OUT, b.id);
    if (!again && candidates(b.id).some((f) => Number.parseInt(f, 10) === n)) return;
    mkdirSync(dir, { recursive: true });
    const prompt = promptFor(b);
    const music = await lyria(prompt);
    const ext = music.mime.includes('wav') ? 'wav' : 'mp3';
    writeFileSync(join(dir, `${n}.${ext}`), music.bytes);
    writeFileSync(
      join(dir, `${n}.json`),
      `${JSON.stringify(
        {
          id: b.id,
          candidate: n,
          service: 'Google Lyria (Gemini API, Interactions)',
          model: record.lyria.model,
          prompt,
          made: new Date().toISOString(),
          note: music.note,
          sha256: sha256(music.bytes),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`${b.id} #${n}: ${(music.bytes.length / 1024 / 1024).toFixed(1)} MB`);
  });
}

async function pick(): Promise<void> {
  await pool(
    briefs.filter((b) => candidates(b.id).length > 1),
    2,
    async (b) => {
      const files = candidates(b.id);
      const result = await rank(
        files.map((f) => forEar(decode(join(OUT, b.id, f), 2))),
        (labels) =>
          [
            `These are ${files.length} candidate pieces of music (${labels}) for a grounded, melancholy science-fiction game.`,
            `The piece is for: ${b.what}. Its brief: "${b.subject}"`,
            "All the game's music should share one palette: synthesiser pads, low strings, sparse piano and glassy textures; instrumental only.",
            b.loop
              ? 'It will be looped, so an even, steady character with no big ending is better.'
              : 'It plays once and should end resolved, fading to silence.',
            'Rate each from 1 to 10 for how well it fits the brief, note any flaw in a few words (vocals or choir, a style that does not fit,',
            'abrupt changes, distortion, an ending that cuts off), and choose the best.',
          ].join(' '),
      );
      const review = {
        id: b.id,
        model: EAR_MODEL,
        how: 'asked twice, the candidates in opposite orders; ratings averaged',
        asked: new Date().toISOString(),
        best: Number.parseInt(files[result.best] as string, 10),
        candidates: Object.fromEntries(
          files.map((f, i) => [Number.parseInt(f, 10), { rating: result.ratings[i], note: result.notes[i] }]),
        ),
      };
      writeFileSync(join(OUT, b.id, 'pick.json'), `${JSON.stringify(review, null, 2)}\n`);
      console.log(`${b.id}: #${review.best} (${result.ratings.join(' / ')})`);
    },
  );
}

function chosen(b: MusicBrief): string | undefined {
  const files = candidates(b.id);
  const review = join(OUT, b.id, 'pick.json');
  const n = b.pick ?? (existsSync(review) ? (JSON.parse(readFileSync(review, 'utf8')) as { best: number }).best : 1);
  return files.find((f) => Number.parseInt(f, 10) === n);
}

const round = (x: number, places = 3) => Math.round(x * 10 ** places) / 10 ** places;

function build(): void {
  const entries: Record<string, ManifestEntry> = {};
  const outputs: Record<string, unknown> = {};
  mkdirSync(join(PUBLIC_AUDIO, 'music'), { recursive: true });
  for (const b of briefs) {
    const file = chosen(b);
    if (!file) {
      console.warn(`skip ${b.id}: no candidate yet (node scripts/art/music.ts generate ${b.id})`);
      continue;
    }
    const n = Number.parseInt(file, 10);
    const made = JSON.parse(readFileSync(join(OUT, b.id, `${n}.json`), 'utf8')) as Record<string, unknown>;
    let pcm = trimQuiet(decode(join(OUT, b.id, file), 2), -60, 0.02);
    const level = normalise(pcm, MUSIC_LUFS, 'integrated', CEILING_DB, 3);
    pcm = level.pcm;
    let entry: ManifestEntry;
    let loopReport: Record<string, number | string> | undefined;
    if (b.loop) {
      const length = seconds(pcm);
      const maxS = Math.min(b.loop.maxS, length - 16);
      const minS = Math.min(b.loop.minS, maxS - 5);
      const found = findLoop(pcm, { minS, maxS, startAfterS: 6, endBeforeS: 6, windowS: 3, goodDb: MATCH_DB });
      // A close match inside the piece loops there; otherwise the whole piece loops, its quiet end
      // crossfaded into its soft opening, as a piece that ends and begins again.
      const inside = found.score <= MATCH_DB;
      const x = inside ? CROSSFADE_S : WHOLE_CROSSFADE_S;
      const looped = inside ? loopBetween(pcm, found.a, found.b, x) : loopBetween(pcm, x, length, x);
      // A crossfade can raise a peak: turn the whole piece down rather than limit it, so the join stays clean.
      const over = peakDb(looped.pcm) - CEILING_DB;
      pcm = fade(over > 0 ? gain(looped.pcm, -over) : looped.pcm, 0.05, 0);
      entry = {
        file: `music/${b.id}.mp3`,
        seconds: round(seconds(pcm)),
        loop: true,
        loopStart: round(looped.loopStart, 4),
        loopEnd: round(looped.loopEnd, 4),
      };
      loopReport = {
        how: inside
          ? 'inside the piece, where the music either side of both points matched'
          : 'the whole piece: no close match inside it, so its end is crossfaded into its opening',
        loopStart: entry.loopStart as number,
        loopEnd: entry.loopEnd as number,
        bestMatchInsideDb: found.score,
        ...(inside ? { onsetMatch: found.onsetMatch, bpm: found.bpm, beats: found.beats } : {}),
        crossfadeSeconds: x,
        candidateSeconds: round(length, 1),
      };
    } else {
      // Plays once: keep the whole piece, make sure it begins and ends softly.
      pcm = fade(pcm, 0.05, 2.5);
      entry = { file: `music/${b.id}.mp3`, seconds: round(seconds(pcm)), loop: false };
    }
    const bytes = encodeMp3(pcm, BITRATE);
    writeFileSync(join(PUBLIC_AUDIO, entry.file), bytes);
    entries[b.id] = entry;
    const reviewPath = join(OUT, b.id, 'pick.json');
    outputs[`music/${b.id}.mp3`] = {
      id: b.id,
      what: b.what,
      licence: record.lyria.licence,
      sources: [
        {
          kind: 'Google Lyria',
          model: made.model,
          prompt: made.prompt,
          made: made.made,
          note: made.note,
          candidate: n,
          of: candidates(b.id).length,
          chosenBy: b.pick
            ? (b.pickNote ?? 'the owner')
            : existsSync(reviewPath)
              ? `Gemini (${EAR_MODEL}) listening`
              : 'default',
          candidateSha256: made.sha256,
          aiGenerated: true,
          watermark: 'SynthID',
        },
      ],
      processing: {
        ...(loopReport ? { loop: loopReport } : { fadeOutSeconds: 2.5 }),
        gainDb: level.gainDb,
        loudness: `${round(loudness(pcm).integrated, 1)} LUFS integrated`,
        peakDb: round(peakDb(pcm), 1),
        encoding: `MP3 stereo 44.1 kHz ${BITRATE}`,
      },
      seconds: entry.seconds,
      bytes: bytes.length,
      sha256: sha256(bytes),
      built: new Date().toISOString().slice(0, 10),
    };
    console.log(
      `${b.id}: #${n}, ${entry.seconds} s, ${(bytes.length / 1024 / 1024).toFixed(2)} MB, ${level.gainDb} dB${
        loopReport
          ? `, loop ${loopReport.loopStart}–${loopReport.loopEnd} s (${loopReport.how === undefined ? '' : String(loopReport.how).split(':')[0]}, best match inside ${loopReport.bestMatchInsideDb} dB)`
          : ''
      }`,
    );
  }
  updateManifest('music', entries);
  updateRecords(outputs);
}

/** A stretch either side of a loop's join, for listening to the seam (art/out/music/<id>/seam.mp3). */
export function seamExcerpt(id: string): void {
  const entryFile = join(PUBLIC_AUDIO, 'music', `${id}.mp3`);
  const manifest = JSON.parse(readFileSync(join(PUBLIC_AUDIO, 'audio.json'), 'utf8')) as {
    music: Record<string, ManifestEntry>;
  };
  const e = manifest.music[id];
  if (!e?.loop || e.loopStart === undefined || e.loopEnd === undefined) return;
  const p = decode(entryFile, 2);
  const before = slice(p, e.loopEnd - 8, e.loopEnd);
  const after = slice(p, e.loopStart, e.loopStart + 8);
  const joined = { ch: before.ch.map((c, i) => Float32Array.from([...c, ...(after.ch[i] ?? [])])) };
  writeFileSync(join(OUT, id, 'seam.mp3'), encodeMp3(joined, '128k'));
}

switch (command) {
  case 'generate':
    await generate();
    break;
  case 'pick':
    await pick();
    break;
  case 'build':
    build();
    for (const b of briefs) if (b.loop && existsSync(join(OUT, b.id))) seamExcerpt(b.id);
    break;
  case 'all':
    await generate();
    await pick();
    build();
    for (const b of briefs) if (b.loop && existsSync(join(OUT, b.id))) seamExcerpt(b.id);
    break;
  default:
    console.log(readFileSync(import.meta.filename, 'utf8').split('*/')[0]);
    process.exit(command === 'help' ? 0 : 1);
}
