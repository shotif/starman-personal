import { describe, expect, it } from 'vitest';
import {
  COMPANION_POWERS,
  cannotRank,
  companionAuto,
  companionPoints,
  companionRankUp,
  GAIN_LEVELS,
  gain,
  gainOnce,
  IN_HAND,
  levelOf,
  MAX_LEVEL,
  modifiers,
  newCompanionGrowth,
  newGrowth,
  nextAt,
  pointsOf,
  powersAt,
  rankOf,
  rankUp,
  sound,
  TALENTS,
  TRAINING,
  toHand,
  train,
} from '../../src/game/growth.ts';
import { CLASSES, MOMENTS, ORIGINS } from '../../src/game/hero.ts';
import { atRank, CLASS_GAINS, CLASS_POWERS, POWERS, type PowerId } from '../../src/game/powers.ts';

const at = (xp: number, heroClass = 'fieldwright') => ({ ...newGrowth(heroClass), xp });

describe('experience and levels', () => {
  it('reaches level 2 at 300, 3 at 750, 6 at 2,800, and stops at 12', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(299)).toBe(1);
    expect(levelOf(300)).toBe(2);
    expect(levelOf(749)).toBe(2);
    expect(levelOf(750)).toBe(3);
    expect(levelOf(2800)).toBe(6);
    expect(levelOf(1e9)).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(12);
    expect(nextAt(1)).toBe(300);
    expect(nextAt(MAX_LEVEL)).toBeNull();
  });

  it('gives two points a level, and tells which levels a grant reached', () => {
    const g = gain(newGrowth('rigger'), 'rigger', 800);
    expect(g.levels).toEqual([2, 3]);
    expect(levelOf(g.growth.xp)).toBe(3);
    expect(pointsOf(g.growth)).toBe(4);
    expect(gain(g.growth, 'rigger', 10).levels).toEqual([]);
    expect(gain(g.growth, 'rigger', -50).growth.xp).toBe(800);
  });
});

describe('grants given once', () => {
  it('gives a keyed grant once only, so a chapter played again gives nothing twice', () => {
    const once = gainOnce(newGrowth('rigger'), 'rigger', 'xp:The drill', 40);
    expect(once.growth.xp).toBe(40);
    expect(once.growth.got).toEqual(['xp:The drill']);
    const again = gainOnce(once.growth, 'rigger', 'xp:The drill', 40);
    expect(again.growth).toBe(once.growth);
    expect(gainOnce(once.growth, 'rigger', 'line:hero_pell_gate_07a', 50).growth.xp).toBe(90);
    expect(sound({ xp: 90, got: ['a', 3 as unknown as string] }, 'rigger').got).toEqual(['a']);
  });
});

describe('powers', () => {
  it('gives every class its two new powers at levels 3 and 6, all of them real powers', () => {
    for (const c of CLASSES) {
      const gains = CLASS_GAINS[c.id] ?? [];
      expect(gains, c.id).toHaveLength(2);
      for (const p of gains) expect(POWERS[p], `${c.id}: ${p}`).toBeDefined();
      expect(powersAt(c.id, 1)).toEqual(CLASS_POWERS[c.id]);
      expect(powersAt(c.id, 2)).toHaveLength(3);
      expect(powersAt(c.id, 3)).toEqual([...(CLASS_POWERS[c.id] ?? []), gains[0]]);
      expect(powersAt(c.id, 6)).toEqual([...(CLASS_POWERS[c.id] ?? []), ...gains]);
      // Never a power the class already had.
      expect(new Set(powersAt(c.id, 12)).size).toBe(5);
    }
    expect(GAIN_LEVELS).toEqual([3, 6]);
  });

  it('says which powers a level brought', () => {
    const g = gain(at(700, 'shade'), 'shade', 100);
    expect(g.powers).toEqual(['blind']);
    expect(gain(at(2700, 'shade'), 'shade', 200).powers).toEqual(['longshot']);
  });

  it('ranks a power for a point, then two, up to three, and only a power learned', () => {
    let g = at(2000, 'breacher'); // level 5: 8 points
    expect(rankOf(g, 'charge')).toBe(1);
    g = rankUp(g, 'breacher', 'charge');
    expect(rankOf(g, 'charge')).toBe(2);
    expect(pointsOf(g)).toBe(7);
    g = rankUp(g, 'breacher', 'charge');
    expect(rankOf(g, 'charge')).toBe(3);
    expect(pointsOf(g)).toBe(5);
    expect(cannotRank(g, 'breacher', 'charge')).toBe('At its last rank.');
    expect(rankUp(g, 'breacher', 'charge')).toBe(g);
    // Second Wind comes at level 6.
    expect(cannotRank(g, 'breacher', 'secondwind')).toBe('Not yet learned.');
    expect(cannotRank(at(0), 'fieldwright', 'lift')).toBe('Not enough points.');
  });

  it('makes a rank-two power a third stronger, and a rank-three one quicker and wider', () => {
    const slam = POWERS.slam;
    expect(atRank(slam, 1)).toEqual(slam);
    expect(atRank(slam, 2).damage?.amount).toBeCloseTo((slam.damage?.amount ?? 0) * (4 / 3));
    expect(atRank(slam, 2).cooldown).toBe(slam.cooldown);
    expect(atRank(slam, 3).cooldown).toBeCloseTo(slam.cooldown * 0.75);
    expect(atRank(slam, 3).range).toBeCloseTo(slam.range * (4 / 3));
    const sink = POWERS.sink;
    expect(atRank(sink, 3).radius).toBeCloseTo((sink.radius ?? 0) * (4 / 3));
    expect(atRank(sink, 2).lasts).toBeCloseTo((sink.lasts ?? 0) * (4 / 3));
    expect(atRank(POWERS.secondwind, 2).heal).toBeCloseTo(0.25 * (4 / 3));
  });

  it('keeps three different powers in hand, swapping places', () => {
    let g = at(800, 'warden'); // level 3: pull, barrier, repair, and Lift
    expect(g.hand).toEqual(CLASS_POWERS.warden);
    expect(IN_HAND).toBe(3);
    g = toHand(g, 'warden', 'lift', 1);
    expect(g.hand).toEqual(['pull', 'lift', 'repair']);
    // A power already in hand trades places.
    g = toHand(g, 'warden', 'repair', 1);
    expect(g.hand).toEqual(['pull', 'repair', 'lift']);
    // Not one not yet learned, nor a slot that is not there.
    expect(toHand(g, 'warden', 'shelter', 0)).toBe(g);
    expect(toHand(g, 'warden', 'pull', 3)).toBe(g);
  });

  it('fills a hand that has room with a new power', () => {
    const g = gain({ ...at(700, 'striker'), hand: ['hop', 'shove'] }, 'striker', 100);
    expect(g.growth.hand).toEqual(['hop', 'shove', 'brace']);
  });

  it('makes a save’s growth sound', () => {
    const g = sound(
      { xp: 800, ranks: { lift: 9, slam: 2, shelter: 3 } as Partial<Record<PowerId, number>>, hand: ['slam', 'slam'] },
      'fieldwright',
    );
    expect(g.ranks).toEqual({ lift: 3, slam: 2 });
    expect(g.hand).toEqual(['slam', 'lift', 'pull']);
    expect(g.training).toBe(1);
    expect(sound(undefined, 'rigger')).toEqual(newGrowth('rigger'));
  });
});

describe('talents and training', () => {
  it('gives every class a training and every past a talent', () => {
    for (const c of CLASSES) expect(TRAINING[c.id], c.id).toBeDefined();
    for (const o of [...ORIGINS, ...MOMENTS]) expect(TALENTS[o.id], o.id).toBeDefined();
  });

  it('trains for a point, then two, to rank three', () => {
    let g = at(1300); // level 4: 6 points
    expect(g.training).toBe(1);
    g = train(g);
    expect(g.training).toBe(2);
    g = train(g);
    expect(g.training).toBe(3);
    expect(pointsOf(g)).toBe(3);
    expect(train(g)).toBe(g);
  });

  it('turns the past and the training into effects in play', () => {
    const survivor = modifiers({ heroClass: 'breacher', origin: 'beltborn', moment: 'survivor' }, 1);
    expect(survivor.healthScale).toBeCloseTo(1.2);
    expect(survivor.shieldScale).toBeCloseTo(1.1);
    expect(survivor.plate).toBe(25);
    expect(modifiers({ heroClass: 'breacher', origin: 'ringborn', moment: 'hard-call' }, 3).plate).toBe(75);
    const rigger = modifiers({ heroClass: 'rigger', origin: 'steader', moment: 'hero-of-the-line' }, 2);
    expect(rigger.cooldownScale).toBeCloseTo(0.86);
    expect(rigger.modCost).toBeCloseTo(0.8);
    expect(rigger.companionCooldown).toBeCloseTo(0.9);
    expect(modifiers({ heroClass: 'shade', origin: 'laneborn', moment: 'lost-someone' }, 3).markReach).toBe(1.5);
    expect(modifiers({ heroClass: 'warden', origin: 'borderer', moment: 'survivor' }, 2).shieldSooner).toBeCloseTo(0.8);
  });
});

describe('companions', () => {
  it('give Ren and Jo two powers each, real ones', () => {
    for (const [who, powers] of Object.entries(COMPANION_POWERS)) {
      for (const p of powers) expect(POWERS[p], `${who}: ${p}`).toBeDefined();
    }
  });

  it('spend their own points by themselves, the cheaper rank first, unless the player does', () => {
    const ren = companionAuto(newCompanionGrowth(), 'ren', 3); // 4 points
    expect(ren.ranks).toEqual({ mark: 3, veil: 2 });
    expect(companionPoints(ren, 3)).toBe(0);
    const held = companionAuto({ ...newCompanionGrowth(), auto: false }, 'jo', 3);
    expect(held.ranks).toEqual({});
    expect(companionRankUp(held, 'jo', 'seeker', 3).ranks).toEqual({ seeker: 2 });
    expect(companionRankUp(held, 'jo', 'lift', 3)).toBe(held);
  });
});
