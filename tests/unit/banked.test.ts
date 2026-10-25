import { describe, expect, it } from 'vitest';
import {
  BANKED,
  BARRIER,
  type BankedState,
  bankedStep,
  barrierStep,
  barrierStops,
  type Cover,
  chooseCover,
  coverPoints,
  type Flat,
  hides,
  hitChance,
  neediest,
  newState,
  type StepInput,
  TACTICS,
} from '../../src/game/banked-rules.ts';

const crate = (x: number, z: number, yaw = 0, size = [1.2, 1, 1.2]) => ({ at: [x, 0, z], yaw, size });

describe('cover', () => {
  it('comes from low furniture only, a point out from each side', () => {
    const points = coverPoints([
      crate(0, 0),
      { at: [5, 0, 5], yaw: 0, size: [6, 2.6, 2.4] },
      { ...crate(9, 9), moves: true },
    ]);
    expect(points).toHaveLength(4);
    for (const p of points) expect(Math.hypot(p.at.x, p.at.z)).toBeCloseTo(0.6 + 0.55, 5);
    // A long crate gives a point each metre along its long sides.
    expect(coverPoints([crate(0, 0, 0, [2.4, 1, 1.2])])).toHaveLength(2 + 2 + 2);
  });

  it('hides from what lies beyond the furniture, not from the side or behind', () => {
    const south: Cover = { at: { x: 0, z: -1.15 }, y: 0, normal: { x: 0, z: -1 } };
    expect(hides(south, { x: 0, z: 10 })).toBe(true);
    expect(hides(south, { x: 4, z: 8 })).toBe(true);
    expect(hides(south, { x: 0, z: -10 })).toBe(false);
    expect(hides(south, { x: 10, z: -1 })).toBe(false);
  });

  const covers = coverPoints([crate(0, 0), crate(6, 2), crate(-6, 4)]);
  const target = { x: 0, z: 16 };

  it('chooses a point that hides, in the band, near, and never one taken or beside an ally', () => {
    const pick = chooseCover({ me: { x: 0, z: -4 }, target, covers, taken: new Set(), allies: [], band: [8, 18] });
    expect(pick).not.toBeNull();
    const c = covers[pick ?? 0] as Cover;
    expect(hides(c, target)).toBe(true);
    expect(c.at).toEqual(covers[1]?.at ?? c.at);
    const other = chooseCover({
      me: { x: 0, z: -4 },
      target,
      covers,
      taken: new Set([pick ?? -1]),
      allies: [],
      band: [8, 18],
    });
    expect(other).not.toBe(pick);
    const crowded = chooseCover({
      me: { x: 0, z: -4 },
      target,
      covers,
      taken: new Set(),
      allies: [c.at],
      band: [8, 18],
    });
    expect(crowded).not.toBe(pick);
  });

  it('falls back to a point farther from the target, and goes round to one well to the side', () => {
    const me = covers.find((c) => hides(c, target) && Math.abs(c.at.x) < 1) as Cover;
    const back = chooseCover({
      me: me.at,
      target,
      covers,
      taken: new Set(),
      allies: [],
      band: [8, 18],
      fallBack: true,
    });
    // Nothing behind the nearest crate is farther than 2 m more: none, or a farther one.
    if (back !== null)
      expect(Math.hypot((covers[back]?.at.x ?? 0) - target.x, (covers[back]?.at.z ?? 0) - target.z)).toBeGreaterThan(
        Math.hypot(me.at.x - target.x, me.at.z - target.z) + 2,
      );
    const round = chooseCover({
      me: me.at,
      target,
      covers,
      taken: new Set(),
      allies: [],
      band: [8, 18],
      flankFrom: { x: 0, z: -1 },
    });
    expect(round).not.toBeNull();
    const at = covers[round ?? 0]?.at ?? { x: 0, z: 0 };
    const angle =
      (Math.acos(((at.x - target.x) * 0 + (at.z - target.z) * -1) / Math.hypot(at.x - target.x, at.z - target.z)) *
        180) /
      Math.PI;
    expect(angle).toBeGreaterThan(15);
  });
});

describe('a turn in cover', () => {
  const covers = coverPoints([crate(0, 0)]);
  const target: Flat = { x: 0, z: 14 };
  const input = (me: Flat, s: Partial<StepInput> = {}): StepInput => ({
    kind: 'trooper',
    me,
    health: 1,
    target,
    sees: true,
    covers,
    taken: new Set(),
    allies: [],
    heroHidden: 0,
    flanker: false,
    random: 0.5,
    ...s,
  });

  it('runs to cover, hides, comes up with a glint, fires two bursts of three, and hides again', () => {
    let s: BankedState = newState();
    let r = bankedStep(s, input({ x: 0, z: -6 }), 0.1);
    expect(r.state.mode).toBe('seek');
    const spot = r.moveTo as Flat;
    expect(hides(covers[r.state.cover ?? 0] as Cover, target)).toBe(true);
    s = r.state;
    r = bankedStep(s, input(spot), 0.1);
    expect(r.state.mode).toBe('hide');
    expect(r.crouch).toBe(true);
    s = r.state;
    let shots = 0;
    let glints = 0;
    let modes = new Set<string>();
    for (let t = 0; t < 8; t += 0.05) {
      r = bankedStep(s, input(spot), 0.05);
      s = r.state;
      if (r.fire) shots++;
      if (r.glint) glints++;
      modes.add(s.mode);
      if (shots === 6 && s.mode === 'hide') break;
    }
    expect(shots).toBe(BANKED.trooper.weapon.shots * BANKED.trooper.weapon.volleys);
    expect(glints).toBeGreaterThan(0);
    expect(s.mode).toBe('hide');
    expect([...modes]).toContain('peek');
    modes = new Set();
  });

  it('does not fire at what it cannot see, and moves on when it has not seen it for long', () => {
    let s: BankedState = { ...newState(), mode: 'hide', cover: 1, timer: 0 };
    const spot = covers[1]?.at as Flat;
    let fired = false;
    for (let t = 0; t < TACTICS.lostAfter + 2; t += 0.25) {
      const r = bankedStep(s, input(spot, { sees: false }), 0.25);
      s = r.state;
      if (r.fire) fired = true;
    }
    expect(fired).toBe(false);
    expect(s.unseen).toBe(0);
    expect(['seek', 'open']).toContain(s.mode);
  });

  it('moves when flanked: its cover no longer hides it from the target', () => {
    const spot = covers.find((c) => hides(c, target)) as Cover;
    const s: BankedState = { ...newState(), mode: 'hide', cover: covers.indexOf(spot), timer: 1 };
    const r = bankedStep(s, input(spot.at, { target: { x: 0, z: -14 } }), 0.1);
    expect(r.state.cover).not.toBe(covers.indexOf(spot));
    expect(['seek', 'open']).toContain(r.state.mode);
  });

  it('falls back once when badly hurt', () => {
    const s: BankedState = { ...newState(), mode: 'hide', cover: 1, timer: 1 };
    const r = bankedStep(s, input(covers[1]?.at as Flat, { health: 0.2 }), 0.1);
    expect(r.state.fellBack).toBe(true);
    const again = bankedStep(r.state, input(covers[1]?.at as Flat, { health: 0.2 }), 0.1);
    expect(again.state.fellBack).toBe(true);
  });

  it('the warden walks in to 7 m and fires its cannon after a long glint', () => {
    let s = newState();
    const far = bankedStep(s, input({ x: 0, z: -10 }, { kind: 'warden' }), 0.1);
    expect(far.moveTo?.z).toBeCloseTo(target.z - TACTICS.wardenStops, 5);
    let shots = 0;
    for (let t = 0; t < 4.5; t += 0.1) {
      const r = bankedStep(s, input({ x: 0, z: 8 }, { kind: 'warden' }), 0.1);
      s = r.state;
      if (r.fire) shots++;
    }
    expect(shots).toBe(1);
  });
});

describe('shots, support and the barrier', () => {
  it('hits more often near and still, less far and moving, by difficulty', () => {
    expect(hitChance(5, false)).toBeCloseTo(0.7);
    expect(hitChance(30, false)).toBeCloseTo(0.3);
    expect(hitChance(10, true)).toBeCloseTo(hitChance(10, false) * 0.75);
    expect(hitChance(10, false, 'story')).toBeLessThan(hitChance(10, false));
    expect(hitChance(10, false, 'hard')).toBeGreaterThan(hitChance(10, false));
  });

  it('shields the ally with the least shield, within reach', () => {
    const me = { x: 0, z: 0 };
    const allies = [
      { at: { x: 2, z: 0 }, shield: 50, shieldMax: 60, alive: true },
      { at: { x: 4, z: 0 }, shield: 10, shieldMax: 60, alive: true },
      { at: { x: 40, z: 0 }, shield: 0, shieldMax: 60, alive: true },
      { at: { x: 1, z: 0 }, shield: 0, shieldMax: 60, alive: false },
    ];
    expect(neediest(me, allies)).toBe(1);
    expect(neediest(me, [{ at: { x: 1, z: 0 }, shield: 60, shieldMax: 60, alive: true }])).toBeNull();
  });

  it('stops blows from in front of the warden while it stands, and comes back after eight seconds', () => {
    const facing = { x: 0, z: 1 };
    const at = { x: 0, z: 0 };
    expect(barrierStops(100, facing, at, { x: 0, z: 10 })).toBe(true);
    expect(barrierStops(100, facing, at, { x: 5, z: 8 })).toBe(true);
    expect(barrierStops(100, facing, at, { x: 10, z: 0 })).toBe(false);
    expect(barrierStops(100, facing, at, { x: 0, z: -10 })).toBe(false);
    expect(barrierStops(0, facing, at, { x: 0, z: 10 })).toBe(false);
    expect(barrierStep(0, 3, 1)).toBe(0);
    expect(barrierStep(0, 9, 1)).toBe(BARRIER.rate);
    expect(barrierStep(BARRIER.strength - 1, 20, 1)).toBe(BARRIER.strength);
  });
});
