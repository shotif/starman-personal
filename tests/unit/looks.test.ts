import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASSES, MOMENTS, ORIGINS } from '../../src/game/hero.ts';
import {
  applyLineage,
  checkLooks,
  controls,
  defaultLooks,
  type Manifest,
  PAIRS,
  pairValue,
  randomLooks,
  setPair,
  sliderMorphs,
} from '../../src/game/looks.ts';

/** The real manifest the art pipeline writes. */
const manifest = JSON.parse(readFileSync('public/assets/characters/heroes.json', 'utf8')) as Manifest;

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('looks', () => {
  it('offers the body and face sliders, not speech or the eyes', () => {
    const names = sliderMorphs(manifest, 'woman').map((m) => m.name);
    expect(names).toContain('body_muscular');
    expect(names).toContain('face_jaw_wide');
    expect(names.some((n) => n.startsWith('viseme') || n.startsWith('blink'))).toBe(false);
  });
  it('starts from the manifest defaults, Earthborn', () => {
    const looks = defaultLooks(manifest, 'man');
    expect(looks.lineage).toBe('earthborn');
    expect(looks.skin).toBe(manifest.bodies.man.defaultLooks.skin);
    expect(looks.height).toBe(1);
  });
  it('sets a lineage preset: its sliders and its height', () => {
    const spacer = applyLineage(manifest, defaultLooks(manifest, 'woman'), 'spacer');
    expect(spacer.height).toBeGreaterThan(1);
    expect(spacer.sliders.body_lean).toBeGreaterThan(0);
    const heavy = applyLineage(manifest, spacer, 'heavyworlder');
    expect(heavy.height).toBeLessThan(1);
    expect(heavy.sliders.body_lean).toBe(0);
  });
  it('makes random heroes that are always valid', () => {
    const random = seeded(7);
    for (let i = 0; i < 50; i++) {
      const looks = randomLooks(manifest, random);
      expect(checkLooks(manifest, looks)).toEqual(looks);
    }
  });
  it('repairs a broken save, and refuses one with no body', () => {
    const repaired = checkLooks(manifest, { body: 'woman', skin: 'purple', height: 9, sliders: { body_lean: 4 } });
    expect(repaired?.skin).toBe(manifest.bodies.woman.defaultLooks.skin);
    expect(repaired?.height).toBe(manifest.heightScale.range[1]);
    expect(repaired?.sliders.body_lean).toBe(1);
    expect(checkLooks(manifest, { body: 'robot' })).toBeNull();
    expect(checkLooks(manifest, null)).toBeNull();
  });
  it('never sets both sides of a pair: random heroes, saves and presets alike', () => {
    const random = seeded(11);
    for (let i = 0; i < 50; i++) {
      const looks = randomLooks(manifest, random);
      for (const p of PAIRS) expect(Math.min(looks.sliders[p.less] ?? 0, looks.sliders[p.more] ?? 0)).toBe(0);
    }
    const saved = checkLooks(manifest, { body: 'man', sliders: { body_slim: 0.7, body_heavy: 0.2 } });
    expect(saved?.sliders.body_slim).toBeCloseTo(0.5);
    expect(saved?.sliders.body_heavy).toBe(0);
  });
  it('turns a pair into one slider each way from the middle', () => {
    const build = PAIRS[0];
    if (!build) throw new Error('no pairs');
    const heavier = setPair({}, build, 0.6);
    expect(heavier[build.more]).toBeCloseTo(0.6);
    expect(heavier[build.less]).toBe(0);
    expect(pairValue(setPair(heavier, build, -0.4), build)).toBeCloseTo(-0.4);
  });
  it('shows the body tab as three pairs and four sliders, the face as nine', () => {
    const body = controls(manifest, 'man', 'body');
    expect(body.filter((c) => c.kind === 'pair')).toHaveLength(3);
    expect(body.filter((c) => c.kind === 'single')).toHaveLength(4);
    expect(controls(manifest, 'woman', 'face')).toHaveLength(9);
  });
  it('offers six classes, six origins and four moments, and repairs unknown ones', () => {
    expect(CLASSES).toHaveLength(6);
    expect(ORIGINS).toHaveLength(6);
    expect(MOMENTS).toHaveLength(4);
    expect(new Set(CLASSES.map((c) => c.id)).size).toBe(6);
    const saved = checkLooks(manifest, { body: 'man', heroClass: 'shade', origin: 'nowhere', moment: 'hard-call' });
    expect(saved?.heroClass).toBe('shade');
    expect(saved?.origin).toBe(ORIGINS[0]?.id);
    expect(saved?.moment).toBe('hard-call');
  });
});
