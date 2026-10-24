/**
 * Turns the style test's concept pictures into 3D models with Meshy's image-to-3D API
 * (docs/design/STYLE_TEST.md), using the owner's subscription. Each model is saved with a record of
 * its task, settings and credits in art/out/meshy/ (ignored by git).
 *
 *   node scripts/art/meshy.ts [id ...]     # all subjects in art/concepts.json, or those named
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireKey } from './env.ts';

const API = 'https://api.meshy.ai/openapi/v1/image-to-3d';
/** For props a phone can carry: remeshed to triangles near the style test's budget, with PBR maps. */
const SETTINGS = {
  ai_model: 'latest',
  should_remesh: true,
  topology: 'triangle',
  target_polycount: 15000,
  should_texture: true,
  enable_pbr: true,
  texture_resolution: '2k',
  target_formats: ['glb'],
  origin_at: 'bottom',
} as const;

const key = requireKey('MESHY_API_KEY');
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const concepts = JSON.parse(await readFile(join('art', 'concepts.json'), 'utf8')) as { subjects: { id: string }[] };
const wanted = process.argv.slice(2);
const ids = concepts.subjects.map((s) => s.id).filter((id) => wanted.length === 0 || wanted.includes(id));
const folder = join('art', 'out', 'meshy');
await mkdir(folder, { recursive: true });

interface Task {
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress: number;
  consumed_credits?: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await Promise.all(
  ids.map(async (id) => {
    const picture = await readFile(join('art', 'out', 'concepts', `${id}.jpg`));
    const started = Date.now();
    const created = await fetch(API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image_url: `data:image/jpeg;base64,${picture.toString('base64')}`, ...SETTINGS }),
    });
    if (!created.ok) throw new Error(`${id}: HTTP ${created.status} ${await created.text()}`);
    const { result: taskId } = (await created.json()) as { result: string };
    console.log(`${id}: task ${taskId}`);

    let task: Task;
    for (;;) {
      await sleep(10_000);
      const polled = await fetch(`${API}/${taskId}`, { headers });
      if (!polled.ok) throw new Error(`${id}: HTTP ${polled.status} while polling`);
      task = (await polled.json()) as Task;
      if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(task.status)) break;
    }
    if (task.status !== 'SUCCEEDED' || !task.model_urls?.glb) {
      throw new Error(`${id}: ${task.status} ${task.task_error?.message ?? ''}`);
    }
    const model = Buffer.from(await (await fetch(task.model_urls.glb)).arrayBuffer());
    await writeFile(join(folder, `${id}-meshy.glb`), model);
    await writeFile(
      join(folder, `${id}-meshy.json`),
      `${JSON.stringify(
        {
          id: `${id}-meshy`,
          service: 'Meshy image-to-3D',
          task: taskId,
          settings: SETTINGS,
          credits: task.consumed_credits,
          seconds: Math.round((Date.now() - started) / 1000),
          made: new Date().toISOString(),
          input: { file: `art/out/concepts/${id}.jpg`, sha256: createHash('sha256').update(picture).digest('hex') },
          output: { bytes: model.length, sha256: createHash('sha256').update(model).digest('hex') },
          licence: "Meshy paid plan: private, the owner's to use commercially",
        },
        null,
        2,
      )}\n`,
    );
    console.log(`${id}: ${(model.length / 1e6).toFixed(1)} MB, ${task.consumed_credits} credits`);
  }),
);
