/**
 * When the hero falls (D-43, COMBAT.md): down rather than dead. For ten seconds a companion who is
 * standing and not under orders elsewhere can come and bring them up, once per fight; otherwise the
 * fight starts again from a checkpoint just before it. Pure, so the rules are tested.
 */
export const FALLING = {
  /** How long the hero can be helped up. */
  window: 10,
  /** How long helping takes, kneeling beside them. */
  help: 2,
  /** How near the companion must be to help. */
  reach: 1.3,
  /** Getting up takes this long; the hero cannot act until it is done. */
  rising: 0.8,
  /** After a second fall in the same fight, this long on the floor before the checkpoint. */
  fallen: 3,
};

export type Condition =
  | { kind: 'up' }
  | { kind: 'down'; left: number; helped: number }
  | { kind: 'rising'; left: number }
  /** Back to the checkpoint: the game puts everyone back and the fight starts again. */
  | { kind: 'restart' };

export interface FallFacts {
  /** A companion is standing, and following (not holding a point or attacking). */
  companionFree: boolean;
  /** How far the companion is from the hero. */
  companionDistance: number;
  /** A companion has already helped the hero up in this fight. */
  helpUsed: boolean;
}

/** The hero has just fallen: the time they have depends on whether help is still possible. */
export function fall(helpUsed: boolean): Condition {
  return { kind: 'down', left: helpUsed ? FALLING.fallen : FALLING.window, helped: 0 };
}

/**
 * One step of the hero's condition. `helpedUp` is true on the step the companion finishes helping,
 * so the game can mend the hero (half health) and count the help used.
 */
export function conditionStep(
  condition: Condition,
  facts: FallFacts,
  dt: number,
): { condition: Condition; helpedUp: boolean } {
  if (condition.kind === 'up' || condition.kind === 'restart') return { condition, helpedUp: false };
  if (condition.kind === 'rising') {
    const left = condition.left - dt;
    return { condition: left > 0 ? { kind: 'rising', left } : { kind: 'up' }, helpedUp: false };
  }
  const left = condition.left - dt;
  const helping = !facts.helpUsed && facts.companionFree && facts.companionDistance <= FALLING.reach;
  const helped = helping ? condition.helped + dt : 0;
  if (helped >= FALLING.help) return { condition: { kind: 'rising', left: FALLING.rising }, helpedUp: true };
  if (left <= 0) return { condition: { kind: 'restart' }, helpedUp: false };
  return { condition: { kind: 'down', left, helped }, helpedUp: false };
}

/** Whether a companion should go to the hero now: they are down and help is still possible. */
export function needsHelp(condition: Condition, facts: Pick<FallFacts, 'companionFree' | 'helpUsed'>): boolean {
  return condition.kind === 'down' && !facts.helpUsed && facts.companionFree;
}
