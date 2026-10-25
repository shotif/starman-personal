import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  distanceBetween,
  fromSky,
  HERE,
  LEADS,
  lightYears,
  type MapSky,
  mapLanes,
  mapSystems,
  nearestTo,
  PYRE,
  PYRE_ANCHOR,
  route,
  STORY_PLACES,
  starSize,
} from '../../src/game/starmap.ts';

const SKY = JSON.parse(readFileSync('src/data/stars.json', 'utf8')) as MapSky;
const SYSTEMS = mapSystems(SKY);
const LANES = mapLanes(SKY);
const find = (id: string) => SYSTEMS.find((s) => s.id === id);

describe('the star map', () => {
  it('holds the real neighbourhood out to 33 light-years, each place with its source', () => {
    expect(SKY.systems.length).toBeGreaterThan(340);
    expect(SKY.importedFrom.repository).toBe('https://github.com/shotif/starman-control');
    for (const s of SKY.systems) {
      // Each place matches its distance from the Sun (the data's positions are the primary star's).
      expect(Math.abs(Math.hypot(...s.at) - s.distance), s.id).toBeLessThan(0.01);
      expect(s.distance).toBeLessThan(33.2);
      expect(s.stars.length, s.id).toBeGreaterThan(0);
      expect(s.source.label, s.id).not.toBe('');
    }
    expect(new Set(SKY.systems.map((s) => s.id)).size).toBe(SKY.systems.length);
  });

  it('puts the story’s stars where the archives do', () => {
    // Ross 128: Gaia DR3, 11.007 ly, RA 176.94°, Dec +0.80°.
    const ross = find('ross-128');
    expect(ross?.distance).toBeCloseTo(11.007, 2);
    const [x, y, z] = ross?.at ?? [0, 0, 0];
    expect(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360).toBeCloseTo(176.94, 1);
    expect((Math.asin(z / Math.hypot(x, y, z)) * 180) / Math.PI).toBeCloseTo(0.8, 1);
    expect(find('wolf-1061')?.distance).toBeCloseTo(14.05, 1);
    expect(find('gj-915')?.distance).toBeCloseTo(27.18, 1);
    expect(find('gj-433')?.shell).toBe(true);
    expect(find('sol')?.distance).toBe(0);
    for (const lead of LEADS) expect(find(lead.system), lead.id).toBeDefined();
    for (const id of Object.keys(STORY_PLACES)) expect(find(id), id).toBeDefined();
  });

  it('keeps Pyre, the one invented star, out of the sky’s data, at Reborn’s place for it', () => {
    expect(SKY.systems.some((s) => /pyre/i.test(s.id) || /pyre/i.test(s.name))).toBe(false);
    expect(readFileSync('src/data/stars.json', 'utf8')).not.toMatch(/pyre/i);
    expect(Math.hypot(...PYRE.at)).toBeCloseTo(33, 6);
    // Toward Phoenix: RA 357.5°, Dec −45.5°.
    const [x, y, z] = PYRE.at;
    expect(z).toBeLessThan(0);
    expect(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360).toBeCloseTo(357.5, 6);
    // Just beyond the census, and its one lane from GJ 915.
    expect(LANES.filter(([a, b]) => a === 'pyre' || b === 'pyre')).toEqual([[PYRE_ANCHOR, 'pyre']]);
  });

  it('reads a place from right ascension and declination', () => {
    const [x, y, z] = fromSky(90, 0, 10);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(10, 9);
    expect(z).toBeCloseTo(0, 9);
    expect(fromSky(0, 90, 5)[2]).toBeCloseTo(5, 9);
  });

  it('finds the shortest way along the old lanes, Pyre by way of GJ 915', () => {
    const way = route(SYSTEMS, LANES, HERE, 'pyre');
    expect(way).not.toBeNull();
    expect(way?.through[0]).toBe(HERE);
    expect(way?.through.slice(-2)).toEqual([PYRE_ANCHOR, 'pyre']);
    // Jo's "eleven jumps" (story/slice.ink, jo_course).
    expect((way?.through.length ?? 0) - 1).toBe(11);
    // The length is the sum of its jumps, each along a lane.
    let sum = 0;
    const lanes = new Set(LANES.map(([a, b]) => `${a}|${b}`));
    for (let i = 1; i < (way?.through.length ?? 0); i++) {
      const a = way?.through[i - 1] ?? '';
      const b = way?.through[i] ?? '';
      expect(lanes.has(`${a}|${b}`) || lanes.has(`${b}|${a}`), `${a} - ${b}`).toBe(true);
      sum += distanceBetween(find(a)?.at ?? [0, 0, 0], find(b)?.at ?? [0, 0, 0]);
    }
    expect(way?.length).toBeCloseTo(sum, 6);
    // Never shorter than the straight line.
    expect(way?.length ?? 0).toBeGreaterThan(distanceBetween(find(HERE)?.at ?? [0, 0, 0], PYRE.at));
  });

  it('says when no old lane reaches a place (the shell)', () => {
    expect(route(SYSTEMS, LANES, HERE, 'gj-433')).toBeNull();
    expect(route(SYSTEMS, LANES, HERE, HERE)?.through).toEqual([HERE]);
  });

  it('opens one lead now, and says honestly the other two come later', () => {
    expect(LEADS.filter((l) => l.open).map((l) => l.id)).toEqual(['pyre']);
    expect(LEADS.map((l) => l.id).sort()).toEqual(['dusk', 'maw', 'pyre']);
  });

  it('chooses the star nearest a tap, within reach, never one behind the camera', () => {
    const points = [
      { id: 'a', x: 100, y: 100, depth: 10 },
      { id: 'b', x: 120, y: 100, depth: 5 },
      { id: 'behind', x: 101, y: 101, depth: -3 },
    ];
    expect(nearestTo(points, 102, 100, 30)).toBe('a');
    expect(nearestTo(points, 118, 100, 30)).toBe('b');
    // Equally near: the nearer star wins.
    expect(nearestTo(points, 110, 100, 30)).toBe('b');
    expect(nearestTo(points, 300, 300, 30)).toBeNull();
    expect(nearestTo(points.slice(2), 101, 101, 30)).toBeNull();
  });

  it('draws the kinds of star at sizes that tell them apart', () => {
    expect(starSize('A1V')).toBeGreaterThan(starSize('G2V'));
    expect(starSize('G2V')).toBeGreaterThan(starSize('M4V'));
    expect(starSize('dM4')).toBe(starSize('M4V'));
    expect(starSize('M4V')).toBeGreaterThan(starSize('DA2'));
    expect(starSize('DA2')).toBeGreaterThan(starSize('T8'));
    expect(starSize('unknown')).toBe(starSize('M5'));
    expect(lightYears(11.0074)).toBe('11.0 light-years');
  });
});
