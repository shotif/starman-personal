import { describe, expect, it } from 'vitest';
import {
  BOLT,
  boltMeetsBody,
  type Drill,
  drillStep,
  type FirePhase,
  fireStep,
  hitSide,
  MOTE,
  pickSpot,
  WAVES,
} from '../../src/game/swarm.ts';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const target = { x: 0, y: 0, z: 0 };
const chest = { x: 0, y: 1.2, z: 0 };

describe('where a mote flies', () => {
  it('keeps 6–14 m from its target, at flying height, swung round from where it is', () => {
    const me = { x: 0, y: 2, z: 10 };
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) {
      const spot = pickSpot({ me, target, others: [], rng, clear: () => true, aimAt: chest });
      expect(spot).not.toBeNull();
      if (!spot) continue;
      const distance = Math.hypot(spot.x, spot.z);
      expect(distance).toBeGreaterThanOrEqual(MOTE.near - 1e-9);
      expect(distance).toBeLessThanOrEqual(MOTE.far + 1e-9);
      expect(spot.y).toBeGreaterThanOrEqual(MOTE.low);
      expect(spot.y).toBeLessThanOrEqual(MOTE.high);
      // It started due +z of the target; it stays within the swing of that bearing.
      expect(Math.abs(Math.atan2(spot.x, spot.z))).toBeLessThanOrEqual(MOTE.swing + 1e-9);
    }
  });

  it('only takes a place it can reach and that sees its target', () => {
    const me = { x: 0, y: 2, z: 10 };
    expect(pickSpot({ me, target, others: [], rng: seeded(1), clear: () => false, aimAt: chest })).toBeNull();
    // Only places west of the target see it: it finds one.
    const spot = pickSpot({
      me,
      target,
      others: [],
      rng: seeded(3),
      clear: (a, b) => a.x < -0.5 || b.x < -0.5,
      aimAt: chest,
      tries: 60,
    });
    expect(spot?.x).toBeLessThan(-0.5);
  });

  it('does not crowd the other motes', () => {
    const me = { x: 0, y: 2, z: 10 };
    const rng = seeded(11);
    const others = [{ x: 0, y: 2, z: 10 }];
    for (let i = 0; i < 100; i++) {
      const spot = pickSpot({ me, target, others, rng, clear: () => true, aimAt: chest });
      if (spot) expect(Math.hypot(spot.x - 0, spot.y - 2, spot.z - 10)).toBeGreaterThanOrEqual(MOTE.apart);
    }
  });
});

describe('when a mote fires', () => {
  const run = (sees: (t: number) => boolean, seconds: number) => {
    let phase: FirePhase = { kind: 'rest', left: 1 };
    const shots: number[] = [];
    const dt = 1 / 60;
    for (let t = 0; t < seconds; t += dt) {
      const step = fireStep(phase, dt, sees(t), () => 0.5);
      phase = step.phase;
      if (step.fire) shots.push(t);
    }
    return shots;
  };

  it('glows, then fires, then rests, while it sees its target', () => {
    const shots = run(() => true, 10);
    expect(shots.length).toBeGreaterThanOrEqual(3);
    // The first shot comes after the first rest and the glow.
    expect(shots[0]).toBeGreaterThan(1 + MOTE.charge - 0.05);
    for (let i = 1; i < shots.length; i++) {
      expect((shots[i] ?? 0) - (shots[i - 1] ?? 0)).toBeGreaterThanOrEqual(MOTE.restMin + MOTE.charge - 0.05);
    }
  });

  it('never fires at what it cannot see, and gives up a shot when its target ducks', () => {
    expect(run(() => false, 10)).toEqual([]);
    // In sight only for the first 1.3 s: the glow starts at 1 s and is cut short.
    expect(run((t) => t < 1.3, 10)).toEqual([]);
  });
});

describe('what a bolt meets', () => {
  const feet = { x: 0, y: 0, z: 0 };

  it('meets a standing body in its path, and passes one beside it', () => {
    const t = boltMeetsBody({ x: 0, y: 1.2, z: 5 }, { x: 0, y: 1.2, z: -5 }, feet, 1.8, 0.35);
    expect(t).not.toBeNull();
    expect(t).toBeCloseTo((5 - 0.35 - BOLT.radius) / 10, 1);
    expect(boltMeetsBody({ x: 1, y: 1.2, z: 5 }, { x: 1, y: 1.2, z: -5 }, feet, 1.8, 0.35)).toBeNull();
  });

  it('passes over a crouched body that a standing one would have stopped', () => {
    const over = [
      { x: 0, y: 1.45, z: 5 },
      { x: 0, y: 1.45, z: -5 },
    ] as const;
    expect(boltMeetsBody(over[0], over[1], feet, 1.8, 0.35)).not.toBeNull();
    expect(boltMeetsBody(over[0], over[1], feet, 1.1, 0.35)).toBeNull();
  });
});

describe('the side a hit comes from', () => {
  const at = { x: 0, y: 0, z: 0 };
  const forward = { x: 0, z: 1 };
  it('names the edge of the screen nearest the shooter', () => {
    expect(hitSide(forward, at, { x: 0, y: 2, z: 8 })).toBe('front');
    expect(hitSide(forward, at, { x: 0, y: 2, z: -8 })).toBe('back');
    expect(hitSide(forward, at, { x: 8, y: 2, z: 1 })).toBe('right');
    expect(hitSide(forward, at, { x: -8, y: 2, z: 1 })).toBe('left');
  });
});

describe('the drill that turns into a fight', () => {
  it('sends the waves in turn once every drone is down, then ends', () => {
    let drill: Drill = { kind: 'quiet' };
    const said: string[] = [];
    const woken: number[] = [];
    let live = 0;
    const tick = (dronesDown: number, seconds: number) => {
      for (let t = 0; t < seconds; t += 0.1) {
        const step = drillStep(drill, { dronesDown, drones: 3, live }, 0.1);
        drill = step.drill;
        if (step.say) said.push(step.say);
        if (step.wake) {
          woken.push(step.wake);
          live = step.wake;
        }
      }
    };
    tick(2, 5);
    expect(woken).toEqual([]);
    tick(3, 5);
    expect(woken).toEqual([WAVES[0]]);
    live = 0;
    tick(3, 5);
    expect(woken).toEqual([...WAVES]);
    live = 0;
    tick(3, 5);
    expect(drill.kind).toBe('over');
    expect(said).toHaveLength(3);
    // Quiet again once the drones are back, ready for the next drill.
    tick(0, 1);
    expect(drill.kind).toBe('quiet');
  });
});
