/**
 * How the Banked fight (D-51; ACT1.md increment 4; COMBAT.md, *The Banked*): cover, a turn in it,
 * falling back, going round, their shots, the engineer's support and the warden's barrier. Pure, so
 * every rule is tested; the scene (src/game/banked.ts) moves the people, fires and draws.
 */

export type BankedKind = 'trooper' | 'engineer' | 'warden';

export interface Flat {
  x: number;
  z: number;
}

export interface KindSpec {
  name: string;
  shield: number;
  plate: number;
  plateBlock: number;
  health: number;
  /** How far from its target it likes to fight, in metres; null for the warden, who walks in. */
  band: [number, number] | null;
  /** Its weapon: damage a shot, shots a volley, seconds between shots, volleys a turn, the rest
   * between volleys, the glint before a volley, and its reach. */
  weapon: { damage: number; shots: number; gap: number; volleys: number; rest: number; glint: number; reach: number };
  /** Walking and running speeds, metres a second. */
  speed: { walk: number; run: number };
  /** Which of the hero's weapons' models it carries (src/game/weapons.ts). */
  carries: 'rifle' | 'pistol' | 'shotgun';
}

export const BANKED: Record<BankedKind, KindSpec> = {
  trooper: {
    name: 'Banked trooper',
    shield: 60,
    plate: 40,
    plateBlock: 4,
    health: 80,
    band: [8, 18],
    weapon: { damage: 9, shots: 3, gap: 0.14, volleys: 2, rest: 0.9, glint: 0.35, reach: 40 },
    speed: { walk: 2.2, run: 4.6 },
    carries: 'rifle',
  },
  engineer: {
    name: 'Banked engineer',
    shield: 80,
    plate: 0,
    plateBlock: 0,
    health: 70,
    band: [12, 24],
    weapon: { damage: 8, shots: 4, gap: 0.5, volleys: 1, rest: 0, glint: 0.35, reach: 35 },
    speed: { walk: 2.2, run: 4.4 },
    carries: 'pistol',
  },
  warden: {
    name: 'Banked warden',
    shield: 0,
    plate: 150,
    plateBlock: 8,
    health: 150,
    band: null,
    weapon: { damage: 28, shots: 1, gap: 0, volleys: 1, rest: 3, glint: 1, reach: 30 },
    speed: { walk: 1.6, run: 1.6 },
    carries: 'shotgun',
  },
};

/** The warden's barrier (D-51): its strength, its arc in front, and how it returns. */
export const BARRIER = { strength: 300, arcDegrees: 120, returnAfter: 8, rate: 60 };
/** The engineer's support: a shield on an ally, motes sent out, and their limits. */
export const SUPPORT = { shield: 60, shieldEvery: 12, shieldReach: 18, motesEvery: 20, motes: 2, motesAlive: 3 };
/** When a Banked falls back (a share of its health), how long hidden makes one go round, and spacing. */
export const TACTICS = { fallBackBelow: 0.35, flankAfter: 6, lostAfter: 6, spacing: 3, wardenStops: 7 };

const sub = (a: Flat, b: Flat): Flat => ({ x: a.x - b.x, z: a.z - b.z });
const len = (a: Flat) => Math.hypot(a.x, a.z);
const dot = (a: Flat, b: Flat) => a.x * b.x + a.z * b.z;
const norm = (a: Flat): Flat => {
  const l = len(a) || 1;
  return { x: a.x / l, z: a.z / l };
};

// ─── Cover ─────────────────────────────────────────────────────────────────────────────────────────

/** A place to hide: where to crouch (the floor's height `y`), and the way the furniture's side faces. */
export interface Cover {
  at: Flat;
  y: number;
  /** Out from the furniture: the cover hides from what lies the other way. */
  normal: Flat;
}

/** Low furniture's sides give cover points: 0.55 m out, about a metre apart (COMBAT.md). */
export function coverPoints(props: readonly { at: number[]; yaw: number; size: number[]; moves?: boolean }[]): Cover[] {
  const out: Cover[] = [];
  for (const p of props) {
    const [w = 0, h = 0, d = 0] = p.size;
    if (p.moves || h < 0.8 || h > 1.35) continue;
    const [x = 0, y = 0, z = 0] = p.at;
    // The prop's own axes on the floor: +X across it, +Z along its front.
    const across: Flat = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
    const front: Flat = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    const faces: [Flat, Flat, number, number][] = [
      [front, across, d / 2, w],
      [{ x: -front.x, z: -front.z }, across, d / 2, w],
      [across, front, w / 2, d],
      [{ x: -across.x, z: -across.z }, front, w / 2, d],
    ];
    for (const [normal, along, half, length] of faces) {
      const n = Math.max(1, Math.floor(length / 1));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        out.push({
          at: {
            x: x + normal.x * (half + 0.55) + along.x * t * length,
            z: z + normal.z * (half + 0.55) + along.z * t * length,
          },
          y,
          normal,
        });
      }
    }
  }
  return out;
}

/** Whether a cover point hides from a target: the furniture lies between them. */
export function hides(cover: Cover, target: Flat): boolean {
  const to = sub(target, cover.at);
  if (len(to) < 1.5) return false;
  return dot(norm(to), { x: -cover.normal.x, z: -cover.normal.z }) >= 0.5;
}

export interface CoverChoice {
  me: Flat;
  target: Flat;
  covers: readonly Cover[];
  /** Points others hold or are running to. */
  taken: ReadonlySet<number>;
  /** Where the rest of the squad are. */
  allies: readonly Flat[];
  band: [number, number];
  /** Falling back: only points farther from the target than now, the farther the better. */
  fallBack?: boolean;
  /** Going round: from the target, the way the rest of the squad lie; points 60° or more from it win. */
  flankFrom?: Flat | null;
  /** The point held now, which does not count as taken. */
  own?: number | null;
}

/** The best cover point by the rules (COMBAT.md, *Choosing cover*), or null if none hides. */
export function chooseCover(c: CoverChoice): number | null {
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const now = len(sub(c.me, c.target));
  c.covers.forEach((cover, i) => {
    if ((c.taken.has(i) && i !== c.own) || !hides(cover, c.target)) return;
    if (c.allies.some((a) => len(sub(a, cover.at)) < TACTICS.spacing)) return;
    const d = len(sub(cover.at, c.target));
    if (c.fallBack && d < now + 2) return;
    let score = len(sub(cover.at, c.me)) * 0.35;
    const [min, max] = c.band;
    score += d < min ? (min - d) * 2 : d > max ? (d - max) * 1.5 : 0;
    if (c.fallBack) score -= d * 0.5;
    if (c.flankFrom) {
      const angle =
        (Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(cover.at, c.target)), norm(c.flankFrom))))) * 180) / Math.PI;
      if (angle < 60) score += (60 - angle) / 5;
    }
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

// ─── A turn in the fight ───────────────────────────────────────────────────────────────────────────

export type Mode = 'idle' | 'seek' | 'hide' | 'peek' | 'open';

export interface BankedState {
  mode: Mode;
  /** The cover point held or run to. */
  cover: number | null;
  /** Seconds left of hiding, or before the next shot; the glint before a volley. */
  timer: number;
  /** Shots left in this volley, volleys left in this turn. */
  shots: number;
  volleys: number;
  /** Seconds the target has not been seen from this cover. */
  unseen: number;
  fellBack: boolean;
  /** Seconds before this one may go round again. */
  flankWait: number;
  /** A cover point it lost the target from, kept away from for a while. */
  avoid: number | null;
  avoidFor: number;
}

export const newState = (): BankedState => ({
  mode: 'idle',
  cover: null,
  timer: 0,
  shots: 0,
  volleys: 0,
  unseen: 0,
  fellBack: false,
  flankWait: 0,
  avoid: null,
  avoidFor: 0,
});

export interface StepInput {
  kind: BankedKind;
  me: Flat;
  /** Its health as a share. */
  health: number;
  target: Flat | null;
  /** Whether it sees its target from where it stands (standing up). */
  sees: boolean;
  covers: readonly Cover[];
  taken: ReadonlySet<number>;
  allies: readonly Flat[];
  /** Seconds the hero has stayed hidden from the whole squad, and whether this one should go round. */
  heroHidden: number;
  flanker: boolean;
  /** A number from 0 to 1, for the times that vary. */
  random: number;
}

export interface StepOutput {
  state: BankedState;
  /** Where to go (running), or null to stay. */
  moveTo: Flat | null;
  crouch: boolean;
  /** Its weapon glints (a volley is coming), and fires one shot now. */
  glint: boolean;
  fire: boolean;
}

const ARRIVED = 0.6;

/** One step of a Banked's fight (COMBAT.md, *A turn in cover*). */
export function bankedStep(s: BankedState, input: StepInput, dt: number): StepOutput {
  const spec = BANKED[input.kind];
  const out = (state: BankedState, moveTo: Flat | null, crouch: boolean, glint = false, fire = false): StepOutput => ({
    state,
    moveTo,
    crouch,
    glint,
    fire,
  });
  const target = input.target;
  if (!target) return out({ ...s, mode: 'idle' }, null, false);
  const state: BankedState = {
    ...s,
    flankWait: Math.max(0, s.flankWait - dt),
    avoidFor: Math.max(0, s.avoidFor - dt),
  };

  // The warden walks in behind its barrier, and fires when it sees.
  if (!spec.band) {
    const to = sub(target, input.me);
    const d = len(to);
    const stop =
      d > TACTICS.wardenStops
        ? { x: target.x - (to.x / d) * TACTICS.wardenStops, z: target.z - (to.z / d) * TACTICS.wardenStops }
        : null;
    return volley({ ...state, mode: 'open' }, input, dt, stop, false);
  }

  const band = spec.band;
  const choose = (extra: Partial<CoverChoice>) =>
    chooseCover({
      me: input.me,
      target,
      covers: input.covers,
      taken: state.avoid !== null && state.avoidFor > 0 ? new Set([...input.taken, state.avoid]) : input.taken,
      allies: input.allies,
      band,
      own: state.cover,
      ...extra,
    });

  // Badly hurt: once, back to the cover farthest from the target that still hides.
  if (!state.fellBack && input.health < TACTICS.fallBackBelow) {
    const back = choose({ fallBack: true });
    state.fellBack = true;
    if (back !== null)
      return out({ ...state, mode: 'seek', cover: back, unseen: 0 }, input.covers[back]?.at ?? null, false);
  }
  // Going round, when the hero has stayed hidden.
  if (input.flanker && input.heroHidden >= TACTICS.flankAfter && state.flankWait <= 0) {
    const squad =
      input.allies.length > 0
        ? input.allies.reduce((a, b) => ({ x: a.x + b.x / input.allies.length, z: a.z + b.z / input.allies.length }), {
            x: 0,
            z: 0,
          })
        : input.me;
    const round = choose({ flankFrom: sub(squad, target) });
    state.flankWait = 10;
    if (round !== null && round !== state.cover) {
      return out({ ...state, mode: 'seek', cover: round, unseen: 0 }, input.covers[round]?.at ?? null, false);
    }
  }
  // No cover yet, or the cover no longer hides from the target (flanked): find another.
  const held = state.cover !== null ? input.covers[state.cover] : undefined;
  if (!held || !hides(held, target) || state.unseen >= TACTICS.lostAfter) {
    // Lost from this cover: anywhere but here, for a while.
    if (held && state.unseen >= TACTICS.lostAfter && state.cover !== null) {
      state.avoid = state.cover;
      state.avoidFor = 10;
    }
    const next = choose({ own: state.avoid === state.cover ? null : state.cover });
    if (next === null) {
      return volley(
        { ...state, mode: 'open', cover: null, unseen: 0 },
        input,
        dt,
        keepBand(input.me, target, band),
        false,
      );
    }
    return out({ ...state, mode: 'seek', cover: next, unseen: 0 }, input.covers[next]?.at ?? null, false);
  }
  if (state.mode === 'seek' || state.mode === 'idle' || state.mode === 'open') {
    if (len(sub(held.at, input.me)) > ARRIVED) return out({ ...state, mode: 'seek' }, held.at, false);
    return out({ ...state, mode: 'hide', timer: 1.2 + input.random * 0.8 }, null, true);
  }
  if (state.mode === 'hide') {
    const timer = state.timer - dt;
    if (timer > 0) return out({ ...state, timer }, null, true);
    if (!input.sees) return out({ ...state, timer: 1, unseen: state.unseen + 1 }, null, true);
    return out(
      {
        ...state,
        mode: 'peek',
        timer: spec.weapon.glint,
        shots: spec.weapon.shots,
        volleys: spec.weapon.volleys,
        unseen: 0,
      },
      null,
      false,
      true,
    );
  }
  // Peeking: volleys, then down again.
  const after = volley(state, input, dt, null, false);
  if (after.state.volleys <= 0 && after.state.shots <= 0) {
    return out({ ...after.state, mode: 'hide', timer: 1.2 + input.random * 0.8 }, null, true, false, after.fire);
  }
  return after;
}

/** Where to stand in the open: at the near edge of the band from the target. */
function keepBand(me: Flat, target: Flat, band: [number, number]): Flat | null {
  const to = sub(me, target);
  const d = len(to);
  if (d >= band[0] && d <= band[1]) return null;
  const want = d < band[0] ? band[0] : band[1];
  const dir = norm(to);
  return { x: target.x + dir.x * want, z: target.z + dir.z * want };
}

/**
 * Firing: the glint, then each shot of a volley at its gap, then the rest before the next volley; a
 * turn's volleys run down (in the open they start again). Nothing is fired at what is not seen.
 */
function volley(s: BankedState, input: StepInput, dt: number, moveTo: Flat | null, crouch: boolean): StepOutput {
  const w = BANKED[input.kind].weapon;
  const result = (state: BankedState, glint: boolean, fire: boolean): StepOutput => ({
    state,
    moveTo,
    crouch,
    glint,
    fire,
  });
  if (!input.sees) return result({ ...s, timer: Math.max(s.timer, w.glint) }, false, false);
  let shots = s.shots;
  let volleys = s.volleys;
  let wait = s.timer;
  if (shots <= 0) {
    if (volleys <= 0 && s.mode !== 'open') return result(s, false, false);
    shots = w.shots;
    if (volleys <= 0) volleys = w.volleys;
    // A volley always starts with its glint.
    if (wait <= 0) wait = w.glint;
  }
  const timer = wait - dt;
  if (timer > 0) return result({ ...s, shots, volleys, timer }, shots === w.shots, false);
  shots -= 1;
  if (shots > 0) return result({ ...s, shots, volleys, timer: w.gap }, false, true);
  return result({ ...s, shots: 0, volleys: volleys - 1, timer: w.rest + w.glint }, false, true);
}

// ─── Shots, support and the barrier ────────────────────────────────────────────────────────────────

/** A Banked shot's chance to hit (COMBAT.md, *Shots*): 70% at 5 m to 30% at 30 m, less if the target moves. */
export function hitChance(
  distance: number,
  moving: boolean,
  level: 'story' | 'standard' | 'hard' = 'standard',
): number {
  const base = Math.max(0.3, Math.min(0.7, 0.7 - (distance - 5) * 0.016));
  const scale = level === 'story' ? 0.8 : level === 'hard' ? 1.15 : 1;
  return Math.min(0.9, base * (moving ? 0.75 : 1) * scale);
}

/** Which ally the engineer shields: the one with the least shield, within reach; null if none needs it. */
export function neediest(
  engineer: Flat,
  allies: readonly { at: Flat; shield: number; shieldMax: number; alive: boolean }[],
): number | null {
  let best: number | null = null;
  let least = 0.999;
  allies.forEach((a, i) => {
    if (!a.alive || len(sub(a.at, engineer)) > SUPPORT.shieldReach) return;
    const share = a.shieldMax > 0 ? a.shield / a.shieldMax : 0;
    if (share < least) {
      least = share;
      best = i;
    }
  });
  return best;
}

/** Whether a blow from `from` meets the warden's barrier: within its arc in front, while it stands. */
export function barrierStops(barrier: number, facing: Flat, at: Flat, from: Flat): boolean {
  if (barrier <= 0) return false;
  const to = norm(sub(from, at));
  return dot(to, norm(facing)) >= Math.cos(((BARRIER.arcDegrees / 2) * Math.PI) / 180);
}

/** The barrier's strength after a step: back 8 s after it last took a blow (or broke), at 60 a second. */
export function barrierStep(barrier: number, sinceHit: number, dt: number): number {
  if (sinceHit < BARRIER.returnAfter) return barrier;
  return Math.min(BARRIER.strength, barrier + BARRIER.rate * dt);
}
