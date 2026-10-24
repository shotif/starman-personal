/**
 * The swarm's rules (COMBAT.md): where a mote flies, when it fires, and what its bolts meet. Pure,
 * so every rule is tested; the scene (src/game/motes.ts) measures the world and draws the result.
 */
export interface P3 {
  x: number;
  y: number;
  z: number;
}

export const MOTE = {
  /** How far from its target a mote keeps, in metres. */
  near: 6,
  far: 14,
  /** How high it flies above its target's feet. */
  low: 1.2,
  high: 2.6,
  /** How far it turns round its target when it moves, at most (radians either way). */
  swing: 1.2,
  /** It keeps this far from the other motes. */
  apart: 1.5,
  /** Flying speed, metres a second. */
  speed: 4.5,
  /** It moves on after this long in one place, at the least and at the most (seconds). */
  stayMin: 2.5,
  stayMax: 4,
  /** The glow before a shot, and the pause after it, at the least and at the most (seconds). */
  charge: 0.6,
  restMin: 1.6,
  restMax: 2.4,
  /** Hits that bring it down (it is lightly plated). */
  hits: 3,
};

export type MachineKind = 'mote' | 'lattice' | 'tender';

/** How each machine of the swarm moves and fights (COMBAT.md). */
export interface MachineRules {
  near: number;
  far: number;
  low: number;
  high: number;
  speed: number;
  stayMin: number;
  stayMax: number;
  /** The glow, or the beam's warning line, before it fires. */
  charge: number;
  restMin: number;
  restMax: number;
  /** Its body's radius. */
  radius: number;
  /** A slow bolt; a beam along a line drawn first; or new motes. */
  weapon: 'bolt' | 'beam' | 'spawn';
  /** What one shot does to a person, at Standard. */
  damage: number;
}

export const MACHINES: Record<MachineKind, MachineRules> = {
  mote: { ...MOTE, radius: 0.3, weapon: 'bolt', damage: 18 },
  // Hangs back and charges a beam for two seconds: break line of sight or be hit hard.
  lattice: {
    ...MOTE,
    near: 11,
    far: 18,
    low: 2,
    high: 4,
    speed: 2.2,
    stayMin: 4,
    stayMax: 6,
    charge: 2,
    restMin: 3,
    restMax: 4,
    radius: 0.75,
    weapon: 'beam',
    damage: 55,
  },
  // Slow and far back; sends out motes in threes.
  tender: {
    ...MOTE,
    near: 14,
    far: 22,
    low: 4,
    high: 7,
    speed: 1.4,
    stayMin: 6,
    stayMax: 9,
    charge: 1.5,
    restMin: 10,
    restMax: 13,
    radius: 1.6,
    weapon: 'spawn',
    damage: 0,
  },
};

export const BOLT = {
  /** Slow enough to see and step out of the way of. */
  speed: 18,
  /** How far off its mark a bolt may go: a fixed part, and a part that grows with distance. */
  spread: 0.2,
  spreadPerMetre: 0.06,
  radius: 0.08,
  /** Seconds before a bolt that met nothing fades. */
  life: 2,
};

/**
 * A new place for a mote: a point 6–14 m from its target that sees the target, reached by a clear
 * straight line, not crowding the other motes, and swung round the target from where the mote is now
 * (so it circles and flanks rather than flying through the target). Null if none of the tries works.
 */
export function pickSpot(o: {
  me: P3;
  target: P3;
  others: readonly P3[];
  rng: () => number;
  /** Whether nothing stands between two points. */
  clear: (a: P3, b: P3) => boolean;
  /** The point the mote must see from its new place (the target's chest). */
  aimAt: P3;
  tries?: number;
  /** The machine's own distances and heights; a mote's by default. */
  rules?: Pick<MachineRules, 'near' | 'far' | 'low' | 'high'>;
}): P3 | null {
  const r = o.rules ?? MOTE;
  const bearing = Math.atan2(o.me.x - o.target.x, o.me.z - o.target.z);
  for (let i = 0; i < (o.tries ?? 12); i++) {
    const angle = bearing + (o.rng() * 2 - 1) * MOTE.swing;
    const distance = r.near + o.rng() * (r.far - r.near);
    const spot = {
      x: o.target.x + Math.sin(angle) * distance,
      y: o.target.y + r.low + o.rng() * (r.high - r.low),
      z: o.target.z + Math.cos(angle) * distance,
    };
    if (o.others.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y, p.z - spot.z) < MOTE.apart)) continue;
    if (o.clear(o.me, spot) && o.clear(spot, o.aimAt)) return spot;
  }
  return null;
}

export type FirePhase = { kind: 'rest'; left: number } | { kind: 'charge'; left: number };

/**
 * A mote's shooting: it rests, then, if it sees its target, glows for a moment and fires. If it
 * loses sight while glowing it gives up the shot and rests a little.
 */
export function fireStep(
  phase: FirePhase,
  dt: number,
  sees: boolean,
  rng: () => number,
  rules: Pick<MachineRules, 'charge' | 'restMin' | 'restMax'> = MOTE,
): { phase: FirePhase; fire: boolean } {
  if (phase.kind === 'rest') {
    const left = phase.left - dt;
    if (left > 0 || !sees) return { phase: { kind: 'rest', left: Math.max(0, left) }, fire: false };
    return { phase: { kind: 'charge', left: rules.charge }, fire: false };
  }
  if (!sees) return { phase: { kind: 'rest', left: 0.5 }, fire: false };
  const left = phase.left - dt;
  if (left > 0) return { phase: { kind: 'charge', left }, fire: false };
  return { phase: { kind: 'rest', left: rules.restMin + rng() * (rules.restMax - rules.restMin) }, fire: true };
}

/**
 * Where along a bolt's step from `a` to `b` (0 to 1) it first comes within `reach` of an upright
 * capsule (a body: feet at `feet`, `height` tall, `radius` round), or null if it passes clear.
 */
export function boltMeetsBody(
  a: P3,
  b: P3,
  feet: P3,
  height: number,
  radius: number,
  reach = BOLT.radius,
): number | null {
  const r = radius + reach;
  const bottom = feet.y + Math.min(radius, height / 2);
  const top = feet.y + Math.max(height - radius, height / 2);
  // Sample the step finely: a bolt moves under half a metre a frame, so this is exact enough and
  // simpler than solving segment against capsule.
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.05));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;
    const cy = Math.min(top, Math.max(bottom, y));
    if (Math.hypot(x - feet.x, y - cy, z - feet.z) <= r) return t;
  }
  return null;
}

/**
 * Which edge of the screen a hit came from, for the red flash: the camera looks along `forward`
 * (on the ground) and the shot came from `from`, as seen from `at` (the hero).
 */
export function hitSide(forward: { x: number; z: number }, at: P3, from: P3): 'front' | 'back' | 'left' | 'right' {
  const dx = from.x - at.x;
  const dz = from.z - at.z;
  const ahead = dx * forward.x + dz * forward.z;
  // The camera's right on the ground, as in the game's camera (right = (forward.z, -forward.x)).
  const across = dx * forward.z - dz * forward.x;
  if (Math.abs(ahead) >= Math.abs(across)) return ahead >= 0 ? 'front' : 'back';
  return across >= 0 ? 'right' : 'left';
}

/** The waves that answer the range's drill, in order. */
export const WAVES = [3, 5] as const;

export type Drill =
  | { kind: 'quiet' }
  | { kind: 'warning'; left: number; wave: number }
  | { kind: 'fighting'; wave: number }
  | { kind: 'over' };

/**
 * The range's drill turning into a fight (COMBAT.md): once every drone is down, the motes come, in
 * waves; when the last wave is down it is over until the drill is run again.
 */
export function drillStep(
  drill: Drill,
  facts: { dronesDown: number; drones: number; live: number },
  dt: number,
): { drill: Drill; wake: number | null; say: string | null } {
  if (drill.kind === 'quiet') {
    if (facts.dronesDown < facts.drones) return { drill, wake: null, say: null };
    return {
      drill: { kind: 'warning', left: 2.5, wave: 0 },
      wake: null,
      say: "Drill's done. Hold on. Something's in the vents.",
    };
  }
  if (drill.kind === 'warning') {
    const left = drill.left - dt;
    if (left > 0) return { drill: { ...drill, left }, wake: null, say: null };
    return { drill: { kind: 'fighting', wave: drill.wave }, wake: WAVES[drill.wave] ?? 0, say: null };
  }
  if (drill.kind === 'fighting') {
    if (facts.live > 0) return { drill, wake: null, say: null };
    const next = drill.wave + 1;
    if (next < WAVES.length)
      return { drill: { kind: 'warning', left: 3, wave: next }, wake: null, say: 'More coming!' };
    return { drill: { kind: 'over' }, wake: null, say: 'That was not a drill. Stay close.' };
  }
  // Over until the drones are back up and the drill is run again.
  return { drill: facts.dronesDown < facts.drones ? { kind: 'quiet' } : drill, wake: null, say: null };
}
