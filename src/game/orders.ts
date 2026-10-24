/**
 * A companion's objectives and how she decides what to do about them (D-16, ORDERS.md). Pure:
 * the game measures the facts, this decides.
 */
export interface Point {
  x: number;
  y: number;
  z: number;
}

export type Objective =
  | { kind: 'follow' }
  | { kind: 'hold'; at: Point; arrived: boolean }
  | { kind: 'attack'; target: number; after: Objective };

export type Order = { kind: 'follow' } | { kind: 'hold'; at: Point } | { kind: 'attack'; target: number };

/** What the game measured this moment. */
export interface Facts {
  me: Point;
  heroFeet: Point;
  heroForward: { x: number; z: number };
  /** The target of an attack, if the objective has one. */
  target: { alive: boolean; position: Point; visible: boolean } | null;
  /** Whether the point she is heading for can be reached on the navigation mesh. */
  reachable: boolean;
  /** The nearest machine that is fighting (the swarm, not the practice drones), if she can see one. */
  threat: { id: number; position: Point } | null;
}

export interface Decision {
  objective: Objective;
  /** Where to walk, or null to stay where she is. */
  moveTo: Point | null;
  /** Which target to shoot at this moment, or null. */
  shootAt: number | null;
  /** A line for the HUD, or null. */
  say: string | null;
}

export const ORDERS = {
  /** Further than this from the hero, she catches up; nearer than `followNear`, she stops. */
  followFar: 2.6,
  followNear: 1.6,
  /** Close enough to a held point to call it reached. */
  arrive: 0.6,
  /** She shoots from no further than this. */
  range: 14,
  /** How far from the target she tries to stand when she must move to see it. */
  approach: 8,
};

const flat = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** The objective an order gives, and what she says on hearing it. */
export function receive(current: Objective, order: Order): { objective: Objective; say: string } {
  if (order.kind === 'follow') return { objective: { kind: 'follow' }, say: 'With you.' };
  if (order.kind === 'hold') return { objective: { kind: 'hold', at: order.at, arrived: false }, say: 'Moving.' };
  // An attack returns to what she was doing before it, but never to another attack.
  const after = current.kind === 'attack' ? current.after : current;
  return { objective: { kind: 'attack', target: order.target, after }, say: 'On it.' };
}

/** Where she stands when following: behind the hero and to the left. */
export function followSpot(feet: Point, forward: { x: number; z: number }): Point {
  return { x: feet.x - forward.x * 1.6 - forward.z * 0.9, y: feet.y, z: feet.z - forward.z * 1.6 + forward.x * 0.9 };
}

export function decide(objective: Objective, facts: Facts): Decision {
  // Between orders she fights on her own (D-16): a threat she can see, in range, from where she is.
  const threat = facts.threat && flat(facts.me, facts.threat.position) <= ORDERS.range ? facts.threat.id : null;
  if (objective.kind === 'follow') {
    const distance = flat(facts.me, facts.heroFeet);
    if (distance > ORDERS.followFar) {
      return { objective, moveTo: followSpot(facts.heroFeet, facts.heroForward), shootAt: null, say: null };
    }
    return { objective, moveTo: distance < ORDERS.followNear ? facts.me : null, shootAt: threat, say: null };
  }
  if (objective.kind === 'hold') {
    if (!facts.reachable) {
      return { objective: { kind: 'follow' }, moveTo: null, shootAt: null, say: "I can't reach that." };
    }
    if (!objective.arrived && flat(facts.me, objective.at) <= ORDERS.arrive) {
      return { objective: { ...objective, arrived: true }, moveTo: null, shootAt: threat, say: 'In position.' };
    }
    return {
      objective,
      moveTo: objective.arrived ? null : objective.at,
      shootAt: objective.arrived ? threat : null,
      say: null,
    };
  }
  const target = facts.target;
  if (!target?.alive) {
    const after = objective.after.kind === 'hold' ? { ...objective.after, arrived: false } : objective.after;
    return { objective: after, moveTo: null, shootAt: null, say: 'Target down.' };
  }
  const distance = Math.hypot(target.position.x - facts.me.x, target.position.z - facts.me.z);
  if (target.visible && distance <= ORDERS.range) {
    return { objective, moveTo: null, shootAt: objective.target, say: null };
  }
  if (!facts.reachable) {
    return { objective: objective.after, moveTo: null, shootAt: null, say: "I can't reach that." };
  }
  // Close in along the line to the target until it is in range and in sight.
  const k = distance > 0 ? Math.max(0, distance - ORDERS.approach) / distance : 0;
  const moveTo = {
    x: facts.me.x + (target.position.x - facts.me.x) * k,
    y: facts.me.y,
    z: facts.me.z + (target.position.z - facts.me.z) * k,
  };
  // A target hovers; she walks to the floor under it.
  const under = { x: target.position.x, y: facts.me.y, z: target.position.z };
  return { objective, moveTo: distance > ORDERS.approach ? moveTo : under, shootAt: null, say: null };
}
