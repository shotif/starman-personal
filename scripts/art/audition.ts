/**
 * Auditions voices for a part (docs/assets/VOICES.md §2): each candidate reads the same line, the
 * take is heard back by speech to text and measured (length, pace, median pitch), and the takes are
 * kept in art/out/voices/audition/ (ignored by git) with their measures, to choose from. A candidate
 * from ElevenLabs' library is added to the account first (a voice slot: D-63); one that is not chosen
 * can be taken off again with `--remove`.
 *
 *   node scripts/art/audition.ts <part> "<line>" "[direction]" <voice> [voice ...]
 *        a voice is a stock voice's id, or `library:<owner id>/<voice id>/<name>`
 *   node scripts/art/audition.ts --remove <voice id> [voice id ...]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { optionalKey, requireKey } from './env.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'art', 'out', 'voices', 'audition');
const BASE = optionalKey('ELEVENLABS_API_BASE') ?? 'https://api.elevenlabs.io';
const MODEL = 'eleven_v4';
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 };

async function eleven(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string>), 'xi-api-key': requireKey('ELEVENLABS_API_KEY') };
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!response.ok)
    throw new Error(
      `ElevenLabs ${path.split('?')[0]}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  return response;
}

/** A stock voice as it is, or a library voice added to the account: its id there, and a name. */
async function voiceOf(spec: string): Promise<{ id: string; name: string }> {
  if (!spec.startsWith('library:')) {
    const all = (await (await eleven('/v1/voices')).json()) as { voices: { voice_id: string; name: string }[] };
    const v = all.voices.find((x) => x.voice_id === spec);
    return { id: spec, name: v?.name.split(' ')[0] ?? spec };
  }
  const [owner = '', id = '', name = id] = spec.slice('library:'.length).split('/');
  const mine = (await (await eleven('/v1/voices')).json()) as { voices: { voice_id: string; name: string }[] };
  const label = `Lightkeeper ${name}`;
  const have = mine.voices.find((v) => v.name === label);
  if (have) return { id: have.voice_id, name };
  const added = (await (
    await eleven(`/v1/voices/add/${owner}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: label }),
    })
  ).json()) as { voice_id: string };
  return { id: added.voice_id, name };
}

function decode(mp3: Buffer): Int16Array {
  const dir = mkdtempSync(join(tmpdir(), 'audition-'));
  try {
    writeFileSync(join(dir, 'take.mp3'), mp3);
    execFileSync('/usr/bin/afconvert', [
      '-f',
      'WAVE',
      '-d',
      'LEI16@22050',
      '-c',
      '1',
      join(dir, 'take.mp3'),
      join(dir, 'take.wav'),
    ]);
    const wav = readFileSync(join(dir, 'take.wav'));
    for (let at = 12; at + 8 <= wav.length; ) {
      const size = wav.readUInt32LE(at + 4);
      if (wav.toString('ascii', at, at + 4) === 'data') {
        const data = wav.subarray(at + 8, at + 8 + size);
        return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
      }
      at += 8 + size + (size % 2);
    }
    throw new Error('no audio');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The median pitch of the voiced frames, by autocorrelation (70 to 400 Hz), at 22.05 kHz. */
function medianPitch(samples: Int16Array, rate = 22050): number {
  const frame = 1024;
  const pitches: number[] = [];
  for (let start = 0; start + frame < samples.length; start += frame / 2) {
    let energy = 0;
    for (let i = 0; i < frame; i++) energy += (samples[start + i] ?? 0) ** 2;
    if (Math.sqrt(energy / frame) < 900) continue;
    let best = 0;
    let lag = 0;
    for (let l = Math.floor(rate / 400); l <= Math.floor(rate / 70); l++) {
      let sum = 0;
      for (let i = 0; i + l < frame; i++) sum += (samples[start + i] ?? 0) * (samples[start + i + l] ?? 0);
      if (sum > best) {
        best = sum;
        lag = l;
      }
    }
    if (lag && best / energy > 0.45) pitches.push(rate / lag);
  }
  pitches.sort((a, b) => a - b);
  return Math.round(pitches[Math.floor(pitches.length / 2)] ?? 0);
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const args = process.argv.slice(2);
if (args[0] === '--remove') {
  for (const id of args.slice(1)) {
    await eleven(`/v1/voices/${id}`, { method: 'DELETE' });
    console.log(`removed ${id}`);
  }
  process.exit(0);
}
const [part = '', line = '', direction = '', ...candidates] = args;
if (!part || !line || candidates.length === 0)
  throw new Error('usage: audition.ts <part> "<line>" "[direction]" <voice> ...');
mkdirSync(OUT, { recursive: true });
const measuresFile = join(OUT, 'auditions.json');
const measures = existsSync(measuresFile)
  ? (JSON.parse(readFileSync(measuresFile, 'utf8')) as Record<string, unknown>)
  : {};
for (const spec of candidates) {
  const voice = await voiceOf(spec);
  const tts = await eleven(`/v1/text-to-speech/${voice.id}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `${direction} ${line}`.trim(), model_id: MODEL, voice_settings: SETTINGS, seed: 7 }),
  });
  const audio = Buffer.from(await tts.arrayBuffer());
  const file = `${part}-${voice.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp3`;
  writeFileSync(join(OUT, file), audio);
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'en');
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), 'take.mp3');
  const heard = (
    (await (await eleven('/v1/speech-to-text', { method: 'POST', body: form })).json()) as { text: string }
  ).text;
  const said = words(line);
  const got = new Set(words(heard));
  const samples = decode(audio);
  const seconds = samples.length / 22050;
  const m = {
    part,
    voice: voice.name,
    id: voice.id,
    seconds: Math.round(seconds * 100) / 100,
    pace: Math.round((line.length / seconds) * 10) / 10,
    pitch: medianPitch(samples),
    heard: Math.round((said.filter((w) => got.has(w)).length / said.length) * 100) / 100,
    transcript: heard,
  };
  measures[file] = m;
  console.log(`${file}: ${m.seconds} s, pace ${m.pace}, pitch ${m.pitch} Hz, heard ${m.heard}`);
}
writeFileSync(measuresFile, `${JSON.stringify(measures, null, 2)}\n`);
