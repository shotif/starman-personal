import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyLineage,
  checkLooks,
  defaultLooks,
  type Manifest,
  randomLooks,
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
});
