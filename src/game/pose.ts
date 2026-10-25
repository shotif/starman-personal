import { locomotionWeights, SPEED, type Vec2 } from './motion.ts';

/**
 * Which animation clips play, and how strongly, for what the hero is doing (COVER_AND_AIM.md).
 * Pure, so every blend is tested. The clip names are the art pipeline's (heroes.json).
 */
export const CLIPS = [
  'idle',
  'idle_talk',
  'walk',
  'jog',
  'sprint',
  'walk_back',
  'strafe_left',
  'strafe_right',
  'crouch_idle',
  'crouch_left',
  'crouch_right',
  'pistol_aim',
  'pistol_shoot',
  'rifle_aim',
  'rifle_shoot',
  'rifle_ready',
  'power_cast',
  'punch_jab',
  'punch_cross',
  'roll',
  'dodge_left',
  'dodge_right',
  'death',
] as const;
export type Clip = (typeof CLIPS)[number];

/** Clips that play once and hold their last frame (going down), rather than looping. */
export const ONE_SHOT: readonly Clip[] = [
  'death',
  'power_cast',
  'punch_jab',
  'punch_cross',
  'roll',
  'dodge_left',
  'dodge_right',
];
export type Weights = Partial<Record<Clip, number>>;

export type PoseState =
  /** Moving freely: idle, walk, jog and sprint by ground speed; `ready` holds a long gun low (a fight). */
  | { mode: 'move'; speed: number; ready?: boolean }
  /**
   * Aiming: walking in any direction (x right, y forward, relative to the hero) with the arms up;
   * `rifle` holds a long gun to the shoulder rather than a pistol out.
   */
  | { mode: 'aim'; speed: number; direction: Vec2; firing: boolean; rifle?: boolean }
  /** In low cover, facing it; `slide` is -1 (left) to 1 (right) along it. */
  | { mode: 'cover'; slide: number }
  /** In a conversation: standing, gesturing while speaking (DIALOGUE.md). */
  | { mode: 'talk'; speaking: boolean }
  /** Down in a fight (D-43): on the floor. */
  | { mode: 'down' }
  /** Kneeling beside someone, to help them up. */
  | { mode: 'kneel' };

export interface Pose {
  /** The whole body, or the legs and hips when `upper` is set. */
  lower: Weights;
  /** The spine, arms and head on their own, or null when the whole body follows `lower`. */
  upper: Weights | null;
  /** How fast the clips fade towards these weights (per second); quick by default. */
  blend?: number;
}

/** The four walking directions while aiming, by angle from forward (clockwise, radians). */
const AIM_WALKS: [Clip, number][] = [
  ['walk', 0],
  ['strafe_right', Math.PI / 2],
  ['walk_back', Math.PI],
  ['strafe_left', -Math.PI / 2],
];

/** Splits one unit of weight between the two walking clips either side of a direction. */
export function directionalWeights(direction: Vec2): Weights {
  const weights: Weights = {};
  if (direction.x === 0 && direction.y === 0) return { walk: 1 };
  const angle = Math.atan2(direction.x, direction.y);
  let total = 0;
  for (const [clip, at] of AIM_WALKS) {
    const w = Math.max(0, Math.cos(angle - at));
    if (w > 1e-6) {
      weights[clip] = w;
      total += w;
    }
  }
  for (const clip of Object.keys(weights) as Clip[]) weights[clip] = (weights[clip] ?? 0) / total;
  return weights;
}

export function poseWeights(state: PoseState): Pose {
  if (state.mode === 'move') {
    const w = locomotionWeights(state.speed);
    return {
      lower: { idle: w.idle, walk: w.walk, jog: w.run, sprint: w.sprint },
      upper: state.ready ? { rifle_ready: 1 } : null,
    };
  }
  if (state.mode === 'down') return { lower: { death: 1 }, upper: null, blend: 5 };
  if (state.mode === 'kneel') return { lower: { crouch_idle: 1 }, upper: null, blend: 6 };
  if (state.mode === 'talk') {
    return { lower: state.speaking ? { idle_talk: 1 } : { idle: 1 }, upper: null };
  }
  if (state.mode === 'cover') {
    const s = Math.max(-1, Math.min(1, state.slide));
    return {
      lower: { crouch_idle: 1 - Math.abs(s), crouch_left: Math.max(0, -s), crouch_right: Math.max(0, s) },
      upper: null,
    };
  }
  const moving = Math.min(1, Math.max(0, state.speed / SPEED.walk));
  const lower: Weights = { idle: 1 - moving };
  for (const [clip, w] of Object.entries(directionalWeights(state.direction)) as [Clip, number][]) {
    lower[clip] = w * moving;
  }
  if (state.rifle) return { lower, upper: state.firing ? { rifle_shoot: 1 } : { rifle_aim: 1 } };
  return { lower, upper: state.firing ? { pistol_shoot: 1 } : { pistol_aim: 1 } };
}
