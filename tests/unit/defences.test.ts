import { describe, expect, it } from 'vitest';
import {
  DAMAGE,
  DIFFICULTY,
  helpedUp,
  moteDefences,
  personDefences,
  RECOVERY,
  recover,
  restored,
  takeHit,
} from '../../src/game/defences.ts';
import { type Condition, conditionStep, FALLING, fall, needsHelp } from '../../src/game/falling.ts';

describe('defences in layers', () => {
  it('takes hits on the shield first, then on health', () => {
    let d = personDefences();
    d = takeHit(d, 60, 'kinetic').defences;
    expect(d.shield).toBe(40);
    expect(d.health).toBe(100);
    const breaking = takeHit(d, 60, 'kinetic');
    expect(breaking.broke).toBe('shield');
    expect(breaking.defences.shield).toBe(0);
    expect(breaking.defences.health).toBe(80);
  });

  it('lets arc tear shields twice as fast, and field powers do nothing to a shielded body', () => {
    expect(takeHit(personDefences(), 30, 'arc').defences.shield).toBe(40);
    const lifted = takeHit(personDefences(), 50, 'field');
    expect(lifted.defences.shield).toBe(100);
    expect(lifted.defences.health).toBe(100);
  });

  it('blunts kinetic hits on plate, and blast breaks it twice as fast', () => {
    const kinetic = takeHit(moteDefences(), 34, 'kinetic').defences;
    expect(kinetic.plate).toBe(40 - (34 - 6));
    const blast = takeHit(moteDefences(), 15, 'blast').defences;
    expect(blast.plate).toBe(10);
  });

  it('brings a mote down in three pistol shots at Standard', () => {
    let d = moteDefences(DIFFICULTY.standard.toughness);
    const results = [1, 2, 3].map(() => {
      const r = takeHit(d, DAMAGE.pistol, 'kinetic');
      d = r.defences;
      return r.down;
    });
    expect(results).toEqual([false, false, true]);
  });

  it('downs the hero after about twelve bolts at Standard, and far more at Story', () => {
    const boltsToFall = (taken: number) => {
      let d = personDefences();
      for (let n = 1; n < 100; n++) {
        const r = takeHit(d, DAMAGE.bolt * taken, 'kinetic');
        d = r.defences;
        if (r.down) return n;
      }
      return Number.POSITIVE_INFINITY;
    };
    expect(boltsToFall(DIFFICULTY.standard.taken)).toBe(12);
    expect(boltsToFall(DIFFICULTY.story.taken)).toBe(23);
    expect(boltsToFall(DIFFICULTY.hard.taken)).toBeLessThan(10);
  });
});

describe('recovering out of fire', () => {
  const later = (d: ReturnType<typeof personDefences>, seconds: number) => {
    let x = d;
    for (let t = 0; t < seconds; t += 0.05) x = recover(x, 0.05);
    return x;
  };

  it('returns nothing until a few seconds without a hit', () => {
    const hurt = takeHit(personDefences(), 150, 'kinetic').defences;
    const soon = later(hurt, RECOVERY.delay - 0.5);
    expect(soon.shield).toBe(0);
    expect(soon.health).toBe(50);
  });

  it('brings the shield back in full, and health only to the top of its quarter', () => {
    const hurt = takeHit(personDefences(), 140, 'kinetic').defences;
    expect(hurt.health).toBe(60);
    const healed = later(hurt, 20);
    expect(healed.shield).toBe(100);
    expect(healed.health).toBe(75);
    // On a quarter's line, it stays there.
    const half = takeHit(personDefences(), 150, 'kinetic').defences;
    expect(later(half, 20).health).toBe(50);
  });

  it("mends with a companion's hand to half, and in full at a checkpoint", () => {
    const fallen = takeHit(personDefences(), 300, 'kinetic').defences;
    expect(fallen.health).toBe(0);
    expect(helpedUp(fallen).health).toBe(50);
    expect(restored(fallen)).toMatchObject({ shield: 100, health: 100 });
  });
});

describe('when the hero falls', () => {
  const run = (start: Condition, facts: Parameters<typeof conditionStep>[1], seconds: number) => {
    let c = start;
    let helped = false;
    for (let t = 0; t < seconds; t += 0.1) {
      const step = conditionStep(c, facts, 0.1);
      c = step.condition;
      helped ||= step.helpedUp;
    }
    return { c, helped };
  };

  it('is helped up by a free companion beside them', () => {
    const r = run(fall(false), { companionFree: true, companionDistance: 1, helpUsed: false }, FALLING.help + 0.2);
    expect(r.helped).toBe(true);
    expect(r.c.kind).toBe('rising');
    expect(run(r.c, { companionFree: true, companionDistance: 1, helpUsed: true }, 1).c.kind).toBe('up');
  });

  it('goes back to the checkpoint when no one comes in time', () => {
    const far = run(fall(false), { companionFree: true, companionDistance: 6, helpUsed: false }, FALLING.window + 0.2);
    expect(far.c.kind).toBe('restart');
    const busy = run(
      fall(false),
      { companionFree: false, companionDistance: 1, helpUsed: false },
      FALLING.window + 0.2,
    );
    expect(busy.c.kind).toBe('restart');
  });

  it('is helped only once in a fight', () => {
    const again = fall(true);
    expect(again).toMatchObject({ kind: 'down', left: FALLING.fallen });
    const r = run(again, { companionFree: true, companionDistance: 1, helpUsed: true }, FALLING.fallen + 0.2);
    expect(r.helped).toBe(false);
    expect(r.c.kind).toBe('restart');
    expect(needsHelp(again, { companionFree: true, helpUsed: true })).toBe(false);
    expect(needsHelp(fall(false), { companionFree: true, helpUsed: false })).toBe(true);
  });
});
