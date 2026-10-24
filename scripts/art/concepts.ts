/**
 * Makes the style test's concept pictures with Gemini (docs/design/STYLE_TEST.md), the request
 * shape adapted from Starman Control's scripts/art/providers.ts. Each picture is saved with a
 * record of its prompt, model and date in art/out/concepts/ (ignored by git).
 *
 *   node scripts/art/concepts.ts [id ...]     # all subjects in art/concepts.json, or those named
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { geminiPicture } from './services.ts';

interface Concepts {
  model: string;
  style: string;
  subjects: { id: string; prompt: string }[];
}

const concepts = JSON.parse(await readFile(join('art', 'concepts.json'), 'utf8')) as Concepts;
const wanted = process.argv.slice(2);
const subjects = concepts.subjects.filter((s) => wanted.length === 0 || wanted.includes(s.id));
const folder = join('art', 'out', 'concepts');
await mkdir(folder, { recursive: true });

await Promise.all(
  subjects.map(async (subject) => {
    const prompt = `${subject.prompt} ${concepts.style}`;
    const bytes = await geminiPicture(concepts.model, prompt).catch((error: Error) => {
      throw new Error(`${subject.id}: ${error.message}`);
    });
    await writeFile(join(folder, `${subject.id}.jpg`), bytes);
    await writeFile(
      join(folder, `${subject.id}.json`),
      `${JSON.stringify(
        {
          id: subject.id,
          service: 'Google Gemini',
          model: concepts.model,
          prompt,
          made: new Date().toISOString(),
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          approxCostUsd: 0.1,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`${subject.id}: ${(bytes.length / 1024).toFixed(0)} KB`);
  }),
);
