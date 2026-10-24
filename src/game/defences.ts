/**
 * Defences in layers (D-42, COMBAT.md): a shield that recharges, plate that blunts each hit, and
 * health beneath. Pure, so every rule is tested.
 */
export type DamageKind = 'kinetic' | 'arc' | 'blast' | 'field';

export interface Defences {
  shield: number;
  shieldMax: number;
  plate: number;
  plateMax: number;
  /** What plate takes off each kinetic hit before the rest lands. */
  plateBlock: number;
  health: number;
  healthMax: number;
  /** Seconds since the last hit, for recovery. */
  sinceHit: number;
}

export type Difficulty = 'story' | 'standard' | 'hard';

/** What each level changes (D-46). Nothing in the story depends on it. */
export const DIFFICULTY: Record<
  Difficulty,
  { name: string; taken: number; toughness: number; assist: number; rest: number }
> = {
  story: { name: 'Story', taken: 0.5, toughness: 0.75, assist: 1.6, rest: 1.3 },
  standard: { name: 'Standard', taken: 1, toughness: 1, assist: 1, rest: 1 },
  hard: { name: 'Hard', taken: 1.4, toughness: 1.25, assist: 0.6, rest: 0.75 },
};

export const DIFFICULTIES: readonly Difficulty[] = ['story', 'standard', 'hard'];

export const RECOVERY = {
  /** Seconds untouched before the shield and health begin to return (D-42). */
  delay: 4,
  /** Points a second. */
  shieldRate: 40,
  healthRate: 10,
  /** Health returns by itself only to the top of the quarter it is in. */
  quarter: 0.25,
};

/** What weapons and machines deal (COMBAT.md). */
export const DAMAGE = {
  pistol: 34,
  bolt: 25,
};

const layers = (shield: number, plate: number, plateBlock: number, health: number): Defences => ({
  shield,
  shieldMax: shield,
  plate,
  plateMax: plate,
  plateBlock,
  health,
  healthMax: health,
  sinceHit: Number.POSITIVE_INFINITY,
});

/** The hero, and a companion: a shield over health. */
export const personDefences = (): Defences => layers(100, 0, 0, 100);

/** A mote: light plate over a small frame, scaled by the difficulty's toughness. */
export const moteDefences = (toughness = 1): Defences => layers(0, 40 * toughness, 6, 40 * toughness);

export interface HitResult {
  defences: Defences;
  /** A layer this hit took to nothing. */
  broke: 'shield' | 'plate' | null;
  /** Health reached nothing: the body is down. */
  down: boolean;
}

/**
 * A hit of `amount` and `kind`, layer by layer. The shield takes it first (arc does double; a field
 * power does nothing to a shielded body); then plate (blast does double and is not blunted; kinetic
 * is blunted by the plate's block; arc does half); whatever is left reaches health.
 */
export function takeHit(d: Defences, amount: number, kind: DamageKind): HitResult {
  const next = { ...d, sinceHit: 0 };
  let broke: HitResult['broke'] = null;
  let left = amount;

  if (next.shield > 0) {
    if (kind === 'field') return { defences: next, broke: null, down: false };
    const scale = kind === 'arc' ? 2 : 1;
    const taken = Math.min(next.shield, left * scale);
    next.shield -= taken;
    left -= taken / scale;
    if (next.shield <= 0) {
      next.shield = 0;
      broke = 'shield';
    }
  }
  if (left > 0 && next.plate > 0) {
    const scale = kind === 'blast' ? 2 : kind === 'arc' ? 0.5 : 1;
    const blunted = kind === 'kinetic' ? Math.max(left * 0.2, left - next.plateBlock) : left;
    const taken = Math.min(next.plate, blunted * scale);
    next.plate -= taken;
    left = blunted - taken / scale;
    if (next.plate <= 0) {
      next.plate = 0;
      broke = broke ?? 'plate';
    }
  }
  if (left > 0) next.health = Math.max(0, next.health - left);
  return { defences: next, broke, down: next.health <= 0 };
}

/**
 * Recovery out of fire (D-42): after a few seconds untouched the shield returns in full, and health
 * returns only to the top of the quarter it is in. Plate never returns in a fight.
 */
export function recover(d: Defences, dt: number): Defences {
  const sinceHit = d.sinceHit + dt;
  if (sinceHit < RECOVERY.delay || d.health <= 0) return { ...d, sinceHit };
  const quarter = d.healthMax * RECOVERY.quarter;
  const ceiling = Math.min(d.healthMax, Math.ceil(d.health / quarter - 1e-9) * quarter);
  return {
    ...d,
    sinceHit,
    shield: Math.min(d.shieldMax, d.shield + RECOVERY.shieldRate * dt),
    health: Math.min(ceiling, d.health + RECOVERY.healthRate * dt),
  };
}

/** Back on their feet after a companion's hand: half health, the shield to return as usual. */
export function helpedUp(d: Defences): Defences {
  return { ...d, health: d.healthMax * 0.5, shield: 0, sinceHit: 0 };
}

/** Whole again: at a checkpoint, or after a fight. */
export function restored(d: Defences): Defences {
  return { ...d, shield: d.shieldMax, plate: d.plateMax, health: d.healthMax, sinceHit: Number.POSITIVE_INFINITY };
}
