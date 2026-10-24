import type { Vec3Like } from './motion.ts';

/**
 * Cover by moving into it (D-17, COVER_AND_AIM.md): two rays in the direction of movement, at knee
 * and chest height, tell low cover from a wall; a small state machine enters, slides and leaves.
 * Pure; the game casts the rays.
 */
export const COVER = {
  kneeHeight: 0.5,
  chestHeight: 1.35,
  /** How close the cover must be to drop into it. */
  reach: 0.8,
  /** How fast the hero slides along cover, in metres a second. */
  slideSpeed: 1.3,
};

/** What the two rays found: distances to the first hit, and the knee hit's surface normal. */
export interface CoverProbe {
  knee: number | null;
  chest: number | null;
  normal: Vec3Like | null;
}

/** Low cover: something at knee height within reach, and nothing at chest height just behind it. */
export function isLowCover(probe: CoverProbe): boolean {
  if (probe.knee === null || probe.knee > COVER.reach || !probe.normal) return false;
  return probe.chest === null || probe.chest > probe.knee + 0.4;
}

export type CoverState = { inCover: false } | { inCover: true; normal: Vec3Like };

export interface CoverInput {
  /** The movement asked for, on the ground, length 0–1. */
  move: Vec3Like;
  sprint: boolean;
  aiming: boolean;
  /** Rays in the direction of movement (when not in cover), or null. */
  probe: CoverProbe | null;
  /** In cover: whether there is still cover in front of the hero. */
  coverAhead: boolean;
}

export interface CoverResult {
  state: CoverState;
  /** -1 to 1 along the cover, from the hero's view facing it; 0 out of cover. */
  slide: number;
  /** The velocity along the cover in metres a second; zero out of cover. */
  velocity: Vec3Like;
}

const NONE: CoverResult = { state: { inCover: false }, slide: 0, velocity: { x: 0, z: 0 } };

export function coverStep(state: CoverState, input: CoverInput): CoverResult {
  const push = Math.hypot(input.move.x, input.move.z);
  if (!state.inCover) {
    const probe = input.probe;
    if (input.sprint || input.aiming || push < 0.3 || !probe || !isLowCover(probe) || !probe.normal) return NONE;
    // Only when moving into it, not when brushing past.
    const into = -(input.move.x * probe.normal.x + input.move.z * probe.normal.z) / push;
    if (into < Math.cos(Math.PI / 4)) return NONE;
    return { state: { inCover: true, normal: probe.normal }, slide: 0, velocity: { x: 0, z: 0 } };
  }
  const n = state.normal;
  const away = push > 0 ? (input.move.x * n.x + input.move.z * n.z) / push : 0;
  if (input.sprint || !input.coverAhead || (push > 0.3 && away > 0.5)) return NONE;
  // Facing the cover means facing -n; the hero's right is then (-n.z, n.x).
  const right = { x: -n.z, z: n.x };
  const slide = Math.max(-1, Math.min(1, input.move.x * right.x + input.move.z * right.z));
  return {
    state,
    slide,
    velocity: { x: right.x * slide * COVER.slideSpeed, z: right.z * slide * COVER.slideSpeed },
  };
}
