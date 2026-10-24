import { describe, expect, it } from 'vitest';
import { pickAssistTarget } from '../../src/game/aim.ts';
import { COVER, coverStep, isLowCover } from '../../src/game/cover.ts';
import { SPEED } from '../../src/game/motion.ts';
import { directionalWeights, poseWeights, type Weights } from '../../src/game/pose.ts';

const sum = (w: Weights) => Object.values(w).reduce((a, b) => a + (b ?? 0), 0);

describe('poses', () => {
  it('moves the whole body by speed', () => {
    const pose = poseWeights({ mode: 'move', speed: 0 });
    expect(pose.upper).toBeNull();
    expect(pose.lower.idle).toBe(1);
    expect(poseWeights({ mode: 'move', speed: SPEED.run }).lower.jog).toBeCloseTo(1);
  });
  it('blends the walks by direction while aiming, with the arms up', () => {
    const forwardRight = directionalWeights({ x: 1, y: 1 });
    expect(forwardRight.walk).toBeCloseTo(0.5);
    expect(forwardRight.strafe_right).toBeCloseTo(0.5);
    expect(directionalWeights({ x: 0, y: -1 }).walk_back).toBeCloseTo(1);
    const pose = poseWeights({ mode: 'aim', speed: SPEED.walk, direction: { x: -1, y: 0 }, firing: false });
    expect(pose.lower.strafe_left).toBeCloseTo(1);
    expect(sum(pose.lower)).toBeCloseTo(1);
    expect(pose.upper).toEqual({ pistol_aim: 1 });
  });
  it('stands still while aiming without moving, and shoots with the upper body', () => {
    const pose = poseWeights({ mode: 'aim', speed: 0, direction: { x: 0, y: 0 }, firing: true });
    expect(pose.lower.idle).toBe(1);
    expect(pose.upper).toEqual({ pistol_shoot: 1 });
  });
  it('crouches in cover and slides along it', () => {
    expect(poseWeights({ mode: 'cover', slide: 0 }).lower.crouch_idle).toBe(1);
    const left = poseWeights({ mode: 'cover', slide: -0.5 }).lower;
    expect(left.crouch_left).toBeCloseTo(0.5);
    expect(sum(left)).toBeCloseTo(1);
  });
});

describe('cover', () => {
  const crate = { knee: 0.5, chest: null, normal: { x: 0, z: -1 } };
  it('tells low cover from a wall', () => {
    expect(isLowCover(crate)).toBe(true);
    expect(isLowCover({ knee: 0.5, chest: 0.52, normal: { x: 0, z: -1 } })).toBe(false);
    expect(isLowCover({ knee: COVER.reach + 0.1, chest: null, normal: { x: 0, z: -1 } })).toBe(false);
  });
  it('enters when moving into low cover, not when brushing past or sprinting', () => {
    const base = { sprint: false, aiming: false, probe: crate, coverAhead: true };
    expect(coverStep({ inCover: false }, { ...base, move: { x: 0, z: 1 } }).state.inCover).toBe(true);
    expect(coverStep({ inCover: false }, { ...base, move: { x: 1, z: 0.2 } }).state.inCover).toBe(false);
    expect(coverStep({ inCover: false }, { ...base, sprint: true, move: { x: 0, z: 1 } }).state.inCover).toBe(false);
  });
  it('slides along cover and leaves when pushed away or when the cover ends', () => {
    const inCover = { inCover: true as const, normal: { x: 0, z: -1 } };
    const base = { sprint: false, aiming: false, probe: null, coverAhead: true };
    // Facing +z (the cover), the hero's right is +x.
    const slid = coverStep(inCover, { ...base, move: { x: 1, z: 0 } });
    expect(slid.slide).toBeCloseTo(1);
    expect(slid.velocity.x).toBeCloseTo(COVER.slideSpeed);
    expect(coverStep(inCover, { ...base, move: { x: 0, z: -1 } }).state.inCover).toBe(false);
    expect(coverStep(inCover, { ...base, coverAhead: false, move: { x: 1, z: 0 } }).state.inCover).toBe(false);
  });
});

describe('aim assist', () => {
  const forward = { x: 0, y: 0, z: 1 };
  it('picks the target nearest the crosshair inside the cone', () => {
    const targets = [
      { id: 1, offset: { x: 1, y: 0, z: 10 } },
      { id: 2, offset: { x: 0.3, y: 0, z: 10 } },
      { id: 3, offset: { x: 0, y: 5, z: 10 } },
    ];
    expect(pickAssistTarget(targets, forward)).toBe(2);
  });
  it('ignores targets outside the cone or out of range', () => {
    expect(pickAssistTarget([{ id: 1, offset: { x: 5, y: 0, z: 10 } }], forward)).toBeNull();
    expect(pickAssistTarget([{ id: 1, offset: { x: 0, y: 0, z: 100 } }], forward)).toBeNull();
  });
});
