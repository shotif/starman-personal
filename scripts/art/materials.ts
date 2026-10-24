/**
 * Fetches the station's surface materials from Poly Haven (CC0) at 1k, checks each file against
 * Poly Haven's published MD5, and records where every file came from (D-28). Files already on
 * disk that match Poly Haven's MD5 are kept, with the date they were first fetched.
 *
 *   node scripts/art/materials.ts
 *
 * Files go to public/assets/materials/<id>/ and the record to art/materials.json.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MATERIALS = [
  { id: 'metal_plate', use: 'floors' },
  { id: 'metal_plate_02', use: 'walls and ceilings' },
  { id: 'container_side', use: 'crates' },
  { id: 'rusty_metal_02', use: 'ribs and trim' },
  { id: 'blue_metal_plate', use: 'clean painted wall panels' },
  { id: 'rubber_tiles', use: 'dark rubber deck floors' },
  { id: 'concrete_floor_worn_001', use: 'concrete floors and walls' },
  { id: 'metal_grate_rusty', use: 'grated metal floors and catwalks (a solid grate pattern, no see-through)' },
  { id: 'fabric_leather_02', use: 'upholstery: the lounge seats' },
  { id: 'interior_tiles', use: 'the clinic floor tiles' },
  { id: 'corrugated_iron_02', use: 'corrugated metal cladding' },
  { id: 'cracked_red_ground', use: 'the rocky ground outside, on Ross 128 b' },
] as const;

/** Base colour, normal map (OpenGL convention), and AO/roughness/metal packed in R/G/B. */
const MAPS = [
  { key: 'Diffuse', file: 'albedo.jpg' },
  { key: 'nor_gl', file: 'normal.jpg' },
  { key: 'arm', file: 'arm.jpg' },
] as const;

const RESOLUTION = '1k';
const HEADERS = { 'User-Agent': 'starman-lightkeeper-art-pipeline (github.com/shotif/starman-personal)' };

interface FileEntry {
  url: string;
  md5: string;
  size: number;
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

interface MaterialRecord {
  id: string;
  fetched: string;
  files: { map: string; sha256: string }[];
}

const RECORD = join('art', 'materials.json');
const previous = existsSync(RECORD)
  ? ((JSON.parse(await readFile(RECORD, 'utf8')) as { materials: MaterialRecord[] }).materials ?? [])
  : [];

const records = [];
for (const material of MATERIALS) {
  const info = await json<{ name: string; authors: Record<string, string> }>(
    `https://api.polyhaven.com/info/${material.id}`,
  );
  const files = await json<Record<string, Record<string, { jpg: FileEntry }>>>(
    `https://api.polyhaven.com/files/${material.id}`,
  );
  const folder = join('public', 'assets', 'materials', material.id);
  await mkdir(folder, { recursive: true });
  const saved = [];
  for (const map of MAPS) {
    const entry = files[map.key]?.[RESOLUTION]?.jpg;
    if (!entry) throw new Error(`${material.id} has no ${map.key} at ${RESOLUTION}`);
    const path = join(folder, map.file);
    let bytes = existsSync(path) ? await readFile(path) : undefined;
    if (!bytes || createHash('md5').update(bytes).digest('hex') !== entry.md5) {
      const response = await fetch(entry.url, { headers: HEADERS });
      if (!response.ok) throw new Error(`${entry.url}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      const md5 = createHash('md5').update(bytes).digest('hex');
      if (md5 !== entry.md5) throw new Error(`${entry.url}: MD5 ${md5}, expected ${entry.md5}`);
      await writeFile(path, bytes);
    }
    saved.push({
      map: map.key,
      path,
      url: entry.url,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    console.log(`${material.id}/${map.file}: ${(bytes.length / 1024).toFixed(0)} KB`);
  }
  records.push({
    id: material.id,
    name: info.name,
    use: material.use,
    page: `https://polyhaven.com/a/${material.id}`,
    authors: Object.keys(info.authors),
    licence: 'CC0 1.0',
    resolution: RESOLUTION,
    fetched:
      unchanged(
        previous.find((p) => p.id === material.id),
        saved,
      ) ?? new Date().toISOString().slice(0, 10),
    files: saved,
  });
}

/** The earlier fetch date, when every file is the same as before. */
function unchanged(before: MaterialRecord | undefined, now: { map: string; sha256: string }[]): string | undefined {
  if (!before || before.files.length !== now.length) return undefined;
  const same = now.every((f) => before.files.some((b) => b.map === f.map && b.sha256 === f.sha256));
  return same ? before.fetched : undefined;
}

await writeFile(
  RECORD,
  `${JSON.stringify({ source: 'Poly Haven', licence: 'CC0 1.0', materials: records }, null, 2)}\n`,
);
console.log(`Recorded ${records.length} materials in art/materials.json`);
