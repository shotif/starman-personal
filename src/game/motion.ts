/**
 * Pure movement rules for the hero and companions: stick and key input, camera-relative
 * direction, turning, speeds and the blend between locomotion animations. No Babylon here, so
 * every rule is tested in Node.
 */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3Like {
  x: number;
  z: number;
}

/** Walking, running and sprinting speeds in metres a second. */
export const SPEED = { walk: 1.6, run: 4.2, sprint: 6.5 } as const;

/**
 * A virtual stick's offset (screen pixels, y down) as a movement vector: x to the right, y
 * forward, length 0–1, with a dead zone near the centre.
 */
export function stickVector(dx: number, dy: number, radius: number, deadZone = 0.12): Vec2 {
  const length = Math.hypot(dx, dy);
  if (radius <= 0 || length === 0) return { x: 0, y: 0 };
  const amount = Math.min(length / radius, 1);
  if (amount < deadZone) return { x: 0, y: 0 };
  const scaled = (amount - deadZone) / (1 - deadZone);
  return { x: (dx / length) * scaled, y: (-dy / length) * scaled };
}

/** WASD and the arrow keys as a movement vector of length 0 or 1. */
export function keysToVector(keys: ReadonlySet<string>): Vec2 {
  const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

/**
 * Turns input (x right, y forward) into a world direction on the ground, relative to where the
 * camera looks. `forward` is the camera's horizontal view direction. Babylon is left-handed, so
 * with forward along +z, right is +x.
 */
export function cameraRelative(input: Vec2, forward: Vec3Like): Vec3Like {
  const length = Math.hypot(forward.x, forward.z);
  if (length === 0) return { x: 0, z: 0 };
  const fx = forward.x / length;
  const fz = forward.z / length;
  return { x: fx * input.y + fz * input.x, z: fz * input.y - fx * input.x };
}

/** The yaw (rotation about y) that faces a ground direction, for a model that faces +z. */
export function yawOf(direction: Vec3Like): number {
  return Math.atan2(direction.x, direction.z);
}

/** Turns from one yaw towards another by at most `maxStep` radians, the short way round. */
export function turnTowards(current: number, target: number, maxStep: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

/** How fast the hero wants to go for a stick push of 0–1: a light push walks, a full one runs. */
export function targetSpeed(push: number, sprint: boolean): number {
  if (push <= 0) return 0;
  if (sprint && push > 0.5) return SPEED.sprint;
  if (push < 0.6) return SPEED.walk * (push / 0.6);
  return SPEED.walk + (SPEED.run - SPEED.walk) * ((push - 0.6) / 0.4);
}

export interface LocomotionWeights {
  idle: number;
  walk: number;
  run: number;
  sprint: number;
}

/** The weights of the four locomotion animations at a ground speed; they always sum to 1. */
export function locomotionWeights(speed: number): LocomotionWeights {
  const stops: [number, keyof LocomotionWeights][] = [
    [0, 'idle'],
    [SPEED.walk, 'walk'],
    [SPEED.run, 'run'],
    [SPEED.sprint, 'sprint'],
  ];
  const weights: LocomotionWeights = { idle: 0, walk: 0, run: 0, sprint: 0 };
  const s = Math.max(0, speed);
  for (let i = 0; i < stops.length - 1; i++) {
    const [from, a] = stops[i] as [number, keyof LocomotionWeights];
    const [to, b] = stops[i + 1] as [number, keyof LocomotionWeights];
    if (s <= to) {
      const t = (s - from) / (to - from);
      weights[a] = 1 - t;
      weights[b] = t;
      return weights;
    }
  }
  weights.sprint = 1;
  return weights;
}

/**
 * Moves the weight of animations a model lacks onto its nearest neighbour that it has, so a
 * model with only idle and walk still blends sensibly at a run.
 */
export function foldMissing(weights: LocomotionWeights, has: Readonly<Record<keyof LocomotionWeights, boolean>>) {
  const order: (keyof LocomotionWeights)[] = ['idle', 'walk', 'run', 'sprint'];
  const available = order.filter((k) => has[k]);
  const result: LocomotionWeights = { idle: 0, walk: 0, run: 0, sprint: 0 };
  if (available.length === 0) return result;
  for (const [i, key] of order.entries()) {
    const nearest = available.reduce((best, k) =>
      Math.abs(order.indexOf(k) - i) < Math.abs(order.indexOf(best) - i) ? k : best,
    );
    result[nearest] += weights[key];
  }
  return result;
}

/**
 * Where the third-person camera sits for a screen shape (width / height): over the right shoulder
 * on a wide screen; further back and nearer the hero's line on a narrow portrait one.
 */
export function cameraFraming(aspect: number): { distance: number; shoulder: number } {
  const narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.7));
  return { distance: 3.4 + narrow * 1.4, shoulder: 0.45 - narrow * 0.3 };
}

/**
 * How far the camera can sit from its pivot without entering a wall: the distance to the first
 * hit, less some padding, never closer than `min` and never further than `desired`.
 */
export function cameraDistance(hit: number | null, desired: number, min: number, padding = 0.25): number {
  if (hit === null) return desired;
  return Math.max(min, Math.min(desired, hit - padding));
}
