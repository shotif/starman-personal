import { describe, expect, it } from 'vitest';
import { CLASSES } from '../../src/game/hero.ts';
import {
  CLASS_POWERS,
  type Cooldowns,
  cool,
  POWERS,
  type PowerId,
  ready,
  strike,
  waiting,
} from '../../src/game/powers.ts';

describe('powers', () => {
  it('gives every class its three starting powers, as the classes name them', () => {
    for (const c of CLASSES) {
      const ids = CLASS_POWERS[c.id];
      expect(ids, c.id).toBeDefined();
      expect([...(ids ?? [])].map((id) => POWERS[id].name).sort()).toEqual([...c.powers].sort());
    }
  });

  it('come back after their cooldown, and say how far they are', () => {
    let cooldowns: Cooldowns = { overload: POWERS.overload.cooldown };
    expect(ready(cooldowns, 'overload')).toBe(false);
    expect(waiting(cooldowns, 'overload')).toBe(1);
    cooldowns = cool(cooldowns, POWERS.overload.cooldown / 2);
    expect(waiting(cooldowns, 'overload')).toBeCloseTo(0.5);
    cooldowns = cool(cooldowns, POWERS.overload.cooldown);
    expect(ready(cooldowns, 'overload')).toBe(true);
    expect(cooldowns).toEqual({});
  });

  it('primes with a Field power, and sets a primed machine off with a detonator', () => {
    expect(strike('lift', { primed: false, shielded: false }).primes).toBe(true);
    expect(strike('overload', { primed: true, shielded: false }).combo).toBe(true);
    expect(strike('overload', { primed: false, shielded: false }).combo).toBe(false);
    expect(strike('mark', { primed: true, shielded: false }).combo).toBe(false);
    const detonators: PowerId[] = ['charge', 'overload', 'slam', 'shove'];
    for (const id of detonators) expect(POWERS[id].detonates, id).toBe(true);
  });

  it('cannot prime a shielded machine with a Field power', () => {
    expect(strike('pull', { primed: false, shielded: true }).primes).toBe(false);
  });

  it('gives every class at least one way to hurt a machine with its powers or to set one up', () => {
    for (const ids of Object.values(CLASS_POWERS)) {
      expect(ids.some((id) => POWERS[id].damage || POWERS[id].primes || id === 'stim' || id === 'mark')).toBe(true);
    }
  });
});
