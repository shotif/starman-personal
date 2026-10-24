import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, type Fight, fightStep, startFight, type Wave } from '../../src/game/encounters.ts';

/** Runs a fight where each wave is brought down `downAfter` seconds after it comes in. */
function run(id: string, downAfter: number) {
  let fight: Fight = startFight(id);
  const woken: Wave[] = [];
  let live = 0;
  let downAt = Number.POSITIVE_INFINITY;
  for (let t = 0; t < 120; t += 0.1) {
    if (t >= downAt) {
      live = 0;
      downAt = Number.POSITIVE_INFINITY;
    }
    const step = fightStep(fight, live, 0.1);
    fight = step.fight;
    if (step.wake) {
      woken.push(step.wake);
      live = (step.wake.motes ?? 0) + (step.wake.lattices ?? 0) + (step.wake.tenders ?? 0);
      downAt = t + downAfter;
    }
    if (step.cleared) return { woken, cleared: t };
  }
  return { woken, cleared: null };
}

describe('fights in waves', () => {
  it('sends every wave in turn, then is cleared', () => {
    for (const id of Object.keys(ENCOUNTERS)) {
      const r = run(id, 5);
      expect(r.woken).toEqual(ENCOUNTERS[id]);
      expect(r.cleared).not.toBeNull();
    }
  });

  it('waits while a wave is still flying', () => {
    const r = run('hangar_1', 30);
    expect(r.cleared).toBeGreaterThan(60);
  });

  it('every fight names vents that a wave can come from', () => {
    for (const waves of Object.values(ENCOUNTERS)) {
      for (const wave of waves) expect(wave.vents.length).toBeGreaterThan(0);
    }
  });
});
