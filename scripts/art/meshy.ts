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
import { meshyBalance, meshyImageTo3d } from './services.ts';

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

const concepts = JSON.parse(await readFile(join('art', 'concepts.json'), 'utf8')) as { subjects: { id: string }[] };
const wanted = process.argv.slice(2);
const ids = concepts.subjects.map((s) => s.id).filter((id) => wanted.length === 0 || wanted.includes(id));
const folder = join('art', 'out', 'meshy');
await mkdir(folder, { recursive: true });

const before = await meshyBalance();
console.log(`Meshy credits before: ${before ?? 'unknown'}`);

await Promise.all(
  ids.map(async (id) => {
    const picture = await readFile(join('art', 'out', 'concepts', `${id}.jpg`));
    const made = await meshyImageTo3d([picture], SETTINGS, (task) => console.log(`${id}: task ${task}`)).catch(
      (error: Error) => {
        throw new Error(`${id}: ${error.message}`);
      },
    );
    const model = made.glb;
    await writeFile(join(folder, `${id}-meshy.glb`), model);
    await writeFile(
      join(folder, `${id}-meshy.json`),
      `${JSON.stringify(
        {
          id: `${id}-meshy`,
          service: 'Meshy image-to-3D',
          task: made.task,
          settings: SETTINGS,
          credits: made.credits,
          seconds: made.seconds,
          made: new Date().toISOString(),
          input: { file: `art/out/concepts/${id}.jpg`, sha256: createHash('sha256').update(picture).digest('hex') },
          output: { bytes: model.length, sha256: createHash('sha256').update(model).digest('hex') },
          licence: "Meshy paid plan: private, the owner's to use commercially",
        },
        null,
        2,
      )}\n`,
    );
    console.log(`${id}: ${(model.length / 1e6).toFixed(1)} MB, ${made.credits} credits`);
  }),
);

const after = await meshyBalance();
console.log(
  `Meshy credits after: ${after ?? 'unknown'}${before !== null && after !== null ? ` (used ${before - after})` : ''}`,
);
if (after !== null && after < 300) {
  console.log('Fewer than 300 credits left: switch to trellis.cpp (npm run art:trellis) when they run out.');
}
