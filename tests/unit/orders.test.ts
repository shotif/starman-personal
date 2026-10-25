import { describe, expect, it } from 'vitest';
import { decide, type Facts, followSpot, type Objective, ORDERS, receive } from '../../src/game/orders.ts';

const at = (x: number, z: number) => ({ x, y: 0, z });
const facts = (over: Partial<Facts> = {}): Facts => ({
  me: at(0, 0),
  heroFeet: at(0, 0),
  heroForward: { x: 0, z: 1 },
  target: null,
  reachable: true,
  threat: null,
  ...over,
});

describe('fighting between orders', () => {
  const threat = { id: 7, position: { x: 0, y: 2, z: 8 } };
  it('shoots a threat she can see while following, and keeps up first', () => {
    expect(decide({ kind: 'follow' }, facts({ me: at(0, -1), threat })).shootAt).toBe(7);
    const behind = decide({ kind: 'follow' }, facts({ me: at(0, -6), threat }));
    expect(behind.shootAt).toBeNull();
    expect(behind.moveTo).not.toBeNull();
  });
  it('shoots from a held point once there, not on the way', () => {
    const holding: Objective = { kind: 'hold', at: at(0, 0), arrived: true };
    expect(decide(holding, facts({ threat })).shootAt).toBe(7);
    const going: Objective = { kind: 'hold', at: at(5, 5), arrived: false };
    expect(decide(going, facts({ threat })).shootAt).toBeNull();
  });
  it('leaves a threat out of range alone', () => {
    const far = { id: 7, position: { x: 0, y: 2, z: ORDERS.range + 5 } };
    expect(decide({ kind: 'follow' }, facts({ me: at(0, -1), threat: far })).shootAt).toBeNull();
  });
});

describe('receiving orders', () => {
  it('answers each order', () => {
    expect(receive({ kind: 'follow' }, { kind: 'follow' }).say).toBe('follow');
    expect(receive({ kind: 'follow' }, { kind: 'hold', at: at(3, 3) }).objective).toEqual({
      kind: 'hold',
      at: at(3, 3),
      arrived: false,
    });
  });
  it('remembers what to go back to after an attack, never another attack', () => {
    const holding: Objective = { kind: 'hold', at: at(1, 1), arrived: true };
    const first = receive(holding, { kind: 'attack', target: 1 }).objective;
    const second = receive(first, { kind: 'attack', target: 2 }).objective;
    expect(second).toEqual({ kind: 'attack', target: 2, after: holding });
  });
});

describe('following', () => {
  it('catches up when left behind, and stops when close', () => {
    const far = decide({ kind: 'follow' }, facts({ me: at(0, -5) }));
    expect(far.moveTo).toEqual(followSpot(at(0, 0), { x: 0, z: 1 }));
    const near = decide({ kind: 'follow' }, facts({ me: at(0, -1) }));
    expect(near.moveTo).toEqual(at(0, -1));
  });
  it('stands behind the hero and to the left', () => {
    const spot = followSpot(at(0, 0), { x: 0, z: 1 });
    expect(spot.z).toBeLessThan(0);
    expect(spot.x).toBeLessThan(0);
  });
});

describe('holding', () => {
  it('goes to the point and says when it is reached', () => {
    const hold: Objective = { kind: 'hold', at: at(5, 0), arrived: false };
    expect(decide(hold, facts()).moveTo).toEqual(at(5, 0));
    const there = decide(hold, facts({ me: at(5, 0.2) }));
    expect(there.say).toBe('arrived');
    expect(there.objective).toEqual({ ...hold, arrived: true });
  });
  it('gives up on a point that cannot be reached', () => {
    const d = decide({ kind: 'hold', at: at(50, 0), arrived: false }, facts({ reachable: false }));
    expect(d.say).toBe('unreachable');
    expect(d.objective.kind).toBe('follow');
  });
});

describe('attacking', () => {
  const attack: Objective = { kind: 'attack', target: 7, after: { kind: 'follow' } };
  it('shoots a target in range and in sight', () => {
    const d = decide(attack, facts({ target: { alive: true, position: at(0, 10), visible: true } }));
    expect(d.shootAt).toBe(7);
    expect(d.moveTo).toBeNull();
  });
  it('closes in on a target out of range or out of sight', () => {
    const d = decide(attack, facts({ target: { alive: true, position: at(0, 30), visible: true } }));
    expect(d.shootAt).toBeNull();
    expect(d.moveTo?.z).toBeCloseTo(30 - ORDERS.approach);
  });
  it('walks to the floor under a close target it cannot see', () => {
    const d = decide(attack, facts({ target: { alive: true, position: { x: 0, y: 2, z: 5 }, visible: false } }));
    expect(d.moveTo).toEqual({ x: 0, y: 0, z: 5 });
  });
  it('returns to what came before once the target is down', () => {
    const d = decide(attack, facts({ target: { alive: false, position: at(0, 10), visible: true } }));
    expect(d.say).toBe('targetDown');
    expect(d.objective).toEqual({ kind: 'follow' });
  });
});
