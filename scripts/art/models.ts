/**
 * The game's 3D models (docs/assets/MODELS.md), built from the list in art/models.json: a Gemini
 * concept picture, a Meshy image-to-3D model, then the same preparation for phones as the style
 * test's props (weld, simplify to the budget, WebP textures, quantised positions), turned to face
 * +Z, scaled to its real size and standing at y = 0. Every step writes its record back into
 * art/models.json (D-28).
 *
 *   node scripts/art/models.ts concepts [id ...] [--views]  # concept pictures → art/out/models/concepts/
 *   node scripts/art/models.ts meshy [id ...] [--floor N]   # Meshy models → art/out/models/meshy/
 *   node scripts/art/models.ts remesh id ...                # a `source` model remeshed to its budget (5 credits)
 *   node scripts/art/models.ts process [id ...]             # for the game → public/assets/models/
 *   node scripts/art/models.ts preview [id ...]             # six views each → art/out/models/previews/
 *
 * With no ids, every model in the list. A model with `views` also gets those extra views of the
 * same object, drawn by Gemini from its concept, and Meshy then builds it from all of them
 * (multi-image-to-3D), so it need not guess the far side; `--views` redraws only those views.
 * `meshy` stops before a task would take the balance under `--floor` credits (default 300; below
 * that, use trellis.cpp: npm run art:trellis). `preview` also writes a small copy of each sheet to
 * docs/assets/models/.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type Document, getBounds, type mat4, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  clearNodeTransform,
  compactPrimitive,
  dedup,
  flatten,
  prune,
  quantize,
  simplify,
  textureCompress,
  transformMesh,
  weld,
} from '@gltf-transform/functions';
import { chromium } from '@playwright/test';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { createServer } from 'vite';
import { geminiPicture, meshyBalance, meshyImageTo3d, meshyRemesh } from './services.ts';

interface Model {
  id: string;
  style: string;
  size: number;
  triangles: number;
  texture: number;
  turn: number;
  prompt: string;
  /** A style line that replaces the usual three-quarter framing. */
  frame?: string;
  /** Extra views of the same object for Meshy, each saying where it is seen from and what is there. */
  views?: string[];
  /**
   * Cuts away what Meshy invented outside this box (in its own axes and units, before the turn):
   * every triangle whose centre lies outside is dropped.
   */
  keep?: { min?: [number, number, number]; max?: [number, number, number]; why?: string };
  /** A Meshy model made before this list (the style test's), prepared like the others but never remade. */
  source?: string;
  record?: Record<string, unknown> & { discarded?: unknown[] };
}
interface List {
  conceptModel: string;
  styles: Record<string, string>;
  meshy: Record<string, unknown>;
  models: Model[];
}

const LIST = join('art', 'models.json');
const OUT = join('art', 'out', 'models');
const PUBLIC = join('public', 'assets', 'models');
const DOCS = join('docs', 'assets', 'models');
const list = JSON.parse(await readFile(LIST, 'utf8')) as List;
const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest.splice(i, 2)[1] : undefined;
};
const floor = Number(flag('--floor') ?? 300);
const viewsOnly = rest.includes('--views');
if (viewsOnly) rest.splice(rest.indexOf('--views'), 1);
const models = list.models.filter((m) => rest.length === 0 || rest.includes(m.id));
const unknown = rest.filter((id) => !list.models.some((m) => m.id === id));
if (unknown.length > 0) throw new Error(`not in ${LIST}: ${unknown.join(', ')}`);

/** The models this run makes pictures and Meshy models for (`source` models are made already). */
const toMake = () => models.filter((m) => !m.source);
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const today = () => new Date().toISOString();

/**
 * Saves one model's record after each finished step. Only that record is written, over a fresh
 * read of the list, so edits made meanwhile (a prompt, a turn) and other runs' records survive.
 */
let saving = Promise.resolve();
function save(model: Model): Promise<void> {
  saving = saving.then(async () => {
    const current = JSON.parse(await readFile(LIST, 'utf8')) as List;
    const entry = current.models.find((m) => m.id === model.id);
    if (entry) entry.record = model.record;
    await writeFile(LIST, `${JSON.stringify(current, null, 2)}\n`);
  });
  return saving;
}

/** Runs `work` over `items`, at most `limit` at a time. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await work(item).catch((error: Error) => {
          failures.push(error.message);
          console.error(error.message);
        });
      }
    }),
  );
  if (failures.length > 0) process.exitCode = 1;
}

/** Keeps the step being replaced, so every credit spent stays on record. */
function retire(model: Model, step: 'concept' | 'meshy') {
  const old = model.record?.[step];
  if (!old || !model.record) return;
  model.record.discarded = [...(model.record.discarded ?? []), { [step]: old, replaced: today() }];
}

interface Concept {
  prompt: string;
  file: string;
  sha256: string;
  views?: { prompt: string; file: string; sha256: string; made: string }[];
}

async function concepts() {
  await mkdir(join(OUT, 'concepts'), { recursive: true });
  await pool(toMake(), 6, async (model) => {
    model.record ??= {};
    const file = join(OUT, 'concepts', `${model.id}.jpg`);
    const old = model.record.concept as Concept | undefined;
    retire(model, 'concept');
    let concept: Record<string, unknown>;
    if (viewsOnly && old && existsSync(file)) {
      concept = { ...old };
    } else {
      const prompt = `${model.prompt} ${list.styles[model.style]} ${list.styles[model.frame ?? 'frame']}`;
      const bytes = await geminiPicture(list.conceptModel, prompt).catch((error: Error) => {
        throw new Error(`${model.id}: ${error.message}`);
      });
      await writeFile(file, bytes);
      concept = {
        service: 'Google Gemini',
        model: list.conceptModel,
        prompt,
        file,
        sha256: sha256(bytes),
        bytes: bytes.length,
        made: today(),
        approxCostUsd: 0.1,
      };
      console.log(`${model.id}: concept ${(bytes.length / 1024).toFixed(0)} KB`);
    }
    const views = [];
    const reference = await readFile(file);
    for (const [i, view] of (model.views ?? []).entries()) {
      const prompt = `${list.styles.sameObject} ${view} ${list.styles.viewFrame}`;
      const bytes = await geminiPicture(list.conceptModel, prompt, [reference]).catch((error: Error) => {
        throw new Error(`${model.id} view ${i + 1}: ${error.message}`);
      });
      const viewFile = join(OUT, 'concepts', `${model.id}-view${i + 1}.jpg`);
      await writeFile(viewFile, bytes);
      views.push({ prompt, file: viewFile, sha256: sha256(bytes), made: today(), approxCostUsd: 0.1 });
      console.log(`${model.id}: view ${i + 1} ${(bytes.length / 1024).toFixed(0)} KB`);
    }
    if (views.length > 0) concept.views = views;
    else delete concept.views;
    model.record.concept = concept;
    await save(model);
  });
}

async function meshy() {
  await mkdir(join(OUT, 'meshy'), { recursive: true });
  let balance = await meshyBalance();
  console.log(`Meshy credits before: ${balance ?? 'unknown'} (floor ${floor})`);
  let spent = 0;
  await pool(toMake(), 5, async (model) => {
    // Reserve the dearest price (35) before starting, so parallel tasks cannot cross the floor.
    if (balance === null || balance - 35 < floor) {
      throw new Error(`${model.id}: skipped, the balance (${balance}) would go under the floor (${floor})`);
    }
    balance -= 35;
    const concept = model.record?.concept as Concept | undefined;
    const files = [join(OUT, 'concepts', `${model.id}.jpg`), ...(concept?.views ?? []).map((v) => v.file)];
    const pictures = await Promise.all(files.map((f) => readFile(f)));
    const settings = { ...list.meshy, target_polycount: model.triangles };
    delete (settings as Record<string, unknown>).note;
    const made = await meshyImageTo3d(pictures, settings, (task) =>
      console.log(`${model.id}: Meshy task ${task}`),
    ).catch((error: Error) => {
      balance = (balance ?? 0) + 35;
      throw new Error(`${model.id}: ${error.message}`);
    });
    balance += 35 - (made.credits ?? 35);
    spent += made.credits ?? 0;
    const glb = join(OUT, 'meshy', `${model.id}.glb`);
    const previous = (model.record?.meshy as { task?: string } | undefined)?.task;
    if (previous && existsSync(glb)) await rename(glb, join(OUT, 'meshy', `${model.id}-${previous}.glb`));
    await writeFile(glb, made.glb);
    model.record ??= {};
    retire(model, 'meshy');
    model.record.meshy = {
      service: `Meshy ${made.endpoint}`,
      task: made.task,
      settings,
      credits: made.credits,
      seconds: made.seconds,
      made: today(),
      input: files.map((file, i) => ({ file, sha256: sha256(pictures[i]) })),
      output: { bytes: made.glb.length, sha256: sha256(made.glb) },
      licence: "Meshy paid plan: private, the owner's to use commercially",
    };
    await save(model);
    console.log(`${model.id}: ${(made.glb.length / 1e6).toFixed(1)} MB, ${made.credits} credits`);
  });
  const after = await meshyBalance();
  console.log(`Meshy credits after: ${after ?? 'unknown'} (this run used ${spent})`);
}

/**
 * Remeshes a model made before this list (`source`, with more triangles than its budget) with Meshy,
 * which bakes its textures again, so it can reach a budget that simplifying around its texture seams
 * cannot.
 */
async function remesh() {
  await mkdir(join(OUT, 'meshy'), { recursive: true });
  await pool(
    models.filter((m) => m.source),
    4,
    async (model) => {
      const task = (model.record?.meshy as { task?: string } | undefined)?.task;
      if (!task) throw new Error(`${model.id}: no Meshy task on record to remesh`);
      const made = await meshyRemesh(task, model.triangles).catch((error: Error) => {
        throw new Error(`${model.id}: ${error.message}`);
      });
      await writeFile(join(OUT, 'meshy', `${model.id}.glb`), made.glb);
      model.record ??= {};
      model.record.remesh = {
        service: 'Meshy remesh',
        task: made.task,
        input: task,
        settings: { topology: 'triangle', target_polycount: model.triangles },
        credits: made.credits,
        seconds: made.seconds,
        made: today(),
        output: { bytes: made.glb.length, sha256: sha256(made.glb) },
      };
      await save(model);
      console.log(`${model.id}: remeshed, ${made.credits} credits`);
    },
  );
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const countTriangles = (doc: Document) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0);

/** Bakes every node's transform into its mesh, so the model's own vertices can be turned and moved. */
async function bake(doc: Document) {
  await doc.transform(flatten());
  for (const node of doc.getRoot().listNodes()) {
    if (node.getMesh()) clearNodeTransform(node);
  }
}

/** Drops every triangle whose centre lies outside the box, and the vertices only they used. */
function crop(doc: Document, min: number[], max: number[]) {
  for (const prim of doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())) {
    const indices = prim.getIndices();
    const position = prim.getAttribute('POSITION');
    if (!indices || !position) continue;
    const kept: number[] = [];
    const corner: number[] = [];
    for (let t = 0; t < indices.getCount(); t += 3) {
      const tri = [indices.getScalar(t), indices.getScalar(t + 1), indices.getScalar(t + 2)];
      const centre = [0, 0, 0];
      for (const i of tri) {
        position.getElement(i, corner);
        for (let k = 0; k < 3; k++) centre[k] += corner[k] / 3;
      }
      if (centre.every((v, k) => v >= min[k] && v <= max[k])) kept.push(...tri);
    }
    indices.setArray(new Uint32Array(kept));
    compactPrimitive(prim);
  }
}

/** Column-major 4×4: scale `s`, turn `degrees` about +Y, then move by `t`. */
function matrix(s: number, degrees: number, t: [number, number, number]): mat4 {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a) * s;
  const n = Math.sin(a) * s;
  return [c, 0, -n, 0, 0, s, 0, 0, n, 0, c, 0, t[0], t[1], t[2], 1];
}

async function processModels() {
  await MeshoptSimplifier.ready;
  await mkdir(PUBLIC, { recursive: true });
  const manifestFile = join(PUBLIC, 'models.json');
  const manifest = existsSync(manifestFile)
    ? (JSON.parse(await readFile(manifestFile, 'utf8')) as { models: Record<string, unknown> })
    : { models: {} };
  for (const model of models) {
    const own = join(OUT, 'meshy', `${model.id}.glb`);
    const input = existsSync(own) || !model.source ? own : model.source;
    if (!existsSync(input)) {
      console.warn(`skip ${model.id}: ${input} not made yet`);
      continue;
    }
    const doc = await io.read(input);
    const before = countTriangles(doc);
    await doc.transform(weld());
    await bake(doc);
    if (model.keep) crop(doc, model.keep.min ?? [-1e9, -1e9, -1e9], model.keep.max ?? [1e9, 1e9, 1e9]);
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const meshes = doc.getRoot().listMeshes();
    // Turn first, then measure, so the size and the base are those of the turned model.
    for (const mesh of meshes) transformMesh(mesh, matrix(1, model.turn, [0, 0, 0]));
    const turned = getBounds(scene);
    const extent = turned.max.map((v, i) => v - turned.min[i]);
    const s = model.size / Math.max(...extent);
    const centre = [(turned.min[0] + turned.max[0]) / 2, turned.min[1], (turned.min[2] + turned.max[2]) / 2];
    for (const mesh of meshes) transformMesh(mesh, matrix(s, 0, [-centre[0] * s, -centre[1] * s, -centre[2] * s]));
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, model.triangles / before), error: 0.06 }),
      dedup(),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [model.texture, model.texture] }),
      quantize(),
    );
    const after = countTriangles(doc);
    const bounds = getBounds(scene);
    const bytes = await io.writeBinary(doc);
    const file = `${model.id}.glb`;
    await writeFile(join(PUBLIC, file), bytes);
    const dims = bounds.max.map((v, i) => Number((v - bounds.min[i]).toFixed(3)));
    manifest.models[model.id] = {
      file,
      size: model.size,
      dimensions: dims,
      triangles: Math.round(after),
      texture: model.texture,
      front: '+z',
      bytes: bytes.length,
    };
    model.record ??= {};
    model.record.output = {
      file: `public/assets/models/${file}`,
      bytes: bytes.length,
      sha256: sha256(bytes),
      triangles: { made: Math.round(before), shipped: Math.round(after) },
      textures: `${model.texture} px WebP`,
      turn: model.turn,
      front: '+z',
      dimensions: dims,
      made: today(),
    };
    await save(model);
    console.log(
      `${file}: ${Math.round(before)} → ${Math.round(after)} triangles, ${dims.join(' × ')} m, base ${bounds.min[1].toFixed(3)}, ${(bytes.length / 1e6).toFixed(2)} MB`,
    );
  }
  const sorted = Object.fromEntries(
    list.models.filter((m) => m.id in manifest.models).map((m) => [m.id, manifest.models[m.id]]),
  );
  await writeFile(
    manifestFile,
    `${JSON.stringify({ about: 'Every model faces +z and stands at y = 0; sizes in metres (docs/assets/MODELS.md).', models: sorted }, null, 2)}\n`,
  );
}

async function preview() {
  await mkdir(join(OUT, 'previews'), { recursive: true });
  await mkdir(DOCS, { recursive: true });
  const server = await createServer({
    configFile: false,
    root: resolve('scripts', 'art', 'model-preview'),
    publicDir: resolve('public'),
    logLevel: 'warn',
    server: { port: 5397 },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5397/';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--enable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 840 } });
    page.on('pageerror', (error) => console.error(`page: ${error.message}`));
    await page.goto(url);
    await page.waitForFunction(() => 'preview' in window, null, { timeout: 120_000 });
    for (const model of models) {
      if (!existsSync(join(PUBLIC, `${model.id}.glb`))) {
        console.warn(`skip ${model.id}: not processed yet`);
        continue;
      }
      const triangles = model.record?.output as { triangles?: { shipped?: number } } | undefined;
      const title = `<b>${model.id}</b> <span>${model.size} m, ${triangles?.triangles?.shipped ?? '?'} triangles, ${model.texture} px, turn ${model.turn}°</span>`;
      const shown = await page.evaluate(
        async ([file, heading]) => {
          const w = window as unknown as {
            preview: { show(url: string, title: string): Promise<{ min: number[]; max: number[] }> };
          };
          return w.preview.show(file, heading);
        },
        [`/assets/models/${model.id}.glb?v=${Date.now()}`, title] as const,
      );
      const png = join(OUT, 'previews', `${model.id}.png`);
      await page.locator('#sheet').screenshot({ path: png });
      await sharp(png)
        .resize(720)
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(join(DOCS, `${model.id}.jpg`));
      const size = shown.max.map((v, i) => (v - shown.min[i]).toFixed(2)).join(' × ');
      console.log(`${model.id}: in Babylon ${size} m, base ${shown.min[1].toFixed(3)} → ${png}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  await overview();
}

/** One picture of every model from the front three-quarter, for docs/assets/MODELS.md. */
async function overview() {
  const cell = 240;
  const columns = 6;
  const shown = list.models.filter((m) => existsSync(join(OUT, 'previews', `${m.id}.png`)));
  const tiles = await Promise.all(
    shown.map(async (model, i) => {
      const view = await sharp(join(OUT, 'previews', `${model.id}.png`))
        .extract({ left: 400, top: 40, width: 400, height: 400 }) // the three-quarter view
        .resize(cell, cell)
        .toBuffer();
      const label = Buffer.from(
        `<svg width="${cell}" height="26"><rect width="100%" height="100%" fill="#2c2f34"/>` +
          `<text x="6" y="18" font-size="15" fill="#f2f2f2" font-family="sans-serif">${model.id}</text></svg>`,
      );
      const input = await sharp(view)
        .composite([{ input: label, top: 0, left: 0 }])
        .toBuffer();
      return { input, left: (i % columns) * cell, top: Math.floor(i / columns) * cell };
    }),
  );
  const rows = Math.ceil(shown.length / columns);
  await sharp({ create: { width: columns * cell, height: rows * cell, channels: 3, background: '#6b6e73' } })
    .composite(tiles)
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(join(DOCS, 'overview.jpg'));
}

const commands: Record<string, () => Promise<void>> = { concepts, meshy, remesh, process: processModels, preview };
const run = commands[command ?? ''];
if (!run) throw new Error(`usage: node scripts/art/models.ts ${Object.keys(commands).join('|')} [id ...]`);
await run();
