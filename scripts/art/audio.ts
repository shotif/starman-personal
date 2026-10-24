/**
 * Makes the slice's sound effects (docs/assets/AUDIO.md, D-45): CC0 libraries first (Kenney's packs,
 * OpenGameArt's CC0 part), ElevenLabs' sound effects for what they lack. The briefs and every record
 * are in art/audio.json; the finished files go to public/assets/audio/sfx/ with the game's
 * manifest, public/assets/audio/audio.json.
 *
 *   node scripts/art/audio.ts fetch              # download and unpack the CC0 packs (art/cache/kenney-audio/, oga-audio/)
 *   node scripts/art/audio.ts generate [id ...]  # ElevenLabs candidates not made yet (--again makes new ones)
 *   node scripts/art/audio.ts pick [id ...]      # Gemini listens to each brief's candidates and picks one
 *   node scripts/art/audio.ts build [id ...]     # trims, layers, loops, levels, encodes; writes the manifest
 *   node scripts/art/audio.ts listen [id ...]    # Gemini describes each finished file against its brief
 *   node scripts/art/audio.ts all                # fetch, generate, pick and build
 *
 * A brief's "pick" (a take's number) overrules Gemini's choice. Keys come from the git-ignored .env
 * (scripts/art/env.ts) and are sent only to their own service.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { optionalKey, requireKey } from './env.ts';
import {
  decode,
  EAR_MODEL,
  ear,
  encodeMp3,
  fade,
  filterPcm,
  forEar,
  gain,
  loudness,
  type ManifestEntry,
  mix,
  normalise,
  type Pcm,
  PUBLIC_AUDIO,
  peakDb,
  pool,
  RATE,
  RECORDS,
  ROOT,
  rank,
  seamless,
  seconds,
  sha256,
  trimQuiet,
  updateManifest,
  updateRecords,
  wav,
  wrapSeam,
} from './sound.ts';

/** Every effect's loudness before the game's own volume: its loudest 400 ms, or a loop's whole. */
const ONE_SHOT_LUFS = -16;
const LOOP_LUFS = -18;
const CEILING_DB = -1.5;
const BITRATE = '96k';

interface Layer {
  pack: string;
  file: string;
  at?: number;
  db?: number;
  filter?: string;
}
interface Eleven {
  prompt: string;
  seconds: number;
  loop?: boolean;
  influence?: number;
  candidates?: number;
}
interface SfxBrief {
  id: string;
  what: string;
  /** Files from the CC0 packs in `sources`, layered. */
  library?: Layer[];
  eleven?: Eleven;
  pick?: number;
  /** Who chose `pick`, and how. */
  pickNote?: string;
  /** What was tried first and why it was not used. */
  tried?: string;
  filter?: string;
  fadeOut?: number;
  /** A loop. `xfade` 0 keeps the generator's own join (for rhythms); left out, a crossfade is made only if the join measures rough. */
  loop?: { xfade?: number };
  volume: number;
}
interface Source {
  id: string;
  /** Where it comes from (Kenney or OpenGameArt) and the folder under art/cache/ it is kept in. */
  site: string;
  cache: string;
  /** The folder it unpacks to, inside `cache` (the archive's name without its extension if left out). */
  unpackTo?: string;
  name: string;
  author: string;
  licence: string;
  licenceUrl: string;
  page: string;
  url: string;
  file: string;
  bytes: number;
  sha256: string;
}
interface Record_ {
  sources: Source[];
  elevenlabs: { model: string; candidates: number; licence: string };
  sfx: SfxBrief[];
}

const record = JSON.parse(readFileSync(RECORDS, 'utf8')) as Record_;
const [command = 'help', ...rest] = process.argv.slice(2);
const again = rest.includes('--again');
const wanted = rest.filter((a) => !a.startsWith('--'));
const briefs = record.sfx.filter((b) => wanted.length === 0 || wanted.includes(b.id));
const CACHE = resolve(ROOT, 'art', 'cache');
const OUT = resolve(ROOT, 'art', 'out', 'audio');
const unpacked = (s: Source) => join(CACHE, s.cache, s.unpackTo ?? s.file.replace(/\.(zip|7z)$/, ''));
const packDir = (pack: string) => {
  const source = record.sources.find((s) => s.id === pack);
  if (!source) throw new Error(`no source ${pack} in art/audio.json`);
  return unpacked(source);
};
/** The only hosts a pack is downloaded from. */
const TRUSTED = ['kenney.nl', 'opengameart.org'];
const candidates = (id: string) =>
  existsSync(join(OUT, id))
    ? readdirSync(join(OUT, id))
        .filter((f) => /^\d+\.wav$/.test(f))
        .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    : [];

// ---------------------------------------------------------------------------------------------

/**
 * Downloads each CC0 pack once (checked against its recorded checksum) and unpacks it, with the
 * system's unzip or tar: nothing inside a pack is ever run.
 */
async function fetchPacks(): Promise<void> {
  for (const s of record.sources) {
    mkdirSync(join(CACHE, s.cache), { recursive: true });
    const zip = join(CACHE, s.cache, s.file);
    if (!existsSync(zip)) {
      if (!TRUSTED.includes(new URL(s.url).host)) throw new Error(`${s.id}: refusing a download from ${s.url}`);
      const res = await fetch(s.url);
      if (!res.ok) throw new Error(`${s.id}: HTTP ${res.status}`);
      writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    }
    const sum = sha256(readFileSync(zip));
    if (sum !== s.sha256) throw new Error(`${s.id}: checksum ${sum} is not the recorded ${s.sha256}`);
    const dir = unpacked(s);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      const r = zip.endsWith('.zip')
        ? spawnSync('unzip', ['-q', '-o', zip, '-d', dir])
        : spawnSync('tar', ['-xf', zip, '-C', dir]);
      if (r.status !== 0) throw new Error(`${s.id}: unpacking failed`);
    }
    console.log(`${s.id}: ready in art/cache/${s.cache}/${basename(dir)}/`);
  }
}

/** ElevenLabs candidates for every brief that asks for them, saved as WAV with a record beside each. */
async function generate(): Promise<void> {
  const key = requireKey('ELEVENLABS_API_KEY');
  const base = optionalKey('ELEVENLABS_API_BASE') ?? 'https://api.elevenlabs.io';
  const jobs = briefs.flatMap((b) => {
    if (!b.eleven) return [];
    const count = b.eleven.candidates ?? record.elevenlabs.candidates;
    return Array.from({ length: count }, (_, i) => ({ brief: b, eleven: b.eleven as Eleven, n: i + 1 }));
  });
  await pool(jobs, 4, async ({ brief, eleven, n }) => {
    const dir = join(OUT, brief.id);
    const file = join(dir, `${n}.wav`);
    if (existsSync(file) && !again) return;
    mkdirSync(dir, { recursive: true });
    const body = {
      text: eleven.prompt,
      duration_seconds: eleven.seconds,
      prompt_influence: eleven.influence ?? 0.5,
      loop: eleven.loop ?? false,
      model_id: record.elevenlabs.model,
    };
    let bytes: Uint8Array | undefined;
    for (let attempt = 0; attempt < 3 && !bytes; attempt++) {
      const res = await fetch(`${base}/v1/sound-generation?output_format=pcm_44100`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify(body),
      });
      if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
      else if (res.status === 429 || res.status >= 500) await new Promise((d) => setTimeout(d, 4000 * (attempt + 1)));
      else throw new Error(`${brief.id}: ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    if (!bytes) throw new Error(`${brief.id}: ElevenLabs was busy three times`);
    // 16-bit samples; stereo unless the length says one channel.
    const channels = Math.abs(bytes.length / (eleven.seconds * RATE * 2) - 1) < 0.2 ? 1 : 2;
    const out = wav(bytes, channels);
    writeFileSync(file, out);
    writeFileSync(
      join(dir, `${n}.json`),
      `${JSON.stringify(
        {
          id: brief.id,
          candidate: n,
          service: 'ElevenLabs sound effects',
          endpoint: '/v1/sound-generation',
          model: record.elevenlabs.model,
          prompt: eleven.prompt,
          seconds: eleven.seconds,
          loop: eleven.loop ?? false,
          promptInfluence: eleven.influence ?? 0.5,
          made: new Date().toISOString(),
          channels,
          sha256: sha256(out),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`${brief.id} #${n}: ${(out.length / 1024).toFixed(0)} KB`);
  });
}

/** Gemini listens to a brief's candidates and picks the best; its notes are kept for the owner. */
async function pick(): Promise<void> {
  await pool(
    briefs.filter((b) => b.eleven && candidates(b.id).length > 1),
    3,
    async (b) => {
      const files = candidates(b.id);
      const result = await rank(
        files.map((f) => forEar(decode(join(OUT, b.id, f), 2))),
        (labels) =>
          [
            `These are ${files.length} candidate sound effects (${labels}) for one moment in a video game.`,
            `The moment: ${b.what}. The brief given to the sound generator: "${b.eleven?.prompt}"`,
            'The game is grounded, semi-realistic science fiction with a melancholy, tense tone: nothing cartoonish, retro or comic.',
            'Rate each candidate from 1 to 10 for how well it fits the brief and the tone, note any flaw in a few words (wrong sound,',
            'music or voices where none were asked for, clipping, distortion, long silence, a sound that does not end cleanly), and choose the best.',
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

/** The candidate a brief uses: its own "pick", else Gemini's, else the first. */
function chosen(b: SfxBrief): number {
  if (b.pick) return b.pick;
  const review = join(OUT, b.id, 'pick.json');
  if (existsSync(review)) return (JSON.parse(readFileSync(review, 'utf8')) as { best: number }).best;
  return 1;
}

const round = (x: number, places = 3) => Math.round(x * 10 ** places) / 10 ** places;

function build(): void {
  const entries: Record<string, ManifestEntry> = {};
  const outputs: Record<string, unknown> = {};
  mkdirSync(join(PUBLIC_AUDIO, 'sfx'), { recursive: true });
  for (const b of briefs) {
    let pcm: Pcm;
    let sources: unknown[];
    let licence: string;
    if (b.library) {
      pcm = mix(
        b.library.map((l) => ({ pcm: decode(join(packDir(l.pack), l.file), 1, l.filter), at: l.at, db: l.db })),
      );
      sources = b.library.map((l) => {
        const s = record.sources.find((x) => x.id === l.pack) as Source;
        return {
          kind: s.site,
          pack: s.name,
          author: s.author,
          page: s.page,
          file: l.file,
          ...(l.at ? { atSeconds: l.at } : {}),
          ...(l.db ? { gainDb: l.db } : {}),
          licence: 'CC0-1.0',
        };
      });
      licence = 'CC0-1.0';
    } else if (b.eleven) {
      const n = chosen(b);
      const file = join(OUT, b.id, `${n}.wav`);
      if (!existsSync(file)) {
        console.warn(`skip ${b.id}: candidate #${n} not made yet (node scripts/art/audio.ts generate ${b.id})`);
        continue;
      }
      const made = JSON.parse(readFileSync(join(OUT, b.id, `${n}.json`), 'utf8')) as Record<string, unknown>;
      const review = join(OUT, b.id, 'pick.json');
      pcm = decode(file, 1);
      sources = [
        {
          kind: 'ElevenLabs',
          model: made.model,
          prompt: made.prompt,
          seconds: made.seconds,
          loop: made.loop,
          promptInfluence: made.promptInfluence,
          made: made.made,
          candidate: n,
          of: candidates(b.id).length,
          chosenBy: b.pick
            ? (b.pickNote ?? 'the owner')
            : existsSync(review)
              ? `Gemini (${EAR_MODEL}) listening, asked twice in opposite orders`
              : 'default',
          candidateSha256: made.sha256,
          aiGenerated: true,
        },
      ];
      licence = record.elevenlabs.licence;
    } else throw new Error(`${b.id}: no source`);

    if (b.filter) pcm = filterPcm(pcm, b.filter);
    let entry: ManifestEntry;
    let gainDb: number;
    let loopReport: Record<string, unknown> | undefined;
    if (b.loop) {
      const level = normalise(pcm, LOOP_LUFS, 'integrated', CEILING_DB);
      gainDb = level.gainDb;
      const join = wrapSeam(level.pcm);
      const xfade = b.loop.xfade ?? (join.rough ? Math.min(1.5, 0.15 * seconds(level.pcm)) : 0);
      const looped = seamless(level.pcm, xfade);
      // A crossfade can raise a peak: turn the whole loop down rather than limit it, so the join stays clean.
      const over = peakDb(looped.pcm) - CEILING_DB;
      pcm = over > 0 ? gain(looped.pcm, -over) : looped.pcm;
      gainDb = Math.round((gainDb - Math.max(0, over)) * 10) / 10;
      entry = {
        file: `sfx/${b.id}.mp3`,
        seconds: round(seconds(pcm)),
        loop: true,
        loopStart: round(looped.loopStart, 4),
        loopEnd: round(looped.loopEnd, 4),
        volume: b.volume,
      };
      loopReport = {
        generatorJoin: { jumpRatio: join.jumpRatio, levelStepDb: join.levelStepDb, usualStepDb: join.usualStepDb },
        crossfadeSeconds: round(xfade, 2),
        why:
          b.loop.xfade === 0
            ? "a rhythm: the generator's own join is kept"
            : xfade > 0
              ? 'the join measured rough, so the end is crossfaded into the start'
              : "the generator's own join measured clean and is kept",
      };
    } else {
      pcm = trimQuiet(pcm, -50);
      pcm = trimQuiet(pcm, -60); // the tail, more gently
      pcm = fade(pcm, 0.002, b.fadeOut ?? 0.02);
      const level = normalise(pcm, ONE_SHOT_LUFS, 'momentary', CEILING_DB);
      pcm = level.pcm;
      gainDb = level.gainDb;
      entry = { file: `sfx/${b.id}.mp3`, seconds: round(seconds(pcm)), loop: false, volume: b.volume };
    }
    const bytes = encodeMp3(pcm, BITRATE);
    writeFileSync(join(PUBLIC_AUDIO, entry.file), bytes);
    entries[b.id] = entry;
    const l = loudness(pcm);
    outputs[`sfx/${b.id}.mp3`] = {
      id: b.id,
      what: b.what,
      licence,
      sources,
      ...(b.tried ? { tried: b.tried } : {}),
      processing: {
        ...(b.filter ? { filter: b.filter } : {}),
        ...(b.loop ? { loop: loopReport } : { trimmed: 'quiet before and after', fadeOutSeconds: b.fadeOut ?? 0.02 }),
        gainDb,
        loudness: b.loop
          ? `${round(l.integrated, 1)} LUFS integrated`
          : `${round(l.momentaryMax, 1)} LUFS momentary maximum`,
        peakDb: round(peakDb(pcm), 1),
        encoding: `MP3 mono 44.1 kHz ${BITRATE}`,
      },
      seconds: entry.seconds,
      bytes: bytes.length,
      sha256: sha256(bytes),
      built: new Date().toISOString().slice(0, 10),
    };
    console.log(
      `${b.id}: ${entry.seconds} s, ${(bytes.length / 1024).toFixed(1)} KB, ${gainDb > 0 ? '+' : ''}${gainDb} dB${loopReport ? `, seam ${JSON.stringify(loopReport)}` : ''}`,
    );
  }
  updateManifest('sfx', entries);
  updateRecords(outputs);
}

/** Gemini describes each finished file against its brief, for the owner and for checking (not the game). */
async function listen(): Promise<void> {
  const notes: Record<string, string> = {};
  await pool(
    briefs.filter((b) => existsSync(join(PUBLIC_AUDIO, 'sfx', `${b.id}.mp3`))),
    4,
    async (b) => {
      const bytes = forEar(decode(join(PUBLIC_AUDIO, 'sfx', `${b.id}.mp3`), 1));
      notes[b.id] = await ear(
        [{ label: 'A', bytes, mime: 'audio/mp3' }],
        `A sound effect for a grounded, melancholy science-fiction game. It is meant to be: ${b.what}${
          b.eleven ? ` (asked of the generator as: "${b.eleven.prompt}")` : ''
        }. In at most two sentences: what do you actually hear, and does it fit (score 1-10)? Mention any flaw.`,
      );
      console.log(`${b.id}: ${notes[b.id]}`);
    },
  );
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, 'listen.json');
  const before = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>) : {};
  writeFileSync(path, `${JSON.stringify({ ...before, ...notes, model: EAR_MODEL }, null, 2)}\n`);
}

switch (command) {
  case 'fetch':
    await fetchPacks();
    break;
  case 'generate':
    await generate();
    break;
  case 'pick':
    await pick();
    break;
  case 'build':
    build();
    break;
  case 'listen':
    await listen();
    break;
  case 'all':
    await fetchPacks();
    await generate();
    await pick();
    build();
    break;
  default:
    console.log(readFileSync(import.meta.filename, 'utf8').split('*/')[0]);
    process.exit(command === 'help' ? 0 : 1);
}
