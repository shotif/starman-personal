import { CreateNavigationPluginAsync } from '@babylonjs/addons/navigation';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { Scene } from '@babylonjs/core/scene';
import * as RecastCore from '@recast-navigation/core';
import * as RecastGenerators from '@recast-navigation/generators';
import type { Character } from './characters.ts';
import type { Range } from './combat.ts';
import { turnTowards, yawOf } from './motion.ts';
import { decide, type Objective, type Order, type Point, receive } from './orders.ts';
import { poseWeights } from './pose.ts';

/**
 * A companion who takes objectives, not remote control (D-16, ORDERS.md): she walks the
 * navigation mesh, decides with src/game/orders.ts what to do about her objective, aims and
 * shoots with the upper body, and says how it goes.
 */
export interface Companion {
  readonly name: string;
  /** Whether she walks the navigation mesh (false: the simple fallback, which only follows). */
  readonly navigated: boolean;
  readonly objective: Objective;
  order(order: Order): void;
  /** Slows her walking with the rest of the game, for the command view. */
  setTimeFactor(factor: number): void;
  update(dt: number, heroFeet: Vector3, heroForward: Vector3): void;
}

export interface World {
  range: Range;
  /** The first thing a ray meets, or null. */
  cast(from: Vector3, to: Vector3): { point: Vector3; body: PhysicsBody | null | undefined } | null;
}

const EYE = 1.5;
const DECIDE_EVERY = 0.25;
const FIRE_INTERVAL = 0.55;
/** She hits about three shots in four. */
const ACCURACY = 0.75;

const toVector = (p: Point) => new Vector3(p.x, p.y, p.z);

export async function spawnCompanion(
  scene: Scene,
  meshes: Mesh[],
  character: Character,
  start: Vector3,
  world: World,
  say: (line: string) => void,
): Promise<Companion> {
  character.root.position.copyFrom(start);
  let yaw = 0;
  let objective: Objective = { kind: 'follow' };
  try {
    await RecastCore.init();
    const navigation = await CreateNavigationPluginAsync({ instance: { ...RecastCore, ...RecastGenerators } });
    navigation.createNavMesh(meshes, {
      cs: 0.15,
      ch: 0.1,
      walkableSlopeAngle: 40,
      walkableHeight: 18,
      walkableClimb: 3,
      walkableRadius: 3,
      maxEdgeLen: 40,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    });
    const crowd = navigation.createCrowd(4, 0.5, scene);
    const agent = crowd.addAgent(
      navigation.getClosestPoint(start),
      {
        radius: 0.35,
        height: 1.8,
        maxAcceleration: 14,
        maxSpeed: 6.8,
        collisionQueryRange: 2,
        pathOptimizationRange: 4,
        separationWeight: 1,
      },
      character.root,
    );

    let sinceDecision = DECIDE_EVERY;
    let goal: Vector3 | null = null;
    let shootAt: number | null = null;
    let cooldown = 0;
    let shotPose = 0;

    /** Whether a point can be stood on: the navigation mesh comes within reach of it. */
    const reachable = (p: Point, reach: number) => {
      const closest = navigation.getClosestPoint(p);
      return Math.hypot(closest.x - p.x, closest.z - p.z) <= reach;
    };
    const goTo = (p: Point) => {
      const target = navigation.getClosestPoint(p);
      if (!goal || Vector3.Distance(goal, target) > 0.3) {
        goal = target;
        crowd.agentGoto(agent, target);
      }
    };
    const stop = (here: Vector3) => {
      goal = null;
      crowd.agentGoto(agent, here);
    };

    const fire = (id: number, eye: Vector3) => {
      const centre = world.range.centre(id);
      const struck = world.cast(eye, centre.add(centre.subtract(eye).normalize().scale(0.5)));
      const lands = Math.random() < ACCURACY && struck && world.range.isDrone(id, struck.body);
      const miss = centre.add(new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
      if (lands) world.range.hit(struck.body);
      character.fire();
      world.range.shot(character.muzzle(), lands ? struck.point : miss, !!lands, 1);
      shotPose = 0.18;
    };

    return {
      name: 'Ren',
      navigated: true,
      get objective() {
        return objective;
      },
      order(order) {
        const received = receive(objective, order);
        objective = received.objective;
        say(received.say);
        shootAt = null;
        sinceDecision = DECIDE_EVERY;
      },
      setTimeFactor(factor) {
        navigation.timeFactor = factor;
      },
      update(dt, heroFeet, heroForward) {
        const here = crowd.getAgentPosition(agent);
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
            // The floor under the drone, which hovers above the navigation mesh.
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
          });
          objective = decision.objective;
          if (decision.say) say(decision.say);
          shootAt = decision.shootAt;
          if (shootAt !== null) stop(here);
          else if (decision.moveTo) {
            if (Vector3.Distance(toVector(decision.moveTo), here) < 0.05) stop(here);
            else goTo(decision.moveTo);
          }
        }

        const velocity = crowd.getAgentVelocity(agent);
        const speed = Math.hypot(velocity.x, velocity.z);
        cooldown -= dt;
        shotPose -= dt;
        if (shootAt !== null && world.range.alive(shootAt)) {
          // Face the target and shoot, with the upper body aiming.
          const centre = world.range.centre(shootAt);
          yaw = turnTowards(yaw, yawOf({ x: centre.x - here.x, z: centre.z - here.z }), 8 * dt);
          if (cooldown <= 0) {
            cooldown = FIRE_INTERVAL;
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
  } catch (error) {
    console.warn('Navigation could not start; the companion only follows.', error);
    return {
      name: 'Ren',
      navigated: false,
      get objective() {
        return objective;
      },
      order(order) {
        say(order.kind === 'follow' ? 'With you.' : "I can't reach that.");
      },
      setTimeFactor() {},
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
}
