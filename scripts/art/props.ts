/**
 * Prepares the style test's candidates for phones, the same way for both tools
 * (docs/design/STYLE_TEST.md): welded, simplified to about 15,000 triangles, textures at 1024 px in
 * WebP, positions quantised (read by Babylon without a decoder). Writes public/assets/props/ with a
 * manifest the game reads, and art/props.json with where every file came from (D-28).
 *
 *   node scripts/art/props.ts
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const TARGET_TRIANGLES = 15_000;
const TEXTURE_SIZE = 1024;

/**
 * How big each subject is shown, in metres along its longest side: the small ones at about twice
 * life size, so their detail can be judged on a phone.
 */
const SIZES: Record<string, number> = { sidearm: 0.48, helmet: 0.6, locker: 1.25, terminal: 0.8 };
const TOOLS = [
  { id: 'trellis', label: 'trellis.cpp (open source)', file: (s: string) => join('art', 'out', `${s}-trellis.glb`) },
  { id: 'meshy', label: 'Meshy (paid)', file: (s: string) => join('art', 'out', 'meshy', `${s}-meshy.glb`) },
] as const;

const triangles = (doc: Document) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0);

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const outFolder = join('public', 'assets', 'props');
await mkdir(outFolder, { recursive: true });

const manifest = [];
const records = [];
for (const subject of Object.keys(SIZES)) {
  for (const tool of TOOLS) {
    const input = tool.file(subject);
    if (!existsSync(input)) {
      console.warn(`skip ${subject} (${tool.id}): ${input} not made yet`);
      continue;
    }
    const doc = await io.read(input);
    const before = triangles(doc);
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TARGET_TRIANGLES / before), error: 0.06 }),
      dedup(),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_SIZE, TEXTURE_SIZE] }),
      quantize(),
    );
    const after = triangles(doc);
    const file = `${subject}-${tool.id}.glb`;
    const bytes = await io.writeBinary(doc);
    await writeFile(join(outFolder, file), bytes);
    const recordFile = input.replace(/\.glb$/, '.json');
    const made = existsSync(recordFile) ? JSON.parse(await readFile(recordFile, 'utf8')) : null;
    manifest.push({
      subject,
      tool: tool.id,
      label: tool.label,
      file,
      size: SIZES[subject],
      triangles: Math.round(after),
    });
    records.push({
      output: `public/assets/props/${file}`,
      bytes: bytes.length,
      sha256: sha256(bytes),
      triangles: { made: Math.round(before), shipped: Math.round(after) },
      textures: `${TEXTURE_SIZE} px WebP`,
      concept: `art/out/concepts/${subject}.jpg (Gemini; see art/concepts.json)`,
      made,
    });
    console.log(
      `${file}: ${Math.round(before)} → ${Math.round(after)} triangles, ${(bytes.length / 1e6).toFixed(2)} MB`,
    );
  }
}

await writeFile(join(outFolder, 'props.json'), `${JSON.stringify({ props: manifest }, null, 2)}\n`);
await writeFile(
  join('art', 'props.json'),
  `${JSON.stringify(
    {
      about:
        "The style test's props (docs/design/STYLE_TEST.md): where each file in public/assets/props/ came from. Concepts are Gemini pictures (the owner's to use under Google's terms); trellis.cpp models are made locally from them (TRELLIS.2, MIT); Meshy models are made with the owner's paid plan, which leaves them the owner's.",
      props: records,
    },
    null,
    2,
  )}\n`,
);
