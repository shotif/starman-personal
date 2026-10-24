/**
 * Turns a concept picture into a 3D model with trellis.cpp on the owner's Mac
 * (docs/research/OPEN_SOURCE.md §3), with network access denied, and records what went in and
 * what came out (D-28). Candidates go to art/out/ (ignored by git) for review; an approved model
 * is cleaned up in Blender before it goes to public/assets/.
 *
 *   node scripts/art/trellis.ts <picture.png> <name> [--res 512|1024] [--seed N]
 *
 * TRELLIS_HOME overrides the install folder (~/tools/trellis-cpp).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const TOOL = { name: 'trellis.cpp', version: 'v0.8.1', commit: 'c0bed38c1578f7e36e3e50c8ff1e38fa0d47583f' };
const WEIGHTS = { repository: 'ilintar/trellis2-gguf', revision: 'a57397bd3d351599d9729fc144b3f87c3f87d65b' };
const LICENCES = [
  'TRELLIS.2 (Microsoft): MIT',
  'trellis.cpp: MIT',
  'DINOv3 image encoder (Meta): DINOv3 Licence; no claim over outputs',
  'BiRefNet background removal: MIT',
];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { res: { type: 'string', default: '512' }, seed: { type: 'string', default: '42' } },
});
const [picture, name] = positionals;
if (!picture || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error(
    'usage: node scripts/art/trellis.ts <picture.png> <name: lower-case-with-dashes> [--res 512|1024] [--seed N]',
  );
  process.exit(1);
}
if (!['512', '1024'].includes(values.res)) throw new Error('--res must be 512 or 1024');

const home = process.env.TRELLIS_HOME ?? join(homedir(), 'tools', 'trellis-cpp');
const cli = join(home, 'build', 'trellis-cli');
if (!existsSync(cli)) throw new Error(`trellis.cpp is not built at ${cli}; see docs/research/OPEN_SOURCE.md §3`);

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const input = await readFile(picture);
await mkdir(join('art', 'out'), { recursive: true });
const output = resolve('art', 'out', `${name}.glb`);

const started = Date.now();
const run = spawnSync(
  '/usr/bin/sandbox-exec',
  [
    '-p',
    '(version 1)(allow default)(deny network*)',
    cli,
    resolve(picture),
    output,
    '--models',
    join(home, 'models'),
    '--res',
    values.res,
    '--seed',
    values.seed,
    '--require-gpu',
    '--copyright',
    'Starman Lightkeeper. Generated with TRELLIS.2 (MIT) through trellis.cpp (MIT).',
  ],
  { stdio: 'inherit' },
);
if (run.status !== 0) throw new Error(`trellis-cli failed with status ${run.status}`);

const model = await readFile(output);
const record = {
  name,
  made: new Date().toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  input: { file: basename(picture), bytes: input.length, sha256: sha256(input) },
  output: { file: `art/out/${name}.glb`, bytes: model.length, sha256: sha256(model) },
  settings: { res: Number(values.res), seed: Number(values.seed), network: 'denied' },
  tool: TOOL,
  weights: WEIGHTS,
  licences: LICENCES,
};
await writeFile(join('art', 'out', `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
console.log(`${name}: ${(model.length / 1e6).toFixed(1)} MB in ${record.seconds} s → art/out/${name}.glb`);
