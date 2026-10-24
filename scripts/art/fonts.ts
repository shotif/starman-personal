/**
 * Open fonts for the lettering that scripts/art/images.ts draws over its pictures (signs, posters,
 * console screens). The image model is never trusted with words: every letter is set in one of
 * these fonts by scripts/art/glyphs.ts. All are under the SIL Open Font License 1.1, which lets
 * pictures made with them be shared freely. The font files stay in the git-ignored
 * art/cache/fonts/ and are fetched from the Google Fonts API when missing.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type Font, font } from './glyphs.ts';

export const FONTS = [
  { family: 'Barlow Condensed', weights: [500, 600, 700, 800], use: 'signs, posters and screen headings' },
  { family: 'Barlow', weights: [500, 600], use: 'poster small print' },
  { family: 'Share Tech Mono', weights: [400], use: 'console readouts' },
] as const;

export const FONT_LICENCE = 'SIL Open Font License 1.1';
const FOLDER = resolve(import.meta.dirname, '../../art/cache/fonts');

export interface FontFile {
  family: string;
  weight: number;
  url: string;
  file: string;
}

let files: FontFile[] | undefined;

/** Fetches any missing font files. Returns every file, with where it came from. */
export async function useFonts(): Promise<FontFile[]> {
  if (files) return files;
  await mkdir(FOLDER, { recursive: true });
  const families = FONTS.map((f) => `family=${f.family.replaceAll(' ', '+')}:wght@${f.weights.join(';')}`);
  const response = await fetch(`https://fonts.googleapis.com/css2?${families.join('&')}`);
  if (!response.ok) throw new Error(`Google Fonts: HTTP ${response.status}`);
  const css = await response.text();
  const faces = [...css.matchAll(/font-family: '([^']+)';[^}]*?font-weight: (\d+);[^}]*?src: url\(([^)]+\.ttf)\)/g)];
  const found: FontFile[] = [];
  for (const [, family, weight, url] of faces) {
    if (!url.startsWith('https://fonts.gstatic.com/')) throw new Error(`unexpected font address ${url}`);
    const file = join(FOLDER, `${family.replaceAll(' ', '')}-${weight}.ttf`);
    if (!existsSync(file)) {
      const download = await fetch(url);
      if (!download.ok) throw new Error(`${url}: HTTP ${download.status}`);
      await writeFile(file, Buffer.from(await download.arrayBuffer()));
    }
    found.push({ family, weight: Number(weight), url, file });
  }
  files = found;
  return found;
}

/** A loaded font by family and weight; call `useFonts()` first. */
export function face(family: (typeof FONTS)[number]['family'], weight: number): Font {
  const f = files?.find((x) => x.family === family && x.weight === weight);
  if (!f) throw new Error(`no font ${family} ${weight}: call useFonts() first`);
  return font(f.file);
}
