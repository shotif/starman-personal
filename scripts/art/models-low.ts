/**
 * The models for the low quality tier (D-22): the same files with their textures fitted within
 * 512 px, in public/assets/models/low/, a quarter of the texture memory on a phone. Run after the
 * models change (`npm run art:models-low`); the game reads them on the low tier (src/game/kit.ts).
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const DIR = resolve(import.meta.dirname, '../../public/assets/models');
const OUT = join(DIR, 'low');
const MAX = 512;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await mkdir(OUT, { recursive: true });
let before = 0;
let after = 0;
for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.glb')).sort()) {
  const document = await io.read(join(DIR, file));
  await document.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX, MAX] }));
  await io.write(join(OUT, file), document);
  const a = (await stat(join(DIR, file))).size;
  const b = (await stat(join(OUT, file))).size;
  before += a;
  after += b;
  console.log(`${file}: ${(a / 1024).toFixed(0)} KB -> ${(b / 1024).toFixed(0)} KB`);
}
console.log(`${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
