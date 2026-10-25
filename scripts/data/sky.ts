/**
 * Copies the real neighbourhood for the star map from a Starman Control checkout (D-27: reuse
 * first): Reborn's census out to 27 light-years and Control's shell out to 33, with Reborn's old
 * lanes, into src/data/stars.json. Only what the map shows is kept: each system's place, its stars
 * and their types, its known planets and the source of its place. Control's commit is recorded.
 *
 *   npm run data:sky -- [--from ../starman-control]
 *
 * Every value comes from the archives by way of Control (src/data/NOTICE.md); nothing is invented
 * here. Pyre, the one invented star, is the game's (src/game/starmap.ts) and never written here.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { MapPlanet, MapSky, MapSystem } from '../../src/game/starmap.ts';

interface Source {
  label: string;
  url: string;
  recordId?: string;
}
interface Star {
  name: string;
  role: string;
  spectralType: string;
  colorHex: string;
  catalogIds: Record<string, string>;
  astrometrySource: Source;
}
interface Planet {
  name: string;
  status: MapPlanet['status'];
  source: Source;
}
interface System {
  id: string;
  name: string;
  catalogId: string;
  positionLy: [number, number, number];
  distanceLy: number;
  distanceErrorLy?: number;
  stars: Star[];
  planets: Planet[];
  shell?: true;
}

const { values } = parseArgs({ options: { from: { type: 'string', default: '../starman-control' } } });
const root = resolve(import.meta.dirname, '../..');
const control = resolve(root, values.from);
const read = (file: string) => JSON.parse(readFileSync(resolve(control, 'src/data', file), 'utf8'));
const census = read('sky.json') as { systems: System[]; lanes: [string, string][]; epoch: number };
const shell = read('shell.json') as { systems: System[] };
const git = (...args: string[]) => execFileSync('git', ['-C', control, ...args], { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', 'src/data')) throw new Error(`${control}/src/data has changes not committed`);
const commit = git('log', '-1', '--format=%h', '--', 'src/data');

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;
const systems: MapSystem[] = [...census.systems, ...shell.systems.map((s) => ({ ...s, shell: true as const }))].map(
  (s) => {
    const primary = s.stars[0];
    if (!primary) throw new Error(`${s.id} has no star`);
    const source = primary.astrometrySource;
    return {
      id: s.id,
      name: s.name,
      catalogId: s.catalogId,
      at: s.positionLy.map((v) => round(v)) as [number, number, number],
      distance: round(s.distanceLy),
      ...(s.distanceErrorLy !== undefined ? { error: round(s.distanceErrorLy, 4) } : {}),
      ...(s.shell ? { shell: true } : {}),
      stars: s.stars.map((t) => ({ name: t.name, type: t.spectralType, colour: t.colorHex })),
      planets: s.planets.map((p) => ({ name: p.name, status: p.status, source: p.source.label })),
      source: { label: source.label, url: source.url, ...(source.recordId ? { record: source.recordId } : {}) },
    };
  },
);
const ids = new Set(systems.map((s) => s.id));
for (const [a, b] of census.lanes) if (!ids.has(a) || !ids.has(b)) throw new Error(`lane ${a} - ${b} leaves the map`);

const sky: MapSky = {
  format: 'starman-lightkeeper-stars',
  importedFrom: { repository: 'https://github.com/shotif/starman-control', commit },
  description:
    'The real neighbourhood out to 33 light-years as Starman Control holds it (Reborn’s census out to 27, ' +
    'Control’s shell beyond), with Reborn’s old lanes. Places are Sol-centred equatorial Cartesian light-years ' +
    `at epoch J${census.epoch}.0. Every value is from the archives, each system with its source.`,
  systems,
  lanes: census.lanes,
};
writeFileSync(resolve(root, 'src/data/stars.json'), `${JSON.stringify(sky)}\n`);
console.log(`${systems.length} systems, ${census.lanes.length} lanes, from Control ${commit}`);
