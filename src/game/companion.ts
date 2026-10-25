import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { Scene } from '@babylonjs/core/scene';
import type { Character } from './characters.ts';
import type { Range } from './combat.ts';
import { DAMAGE, type Defences, personDefences, recover, restored, takeHit } from './defences.ts';
import { turnTowards, yawOf } from './motion.ts';
import type { AgentHandle, Navigation } from './navigation.ts';
import { decide, type Objective, type Order, type Point, receive } from './orders.ts';
import { poseWeights } from './pose.ts';

/**
 * A companion who takes objectives, not remote control (D-16, ORDERS.md): she walks the navigation
 * mesh, decides with src/game/orders.ts what to do about her objective, fights the swarm between
 * orders, aims and shoots with the upper body, and says how it goes. She has a shield and health
 * like the hero (D-42), goes down when they run out, and helps the hero up when they fall (D-43).
 */
export interface Companion {
  readonly name: string;
  readonly character: Character;
  /** Whether she walks the navigation mesh (false: the simple fallback, which only follows). */
  readonly navigated: boolean;
  readonly objective: Objective;
  readonly defences: Defences;
  /** Down in a fight: she lies where she fell until the fight is over or someone helps. */
  readonly down: boolean;
  /** Kneeling beside the one she was sent to help. */
  readonly helping: boolean;
  order(order: Order, quiet?: boolean): void;
  /** In a conversation (DIALOGUE.md): she stops, faces this point and gestures while speaking; null ends it. */
  converse(facing: Vector3 | null, speaking: boolean): void;
  /** Sends her to kneel beside someone (the fallen hero); null calls her off. */
  help(target: Vector3 | null): void;
  /** A hit; true if it put her down. */
  hurt(amount: number): boolean;
  /** Back on her feet, whole. */
  raise(): void;
  /** Puts her somewhere at once, facing `yaw`, and has her hold there. */
  place(at: Vector3, yaw: number): void;
  /** In the story or out of it: hidden, she waits out of everyone's way. */
  show(visible: boolean): void;
  readonly visible: boolean;
  update(dt: number, heroFeet: Vector3, heroForward: Vector3): void;
}

export interface World {
  range: Range;
  /** The first thing a ray meets, or null. */
  cast(from: Vector3, to: Vector3): { point: Vector3; body: PhysicsBody | null | undefined } | null;
  /** The height of the floor under a point near it, or null (see `groundUnder` in game.ts). */
  groundUnder(at: Vector3): number | null;
  /** Her powers (src/game/game.ts decides which, if any, on the target she is shooting): true if used. */
  power?(name: string, target: number, eye: Vector3): boolean;
}

const EYE = 1.5;
const DECIDE_EVERY = 0.25;
const FIRE_INTERVAL = 0.55;
/** Between orders she fires more carefully: the hero carries the fight, she helps. */
const OWN_FIRE_INTERVAL = 1.1;
/** The least time between two of her powers, whatever their cooldowns. */
const POWER_GAP = 3;
/** She hits about three shots in four. */
const ACCURACY = 0.75;
/** How near she kneels to the one she helps. */
const KNEEL = 0.9;
/** Where a companion out of the story waits: the bunk room's far corner. */
const PARKED = new Vector3(-11.3, 0, 6.6);

const toVector = (p: Point) => new Vector3(p.x, p.y, p.z);

export function spawnCompanion(
  scene: Scene,
  name: string,
  nav: Navigation | null,
  character: Character,
  start: Vector3,
  world: World,
  say: (line: string) => void,
): Companion {
  character.root.position.copyFrom(start);
  let yaw = 0;
  let objective: Objective = { kind: 'follow' };
  let defences = personDefences();
  let isDown = false;
  let helpTarget: Vector3 | null = null;
  let kneeling = false;
  let talking: { facing: Vector3; speaking: boolean } | null = null;

  if (!nav) {
    // The fallback: no navigation, so she only follows, and never fights.
    return {
      name,
      character,
      navigated: false,
      get objective() {
        return objective;
      },
      get defences() {
        return defences;
      },
      down: false,
      helping: false,
      order(order) {
        say(order.kind === 'follow' ? 'With you.' : "I can't reach that.");
      },
      converse() {},
      help() {},
      hurt: () => false,
      raise() {},
      place(at, y) {
        character.root.position.copyFrom(at);
        yaw = y;
      },
      show(visible) {
        character.root.setEnabled(visible);
      },
      get visible() {
        return character.root.isEnabled();
      },
      update(dt, heroFeet, heroForward) {
        const goal = heroFeet.subtract(heroForward.scale(1.8));
        const offset = goal.subtract(character.root.position);
        offset.y = 0;
        const distance = offset.length();
        const speed = distance > 0.4 ? Math.min(6.5, distance * 2.5) : 0;
        if (speed > 0) {
          character.root.position.addInPlace(offset.normalize().scale(speed * dt));
          yaw = turnTowards(yaw, yawOf(offset), 8 * dt);
        }
        character.root.position.y = heroFeet.y;
        character.root.rotation.y = yaw;
        character.setPose(poseWeights({ mode: 'move', speed }), dt);
      },
    };
  }

  // The crowd moves this stand-in for her; she stands on the floor under it, since the navigation
  // mesh lies up to a voxel above the floor.
  const anchor = new TransformNode(`${character.root.name}-agent`, scene);
  anchor.position.copyFrom(start);
  const agent: AgentHandle = nav.addAgent(start, anchor);
  const stand = (here: Vector3) => character.root.position.set(here.x, world.groundUnder(here) ?? here.y, here.z);

  let sinceDecision = DECIDE_EVERY;
  let goal: Vector3 | null = null;
  let shootAt: number | null = null;
  let cooldown = 0;
  let shotPose = 0;
  /** Seconds before she may use a power again. */
  let powerWait = 2;

  /** Whether a point can be stood on: the navigation mesh comes within reach of it. */
  const reachable = (p: Point, reach: number) => {
    const closest = nav.closest(toVector(p));
    return Math.hypot(closest.x - p.x, closest.z - p.z) <= reach;
  };
  const goTo = (p: Point) => {
    const target = nav.closest(toVector(p));
    if (!goal || Vector3.Distance(goal, target) > 0.3) {
      goal = target;
      agent.goTo(target);
    }
  };
  const stop = () => {
    goal = null;
    agent.stop();
  };

  /** The nearest live threat (the swarm) she can see from `eye`, if any. */
  const nearestThreat = (eye: Vector3) => {
    const threats = world.range
      .threats()
      .sort((a, b) => Vector3.Distance(eye, a.position) - Vector3.Distance(eye, b.position));
    // Only the nearest few: each costs a ray.
    for (const threat of threats.slice(0, 3)) {
      const seen = world.cast(eye, threat.position.add(threat.position.subtract(eye).normalize().scale(0.5)));
      if (seen && world.range.isDrone(threat.id, seen.body)) return { id: threat.id, position: threat.position };
    }
    return null;
  };

  const fire = (id: number, eye: Vector3) => {
    const centre = world.range.centre(id);
    const struck = world.cast(eye, centre.add(centre.subtract(eye).normalize().scale(0.5)));
    const lands = Math.random() < ACCURACY && struck && world.range.isDrone(id, struck.body);
    const miss = centre.add(new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
    if (lands) world.range.hit(struck.body, 'partner', { amount: DAMAGE.pistol, kind: 'kinetic' });
    character.fire();
    world.range.shot(character.muzzle(), lands ? struck.point : miss, !!lands, 1);
    shotPose = 0.18;
  };

  return {
    name,
    character,
    navigated: true,
    get objective() {
      return objective;
    },
    get defences() {
      return defences;
    },
    get down() {
      return isDown;
    },
    get helping() {
      return kneeling;
    },
    order(order, quiet = false) {
      if (isDown) return;
      const received = receive(objective, order);
      objective = received.objective;
      if (!quiet) say(received.say);
      shootAt = null;
      sinceDecision = DECIDE_EVERY;
    },
    converse(facing, speaking) {
      if (facing && !talking) stop();
      talking = facing ? { facing, speaking } : null;
    },
    help(target) {
      helpTarget = target ? target.clone() : null;
      kneeling = false;
      if (!target) stop();
    },
    hurt(amount) {
      if (isDown) return false;
      const result = takeHit(defences, amount, 'kinetic');
      defences = result.defences;
      if (result.down) {
        isDown = true;
        shootAt = null;
        stop();
        say('I’m down!');
      }
      return result.down;
    },
    raise() {
      isDown = false;
      defences = restored(defences);
    },
    place(at, y) {
      agent.teleport(at);
      anchor.position.copyFrom(at);
      character.root.position.copyFrom(at);
      yaw = y;
      character.root.rotation.y = yaw;
      goal = null;
      helpTarget = null;
      objective = { kind: 'hold', at: { x: at.x, y: at.y, z: at.z }, arrived: true };
      character.root.setEnabled(true);
    },
    show(visible) {
      character.root.setEnabled(visible);
      if (!visible) {
        agent.teleport(PARKED);
        goal = null;
      }
    },
    get visible() {
      return character.root.isEnabled();
    },
    update(dt, heroFeet, heroForward) {
      const here = agent.position();
      stand(here);
      if (!character.root.isEnabled()) return;
      if (isDown) {
        character.setPose(poseWeights({ mode: 'down' }), dt);
        return;
      }
      defences = recover(defences, dt);
      if (talking) {
        const towards = talking.facing.subtract(here);
        yaw = turnTowards(yaw, yawOf(towards), 8 * dt);
        character.root.rotation.y = yaw;
        character.setPose(poseWeights({ mode: 'talk', speaking: talking.speaking }), dt);
        return;
      }
      if (helpTarget) {
        // To the fallen, then kneel beside them.
        const to = helpTarget.subtract(here);
        to.y = 0;
        const distance = to.length();
        if (distance > KNEEL + 0.3) {
          goTo(helpTarget.subtract(to.normalize().scale(KNEEL)));
          kneeling = false;
        } else {
          stop();
          kneeling = true;
        }
        const velocity = agent.velocity();
        const speed = Math.hypot(velocity.x, velocity.z);
        yaw = turnTowards(yaw, yawOf(kneeling || speed < 0.2 ? to : velocity), 8 * dt);
        character.root.rotation.y = yaw;
        character.setPose(poseWeights(kneeling ? { mode: 'kneel' } : { mode: 'move', speed }), dt);
        return;
      }
      sinceDecision += dt;
      if (sinceDecision >= DECIDE_EVERY) {
        sinceDecision = 0;
        const eye = here.add(new Vector3(0, EYE, 0));
        let target = null;
        let canReach = true;
        if (objective.kind === 'attack') {
          const id = objective.target;
          const centre = world.range.centre(id);
          const seen = world.cast(eye, centre.add(centre.subtract(eye).normalize().scale(0.5)));
          target = {
            alive: world.range.alive(id),
            position: centre,
            visible: !!seen && world.range.isDrone(id, seen.body),
          };
          // The floor under the target, which hovers above the navigation mesh.
          canReach = reachable({ x: centre.x, y: here.y, z: centre.z }, 3);
        } else if (objective.kind === 'hold') {
          canReach = reachable(objective.at, 1);
        }
        const decision = decide(objective, {
          me: here,
          heroFeet,
          heroForward: { x: heroForward.x, z: heroForward.z },
          target,
          reachable: canReach,
          threat: nearestThreat(eye),
        });
        objective = decision.objective;
        if (decision.say) say(decision.say);
        shootAt = decision.shootAt;
        if (shootAt !== null) stop();
        else if (decision.moveTo) {
          if (Vector3.Distance(toVector(decision.moveTo), here) < 0.05) stop();
          else goTo(decision.moveTo);
        }
      }

      const velocity = agent.velocity();
      const speed = Math.hypot(velocity.x, velocity.z);
      cooldown -= dt;
      shotPose -= dt;
      powerWait -= dt;
      if (shootAt !== null && world.range.alive(shootAt)) {
        // Face the target and shoot, with the upper body aiming; now and then, a power on it.
        const centre = world.range.centre(shootAt);
        yaw = turnTowards(yaw, yawOf({ x: centre.x - here.x, z: centre.z - here.z }), 8 * dt);
        if (powerWait <= 0) {
          powerWait = world.power?.(name, shootAt, here.add(new Vector3(0, EYE, 0))) ? POWER_GAP : 0.5;
        }
        if (cooldown <= 0) {
          cooldown = objective.kind === 'attack' ? FIRE_INTERVAL : OWN_FIRE_INTERVAL;
          fire(shootAt, here.add(new Vector3(0, EYE, 0)));
        }
        character.setPose(poseWeights({ mode: 'aim', speed, direction: { x: 0, y: 0 }, firing: shotPose > 0 }), dt);
      } else {
        if (speed > 0.2) yaw = turnTowards(yaw, yawOf(velocity), 8 * dt);
        character.setPose(poseWeights({ mode: 'move', speed }), dt);
      }
      character.root.rotation.y = yaw;
    },
  };
}
