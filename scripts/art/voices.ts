/**
 * Voices every spoken line of the slice (story/slice.ink) with ElevenLabs text to speech (D-23): each
 * person in a premade voice of the owner's plan, the hero twice, in a man's and a woman's voice
 * (D-09). Each take is heard back by speech to text and made again if words are lost or it is
 * clearly wrong, then published to public/assets/voices/ with a manifest the game reads
 * (src/game/audio.ts): length, a loudness envelope at 20 a second for lip sync (D-31), and which
 * lines come over the radio. art/voices.json records each file's text, hash, voice, model, settings
 * and date (D-28); a line whose text, direction, voice and settings are unchanged is not made again.
 * The cast and the method are in docs/assets/VOICES.md. Fiction, all of it.
 *
 *   node scripts/art/voices.ts [line ...]          # every line, or those named (ids, or files such as x.man.mp3)
 *   node scripts/art/voices.ts --again [line ...]  # a new take of each, from a new seed, even if unchanged
 *   node scripts/art/voices.ts --list              # the parsed lines and their stitching; no key needed
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { optionalKey, requireKey } from './env.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(ROOT, 'story', 'slice.ink');
const OUT = join(ROOT, 'public', 'assets', 'voices');
const MANIFEST = join(OUT, 'voices.json');
const RECORDS = join(ROOT, 'art', 'voices.json');

/** Chosen by measure on 24 October 2026 (VOICES.md §3): the only model with stitching and delivery tags. */
const MODEL = 'eleven_v4';
/** Mono MP3, 44.1 kHz, 64 kbps: about 8 KB a second. */
const FORMAT = 'mp3_44100_64';
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 } as const;
const STT_MODEL = 'scribe_v2';
/** How much of a line must be heard back for a take to stand, and how many takes to try. */
const HEARD = 0.9;
const TRIES = 4;
const PARALLEL = 4;
const ENVELOPE_RATE = 20;
/** The shortest line given the next line's text for stitching. */
const NEXT_FROM = 30;
/** The speech level every line is brought to by its `gain` in the manifest (RMS of the speech, dBFS). */
const SPEECH_LEVEL = -20;

interface Voice {
  id: string;
  name: string;
}

/** ElevenLabs premade voices (none added to the account, D-103 in Control); why each is in VOICES.md. */
const CAST: Record<string, Voice> = {
  Ren: { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  Jo: { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
  Hale: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  Pell: { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave' },
  Dena: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  Sorrel: { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill' },
  Ilya: { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  Merrow: { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' },
};
const HERO: Record<'man' | 'woman', Voice> = {
  man: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  woman: { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
};

/** Heard over comms: the game puts these through a radio's band. */
const RADIO = new Set([
  'hale_call_01',
  'hale_gate_01',
  'pell_relay_01',
  'pell_relay_02',
  'pell_relay_03',
  'pell_escort_01',
  'merrow_01',
]);

/**
 * How a line is delivered: a tag the model reads but does not speak. Each conversation has one, so
 * its lines sound alike; a line changes it only where the feeling changes. The hero's follow the
 * manner of the choice (D-12).
 */
const SCENE: Record<string, string> = {
  ren_night: '[dry, quiet]',
  dena_night: '[warm, motherly]',
  sorrel_night: '[soft, slow]',
  ilya_night: '[eager, nervous]',
  dena_dark: '[frightened]',
  hale_control: '[grave, tired, authoritative]',
  pell_gate: '[hurried, anxious]',
  dena_loss: '[grieving, shaken]',
  dena_escort: '[relieved, frightened]',
  jo_meet: '[brash, quick]',
  jo_name: '[wry, tired]',
  ren_bridge: '[quiet, tired]',
  jo_bridge: '[wry, relaxed]',
  sorrel_dark: '[low, haunted]',
  ilya_dark: '[anxious, quick]',
  dena_ship: '[tired, warm]',
  sorrel_ship: '[soft, slow]',
  pell_ship: '[quiet, rueful]',
  ilya_ship: '[earnest, tired]',
  ren_aboard: '[quiet, thoughtful]',
  jo_aboard: '[wry, cheerful]',
  dena_aboard: '[warm, tired]',
  sorrel_aboard: '[soft, slow, remembering]',
  pell_aboard: '[low, worried]',
  ilya_aboard: '[eager, quick]',
  jo_course: '[steady, dry]',
};
const LINE: Record<string, string> = {
  ren_drill_01: '[calm, instructing]',
  ren_drill_02: '[pleased]',
  ren_drill_orders: '[calm, instructing]',
  ren_walk_files: '[quiet, bitter]',
  ren_walk_gate: '[low, steady]',
  ren_catwalk_02: '[breathing hard, uneasy]',
  dena_escort_04: '[firm, frightened, motherly]',
  ren_drill_powers: '[calm, instructing, a little amused]',
  hale_call_01: '[urgent, commanding]',
  ren_drill_03: '[quiet, alarmed]',
  ren_spine_01: '[quietly, uneasy]',
  ren_spine_02: '[uneasy]',
  ren_concourse_01: '[shouting, urgent]',
  ren_concourse_02: '[breathing hard, wry]',
  ren_catwalk_01: '[low, urgent]',
  pell_relay_01: '[urgent, clear]',
  pell_relay_02: '[excited, relieved]',
  pell_relay_03: '[panicking]',
  ren_escort_01: '[shouting, urgent]',
  pell_escort_01: '[out of breath, worried]',
  hale_gate_01: '[tired, calm, resigned]',
  jo_hangar_01: '[shouting]',
  jo_hangar_02: '[shouting, quick]',
  jo_hangar_03: '[urgent, quick]',
  merrow_01: '[relieved, grateful]',
  jo_merrow_silent: '[quiet, sombre]',
  ren_night_08a: '[warm, amused]',
  ren_origin_laneborn: '[dry, observant]',
  ren_origin_den: '[dry, observant]',
  ren_origin_ring: '[dry, observant]',
  ren_origin_steader: '[dry, observant]',
  ren_origin_belt: '[dry, observant]',
  ren_origin_border: '[dry, observant]',
  ren_class_warden: '[dry, amused]',
  ren_class_rigger: '[dry, amused]',
  ren_class_field: '[dry, amused]',
  ren_class_striker: '[dry, amused]',
  ren_class_shade: '[dry, amused]',
  ren_class_arms: '[dry, amused]',
  dena_night_04: '[warm, chatty]',
  sorrel_night_06a: '[soft, slow, remembering]',
  sorrel_night_06b: '[soft, quiet]',
  ilya_night_04a: '[quietly, nervous]',
  ilya_night_06b: '[grateful]',
  dena_dark_03a: '[frightened, steadying herself]',
  hale_control_06a: '[quiet, regretful]',
  hale_files_02: '[gruff, almost kind]',
  ren_hale_files_01: '[pointed]',
  ren_pell_gate_06b: '[steady, grave]',
  ren_pell_gate_09a: '[quiet, doubtful]',
  ren_pell_gate_09b: '[quiet, regretful]',
  dena_loss_04b: '[shaken, pulling herself together]',
  ren_jo_meet_06: '[dry]',
  jo_meet_08a: '[pleased, brash]',
  jo_meet_08b: '[wry, amused]',
  jo_name_04: '[decisive, pleased]',
  ren_bridge_06: '[quiet, determined]',
  ren_bridge_08: '[warm, dry]',
  jo_bridge_05: '[wry, warm]',
  ren_bridge_hold: '[quiet, firm]',
  ren_bridge_curve: '[quiet, resolved]',
  sorrel_dark_04b: '[quiet, firm]',
  ilya_dark_02: '[ashamed, quick]',
  ilya_dark_04a: '[relieved, eager]',
  dena_ship_02a: '[gentle, sad]',
  dena_ship_03a: '[wry, warm]',
  dena_ship_03b: '[sad, quiet]',
  pell_ship_02a: '[quiet, troubled]',
  pell_ship_04b: '[wry, steadier]',
  ilya_ship_04b: '[quiet, determined]',
  ren_aboard_07b: '[approving, warm]',
  jo_aboard_04b: '[quiet, bitter]',
  jo_aboard_05b: '[quiet, uneasy]',
  sorrel_aboard_04b: '[quiet, ashamed]',
  pell_aboard_05a: '[quoting, flat, uneasy]',
  ilya_aboard_04b: '[quiet, frightened]',
  jo_course_04b: '[firm, pleased]',
  ren_leaving_01: '[calm, carrying, announcing to the ship]',
  jo_lane_01: '[relieved, quiet]',
  pell_lane_01: '[quiet, wistful]',
};
const MANNER: Record<string, string> = {
  ask: '[curious]',
  plain: '[plain, matter-of-fact]',
  resolve: '[firm]',
  mercy: '[gentle]',
};

// ─── The script ────────────────────────────────────────────────────────────────────────────────────

interface Line {
  id: string;
  speaker: string;
  text: string;
  knot: string;
  stitch: string;
  /** Counts the game's commands (`>>>`): lines with play between them are not stitched. */
  beat: number;
  /** The branches (choices and conditions) the line sits in, outermost first, as `group:branch`. */
  path: string[];
  /** The manner of the choice a hero's line answers. */
  manner?: string;
}

/**
 * Every line with `#speaker:` and `#line:` tags, with the branches it sits in, so that lines which
 * are alternatives (choices, conditions) are never stitched to each other. Commands (`>>>`), choice
 * text, logic and diverts are skipped.
 */
function parseScript(source: string): Line[] {
  const lines: Line[] = [];
  let knot = '';
  let stitch = '';
  let path: string[] = [];
  let manner: string | undefined;
  let counter = 0;
  let beat = 0;
  const conditions: { base: string[]; id: number; n: number }[] = [];
  /** The choice group open at each depth, and the branch it opened in. */
  const groups = new Map<number, { id: number; parent: string }>();
  /** Keeps the open conditions and the first `depth` choices. */
  const toDepth = (p: string[], depth: number) => {
    let choices = 0;
    return p.filter((t) => t.startsWith('c') || ++choices <= depth);
  };
  const reset = () => {
    path = [];
    conditions.length = 0;
    groups.clear();
  };
  for (const raw of source.split(/\r?\n/)) {
    let rest = raw.trim();
    if (rest.startsWith('>>>')) beat++;
    if (!rest || rest.startsWith('//') || rest.startsWith('>>>') || rest.startsWith('~')) continue;
    const knotMatch = /^===\s*(\w+)\s*===/.exec(rest);
    if (knotMatch) {
      knot = knotMatch[1] ?? '';
      stitch = '';
      reset();
      continue;
    }
    const stitchMatch = /^=\s*(\w+)/.exec(rest);
    if (stitchMatch) {
      stitch = stitchMatch[1] ?? '';
      reset();
      continue;
    }
    if (/^\{[^}]*$/.test(rest)) {
      const id = counter++;
      conditions.push({ base: path, id, n: 0 });
      path = [...path, `c${id}:0`];
      continue;
    }
    if (rest === '}') {
      path = conditions.pop()?.base ?? [];
      continue;
    }
    const open = conditions.at(-1);
    if (open && /^-(?!>).*:\s*$/.test(rest)) {
      open.n++;
      path = [...open.base, `c${open.id}:${open.n}`];
      continue;
    }
    const choice = /^((?:[*+]\s*)+)/.exec(rest);
    if (choice) {
      const depth = (choice[1] ?? '').replace(/\s/g, '').length;
      const parent = toDepth(path, depth - 1);
      let group = groups.get(depth);
      if (!group || group.parent !== parent.join('/')) {
        group = { id: counter++, parent: parent.join('/') };
        groups.set(depth, group);
      }
      path = [...parent, `k${group.id}:${counter++}`];
      manner = /#manner:\s*(\w+)/.exec(rest)?.[1];
      continue;
    }
    const gather = /^((?:-(?!>)\s*)+)/.exec(rest);
    if (gather) {
      const depth = (gather[1] ?? '').replace(/\s/g, '').length;
      path = toDepth(path, depth - 1);
      for (const d of groups.keys()) if (d >= depth) groups.delete(d);
      rest = rest.slice((gather[1] ?? '').length);
    }
    const speaker = /#speaker:\s*([^#]+?)\s*(?:#|$)/.exec(rest)?.[1];
    const id = /#line:\s*(\w+)/.exec(rest)?.[1];
    if (!speaker || !id) continue;
    const text = rest.slice(0, rest.indexOf('#')).trim();
    lines.push({ id, speaker, text, knot, stitch, beat, path, manner: speaker === 'hero' ? manner : undefined });
    if (speaker !== 'hero') manner = undefined;
  }
  return lines;
}

const scope = (l: Line) => `${l.knot}.${l.knot === 'slice' ? l.stitch : ''}.${l.beat}`;
const group = (token: string) => token.slice(0, token.indexOf(':'));

/** Two lines can be heard one after the other: they part, if at all, in different groups of branches. */
function together(a: Line, b: Line): boolean {
  if (scope(a) !== scope(b)) return false;
  for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
    const x = a.path[i] ?? '';
    const y = b.path[i] ?? '';
    if (x !== y) return group(x) !== group(y);
  }
  return true;
}

/** `b` always follows `a`: it sits in no branch that `a` does not. */
const always = (a: Line, b: Line) => b.path.length <= a.path.length && b.path.every((t, i) => a.path[i] === t);

/**
 * Request stitching: the line heard before (whoever said it) sets the tone; the line after is given
 * only when the same person surely goes on speaking, so a line before someone else's answer still ends,
 * and never to a short line, which it can leak into ("Look at the star." became "stars" before "Those
 * aren't stars round it.").
 */
function stitching(lines: Line[]): Map<string, { previous?: string; next?: string }> {
  const out = new Map<string, { previous?: string; next?: string }>();
  lines.forEach((line, i) => {
    const before = lines.slice(0, i).findLast((l) => together(l, line));
    const after = lines.slice(i + 1).find((l) => together(l, line));
    out.set(line.id, {
      previous: before?.text,
      next:
        after && after.speaker === line.speaker && always(line, after) && line.text.length >= NEXT_FROM
          ? after.text
          : undefined,
    });
  });
  return out;
}

function directionOf(line: Line): string {
  // The hero's remarks on what they look at are said half to themselves.
  if (line.speaker === 'hero') {
    return (
      MANNER[line.manner ?? ''] ?? (line.knot.startsWith('look_') ? '[quietly, thinking aloud]' : '[calm, capable]')
    );
  }
  return LINE[line.id] ?? SCENE[line.knot] ?? '';
}

// ─── Hearing a take back ───────────────────────────────────────────────────────────────────────────

const ONES =
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(
    ' ',
  );
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** A number below a hundred in words, as speech to text writes digits ("31", "3:00"). */
function numberWords(n: number): string[] {
  if (n < 20) return [ONES[n] ?? String(n)];
  if (n < 100) return [TENS[Math.floor(n / 10)] ?? '', ...(n % 10 ? [ONES[n % 10] ?? ''] : [])];
  return [String(n)];
}

/** The words of a line for comparing: lower case, no punctuation, numbers in words, one spelling. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(\d+):00\b/g, '$1')
    .replace(/(\d+)\s*%/g, '$1 per cent')
    .replace(/\bpercent\b/g, 'per cent')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (/^\d+$/.test(w) ? numberWords(Number(w)) : [w]))
    .map((w) => w.replace(/^(\w{3,})our(s?)$/, '$1or$2').replace(/^'+|'+$/g, ''));
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min(above + 1, (row[j - 1] ?? 0) + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length] ?? 0;
}

/** The same word, allowing speech to text one letter wrong in a long one (an invented name: "Marrow"). */
/** The game's invented names as speech to text spells them, which it cannot know. */
const SOUNDS_LIKE: Record<string, string> = {
  wren: 'ren',
  mero: 'merrow',
  marrow: 'merrow',
  morrow: 'merrow',
  more: 'maw',
};
const squash = (w: string) => w.replace(/(.)\1+/g, '$1');
const sameWord = (a: string, b: string) =>
  a === b ||
  (SOUNDS_LIKE[b] ?? b) === a ||
  (a.length >= 5 && distance(a, b) <= 1) ||
  (squash(a).length >= 4 && distance(squash(a), squash(b)) <= 1);

/** Joins two words of `words` where `other` has them as one ("farm hands" heard as "farmhands"). */
function compounds(words: string[], other: string[]): string[] {
  const joined = new Set(other);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const pair = `${words[i]}${words[i + 1] ?? ''}`;
    if (i + 1 < words.length && joined.has(pair)) {
      out.push(pair);
      i++;
    } else out.push(words[i] ?? '');
  }
  return out;
}

/** How much of what was meant was heard, in order: the longest common run of words over the words meant. */
function wordMatch(meant: string, heard: string): number {
  const a = compounds(wordsOf(meant), wordsOf(heard));
  const b = compounds(wordsOf(heard), a);
  if (a.length === 0) return 1;
  const row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = sameWord(a[i - 1] ?? '', b[j - 1] ?? '') ? diagonal + 1 : Math.max(above, row[j - 1] ?? 0);
      diagonal = above;
    }
  }
  return (row[b.length] ?? 0) / a.length;
}

// ─── The service ───────────────────────────────────────────────────────────────────────────────────

const BASE = optionalKey('ELEVENLABS_API_BASE') ?? 'https://api.elevenlabs.io';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A request to ElevenLabs with the key as `xi-api-key`, tried again when busy or dropped. */
async function eleven(path: string, init: RequestInit): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string>), 'xi-api-key': requireKey('ELEVENLABS_API_KEY') };
  let last = '';
  for (const wait of [0, 3000, 10_000, 30_000]) {
    if (wait) await sleep(wait);
    try {
      const response = await fetch(`${BASE}${path}`, { ...init, headers });
      if (response.ok) return response;
      last = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (e) {
      last = (e as Error).message;
    }
  }
  throw new Error(`ElevenLabs ${path.split('?')[0]}: ${last}`);
}

async function speak(voice: Voice, text: string, stitch: { previous?: string; next?: string }, seed: number) {
  const response = await eleven(`/v1/text-to-speech/${voice.id}/with-timestamps?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: SETTINGS,
      seed,
      previous_text: stitch.previous,
      next_text: stitch.next,
    }),
  });
  const json = (await response.json()) as {
    audio_base64: string;
    alignment?: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };
  return { audio: Buffer.from(json.audio_base64, 'base64'), alignment: json.alignment };
}

/** Word timings from the character alignment, the delivery tag left out. */
function wordTimes(
  alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] },
  sent: string,
  skip: number,
): [string, number, number][] | undefined {
  if (alignment.characters.join('') !== sent) return undefined;
  const words: [string, number, number][] = [];
  let word = '';
  let start = 0;
  let end = 0;
  for (let i = skip; i <= alignment.characters.length; i++) {
    const ch = alignment.characters[i] ?? ' ';
    if (/\s/.test(ch)) {
      if (word) words.push([word, Math.round(start * 100) / 100, Math.round(end * 100) / 100]);
      word = '';
      continue;
    }
    if (!word) start = alignment.character_start_times_seconds[i] ?? 0;
    word += ch;
    end = alignment.character_end_times_seconds[i] ?? end;
  }
  return words;
}

async function transcribe(audio: Buffer): Promise<string> {
  const form = new FormData();
  form.append('model_id', STT_MODEL);
  form.append('language_code', 'en');
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), 'take.mp3');
  const response = await eleven('/v1/speech-to-text', { method: 'POST', body: form });
  return ((await response.json()) as { text: string }).text.trim();
}

// ─── Measuring a take ──────────────────────────────────────────────────────────────────────────────

/** The take as mono 16-bit samples at 44.1 kHz, by macOS's afconvert or else ffmpeg. */
function decode(mp3: Buffer): Int16Array {
  const dir = mkdtempSync(join(tmpdir(), 'voices-'));
  try {
    const input = join(dir, 'take.mp3');
    const output = join(dir, 'take.wav');
    writeFileSync(input, mp3);
    if (existsSync('/usr/bin/afconvert')) {
      execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', input, output]);
    } else {
      const ffmpeg = optionalKey('FFMPEG') ?? 'ffmpeg';
      execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', input, '-ac', '1', '-ar', '44100', output]);
    }
    const wav = readFileSync(output);
    for (let at = 12; at + 8 <= wav.length; ) {
      const size = wav.readUInt32LE(at + 4);
      if (wav.toString('ascii', at, at + 4) === 'data') {
        const data = wav.subarray(at + 8, at + 8 + size);
        return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
      }
      at += 8 + size + (size % 2);
    }
    throw new Error('no audio in the decoded take');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface Measure {
  seconds: number;
  /** Loudness every 50 ms, 0 to 1: RMS over the line's loud level (its 98th percentile), clipped. */
  envelope: number[];
  /** Silence before the first word and after the last, in seconds. */
  lead: number;
  tail: number;
  /** The share of samples at full scale, and the loudest sample (0 to 1). */
  clipped: number;
  peak: number;
  /** The RMS of the speech (every 50 ms at a tenth of the loud level or more), in dBFS. */
  loudness: number;
}

function measure(samples: Int16Array, rate = 44100): Measure {
  const size = rate / ENVELOPE_RATE;
  const rms: number[] = [];
  for (let at = 0; at < samples.length; at += size) {
    let sum = 0;
    const end = Math.min(samples.length, at + size);
    for (let i = at; i < end; i++) sum += (samples[i] ?? 0) ** 2;
    rms.push(Math.sqrt(sum / Math.max(1, end - at)));
  }
  const sorted = rms.filter((v) => v > 0).sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.98)] ?? 1;
  const envelope = rms.map((v) => {
    const level = Math.min(1, v / loud);
    return level < 0.05 ? 0 : Math.round(level * 100) / 100;
  });
  const first = envelope.findIndex((v) => v >= 0.1);
  const last = envelope.findLastIndex((v) => v >= 0.1);
  const speech = rms.filter((v) => v >= loud * 0.1);
  const power = speech.reduce((n, v) => n + v * v, 0) / Math.max(1, speech.length);
  let peak = 0;
  let full = 0;
  for (const s of samples) {
    const a = Math.abs(s);
    if (a > peak) peak = a;
    if (a >= 32_440) full++;
  }
  return {
    seconds: Math.round((samples.length / rate) * 100) / 100,
    envelope,
    lead: first < 0 ? 0 : first / ENVELOPE_RATE,
    tail: last < 0 ? 0 : (envelope.length - 1 - last) / ENVELOPE_RATE,
    clipped: full / Math.max(1, samples.length),
    peak: Math.round((peak / 32_768) * 1000) / 1000,
    loudness: Math.round(10 * Math.log10(Math.max(1e-9, power / 32_768 ** 2)) * 10) / 10,
  };
}

/** What is clearly wrong with a take, if anything: lost words, odd pace, long silences, clipping. */
function problems(text: string, heard: string, m: Measure, words?: [string, number, number][]): string[] {
  const out: string[] = [];
  const match = wordMatch(text, heard);
  if (match < HEARD) out.push(`heard ${Math.round(match * 100)}%: "${heard}"`);
  const spoken = words?.length ? (words.at(-1)?.[2] ?? 0) - (words[0]?.[1] ?? 0) : m.seconds - m.lead - m.tail;
  const pace = text.length / Math.max(0.1, spoken);
  if (text.length >= 12 && (pace < 7 || pace > 24)) out.push(`pace ${pace.toFixed(1)} characters a second`);
  if (m.lead > 1) out.push(`${m.lead} s of silence before`);
  if (m.tail > 1.5) out.push(`${m.tail} s of silence after`);
  if (m.clipped > 0.001) out.push(`clipped (${(m.clipped * 100).toFixed(2)}% at full scale)`);
  return out;
}

// ─── Records and the manifest ──────────────────────────────────────────────────────────────────────

interface FileRecord {
  line: string;
  speaker: string;
  body?: 'man' | 'woman';
  text: string;
  direction: string;
  /** Of the text, direction, voice, model, settings and format: unchanged, the take is kept. */
  hash: string;
  voice: Voice;
  service: string;
  model: string;
  settings: typeof SETTINGS;
  format: string;
  seed: number;
  stitching: { previous?: string; next?: string };
  heard: string;
  match: number;
  checks: string[];
  tries: number;
  seconds: number;
  lead: number;
  tail: number;
  peak: number;
  loudness: number;
  bytes: number;
  sha256: string;
  made: string;
  aiGenerated: true;
  envelope: number[];
  words?: [string, number, number][];
}

interface Records {
  about: string;
  files: Record<string, FileRecord>;
}

const ABOUT =
  'Every voice file in public/assets/voices/, made by scripts/art/voices.ts with ElevenLabs text to speech on the ' +
  "owner's paid plan from premade voices (docs/assets/VOICES.md). Generated speech, all of it; the lines are fiction.";

/** Pretty, but each envelope and word list on one line. */
function writeRecords(records: Records): string {
  const files = Object.fromEntries(Object.entries(records.files).sort(([a], [b]) => a.localeCompare(b)));
  const inline: string[] = [];
  const text = JSON.stringify(
    { about: records.about, files },
    (key, value) => {
      if (key !== 'envelope' && key !== 'words') return value;
      inline.push(JSON.stringify(value));
      return `\u0000${inline.length - 1}\u0000`;
    },
    2,
  );
  return `${text.replace(/"\\u0000(\d+)\\u0000"/g, (_, i: string) => inline[Number(i)] ?? '[]')}\n`;
}

interface Entry {
  speaker?: string;
  file: string;
  seconds: number;
  envelope: number[];
  /** Playback gain that brings the speech to SPEECH_LEVEL, kept off clipping (0.5 to 3). */
  gain: number;
  radio?: true;
}

const gainOf = (r: FileRecord) => {
  const wanted = 10 ** ((SPEECH_LEVEL - r.loudness) / 20);
  return Math.round(Math.min(3, 0.98 / Math.max(0.01, r.peak), Math.max(0.5, wanted)) * 100) / 100;
};

const entry = (r: FileRecord, file: string, speaker?: string): Entry => ({
  ...(speaker ? { speaker } : {}),
  file,
  seconds: r.seconds,
  envelope: r.envelope,
  gain: gainOf(r),
  ...(RADIO.has(r.line) ? { radio: true as const } : {}),
});

/** One entry a line, for the game (src/game/audio.ts): `lines` by id, the hero's by id and body. */
function writeManifest(lines: Line[], records: Records): string {
  const rows: string[] = [];
  const heroRows: string[] = [];
  for (const line of lines) {
    if (line.speaker === 'hero') {
      const man = records.files[`${line.id}.man.mp3`];
      const woman = records.files[`${line.id}.woman.mp3`];
      const both = {
        ...(man ? { man: entry(man, `${line.id}.man.mp3`) } : {}),
        ...(woman ? { woman: entry(woman, `${line.id}.woman.mp3`) } : {}),
      };
      if (man || woman) heroRows.push(`    ${JSON.stringify(line.id)}: ${JSON.stringify(both)}`);
    } else {
      const r = records.files[`${line.id}.mp3`];
      if (r) rows.push(`    ${JSON.stringify(line.id)}: ${JSON.stringify(entry(r, `${line.id}.mp3`, line.speaker))}`);
    }
  }
  const about = `Voices for story/slice.ink, made by scripts/art/voices.ts (${MODEL}, ${FORMAT}). envelope: loudness 0-1 at ${ENVELOPE_RATE} a second, for lip sync; gain: playback gain to level the speech; radio: heard over comms.`;
  const head = `  "about": ${JSON.stringify(about)}`;
  return `{\n${head},\n  "envelopeRate": ${ENVELOPE_RATE},\n  "lines": {\n${rows.join(',\n')}\n  },\n  "hero": {\n${heroRows.join(',\n')}\n  }\n}\n`;
}

// ─── Making them ───────────────────────────────────────────────────────────────────────────────────

interface Job {
  line: Line;
  file: string;
  voice: Voice;
  body?: 'man' | 'woman';
  direction: string;
  hash: string;
  stitch: { previous?: string; next?: string };
}

function jobsOf(lines: Line[]): Job[] {
  const stitches = stitching(lines);
  return lines.flatMap((line) => {
    const direction = directionOf(line);
    const stitch = stitches.get(line.id) ?? {};
    const one = (file: string, voice: Voice, body?: 'man' | 'woman'): Job => ({
      line,
      file,
      voice,
      body,
      direction,
      stitch,
      hash: createHash('sha256')
        .update(JSON.stringify({ text: line.text, direction, voice: voice.id, model: MODEL, SETTINGS, FORMAT }))
        .digest('hex'),
    });
    if (line.speaker === 'hero') {
      return [one(`${line.id}.man.mp3`, HERO.man, 'man'), one(`${line.id}.woman.mp3`, HERO.woman, 'woman')];
    }
    const voice = CAST[line.speaker];
    if (!voice) throw new Error(`${line.id}: nobody is cast as ${line.speaker}`);
    return [one(`${line.id}.mp3`, voice)];
  });
}

/** A take of the job; `after`, the seed of a take of the same line to move on from (`--again`). */
async function make(job: Job, after?: number): Promise<FileRecord> {
  const sent = job.direction ? `${job.direction} ${job.line.text}` : job.line.text;
  const seedBase = after === undefined ? Number.parseInt(job.hash.slice(0, 8), 16) : after + 1;
  let best: { record: FileRecord; audio: Buffer } | undefined;
  let tries = 0;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    tries++;
    const seed = (seedBase + attempt) % 4_294_967_295;
    const { audio, alignment } = await speak(job.voice, sent, job.stitch, seed);
    const words = alignment ? wordTimes(alignment, sent, job.direction ? job.direction.length + 1 : 0) : undefined;
    const m = measure(decode(audio));
    const heard = await transcribe(audio);
    const checks = problems(job.line.text, heard, m, words);
    const record: FileRecord = {
      line: job.line.id,
      speaker: job.line.speaker,
      ...(job.body ? { body: job.body } : {}),
      text: job.line.text,
      direction: job.direction,
      hash: job.hash,
      voice: job.voice,
      service: 'ElevenLabs text to speech',
      model: MODEL,
      settings: SETTINGS,
      format: FORMAT,
      seed,
      stitching: job.stitch,
      heard,
      match: Math.round(wordMatch(job.line.text, heard) * 1000) / 1000,
      checks,
      tries: 0,
      seconds: m.seconds,
      lead: m.lead,
      tail: m.tail,
      peak: m.peak,
      loudness: m.loudness,
      bytes: audio.length,
      sha256: createHash('sha256').update(audio).digest('hex'),
      made: new Date().toISOString(),
      aiGenerated: true,
      envelope: m.envelope,
      ...(words ? { words } : {}),
    };
    const better =
      !best ||
      checks.length < best.record.checks.length ||
      (checks.length === best.record.checks.length && record.match > best.record.match);
    if (better) best = { record, audio };
    if (checks.length === 0) break;
    console.log(`  ${job.file}: take ${attempt + 1} ${checks.join('; ')}`);
  }
  if (!best) throw new Error(`${job.file}: no take`);
  best.record.tries = tries;
  await writeFile(join(OUT, job.file), best.audio);
  return best.record;
}

const args = process.argv.slice(2);
const again = args.includes('--again');
const wanted = args.filter((a) => !a.startsWith('--'));
const lines = parseScript(await readFile(SCRIPT, 'utf8'));
const named = (j: { line: Line; file: string }) => wanted.includes(j.line.id) || wanted.includes(j.file);
const unknown = wanted.filter((w) => !lines.some((l) => l.id === w || w.startsWith(`${l.id}.`)));
if (unknown.length) throw new Error(`Not lines in slice.ink: ${unknown.join(', ')}`);
const braces = lines.filter((l) => /[{}]/.test(l.text));
for (const l of braces) console.warn(`${l.id}: holds ink logic ({...}), so it is not voiced: "${l.text}"`);
const voiced = lines.filter((l) => !braces.includes(l));
const jobs = jobsOf(voiced);

if (args.includes('--list')) {
  const stitches = stitching(voiced);
  for (const l of voiced) {
    const s = stitches.get(l.id);
    console.log(`${l.id} [${l.speaker}] ${directionOf(l)} ${l.text}`);
    if (s?.previous) console.log(`    after: ${s.previous}`);
    if (s?.next) console.log(`    before: ${s.next}`);
  }
  const heroLines = voiced.filter((l) => l.speaker === 'hero').length;
  const chars = jobs.reduce((n, j) => n + j.line.text.length + (j.direction ? j.direction.length + 1 : 0), 0);
  console.log(`${voiced.length} lines (${heroLines} the hero's), ${jobs.length} files, ${chars} characters a full run`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
const records: Records = existsSync(RECORDS)
  ? (JSON.parse(await readFile(RECORDS, 'utf8')) as Records)
  : { about: ABOUT, files: {} };
records.about = ABOUT;
const asked = jobs.filter((j) => wanted.length === 0 || named(j));
const todo = asked.filter((j) => {
  const old = records.files[j.file];
  return again || !old || old.hash !== j.hash || !existsSync(join(OUT, j.file));
});
console.log(
  `${jobs.length} files for ${voiced.length} lines; ${todo.length} to make, ${asked.length - todo.length} unchanged`,
);

let made = 0;
let failed = 0;
const queue = [...todo];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const old = records.files[job.file];
        const record = await make(job, old?.hash === job.hash ? old.seed : undefined);
        records.files[job.file] = record;
        made++;
        const note = record.checks.length ? `  CHECK: ${record.checks.join('; ')}` : '';
        console.log(
          `${job.file}: ${record.seconds} s, ${(record.bytes / 1024).toFixed(0)} KB, ${record.voice.name}${note}`,
        );
        if (made % 10 === 0) await writeFile(RECORDS, writeRecords(records));
      } catch (e) {
        failed++;
        console.error(`${job.file}: ${(e as Error).message}`);
      }
    }
  }),
);

// Each take is judged again from what was heard, as the comparison improves; nothing is asked of the service.
for (const r of Object.values(records.files)) {
  r.match = Math.round(wordMatch(r.text, r.heard) * 1000) / 1000;
  const heard = r.match < HEARD ? [`heard ${Math.round(r.match * 100)}%: "${r.heard}"`] : [];
  r.checks = [...r.checks.filter((c) => !c.startsWith('heard ')), ...heard];
}
// A record from before a measure was added is measured again from its file; nothing is asked of the service.
for (const job of jobs) {
  const r = records.files[job.file];
  if (r && r.loudness === undefined && existsSync(join(OUT, job.file))) {
    const m = measure(decode(readFileSync(join(OUT, job.file))));
    Object.assign(r, { loudness: m.loudness, peak: m.peak, envelope: m.envelope, seconds: m.seconds });
  }
}
await writeFile(RECORDS, writeRecords(records));
await writeFile(MANIFEST, writeManifest(voiced, records));
const current = new Set(jobs.map((j) => j.file));
const stale = Object.keys(records.files).filter((f) => !current.has(f));
if (stale.length) console.warn(`No longer in slice.ink (remove by hand, with their records): ${stale.join(', ')}`);
const bytes = jobs.reduce((n, j) => n + (existsSync(join(OUT, j.file)) ? statSync(join(OUT, j.file)).size : 0), 0);
const flagged = jobs.filter((j) => records.files[j.file]?.checks.length).map((j) => j.file);
console.log(`made ${made}, failed ${failed}; ${jobs.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB in all`);
if (flagged.length) console.log(`still flagged: ${flagged.join(', ')}`);
if (failed) process.exitCode = 1;
