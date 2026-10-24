import type { DamageKind } from './defences.ts';

/**
 * The classes' starting powers (D-33, COMBAT.md): what each does, how long it takes to return, and
 * what it needs. Pure, so the rules are tested; the game (src/game/abilities.ts) carries them out.
 * Everything here is fiction: Field powers bend space a little, as the jump drives do, scaled down
 * to a body; Systems powers are machines and intrusion; Arms powers are training, armour and stims.
 */
export type PowerId =
  | 'stim'
  | 'charge'
  | 'brace'
  | 'seeker'
  | 'overload'
  | 'spoof'
  | 'lift'
  | 'pull'
  | 'slam'
  | 'veil'
  | 'mark'
  | 'flare'
  | 'hop'
  | 'shove'
  | 'barrier'
  | 'repair';

export interface PowerSpec {
  id: PowerId;
  name: string;
  /** Seconds before it can be used again. */
  cooldown: number;
  /** What it is aimed at: a machine under the crosshair, the hero, or the ground ahead. */
  target: 'machine' | 'self' | 'ground';
  /** How far it reaches, for a target. */
  range: number;
  /** What it does to the machine it strikes, if anything. */
  damage?: { amount: number; kind: DamageKind };
  /** A Field power that leaves its target primed for a combination. */
  primes?: boolean;
  /** Sets off a primed target: a burst that hurts everything near it. */
  detonates?: boolean;
  /** How long its effect lasts, in seconds. */
  lasts?: number;
  /** One line for the screen. */
  says: string;
}

export const POWERS: Record<PowerId, PowerSpec> = {
  stim: {
    id: 'stim',
    name: 'Stim Burst',
    cooldown: 20,
    target: 'self',
    range: 0,
    lasts: 5,
    says: 'The world slows for you.',
  },
  charge: {
    id: 'charge',
    name: 'Breach Charge',
    cooldown: 8,
    target: 'ground',
    range: 22,
    damage: { amount: 90, kind: 'blast' },
    detonates: true,
    says: 'A shaped charge, thrown.',
  },
  brace: {
    id: 'brace',
    name: 'Brace',
    cooldown: 14,
    target: 'self',
    range: 0,
    lasts: 6,
    says: 'Armour locks: damage halved.',
  },
  seeker: {
    id: 'seeker',
    name: 'Seeker Drone',
    cooldown: 9,
    target: 'machine',
    range: 30,
    damage: { amount: 70, kind: 'arc' },
    says: 'A drone that finds its mark and bursts.',
  },
  overload: {
    id: 'overload',
    name: 'Overload',
    cooldown: 7,
    target: 'machine',
    range: 30,
    damage: { amount: 60, kind: 'arc' },
    detonates: true,
    says: 'Strips shields, shorts machines.',
  },
  spoof: {
    id: 'spoof',
    name: 'Spoof',
    cooldown: 16,
    target: 'machine',
    range: 25,
    lasts: 8,
    says: 'Turns a machine on its own kind.',
  },
  lift: {
    id: 'lift',
    name: 'Lift',
    cooldown: 8,
    target: 'machine',
    range: 25,
    damage: { amount: 15, kind: 'field' },
    primes: true,
    lasts: 4,
    says: 'Hangs a machine helpless in the air.',
  },
  pull: {
    id: 'pull',
    name: 'Pull',
    cooldown: 7,
    target: 'machine',
    range: 25,
    damage: { amount: 15, kind: 'field' },
    primes: true,
    lasts: 2.5,
    says: 'Drags a machine to you, helpless.',
  },
  slam: {
    id: 'slam',
    name: 'Slam',
    cooldown: 9,
    target: 'machine',
    range: 25,
    damage: { amount: 80, kind: 'field' },
    detonates: true,
    says: 'Throws a machine into the floor.',
  },
  veil: {
    id: 'veil',
    name: 'Veil',
    cooldown: 16,
    target: 'self',
    range: 0,
    lasts: 6,
    says: 'Bends light round you: unseen.',
  },
  mark: {
    id: 'mark',
    name: 'Mark',
    cooldown: 6,
    target: 'machine',
    range: 40,
    lasts: 10,
    says: 'Marked: it takes half again.',
  },
  flare: {
    id: 'flare',
    name: 'Decoy Flare',
    cooldown: 14,
    target: 'ground',
    range: 18,
    lasts: 6,
    says: 'Something brighter to shoot at.',
  },
  hop: {
    id: 'hop',
    name: 'Hop',
    cooldown: 8,
    target: 'machine',
    range: 14,
    damage: { amount: 40, kind: 'field' },
    says: 'A short warp jump under a machine, and a blow.',
  },
  shove: {
    id: 'shove',
    name: 'Shove',
    cooldown: 7,
    target: 'self',
    range: 7,
    damage: { amount: 50, kind: 'field' },
    detonates: true,
    says: 'A wave of force ahead of you.',
  },
  barrier: {
    id: 'barrier',
    name: 'Barrier',
    cooldown: 15,
    target: 'self',
    range: 0,
    lasts: 8,
    says: 'A field shell over your shield.',
  },
  repair: {
    id: 'repair',
    name: 'Repair Drone',
    cooldown: 18,
    target: 'self',
    range: 0,
    lasts: 4,
    says: 'Mends you and those near you.',
  },
};

/** Each class's three starting powers (D-33), in the order of their keys and buttons. */
export const CLASS_POWERS: Record<string, [PowerId, PowerId, PowerId]> = {
  breacher: ['charge', 'brace', 'stim'],
  rigger: ['overload', 'seeker', 'spoof'],
  fieldwright: ['lift', 'slam', 'pull'],
  shade: ['mark', 'veil', 'flare'],
  striker: ['hop', 'shove', 'stim'],
  warden: ['pull', 'barrier', 'repair'],
};

/** The burst when a primed machine is set off (COMBAT.md's one combination). */
export const COMBO = { amount: 70, kind: 'blast' as DamageKind, radius: 4.5 };

/** How long a primed machine stays primed, glowing violet. */
export const PRIMED_SECONDS = 4;

/** Seconds left on each of the hero's powers. */
export type Cooldowns = Partial<Record<PowerId, number>>;

export function cool(cooldowns: Cooldowns, dt: number): Cooldowns {
  const next: Cooldowns = {};
  for (const [id, left] of Object.entries(cooldowns) as [PowerId, number][]) {
    if (left - dt > 0) next[id] = left - dt;
  }
  return next;
}

export function ready(cooldowns: Cooldowns, id: PowerId): boolean {
  return (cooldowns[id] ?? 0) <= 0;
}

/** The share of a power's cooldown still to run, 0 when ready, for the buttons. */
export function waiting(cooldowns: Cooldowns, id: PowerId): number {
  return Math.min(1, (cooldowns[id] ?? 0) / POWERS[id].cooldown);
}

/**
 * What one power does when it strikes a machine: its own damage, and the combination's burst if the
 * machine was primed and this power sets it off. A Field power on a shielded machine does nothing
 * but strip a little of nothing: shields stop it (D-42).
 */
export function strike(
  id: PowerId,
  target: { primed: boolean; shielded: boolean },
): { damage: { amount: number; kind: DamageKind } | null; combo: boolean; primes: boolean } {
  const spec = POWERS[id];
  const fieldBlocked = spec.damage?.kind === 'field' && target.shielded;
  return {
    damage: spec.damage ?? null,
    combo: !!spec.detonates && target.primed,
    primes: !!spec.primes && !fieldBlocked,
  };
}
