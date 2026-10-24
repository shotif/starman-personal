/**
 * Makes the game's 2D pictures (docs/assets/IMAGES.md): key art, console screens, signs,
 * posters, the ground and horizon of Ross 128 b, and loading pictures. Driven by
 * art/images.json. Paintings, plates and poster art come from Gemini (the request shape of
 * scripts/art/concepts.ts); every word and the console screens are drawn by
 * scripts/art/drawings.ts. Each picture is recorded in art/images.json with its prompt, model,
 * date and checksums (D-28).
 *
 *   node scripts/art/images.ts generate [id ...]  # a new Gemini candidate for each named picture,
 *                                                 # or for every generated picture that has none yet
 *   node scripts/art/images.ts build [id ...]     # chosen candidates and drawings → public/assets/textures/
 *   node scripts/art/images.ts sheet              # a contact sheet for review, art/out/images/sheet.jpg
 *
 * Candidates are kept in art/out/images/<id>/<n>.jpg (ignored by git); the newest is used unless
 * the picture's entry names another with "pick".
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { drawScreen, POSTERS, SIGNS } from './drawings.ts';
import { requireKey } from './env.ts';
import { FONT_LICENCE, useFonts } from './fonts.ts';

type Kind = 'keyart' | 'screen' | 'sign' | 'poster' | 'ground' | 'ridge' | 'loading';
type Treatment = 'cover' | 'tile' | 'ridge' | 'sign' | 'poster' | 'screen';

interface ImageSpec {
  id: string;
  kind: Kind;
  width: number;
  height: number;
  treatment: Treatment;
  /** The drawing in scripts/art/drawings.ts, for screens, signs and posters. */
  design?: string;
  aspect?: string;
  style?: string;
  with?: string[];
  prompt?: string;
  /** Which part of the generated picture to keep when cropping (sharp's position). */
  focus?: string;
  /** The candidate to use; the newest when absent. */
  pick?: number;
  /** Trims this fraction of the generated picture from each side (x, y) first, e.g. a plate's rim. */
  inset?: [number, number];
}

interface Spec {
  about: string;
  model: string;
  imageSize: string;
  webpQuality: number;
  parts: Record<string, string>;
  styles: Record<string, string>;
  images: ImageSpec[];
  records?: Record<string, unknown>;
}

const SPEC_FILE = join('art', 'images.json');
const OUT = join('art', 'out', 'images');
const TARGET = join('public', 'assets', 'textures');
const spec = JSON.parse(await readFile(SPEC_FILE, 'utf8')) as Spec;
const [command = 'build', ...wanted] = process.argv.slice(2);
const chosen = spec.images.filter((i) => wanted.length === 0 || wanted.includes(i.id));
for (const id of wanted)
  if (!spec.images.some((i) => i.id === id)) throw new Error(`no picture "${id}" in ${SPEC_FILE}`);

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function promptFor(image: ImageSpec): string {
  if (!image.prompt || !image.style) throw new Error(`${image.id}: a generated picture needs a prompt and a style`);
  const parts = (image.with ?? []).map((key) => {
    const part = spec.parts[key];
    if (!part) throw new Error(`${image.id}: no part "${key}"`);
    return part;
  });
  const style = spec.styles[image.style];
  if (!style) throw new Error(`${image.id}: no style "${image.style}"`);
  return [image.prompt, ...parts, style].join(' ');
}

function candidates(id: string): number[] {
  const folder = join(OUT, id);
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .map((f) => /^(\d+)\.jpg$/.exec(f)?.[1])
    .filter((m): m is string => m !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------------------------
// Generating with Gemini
// ---------------------------------------------------------------------------------------------

async function generate(image: ImageSpec, key: string): Promise<void> {
  const prompt = promptFor(image);
  let bytes: Buffer | undefined;
  for (let attempt = 1; !bytes; attempt++) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: spec.model,
        input: [{ type: 'text', text: prompt }],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: image.aspect,
          image_size: spec.imageSize,
        },
        store: false,
      }),
    });
    const json = (await response.json()) as {
      status?: string;
      steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
      error?: { message?: string };
    };
    if (!response.ok) {
      if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
        await new Promise((done) => setTimeout(done, attempt * 8000));
        continue;
      }
      throw new Error(`${image.id}: HTTP ${response.status} ${json.error?.message ?? ''}`);
    }
    const found = (json.steps ?? [])
      .filter((s) => s.type === 'model_output')
      .flatMap((s) => s.content ?? [])
      .filter((b) => b.type === 'image' && b.data)
      .at(-1);
    if (!found?.data) {
      if (attempt < 3) continue;
      throw new Error(`${image.id}: no image in the response (status ${json.status})`);
    }
    bytes = Buffer.from(found.data, 'base64');
  }
  const folder = join(OUT, image.id);
  await mkdir(folder, { recursive: true });
  const number = (candidates(image.id).at(-1) ?? 0) + 1;
  const meta = await sharp(bytes).metadata();
  await writeFile(join(folder, `${number}.jpg`), bytes);
  await writeFile(
    join(folder, `${number}.json`),
    `${JSON.stringify(
      {
        id: image.id,
        candidate: number,
        service: 'Google Gemini',
        model: spec.model,
        prompt,
        aspect: image.aspect,
        made: new Date().toISOString(),
        width: meta.width,
        height: meta.height,
        bytes: bytes.length,
        sha256: sha256(bytes),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${image.id}: candidate ${number}, ${meta.width}x${meta.height}, ${(bytes.length / 1024).toFixed(0)} KB`);
}

async function generateAll(): Promise<void> {
  const key = requireKey('GEMINI_API_KEY');
  const queue = chosen.filter((i) => i.treatment !== 'screen' && (wanted.length > 0 || candidates(i.id).length === 0));
  const failures: string[] = [];
  const worker = async () => {
    for (let image = queue.shift(); image; image = queue.shift()) {
      try {
        await generate(image, key);
      } catch (error) {
        failures.push(String(error));
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (failures.length) throw new Error(failures.join('\n'));
}

// ---------------------------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------------------------

async function rgb(input: Buffer, w: number, h: number, position = 'centre'): Promise<Buffer> {
  return sharp(input).resize(w, h, { fit: 'cover', position }).removeAlpha().raw().toBuffer();
}

/** The picture with `inset` trimmed from each side. */
async function trim(input: Buffer, inset?: [number, number]): Promise<Buffer> {
  if (!inset) return input;
  const meta = await sharp(input).metadata();
  const [W, H] = [meta.width ?? 0, meta.height ?? 0];
  const [dx, dy] = [Math.round(W * inset[0]), Math.round(H * inset[1])];
  return sharp(input)
    .extract({ left: dx, top: dy, width: W - 2 * dx, height: H - 2 * dy })
    .png()
    .toBuffer();
}

async function blurRaw(data: Buffer | Uint8Array, w: number, h: number, channels: 1 | 3, sigma: number) {
  return sharp(data, { raw: { width: w, height: h, channels } })
    .blur(sigma)
    .raw()
    .toBuffer();
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Joins the two ends of a picture along x so that it wraps. The last `w - n` columns overlap the
 * first ones, and each row switches from the one to the other along the cheapest seam (where they
 * differ least), with a short feather: the way image quilting joins patches. With `cyclic`, the
 * seam ends where it starts, so the result also wraps the other way.
 */
function wrapColumns(img: Float32Array, w: number, h: number, n: number, cyclic: boolean): Float32Array {
  const m = w - n;
  const f = 5;
  const err = new Float32Array(h * m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < m; x++) {
      let e = x < f || x >= m - f ? Number.POSITIVE_INFINITY : 0;
      for (let c = 0; c < 3 && e < Number.POSITIVE_INFINITY; c++) {
        const d = img[(y * w + n + x) * 3 + c] - img[(y * w + x) * 3 + c];
        e += d * d;
      }
      err[y * m + x] = e;
    }
  }
  const solve = (start?: number) => {
    const cost = new Float64Array(h * m);
    const back = new Int8Array(h * m);
    for (let x = 0; x < m; x++) cost[x] = start === undefined || x === start ? err[x] : Number.POSITIVE_INFINITY;
    for (let y = 1; y < h; y++) {
      for (let x = 0; x < m; x++) {
        let best = cost[(y - 1) * m + x];
        let step = 0;
        if (x > 0 && cost[(y - 1) * m + x - 1] < best) {
          best = cost[(y - 1) * m + x - 1];
          step = -1;
        }
        if (x < m - 1 && cost[(y - 1) * m + x + 1] < best) {
          best = cost[(y - 1) * m + x + 1];
          step = 1;
        }
        cost[y * m + x] = err[y * m + x] + best;
        back[y * m + x] = step;
      }
    }
    let end = -1;
    for (let x = 0; x < m; x++) {
      if (start !== undefined && Math.abs(x - start) > 1) continue;
      if (end < 0 || cost[(h - 1) * m + x] < cost[(h - 1) * m + end]) end = x;
    }
    const path = new Int32Array(h);
    path[h - 1] = end;
    for (let y = h - 1; y > 0; y--) path[y - 1] = path[y] + back[y * m + path[y]];
    return { total: cost[(h - 1) * m + end], path };
  };
  let best = solve();
  if (cyclic) {
    best = { total: Number.POSITIVE_INFINITY, path: best.path };
    for (let s = f; s < m - f; s += 6) {
      const tried = solve(s);
      if (tried.total < best.total) best = tried;
    }
  }
  const out = new Float32Array(n * h * 3);
  for (let y = 0; y < h; y++) {
    const seam = best.path[y];
    for (let x = 0; x < n; x++) {
      const t = x < m ? smoothstep(seam - f, seam + f, x) : 1;
      for (let c = 0; c < 3; c++) {
        const wrapped = x < m ? img[(y * w + n + x) * 3 + c] : 0;
        out[(y * n + x) * 3 + c] = wrapped * (1 - t) + img[(y * w + x) * 3 + c] * t;
      }
    }
  }
  return out;
}

function transpose(img: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(img.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) out[(x * h + y) * 3 + c] = img[(y * w + x) * 3 + c];
  }
  return out;
}

/**
 * Makes a ground texture tile seamlessly: takes a patch a quarter larger than the tile at the
 * picture's own scale, evens out its lighting, then wraps it in x and in y along the cheapest
 * seams, so nothing inside the tile repeats.
 */
async function tile(input: Buffer, w: number, h: number): Promise<Buffer> {
  const W = w + Math.round(w / 4);
  const H = h + Math.round(h / 4);
  const meta = await sharp(input).metadata();
  let source = sharp(input).removeAlpha();
  if ((meta.width ?? 0) < W || (meta.height ?? 0) < H) source = source.resize(W, H, { fit: 'cover' });
  const data = await source.extract({ left: 0, top: 0, width: W, height: H }).raw().toBuffer();
  const blurred = await blurRaw(data, W, H, 3, W / 8);
  const mean = [0, 0, 0];
  for (let i = 0; i < data.length; i++) mean[i % 3] += data[i];
  for (let c = 0; c < 3; c++) mean[c] /= W * H;
  const flat = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) flat[i] = data[i] - blurred[i] + mean[i % 3];
  const across = wrapColumns(flat, W, H, w, false);
  const down = transpose(wrapColumns(transpose(across, w, H), H, w, h, true), h, w);
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(down[i])));
  return sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

/**
 * Cuts a horizon ridge out of its flat green backdrop: finds the ridge line in each column, joins
 * the two ends so the strip wraps round without a seam, gives it a soft alpha edge, and takes any
 * green spill out of the rock (green is never above red in rust-brown rock).
 */
async function ridge(input: Buffer, w: number, h: number): Promise<Buffer> {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const px = (x: number, y: number) => (y * W + x) * 3;
  const bg = [0, 0, 0];
  const rows = Math.max(2, Math.round(H * 0.03));
  for (let y = 0; y < rows; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) bg[c] += data[px(x, y) + c];
  for (let c = 0; c < 3; c++) bg[c] /= rows * W;
  const distance = (x: number, y: number) => {
    const i = px(x, y);
    return Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  };
  const threshold = 150;
  const top = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H - 1 && !(distance(x, y) > threshold && distance(x, y + 1) > threshold)) y++;
    const before = y > 0 ? distance(x, y - 1) : 0;
    top[x] = y - Math.min(1, before / threshold);
  }
  const median = Float32Array.from(top, (_, x) => {
    const near = [
      top[Math.max(0, x - 2)],
      top[Math.max(0, x - 1)],
      top[x],
      top[Math.min(W - 1, x + 1)],
      top[Math.min(W - 1, x + 2)],
    ];
    return near.sort((a, b) => a - b)[2];
  });
  const overlap = Math.round(W * 0.08);
  const W1 = W - overlap;
  const out = Buffer.alloc(W1 * H * 4);
  for (let x = 0; x < W1; x++) {
    const t = x < overlap ? smoothstep(0, 1, x / overlap) : 1;
    const xb = W1 + x;
    const edge = x < overlap ? median[xb] * (1 - t) + median[x] * t : median[x];
    for (let y = 0; y < H; y++) {
      const own = Math.min(H - 1, Math.max(y, Math.ceil(median[x]) + 6));
      const o = (y * W1 + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = data[px(x, own) + c];
        if (x < overlap) {
          const other = Math.min(H - 1, Math.max(y, Math.ceil(median[xb]) + 6));
          out[o + c] = Math.round(data[px(xb, other) + c] * (1 - t) + a * t);
        } else out[o + c] = a;
      }
      out[o + 1] = Math.min(out[o + 1], out[o], Math.round((out[o] + out[o + 2]) / 2 + 10));
      out[o + 3] = Math.round(255 * Math.min(1, Math.max(0, y - edge + 0.5)));
    }
  }
  const lowestTop = Math.min(...median);
  const keep = Math.round(W1 / (w / h));
  const cropTop = Math.max(0, Math.min(Math.floor(lowestTop) - 8, H - keep));
  return sharp(out, { raw: { width: W1, height: H, channels: 4 } })
    .extract({ left: 0, top: cropTop, width: W1, height: Math.min(H - cropTop, keep) })
    .resize(w, h, { fit: 'fill' })
    .png()
    .toBuffer();
}

/** Lays the drawn lettering over a generated plate so the plate's wear and grime show through. */
async function sign(input: Buffer, design: string, w: number, h: number): Promise<Buffer> {
  const draw = SIGNS[design];
  if (!draw) throw new Error(`no sign design "${design}"`);
  const plate = await rgb(input, w, h);
  const art = await sharp(Buffer.from(draw(w, h)))
    .ensureAlpha()
    .raw()
    .toBuffer();
  const lum = new Uint8Array(w * h);
  let mean = 0;
  for (let i = 0; i < w * h; i++) {
    lum[i] = Math.round(0.299 * plate[i * 3] + 0.587 * plate[i * 3 + 1] + 0.114 * plate[i * 3 + 2]);
    mean += lum[i];
  }
  mean /= w * h;
  const soft = await blurRaw(lum, w, h, 1, 5);
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const detail = (lum[i] - soft[i]) / 255;
    const wear = smoothstep(0.05, 0.16, detail);
    const shade = Math.min(1.3, Math.max(0.55, lum[i] / Math.max(1, mean)));
    const a = (art[i * 4 + 3] / 255) * (1 - 0.85 * wear);
    for (let c = 0; c < 3; c++) {
      const paint = art[i * 4 + c] * (0.62 + 0.38 * shade);
      out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(plate[i * 3 + c] * (1 - a) + paint * a)));
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

/** Sets generated poster art in a printed layout, then adds paper grain, folds and worn edges. */
async function poster(input: Buffer, design: string, w: number, h: number, focus = 'centre'): Promise<Buffer> {
  const layout = POSTERS[design]?.(w, h);
  if (!layout) throw new Error(`no poster design "${design}"`);
  const box = layout.art;
  const art = await sharp(input)
    .resize(Math.round(box.w), Math.round(box.h), { fit: 'cover', position: focus })
    .png()
    .toBuffer();
  const printed = await sharp(Buffer.from(layout.under))
    .composite([
      { input: art, left: Math.round(box.x), top: Math.round(box.y) },
      { input: Buffer.from(layout.over), left: 0, top: 0 },
    ])
    .removeAlpha()
    .raw()
    .toBuffer();
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const out = Buffer.alloc(printed.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const grain = (rand() - 0.5) * 16;
      const fold = Math.exp(-(((x - w / 2) / 1.6) ** 2)) * 18 + Math.exp(-(((y - h / 2) / 1.6) ** 2)) * 14;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const tired = 1 - 0.18 * (1 - smoothstep(0, 26, edge));
      for (let c = 0; c < 3; c++) {
        out[i + c] = Math.max(0, Math.min(255, Math.round((printed[i + c] + grain + fold) * tired)));
      }
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------

async function buildOne(image: ImageSpec, fonts: Awaited<ReturnType<typeof useFonts>>) {
  const { width: w, height: h } = image;
  let png: Buffer;
  let source: Record<string, unknown>;
  if (image.treatment === 'screen') {
    if (!image.design) throw new Error(`${image.id}: a screen needs a design`);
    png = await drawScreen(image.design, w, h);
    source = { made: 'drawn', script: 'scripts/art/drawings.ts', design: image.design };
  } else {
    const list = candidates(image.id);
    const number = image.pick ?? list.at(-1);
    if (number === undefined || !list.includes(number)) {
      throw new Error(`${image.id}: no candidate yet; run "node scripts/art/images.ts generate ${image.id}"`);
    }
    const raw = await trim(await readFile(join(OUT, image.id, `${number}.jpg`)), image.inset);
    const made = JSON.parse(await readFile(join(OUT, image.id, `${number}.json`), 'utf8')) as Record<string, unknown>;
    source = {
      made: 'generated',
      service: made.service,
      model: made.model,
      prompt: made.prompt,
      date: made.made,
      candidate: number,
      candidateSize: `${made.width}x${made.height}`,
      candidateSha256: made.sha256,
      ...(image.inset ? { inset: image.inset } : {}),
      ...(image.design ? { drawnOver: 'scripts/art/drawings.ts', design: image.design } : {}),
    };
    if (image.treatment === 'cover') {
      png = await sharp(raw)
        .resize(w, h, { fit: 'cover', position: image.focus ?? 'centre' })
        .png()
        .toBuffer();
    } else if (image.treatment === 'tile') png = await tile(raw, w, h);
    else if (image.treatment === 'ridge') png = await ridge(raw, w, h);
    else if (image.treatment === 'sign') png = await sign(raw, image.design ?? '', w, h);
    else png = await poster(raw, image.design ?? '', w, h, image.focus);
  }
  const webp = await sharp(png)
    .webp({ quality: spec.webpQuality, alphaQuality: 90, effort: 6, exact: true, smartSubsample: true })
    .toBuffer();
  const file = `${image.id}.webp`;
  await writeFile(join(TARGET, file), webp);
  const lettering = image.design ? fonts.map((f) => ({ font: `${f.family} ${f.weight}`, url: f.url })) : undefined;
  return {
    manifest: { file, width: w, height: h, kind: image.kind },
    record: {
      kind: image.kind,
      file: join(TARGET, file),
      width: w,
      height: h,
      bytes: webp.length,
      sha256: sha256(webp),
      built: new Date().toISOString().slice(0, 10),
      licence:
        source.made === 'drawn'
          ? 'Made for Starman Lightkeeper (drawn by script); shared with the project'
          : 'Made for Starman Lightkeeper with Google Gemini on the owner’s key; Google claims no ownership of generated images; shared with the project',
      ...(lettering ? { fonts: { licence: FONT_LICENCE, files: lettering } } : {}),
      source,
    },
  };
}

async function buildAll(): Promise<void> {
  await mkdir(TARGET, { recursive: true });
  const fonts = await useFonts();
  const manifestFile = join(TARGET, 'textures.json');
  const manifest = existsSync(manifestFile)
    ? (JSON.parse(await readFile(manifestFile, 'utf8')) as Record<string, unknown>)
    : {};
  const records = spec.records ?? {};
  for (const image of chosen) {
    const { manifest: entry, record } = await buildOne(image, fonts);
    manifest[image.id] = entry;
    records[image.id] = record;
    console.log(`${image.id}: ${image.width}x${image.height}, ${(record.bytes / 1024).toFixed(0)} KB`);
  }
  const order = spec.images.map((i) => i.id);
  const sorted = Object.fromEntries(
    Object.entries(manifest)
      .filter(([id]) => order.includes(id))
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)),
  );
  await writeFile(manifestFile, `${JSON.stringify(sorted, null, 2)}\n`);
  spec.records = Object.fromEntries(
    Object.entries(records)
      .filter(([id]) => order.includes(id))
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)),
  );
  await writeFile(SPEC_FILE, `${JSON.stringify(spec, null, 2)}\n`);
  const total = Object.values(spec.records).reduce((s: number, r) => s + ((r as { bytes: number }).bytes ?? 0), 0);
  console.log(`${Object.keys(sorted).length} pictures in ${manifestFile}, ${(total / 1024 / 1024).toFixed(2)} MB`);
}

/** A labelled contact sheet of the built pictures, for looking at them all at once. */
async function sheet(): Promise<void> {
  const cell = 320;
  const tiles: OverlayOptions[] = [];
  const list = chosen.filter((i) => existsSync(join(TARGET, `${i.id}.webp`)));
  const columns = 4;
  list.forEach((image, k) => {
    const left = (k % columns) * cell;
    const top = Math.floor(k / columns) * (cell + 20);
    tiles.push({ input: join(TARGET, `${image.id}.webp`), left, top });
  });
  const inputs = await Promise.all(
    tiles.map(async (t) =>
      sharp(t.input as string)
        .resize(cell, cell, { fit: 'contain', background: '#303030' })
        .flatten({ background: '#303030' })
        .png()
        .toBuffer(),
    ),
  );
  const rows = Math.ceil(list.length / columns);
  await mkdir(OUT, { recursive: true });
  await sharp({ create: { width: columns * cell, height: rows * (cell + 20), channels: 3, background: '#181818' } })
    .composite(tiles.map((t, k) => ({ ...t, input: inputs[k] })))
    .jpeg({ quality: 85 })
    .toFile(join(OUT, 'sheet.jpg'));
  console.log(`${join(OUT, 'sheet.jpg')}: ${list.map((i) => i.id).join(', ')}`);
}

if (command === 'generate') await generateAll();
else if (command === 'build') await buildAll();
else if (command === 'sheet') await sheet();
else throw new Error(`unknown command "${command}": use generate, build or sheet`);
