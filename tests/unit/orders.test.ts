import { describe, expect, it } from 'vitest';
import { decide, type Facts, followSpot, type Objective, ORDERS, receive } from '../../src/game/orders.ts';

const at = (x: number, z: number) => ({ x, y: 0, z });
const facts = (over: Partial<Facts> = {}): Facts => ({
  me: at(0, 0),
  heroFeet: at(0, 0),
  heroForward: { x: 0, z: 1 },
  target: null,
  reachable: true,
  ...over,
});

describe('receiving orders', () => {
  it('answers each order', () => {
    expect(receive({ kind: 'follow' }, { kind: 'follow' }).say).toBe('With you.');
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
    expect(there.say).toBe('In position.');
    expect(there.objective).toEqual({ ...hold, arrived: true });
  });
  it('gives up on a point that cannot be reached', () => {
    const d = decide({ kind: 'hold', at: at(50, 0), arrived: false }, facts({ reachable: false }));
    expect(d.say).toBe("I can't reach that.");
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
    expect(d.say).toBe('Target down.');
    expect(d.objective).toEqual({ kind: 'follow' });
  });
});
