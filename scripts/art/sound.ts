/**
 * Shared tools for the sound effects and the music (docs/assets/AUDIO.md): ffmpeg to decode and to
 * encode, and the processing done between, on plain samples so every step is visible here: trims,
 * fades, layers, seamless loops, loudness (ITU-R BS.1770) and a gentle peak limiter. The ffmpeg
 * lookup is adapted from Starman Control's scripts/media.ts. Only build-time scripts use this.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { optionalKey, requireKey } from './env.ts';

export const RATE = 44_100;

// ---------------------------------------------------------------------------------------------
// ffmpeg

export const ROOT = resolve(import.meta.dirname, '../..');

/** ffmpeg-static or ffprobe-static installed beside a package.json (this repository's or a sibling's). */
function fromPackage(packageJson: string, name: 'ffmpeg-static' | 'ffprobe-static'): string | undefined {
  if (!existsSync(packageJson)) return undefined;
  try {
    const found = createRequire(packageJson)(name) as string | { path: string };
    const path = typeof found === 'string' ? found : found.path;
    return existsSync(path) ? path : undefined;
  } catch {
    return undefined;
  }
}

function findTool(tool: 'ffmpeg' | 'ffprobe'): string {
  const name = tool === 'ffmpeg' ? 'ffmpeg-static' : 'ffprobe-static';
  return (
    optionalKey(tool === 'ffmpeg' ? 'FFMPEG' : 'FFPROBE') ??
    fromPackage(resolve(ROOT, 'package.json'), name) ??
    fromPackage(resolve(ROOT, '../starman-control/tools/package.json'), name) ??
    tool
  );
}

export const FFMPEG = findTool('ffmpeg');

function ffmpeg(args: string[], input?: Buffer): Buffer {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-loglevel', 'error', ...args], {
    input,
    maxBuffer: 1024 * 1024 * 1024,
    timeout: 300_000,
  });
  if (r.error) throw new Error(`ffmpeg could not be run (${r.error.message}); set FFMPEG in .env (see AUDIO.md)`);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.toString().slice(-600)}`);
  return r.stdout;
}

// ---------------------------------------------------------------------------------------------
// Samples

/** Audio as one Float32Array per channel at 44.1 kHz. */
export interface Pcm {
  ch: Float32Array[];
}

export const frames = (p: Pcm) => p.ch[0]?.length ?? 0;
export const seconds = (p: Pcm) => frames(p) / RATE;
const at = (s: number) => Math.round(s * RATE);

/** Decodes any file ffmpeg reads, optionally through ffmpeg filters (`-af`), to `channels` channels. */
export function decode(file: string, channels: 1 | 2, filter?: string): Pcm {
  const raw = ffmpeg([
    '-i',
    file,
    ...(filter ? ['-af', filter] : []),
    '-f',
    'f32le',
    '-acodec',
    'pcm_f32le',
    '-ac',
    String(channels),
    '-ar',
    String(RATE),
    'pipe:1',
  ]);
  const all = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  const n = Math.floor(all.length / channels);
  const ch = Array.from({ length: channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++)
    for (let c = 0; c < channels; c++) (ch[c] as Float32Array)[i] = all[i * channels + c] ?? 0;
  return { ch };
}

/**
 * Encodes to MP3 (LAME, constant bit rate, no metadata) and returns the bytes. It goes through a
 * file, not a pipe, so ffmpeg can write the LAME header that tells decoders the encoder's delay and
 * padding: browsers then trim them, and a one-shot starts on its first sample.
 */
export function encodeMp3(p: Pcm, bitrate: string): Buffer {
  const n = frames(p);
  const c = p.ch.length;
  const all = new Float32Array(n * c);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) all[i * c + k] = p.ch[k]?.[i] ?? 0;
  const dir = mkdtempSync(join(tmpdir(), 'audio-'));
  const out = join(dir, 'out.mp3');
  try {
    ffmpeg(
      [
        '-f',
        'f32le',
        '-ar',
        String(RATE),
        '-ac',
        String(c),
        '-i',
        'pipe:0',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        bitrate,
        '-map_metadata',
        '-1',
        '-id3v2_version',
        '0',
        '-y',
        out,
      ],
      Buffer.from(all.buffer),
    );
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs samples through ffmpeg audio filters (`-af`), such as `highpass=f=70`. */
export function filterPcm(p: Pcm, filter: string): Pcm {
  const n = frames(p);
  const c = p.ch.length;
  const all = new Float32Array(n * c);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) all[i * c + k] = p.ch[k]?.[i] ?? 0;
  const raw = ffmpeg(
    ['-f', 'f32le', '-ar', String(RATE), '-ac', String(c), '-i', 'pipe:0', '-af', filter, '-f', 'f32le', 'pipe:1'],
    Buffer.from(all.buffer),
  );
  const out = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  const m = Math.floor(out.length / c);
  const ch = Array.from({ length: c }, () => new Float32Array(m));
  for (let i = 0; i < m; i++) for (let k = 0; k < c; k++) (ch[k] as Float32Array)[i] = out[i * c + k] ?? 0;
  return { ch };
}

export const silence = (s: number, channels = 1): Pcm => ({
  ch: Array.from({ length: channels }, () => new Float32Array(at(s))),
});

export function slice(p: Pcm, from: number, to = seconds(p)): Pcm {
  return { ch: p.ch.map((c) => c.slice(at(from), at(to))) };
}

export function concat(...parts: Pcm[]): Pcm {
  const n = parts.reduce((sum, p) => sum + frames(p), 0);
  const channels = parts[0]?.ch.length ?? 1;
  const ch = Array.from({ length: channels }, () => new Float32Array(n));
  let o = 0;
  for (const p of parts) {
    for (let c = 0; c < channels; c++) ch[c]?.set(p.ch[c] ?? (p.ch[0] as Float32Array), o);
    o += frames(p);
  }
  return { ch };
}

export function gain(p: Pcm, db: number): Pcm {
  const g = 10 ** (db / 20);
  return { ch: p.ch.map((c) => c.map((v) => v * g)) };
}

/** Raised-cosine fades in and out, in seconds. */
export function fade(p: Pcm, inS: number, outS: number): Pcm {
  const n = frames(p);
  const fi = Math.min(n, at(inS));
  const fo = Math.min(n, at(outS));
  const ch = p.ch.map((c) => {
    const out = c.slice();
    for (let i = 0; i < fi; i++) out[i] = (out[i] ?? 0) * (0.5 - 0.5 * Math.cos((Math.PI * i) / fi));
    for (let i = 0; i < fo; i++) out[n - 1 - i] = (out[n - 1 - i] ?? 0) * (0.5 - 0.5 * Math.cos((Math.PI * i) / fo));
    return out;
  });
  return { ch };
}

/** Layers mixed into one: each placed at `at` seconds with a gain in dB. */
export function mix(layers: { pcm: Pcm; at?: number; db?: number }[]): Pcm {
  const channels = Math.max(...layers.map((l) => l.pcm.ch.length));
  const n = Math.max(...layers.map((l) => at(l.at ?? 0) + frames(l.pcm)));
  const ch = Array.from({ length: channels }, () => new Float32Array(n));
  for (const l of layers) {
    const g = 10 ** ((l.db ?? 0) / 20);
    const o = at(l.at ?? 0);
    for (let c = 0; c < channels; c++) {
      const src = l.pcm.ch[c] ?? (l.pcm.ch[0] as Float32Array);
      const dst = ch[c] as Float32Array;
      for (let i = 0; i < src.length; i++) dst[o + i] = (dst[o + i] ?? 0) + (src[i] ?? 0) * g;
    }
  }
  return { ch };
}

const peakOf = (p: Pcm) => p.ch.reduce((m, c) => c.reduce((mm, v) => Math.max(mm, Math.abs(v)), m), 0);
export const peakDb = (p: Pcm) => 20 * Math.log10(peakOf(p) || 1e-9);

/**
 * Cuts the quiet before the first sound and after the last (below `db` relative to the peak),
 * keeping a few milliseconds so the attack is whole.
 */
export function trimQuiet(p: Pcm, db = -50, keepS = 0.004): Pcm {
  const limit = peakOf(p) * 10 ** (db / 20);
  const n = frames(p);
  const loud = (i: number) => p.ch.some((c) => Math.abs(c[i] ?? 0) > limit);
  let a = 0;
  while (a < n && !loud(a)) a++;
  let b = n - 1;
  while (b > a && !loud(b)) b--;
  return slice(p, Math.max(0, a / RATE - keepS), Math.min(n, b + 1) / RATE + keepS);
}

// ---------------------------------------------------------------------------------------------
// Loudness (ITU-R BS.1770: K-weighting, 400 ms blocks)

function biquad(x: Float32Array, b: number[], a: number[]): Float32Array {
  const [b0 = 0, b1 = 0, b2 = 0] = b;
  const [a0 = 1, a1 = 0, a2 = 0] = a;
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] ?? 0;
    const yi = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

function kWeight(x: Float32Array): Float32Array {
  // Stage 1: high shelf, +4 dB above about 1.5 kHz. Stage 2: high pass at 38 Hz (as pyloudnorm).
  const shelf = (() => {
    const A = 10 ** (4 / 40);
    const w0 = (2 * Math.PI * 1500) / RATE;
    const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
    const cos = Math.cos(w0);
    const s = 2 * Math.sqrt(A) * alpha;
    return {
      b: [A * (A + 1 + (A - 1) * cos + s), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - s)],
      a: [A + 1 - (A - 1) * cos + s, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - s],
    };
  })();
  const high = (() => {
    const w0 = (2 * Math.PI * 38) / RATE;
    const alpha = Math.sin(w0) / (2 * 0.5);
    const cos = Math.cos(w0);
    return { b: [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2], a: [1 + alpha, -2 * cos, 1 - alpha] };
  })();
  return biquad(biquad(x, shelf.b, shelf.a), high.b, high.a);
}

/** Mean-square loudness of each 400 ms block (100 ms apart), in LUFS; short sounds are padded to one block. */
function blocks(p: Pcm): number[] {
  const block = at(0.4);
  const hop = at(0.1);
  const n = Math.max(frames(p), block);
  const weighted = p.ch.map((c) => {
    const padded = new Float32Array(n);
    padded.set(c);
    return kWeight(padded);
  });
  const out: number[] = [];
  for (let s = 0; s + block <= n; s += hop) {
    let z = 0;
    for (const w of weighted) {
      let sum = 0;
      for (let i = s; i < s + block; i++) sum += (w[i] ?? 0) ** 2;
      z += sum / block;
    }
    out.push(-0.691 + 10 * Math.log10(z || 1e-12));
  }
  return out;
}

/** Integrated loudness (gated, LUFS) and the loudest 400 ms block (momentary maximum). */
export function loudness(p: Pcm): { integrated: number; momentaryMax: number } {
  const ls = blocks(p);
  const momentaryMax = Math.max(...ls);
  const power = (xs: number[]) => xs.reduce((s, l) => s + 10 ** ((l + 0.691) / 10), 0) / Math.max(1, xs.length);
  const abs = ls.filter((l) => l > -70);
  const relGate = -0.691 + 10 * Math.log10(power(abs) || 1e-12) - 10;
  const gated = abs.filter((l) => l > relGate);
  const integrated = gated.length ? -0.691 + 10 * Math.log10(power(gated)) : -70;
  return { integrated, momentaryMax };
}

/**
 * A look-ahead peak limiter: gain falls smoothly before a peak would pass `ceilingDb` and recovers
 * over `releaseS`. Offline, so it needs no delay.
 */
export function limit(p: Pcm, ceilingDb = -1, releaseS = 0.08): Pcm {
  const ceiling = 10 ** (ceilingDb / 20);
  const n = frames(p);
  const ahead = at(0.002);
  const want = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = p.ch.reduce((mm, c) => Math.max(mm, Math.abs(c[i] ?? 0)), 0);
    want[i] = m > ceiling ? ceiling / m : 1;
  }
  // The smallest gain wanted over the next `ahead` samples, released slowly afterwards.
  const g = new Float32Array(n);
  const release = Math.exp(-1 / (releaseS * RATE));
  let env = 1;
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let k = i; k < Math.min(n, i + ahead); k++) m = Math.min(m, want[k] ?? 1);
    env = m < env ? m : m - (m - env) * release;
    g[i] = env;
  }
  // Smooth the drops over the look-ahead, so the gain moves before the peak, not on it.
  const smooth = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += g[i] ?? 1;
    if (i >= ahead) sum -= g[i - ahead] ?? 1;
    smooth[i] = Math.min(g[i] ?? 1, sum / Math.min(i + 1, ahead));
  }
  return {
    ch: p.ch.map((c) =>
      c.map((v, i) => {
        const y = v * Math.min(smooth[i] ?? 1, g[i] ?? 1);
        return Math.max(-ceiling, Math.min(ceiling, y));
      }),
    ),
  };
}

/**
 * Brings a sound to a loudness: its loudest 400 ms (`momentary`, for effects) or its whole
 * (`integrated`, for beds and music). Peaks above the ceiling are limited by at most `maxLimitDb`;
 * beyond that the whole sound is turned down instead, so nothing is squashed.
 */
export function normalise(
  p: Pcm,
  target: number,
  mode: 'momentary' | 'integrated',
  ceilingDb = -1,
  maxLimitDb = 5,
): { pcm: Pcm; gainDb: number } {
  const l = loudness(p);
  let g = target - (mode === 'momentary' ? l.momentaryMax : l.integrated);
  const over = peakDb(p) + g - ceilingDb;
  if (over > maxLimitDb) g -= over - maxLimitDb;
  return { pcm: limit(gain(p, g), ceilingDb), gainDb: Math.round(g * 10) / 10 };
}

// ---------------------------------------------------------------------------------------------
// Loops

/** Correlation of two equal-length stretches, -1…1 (the first channel). */
function correlation(a: Float32Array, b: Float32Array): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += (a[i] ?? 0) * (b[i] ?? 0);
    aa += (a[i] ?? 0) ** 2;
    bb += (b[i] ?? 0) ** 2;
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/**
 * Mixes `tail` (fading out) into `head` (fading in) over their common length, keeping the power
 * steady whether the two are alike (a hum) or unrelated (noise).
 */
function crossfade(tail: Pcm, head: Pcm): Pcm {
  const n = Math.min(frames(tail), frames(head));
  const r = Math.max(
    0,
    correlation((tail.ch[0] as Float32Array).slice(0, n), (head.ch[0] as Float32Array).slice(0, n)),
  );
  const ch = tail.ch.map((t, c) => {
    const h = head.ch[c] ?? (head.ch[0] as Float32Array);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const th = (Math.PI / 2) * (i / n);
      const fo = Math.cos(th);
      const fi = Math.sin(th);
      const norm = Math.sqrt(1 + 2 * r * fi * fo);
      out[i] = ((t[i] ?? 0) * fo + (h[i] ?? 0) * fi) / norm;
    }
    return out;
  });
  return { ch };
}

/**
 * How cleanly a sound already joins its end to its start (ElevenLabs makes loops that should): the
 * jump between the last sample and the first against the mean step between neighbours (about 1 is
 * seamless), and the change of level across the join against the usual change between neighbouring
 * 10 ms stretches.
 */
export function wrapSeam(p: Pcm): { jumpRatio: number; levelStepDb: number; usualStepDb: number; rough: boolean } {
  const c = mono(p);
  const n = c.length;
  let step = 0;
  for (let i = 1; i < n; i++) step += Math.abs((c[i] ?? 0) - (c[i - 1] ?? 0));
  step /= Math.max(1, n - 1);
  const w = Math.round(0.01 * RATE);
  const rms = (a: number) => {
    let q = 0;
    for (let i = 0; i < w; i++) q += (c[(a + i + n) % n] ?? 0) ** 2;
    return 10 * Math.log10(q / w + 1e-12);
  };
  let usual = 0;
  let k = 0;
  for (let a = w; a < n - 2 * w; a += w, k++) usual += Math.abs(rms(a) - rms(a + w));
  usual /= Math.max(1, k);
  const jumpRatio = Math.abs((c[n - 1] ?? 0) - (c[0] ?? 0)) / (step || 1e-9);
  const levelStepDb = Math.abs(rms(n - w) - rms(0));
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    jumpRatio: r(jumpRatio),
    levelStepDb: r(levelStepDb),
    usualStepDb: r(usual),
    rough: jumpRatio > 4 || levelStepDb > usual + 2.5,
  };
}

/** Margins kept before the loop's start and after its end, so the decoder's padding never falls inside it. */
export const LOOP_MARGIN_S = 0.1;

/**
 * Makes a whole sound into a seamless loop by crossfading its end into its beginning, and returns
 * it with a margin either side: play it with `loopStart` and `loopEnd` (Web Audio), never the whole
 * file, so the MP3's padding stays outside the loop.
 */
export function seamless(p: Pcm, xfadeS: number): { pcm: Pcm; loopStart: number; loopEnd: number } {
  const n = frames(p);
  const x = at(xfadeS);
  const body = slice(p, x / RATE, (n - x) / RATE);
  const joined = crossfade(slice(p, (n - x) / RATE), slice(p, 0, x / RATE));
  const loop = concat(body, joined); // ends exactly where `body` begins
  return withMargins(loop);
}

function withMargins(loop: Pcm): { pcm: Pcm; loopStart: number; loopEnd: number } {
  const m = LOOP_MARGIN_S;
  const len = seconds(loop);
  const pcm = concat(slice(loop, len - m), loop, slice(loop, 0, m));
  return {
    pcm,
    loopStart: frames(slice(loop, len - m)) / RATE,
    loopEnd: (frames(slice(loop, len - m)) + frames(loop)) / RATE,
  };
}

/**
 * For music: plays from the top once, then loops between `a` and `b` (seconds in `p`). The stretch
 * before `b` is crossfaded into the stretch before `a`, so the jump from `loopEnd` back to
 * `loopStart` is seamless; the margin after `b` keeps the MP3's padding outside the loop.
 */
export function loopBetween(
  p: Pcm,
  a: number,
  b: number,
  xfadeS: number,
): { pcm: Pcm; loopStart: number; loopEnd: number } {
  const x = Math.min(xfadeS, a);
  const before = slice(p, 0, b - x);
  const joined = crossfade(slice(p, b - x, b), slice(p, a - x, a));
  const after = slice(p, a, a + LOOP_MARGIN_S); // what follows the jump, as margin
  const pcm = concat(before, joined, after);
  return { pcm, loopStart: a, loopEnd: frames(before) / RATE + frames(joined) / RATE };
}

// ---------------------------------------------------------------------------------------------
// Finding where music can loop

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2] ?? 0;
        const ai = im[i + k + len / 2] ?? 0;
        const xr = ar * wr - ai * wi;
        const xi = ar * wi + ai * wr;
        re[i + k + len / 2] = (re[i + k] ?? 0) - xr;
        im[i + k + len / 2] = (im[i + k] ?? 0) - xi;
        re[i + k] = (re[i + k] ?? 0) + xr;
        im[i + k] = (im[i + k] ?? 0) + xi;
      }
    }
  }
}

/**
 * Level in 20 bands from 60 Hz to 16 kHz (dB), one frame every `hopS` seconds (mono mix), each
 * frame's power averaged with its neighbours' so a single noisy bin does not swamp the comparison.
 */
function bandFrames(p: Pcm, hopS: number): Float64Array[] {
  const size = 4096;
  const count = 20;
  const hop = at(hopS);
  const left = p.ch[0] as Float32Array;
  const right = p.ch[1];
  const edges = Array.from({ length: count + 1 }, (_, i) =>
    Math.round((60 * (16000 / 60) ** (i / count) * size) / RATE),
  );
  for (let i = 1; i < edges.length; i++) edges[i] = Math.max(edges[i] ?? 0, (edges[i - 1] ?? 0) + 2);
  const window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
  const power: Float64Array[] = [];
  for (let s = 0; s + size <= left.length; s += hop) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++)
      re[i] = (((left[s + i] ?? 0) + (right?.[s + i] ?? left[s + i] ?? 0)) / 2) * (window[i] ?? 0);
    fft(re, im);
    const bands = new Float64Array(count);
    for (let b = 0; b < count; b++)
      for (let k = edges[b] ?? 0; k < (edges[b + 1] ?? 0); k++)
        bands[b] = (bands[b] ?? 0) + (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
    power.push(bands);
  }
  return power.map((_, t) => {
    const out = new Float64Array(count);
    for (let b = 0; b < count; b++) {
      let e = 0;
      for (let k = Math.max(0, t - 1); k <= Math.min(power.length - 1, t + 1); k++) e += power[k]?.[b] ?? 0;
      out[b] = 10 * Math.log10(e + 1e-9);
    }
    return out;
  });
}

/**
 * The best place for music to loop: a start `a` after the opening and an end `b`, `b - a` between
 * `minS` and `maxS`, where the music either side of `a` most resembles the music either side of
 * `b` (spectrum, frame by frame over `windowS`), then lined up to the sample by cross-correlation.
 * Returns the score too: the mean difference of band levels in dB (lower is better; a few dB is close).
 */
export function findLoop(
  p: Pcm,
  opts: { minS: number; maxS: number; startAfterS: number; endBeforeS: number; windowS?: number; goodDb?: number },
): { a: number; b: number; score: number; onsetMatch: number; bpm?: number; beats?: number } {
  const hopS = 0.1;
  const f = bandFrames(p, hopS);
  const w = Math.round((opts.windowS ?? 3) / hopS);
  const total = f.length;
  const minL = Math.round(opts.minS / hopS);
  const maxL = Math.round(opts.maxS / hopS);
  const first = Math.round(opts.startAfterS / hopS) + w;
  const last = total - Math.round(opts.endBeforeS / hopS) - w;
  // With a steady beat, only lengths of whole phrases (16 beats) are tried, then whole bars (4), so
  // the bars carry on across the join: the first that matches within `goodDb` is kept.
  const env = onsets(p);
  const beat = beatPeriod(env);
  const search = (unit: number | undefined) => {
    const lengths: number[] = [];
    if (unit) for (let k = Math.ceil(opts.minS / unit); k * unit <= opts.maxS; k++) lengths.push(k * unit);
    else for (let L = minL; L <= maxL; L++) lengths.push(L * hopS);
    let found = { a: 0, b: 0, length: 0, score: Number.POSITIVE_INFINITY, unit };
    for (let a = first; a < last - minL; a++) {
      for (const length of lengths) {
        const b = a + Math.round(length / hopS);
        if (b >= last) break;
        let d = 0;
        for (let k = -w; k < w; k++) {
          const fa = f[a + k] as Float64Array;
          const fb = f[b + k] as Float64Array;
          for (let j = 0; j < fa.length; j++) d += Math.abs((fa[j] ?? 0) - (fb[j] ?? 0));
        }
        d /= 2 * w * (f[0]?.length ?? 1);
        if (d < found.score) found = { a, b, length, score: d, unit };
      }
    }
    return found;
  };
  const tries = beat ? [16 * beat.seconds, 4 * beat.seconds].map(search) : [search(undefined)];
  const best = tries.find((t) => t.score <= (opts.goodDb ?? 4)) ?? tries.reduce((x, y) => (y.score < x.score ? y : x));
  const unit = best.unit;
  if (!Number.isFinite(best.score)) throw new Error('no loop fits those limits');
  // Then b slides (within a few hundredths of a second with a beat, else up to 0.6 s) until the
  // onsets in the four seconds before b line up with those before a.
  const aS = at(best.a * hopS);
  const per = at(ONSET_HOP_S);
  const look = Math.round(4 / ONSET_HOP_S);
  const ia = Math.round(aS / per);
  const ib0 = ia + Math.round(best.length / ONSET_HOP_S);
  const reach = Math.round((unit ? 0.06 : 0.6) / ONSET_HOP_S);
  let beatShift = 0;
  let beatR = Number.NEGATIVE_INFINITY;
  for (let s = -reach; s <= reach; s++) {
    const r = correlation(env.slice(ia - look, ia), env.slice(ib0 + s - look, ib0 + s));
    if (r > beatR) {
      beatR = r;
      beatShift = s;
    }
  }
  const bS = (ib0 + beatShift) * per;
  const span = at(0.5);
  const mono = p.ch[0] as Float32Array;
  const ref = mono.slice(aS - span, aS);
  let shift = 0;
  let bestR = Number.NEGATIVE_INFINITY;
  for (let s = -at(0.01); s <= at(0.01); s++) {
    const r = correlation(ref, mono.slice(bS + s - span, bS + s));
    if (r > bestR) {
      bestR = r;
      shift = s;
    }
  }
  return {
    a: aS / RATE,
    b: (bS + shift) / RATE,
    score: Math.round(best.score * 1000) / 1000,
    onsetMatch: Math.round(beatR * 100) / 100,
    ...(beat
      ? { bpm: Math.round(6000 / beat.seconds) / 100, beats: Math.round((bS / RATE - aS / RATE) / beat.seconds) }
      : {}),
  };
}

const ONSET_HOP_S = 0.01;

/**
 * The beat, if the music has a steady one: the strongest repeat of the onsets between 0.3 and
 * 1.2 seconds (50 to 200 BPM), kept only if it stands out (normalised autocorrelation over 0.3).
 */
function beatPeriod(env: Float32Array): { seconds: number; strength: number } | undefined {
  const mean = env.reduce((s, v) => s + v, 0) / Math.max(1, env.length);
  const x = env.map((v) => v - mean);
  let zero = 0;
  for (const v of x) zero += v * v;
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += (x[i] ?? 0) * (x[i + lag] ?? 0);
    return s;
  };
  const lo = Math.round(0.3 / ONSET_HOP_S);
  const hi = Math.round(1.2 / ONSET_HOP_S);
  let best = lo;
  let bestV = Number.NEGATIVE_INFINITY;
  const values: number[] = [];
  for (let lag = lo - 1; lag <= hi + 1; lag++) values[lag] = ac(lag);
  for (let lag = lo; lag <= hi; lag++)
    if ((values[lag] ?? 0) > bestV) {
      bestV = values[lag] ?? 0;
      best = lag;
    }
  const strength = bestV / (zero || 1);
  if (strength < 0.3) return undefined;
  const [y0, y1, y2] = [values[best - 1] ?? 0, values[best] ?? 0, values[best + 1] ?? 0];
  const refined = best + (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2 || 1);
  return { seconds: refined * ONSET_HOP_S, strength: Math.round(strength * 100) / 100 };
}

/** How sharply the sound rises every 10 ms (spectral flux of four bands): peaks at each attack. */
export function onsets(p: Pcm): Float32Array {
  const c = p.ch[0] as Float32Array;
  const hop = at(ONSET_HOP_S);
  const n = Math.floor(c.length / hop);
  // Band-pass filters (RBJ, Q 1) at about 80 Hz (a kick), 400 Hz, 2 kHz and 8 kHz (hats and clicks).
  const bands = [80, 400, 2000, 8000].map((f0) => {
    const w0 = (2 * Math.PI * f0) / RATE;
    const alpha = Math.sin(w0) / 2;
    return biquad(c, [alpha, 0, -alpha], [1 + alpha, -2 * Math.cos(w0), 1 - alpha]);
  });
  const out = new Float32Array(n);
  const prev = bands.map(() => 0);
  for (let i = 0; i < n; i++) {
    let flux = 0;
    bands.forEach((x, k) => {
      let e = 0;
      for (let j = i * hop; j < (i + 1) * hop; j++) e += (x[j] ?? 0) ** 2;
      const l = Math.log10(e + 1e-9);
      flux += Math.max(0, l - (prev[k] ?? l));
      prev[k] = l;
    });
    out[i] = flux;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// An ear: Gemini listens, since the scripts cannot

export const EAR_MODEL = 'gemini-3.1-pro-preview';

/**
 * Asks Gemini about some sounds, each labelled, for review only (never for the game). With `json`,
 * the answer is parsed as JSON.
 */
export async function ear(
  sounds: { label: string; bytes: Uint8Array; mime: string }[],
  question: string,
  json = false,
): Promise<string> {
  const key = requireKey('GEMINI_API_KEY');
  const parts: unknown[] = sounds.flatMap((s) => [
    { text: `Sound ${s.label}:` },
    { inline_data: { mime_type: s.mime, data: Buffer.from(s.bytes).toString('base64') } },
  ]);
  parts.push({ text: question });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EAR_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts }],
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    });
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (res.ok)
      return (body.candidates?.[0]?.content?.parts ?? [])
        .map((x) => x.text ?? '')
        .join('')
        .trim();
    if (attempt >= 2 || (res.status !== 429 && res.status < 500))
      throw new Error(`Gemini answered ${res.status}: ${body.error?.message ?? ''}`);
    await new Promise((done) => setTimeout(done, 5000 * (attempt + 1)));
  }
}

/**
 * A small MP3 of a sound for the ear (mono, 96 kbps), so long candidates stay well inside a request;
 * a short sound gets silence after it up to 1.5 seconds, as Gemini sometimes heard nothing in a
 * clip of a fraction of a second.
 */
export function forEar(p: Pcm): Buffer {
  const m = mono(p);
  const padded = new Float32Array(Math.max(m.length, Math.round(1.5 * RATE)));
  padded.set(m);
  return encodeMp3({ ch: [padded] }, '96k');
}

/**
 * Gemini rates some candidates against a brief and picks the best. It is asked twice, the second
 * time with the candidates in the opposite order, and the ratings are averaged: asked once, it
 * favoured whichever came first (24 October 2026).
 */
export async function rank(
  candidates: Uint8Array[],
  question: (labels: string) => string,
): Promise<{ best: number; ratings: number[]; notes: string[] }> {
  const letters = 'ABCDEFGH';
  const ratings = candidates.map(() => 0);
  const notes: string[][] = candidates.map(() => []);
  for (const reversed of [false, true]) {
    const order = candidates.map((_, i) => (reversed ? candidates.length - 1 - i : i));
    const sounds = order.map((i, k) => ({
      label: letters[k] as string,
      bytes: candidates[i] as Uint8Array,
      mime: 'audio/mp3',
    }));
    const labels = sounds.map((s) => s.label).join(', ');
    const answer = JSON.parse(
      await ear(
        sounds,
        `${question(labels)} Answer as JSON: {"ratings": {"A": 7, ...}, "notes": {"A": "a few words", ...}, "best": "A"}`,
        true,
      ),
    ) as { ratings: Record<string, number>; notes: Record<string, string> };
    order.forEach((i, k) => {
      ratings[i] = (ratings[i] ?? 0) + (Number(answer.ratings[letters[k] as string]) || 0) / 2;
      notes[i]?.push(answer.notes[letters[k] as string] ?? '');
    });
  }
  const best = ratings.indexOf(Math.max(...ratings));
  return { best, ratings, notes: notes.map((n) => n.filter(Boolean).join(' / ')) };
}

export function mono(p: Pcm): Float32Array {
  if (p.ch.length === 1) return p.ch[0] as Float32Array;
  const n = frames(p);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = p.ch.reduce((sum, c) => sum + (c[i] ?? 0), 0) / p.ch.length;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Files

/** A WAV file of 16-bit samples (what ElevenLabs' `pcm_44100` sends, with a header added). */
export function wav(pcm16: Uint8Array, channels: number, rate = RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm16.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm16.length, 40);
  return Buffer.concat([header, Buffer.from(pcm16)]);
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export const RECORDS = resolve(ROOT, 'art', 'audio.json');
export const PUBLIC_AUDIO = resolve(ROOT, 'public', 'assets', 'audio');
const MANIFEST = resolve(PUBLIC_AUDIO, 'audio.json');

/** The game's manifest entry for one file. */
export interface ManifestEntry {
  file: string;
  seconds: number;
  loop: boolean;
  /** Where the loop starts and ends, in seconds (loops only): play with Web Audio's loopStart and loopEnd. */
  loopStart?: number;
  loopEnd?: number;
  volume?: number;
}

/** Replaces entries of one section of public/assets/audio/audio.json, keeping the rest. */
export function updateManifest(section: 'sfx' | 'music', entries: Record<string, ManifestEntry>): void {
  const current = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, Record<string, ManifestEntry>>)
    : {};
  const merged = { ...(current[section] ?? {}), ...entries };
  const sorted = Object.fromEntries(Object.keys(merged).map((k) => [k, merged[k]]));
  const next = {
    about:
      'Sound effects and music for the game: see docs/assets/AUDIO.md. Loops carry loopStart and loopEnd in seconds; play them with an AudioBufferSourceNode (loop = true, loopStart, loopEnd), not the whole file. volume is a suggested starting mix, 0-1.',
    sfx: current.sfx ?? {},
    music: current.music ?? {},
    [section]: sorted,
  };
  mkdirSync(PUBLIC_AUDIO, { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);
}

/** Writes records into art/audio.json's `outputs`, re-reading the file first so hand edits are kept. */
export function updateRecords(outputs: Record<string, unknown>): void {
  const record = JSON.parse(readFileSync(RECORDS, 'utf8')) as { updated: string; outputs: Record<string, unknown> };
  record.outputs = { ...record.outputs, ...outputs };
  record.outputs = Object.fromEntries(
    Object.keys(record.outputs)
      .sort()
      .map((k) => [k, record.outputs[k]]),
  );
  record.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(RECORDS, `${JSON.stringify(record, null, 2)}\n`);
}

/** Runs `work` on every item, `width` at a time. */
export async function pool<T>(items: T[], width: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: width }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}
