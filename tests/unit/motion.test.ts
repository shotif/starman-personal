import { describe, expect, it } from 'vitest';
import {
  cameraDistance,
  cameraFraming,
  cameraRelative,
  foldMissing,
  keysToVector,
  locomotionWeights,
  SPEED,
  stickVector,
  targetSpeed,
  turnTowards,
  yawOf,
} from '../../src/game/motion.ts';

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe('stickVector', () => {
  it('is still inside the dead zone', () => {
    expect(stickVector(3, 3, 60)).toEqual({ x: 0, y: 0 });
  });
  it('turns screen-up into forward', () => {
    const v = stickVector(0, -60, 60);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });
  it('never goes beyond full push', () => {
    const v = stickVector(200, 0, 60);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });
});

describe('keysToVector', () => {
  it('normalises diagonals', () => {
    const v = keysToVector(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });
  it('cancels opposite keys', () => {
    expect(keysToVector(new Set(['KeyW', 'KeyS']))).toEqual({ x: 0, y: 0 });
  });
});

describe('cameraRelative', () => {
  it('moves forward along the camera view and right to its right', () => {
    const f = cameraRelative({ x: 0, y: 1 }, { x: 0, z: 1 });
    expect(f.x).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(1);
    const r = cameraRelative({ x: 1, y: 0 }, { x: 0, z: 1 });
    expect(r.x).toBeCloseTo(1);
    expect(r.z).toBeCloseTo(0);
  });
  it('follows a camera looking along +x', () => {
    const d = cameraRelative({ x: 0, y: 1 }, { x: 2, z: 0 });
    expect(d.x).toBeCloseTo(1);
    expect(d.z).toBeCloseTo(0);
    const r = cameraRelative({ x: 1, y: 0 }, { x: 1, z: 0 });
    expect(r.z).toBeCloseTo(-1);
  });
});

describe('turning', () => {
  it('faces +z at yaw 0 and +x at a quarter turn', () => {
    expect(yawOf({ x: 0, z: 1 })).toBeCloseTo(0);
    expect(yawOf({ x: 1, z: 0 })).toBeCloseTo(Math.PI / 2);
  });
  it('turns the short way round', () => {
    const next = turnTowards(Math.PI * 0.9, -Math.PI * 0.9, 0.1);
    expect(next).toBeCloseTo(Math.PI * 0.9 + 0.1);
  });
  it('arrives when within one step', () => {
    expect(turnTowards(0, 0.05, 0.1)).toBe(0.05);
  });
});

describe('speeds and blending', () => {
  it('walks on a light push, runs on a full one, sprints when asked', () => {
    expect(targetSpeed(0, false)).toBe(0);
    expect(targetSpeed(0.6, false)).toBeCloseTo(SPEED.walk);
    expect(targetSpeed(1, false)).toBeCloseTo(SPEED.run);
    expect(targetSpeed(1, true)).toBe(SPEED.sprint);
  });
  it('blends weights that always sum to one', () => {
    for (const speed of [0, 0.8, SPEED.walk, 3, SPEED.run, 5.5, SPEED.sprint, 12]) {
      expect(sum({ ...locomotionWeights(speed) })).toBeCloseTo(1);
    }
    expect(locomotionWeights(0).idle).toBe(1);
    expect(locomotionWeights(SPEED.run).run).toBeCloseTo(1);
  });
  it('folds missing animations onto their neighbours', () => {
    const w = foldMissing(locomotionWeights(SPEED.sprint), { idle: true, walk: true, run: true, sprint: false });
    expect(w.run).toBeCloseTo(1);
    expect(w.sprint).toBe(0);
    expect(sum({ ...w })).toBeCloseTo(1);
  });
});

describe('cameraFraming', () => {
  it('stands over the shoulder on a wide screen and further back on a portrait phone', () => {
    expect(cameraFraming(16 / 9)).toEqual({ distance: 3.4, shoulder: 0.45 });
    const phone = cameraFraming(390 / 844);
    expect(phone.distance).toBeCloseTo(4.8);
    expect(phone.shoulder).toBeCloseTo(0.15);
  });
});

describe('cameraDistance', () => {
  it('keeps the full distance when nothing is in the way', () => {
    expect(cameraDistance(null, 3.4, 0.9)).toBe(3.4);
  });
  it('pulls in before a wall, but not closer than the minimum', () => {
    expect(cameraDistance(2, 3.4, 0.9)).toBeCloseTo(1.75);
    expect(cameraDistance(0.5, 3.4, 0.9)).toBe(0.9);
  });
});
