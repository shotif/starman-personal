// The story's ink compiled from its files (DIALOGUE.md): story/slice.ink and what it INCLUDEs, read
// from the same folder. Used by the build (vite.config.ts), the story's tests and the voices script,
// so all three read the one story the game plays.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Compiler, CompilerOptions } from 'inkjs/full';

export interface CompiledStory {
  /** The story as JSON, for inkjs's `Story`. */
  json: string;
  errors: string[];
  warnings: string[];
  /** Every ink file read: the entry and each it included. */
  files: string[];
}

/** The story's entry file. */
export const STORY = resolve(import.meta.dirname, '..', 'story', 'slice.ink');

/** Every ink file of the story, as one text: for checks that read the source (ids, commands). */
export function storySource(entry = STORY): string {
  return compileStory(entry)
    .files.map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}

export function compileStory(entry = STORY, source = readFileSync(entry, 'utf8')): CompiledStory {
  const folder = dirname(entry);
  const files = [entry];
  const handler = {
    ResolveInkFilename: (name: string) => join(folder, name),
    LoadInkFileContents: (path: string) => {
      files.push(path);
      return readFileSync(path, 'utf8');
    },
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  // Messages are collected rather than thrown, so every one is reported at once (ink's types: 0
  // an author's note, 1 a warning, 2 an error).
  const report = (message: string, type: number) => (type === 2 ? errors : warnings).push(message);
  const compiler = new Compiler(source, new CompilerOptions(entry, [], false, report, handler));
  let json = '';
  try {
    json = compiler.Compile()?.ToJson() ?? '';
  } catch (error) {
    if (errors.length === 0) errors.push(String(error));
  }
  return { json, errors, warnings, files };
}
