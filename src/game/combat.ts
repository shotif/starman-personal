import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { Scene } from '@babylonjs/core/scene';
import type { AimCandidate } from './aim.ts';

import type { DamageKind } from './defences.ts';

/** Who fired a shot: 'hero', or a companion's name. */
export type Shooter = string;

/** What a shot does: an amount, of a kind (D-42). */
export interface Damage {
  amount: number;
  kind: DamageKind;
}

/**
 * Other things that can be aimed at and shot, joined to the range: the swarm (src/game/motes.ts).
 * Their ids are their own, from 0; the range numbers them after its drones.
 */
export interface TargetGroup {
  readonly size: number;
  centre(id: number): Vector3;
  alive(id: number): boolean;
  owns(id: number, body: PhysicsBody | null | undefined): boolean;
  /** Applies a hit if the body is one of its live targets; true if it was. */
  hit(body: PhysicsBody | null | undefined, by: Shooter, damage: Damage): boolean;
}

/**
 * The proof's practice range (COVER_AND_AIM.md): drones that hover, take three hits, fall when
 * destroyed and come back; and the flash, tracer and spark of a shot. Joined groups (the swarm) are
 * aimed at and shot through it the same way, and are the threats a companion fights unordered.
 */
export interface Range {
  /** Live drones, as seen from a point (the camera), for aim assist. */
  candidates(from: Vector3): AimCandidate[];
  /** A drone's centre. */
  centre(id: number): Vector3;
  /** Whether a drone is flying (not down). */
  alive(id: number): boolean;
  /** Whether a physics body is that drone's. */
  isDrone(id: number, body: PhysicsBody | null | undefined): boolean;
  /** The live drone a physics body belongs to, or null. */
  droneOf(body: PhysicsBody | null | undefined): number | null;
  /** Applies a hit to whatever body a shot struck; true if it was a target. A drone takes any hit as one. */
  hit(body: PhysicsBody | null | undefined, by?: Shooter, damage?: Damage): boolean;
  /** Live targets of joined groups (the swarm), which fight back. */
  threats(): { id: number; position: Vector3 }[];
  /** Adds a group of targets after the drones. */
  join(group: TargetGroup): void;
  /**
   * Shows a shot from the muzzle to where it struck (or where it ended). `shooter` keeps the hero's
   * and the companion's shots apart (0 and 1).
   */
  shot(from: Vector3, to: Vector3, struck: boolean, shooter?: number): void;
  /** Called for every shot shown, for its sound. */
  onShot: ((from: Vector3, shooter: number) => void) | null;
  update(dt: number): void;
  /** How many drones are down right now, and how many have been destroyed since the start. */
  readonly down: number;
  readonly destroyed: number;
}

const HITS = 3;
const RESPAWN_SECONDS = 6;
const FLASH_SECONDS = 0.12;

interface Drone {
  id: number;
  body: Mesh;
  ring: Mesh;
  eye: PBRMaterial;
  home: Vector3;
  aggregate: PhysicsAggregate;
  hp: number;
  respawnIn: number;
  flashFor: number;
}

function glow(scene: Scene, name: string, colour: Color3): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = new Color3(0.02, 0.02, 0.02);
  m.emissiveColor = colour;
  m.emissiveIntensity = 1.5;
  m.metallic = 0;
  m.roughness = 0.6;
  return m;
}

const EYE = new Color3(0.3, 0.9, 1);
const EYE_HIT = new Color3(1, 0.25, 0.15);

export function buildRange(scene: Scene, positions: readonly Vector3[], maxLights: number): Range {
  const shell = new PBRMaterial('drone-shell', scene);
  shell.albedoColor = new Color3(0.22, 0.24, 0.27);
  shell.metallic = 0.7;
  shell.roughness = 0.35;
  shell.maxSimultaneousLights = maxLights;

  const drones: Drone[] = positions.map((home, id) => {
    const body = CreateSphere(`drone-${id}`, { diameter: 0.5, segments: 16 }, scene);
    body.position.copyFrom(home);
    body.material = shell;
    const ring = CreateTorus(`drone-${id}-ring`, { diameter: 0.72, thickness: 0.05, tessellation: 32 }, scene);
    ring.parent = body;
    ring.material = shell;
    const eye = glow(scene, `drone-${id}-eye`, EYE);
    const lens = CreateSphere(`drone-${id}-lens`, { diameter: 0.16, segments: 8 }, scene);
    lens.parent = body;
    lens.position.z = -0.21;
    lens.material = eye;
    const aggregate = new PhysicsAggregate(body, PhysicsShapeType.SPHERE, { mass: 0 }, scene);
    return { id, body, ring, eye, home: home.clone(), aggregate, hp: HITS, respawnIn: 0, flashFor: 0 };
  });

  const tracerGlow = glow(scene, 'tracer-glow', new Color3(1, 0.85, 0.5));
  const sparkGlow = glow(scene, 'spark-glow', new Color3(1, 0.5, 0.2));
  /** One set of shot effects per shooter, so two shots in the same moment both show. */
  const effects = [0, 1].map((i) => {
    const tracer = CreateBox(`tracer-${i}`, { width: 0.025, height: 0.025, depth: 1 }, scene);
    const flash = CreateSphere(`muzzle-flash-${i}`, { diameter: 0.14, segments: 6 }, scene);
    const spark = CreateSphere(`spark-${i}`, { diameter: 0.12, segments: 6 }, scene);
    tracer.material = tracerGlow;
    flash.material = tracerGlow;
    spark.material = sparkGlow;
    for (const mesh of [tracer, flash, spark]) {
      mesh.isPickable = false;
      mesh.setEnabled(false);
    }
    return { tracer, flash, spark, time: 0 };
  });

  const alive = (d: Drone) => d.respawnIn <= 0;
  let destroyed = 0;
  const groups: { group: TargetGroup; first: number }[] = [];
  /** The joined group an id falls in, and the id within it. */
  const joined = (id: number) => {
    for (const { group, first } of groups) {
      if (id >= first && id < first + group.size) return { group, own: id - first };
    }
    return null;
  };
  /** Every live joined target, with its range id. */
  const liveJoined = () =>
    groups.flatMap(({ group, first }) =>
      Array.from({ length: group.size }, (_, own) => own)
        .filter((own) => group.alive(own))
        .map((own) => ({ id: first + own, position: group.centre(own) })),
    );

  return {
    candidates(from) {
      const targets = [...drones.filter(alive).map((d) => ({ id: d.id, position: d.body.position })), ...liveJoined()];
      return targets.map(({ id, position }) => {
        const offset = position.subtract(from);
        return { id, offset: { x: offset.x, y: offset.y, z: offset.z } };
      });
    },
    centre(id) {
      const j = joined(id);
      if (j) return j.group.centre(j.own);
      return drones[id]?.body.position.clone() ?? Vector3.Zero();
    },
    alive(id) {
      const j = joined(id);
      if (j) return j.group.alive(j.own);
      const d = drones[id];
      return !!d && alive(d);
    },
    isDrone(id, body) {
      const j = joined(id);
      if (j) return j.group.alive(j.own) && j.group.owns(j.own, body);
      const d = drones[id];
      return !!d && !!body && d.aggregate.body === body;
    },
    droneOf(body) {
      const drone = drones.find((d) => alive(d) && !!body && d.aggregate.body === body);
      if (drone) return drone.id;
      for (const { group, first } of groups) {
        for (let own = 0; own < group.size; own++) {
          if (group.alive(own) && group.owns(own, body)) return first + own;
        }
      }
      return null;
    },
    threats: liveJoined,
    join(group) {
      const last = groups[groups.length - 1];
      groups.push({ group, first: last ? last.first + last.group.size : drones.length });
    },
    hit(struck, by = 'hero', damage = { amount: 34, kind: 'kinetic' }) {
      if (groups.some(({ group }) => group.hit(struck, by, damage))) return true;
      const drone = drones.find((d) => alive(d) && d.aggregate.body === struck);
      if (!drone) return false;
      drone.hp -= 1;
      drone.flashFor = FLASH_SECONDS;
      drone.eye.emissiveColor = EYE_HIT;
      if (drone.hp <= 0) {
        destroyed += 1;
        // Destroyed: it drops to the floor as a loose body, its eye dark.
        drone.respawnIn = RESPAWN_SECONDS;
        drone.aggregate.dispose();
        drone.aggregate = new PhysicsAggregate(
          drone.body,
          PhysicsShapeType.SPHERE,
          { mass: 2, restitution: 0.3 },
          scene,
        );
        drone.aggregate.body.applyImpulse(new Vector3(0, 1, 0), drone.body.position);
        drone.eye.emissiveColor = new Color3(0, 0, 0);
      }
      return true;
    },
    onShot: null,
    shot(from, to, struck, shooter = 0) {
      this.onShot?.(from, shooter);
      const fx = effects[shooter] ?? effects[0];
      if (!fx) return;
      fx.tracer.position = Vector3.Lerp(from, to, 0.5);
      fx.tracer.scaling.z = Vector3.Distance(from, to);
      fx.tracer.lookAt(to);
      fx.tracer.setEnabled(true);
      fx.flash.position.copyFrom(from);
      fx.flash.setEnabled(true);
      fx.spark.position.copyFrom(to);
      fx.spark.setEnabled(struck);
      fx.time = 0.06;
    },
    update(dt) {
      for (const fx of effects) {
        if (fx.time <= 0) continue;
        fx.time -= dt;
        if (fx.time <= 0) {
          fx.tracer.setEnabled(false);
          fx.flash.setEnabled(false);
          fx.spark.setEnabled(false);
        }
      }
      for (const d of drones) {
        if (alive(d)) {
          d.ring.rotation.y += dt * 1.6;
          if (d.flashFor > 0) {
            d.flashFor -= dt;
            if (d.flashFor <= 0) d.eye.emissiveColor = EYE;
          }
        } else {
          d.respawnIn -= dt;
          if (d.respawnIn <= 0) {
            d.aggregate.dispose();
            d.body.position.copyFrom(d.home);
            d.body.rotationQuaternion = null;
            d.body.rotation.setAll(0);
            d.aggregate = new PhysicsAggregate(d.body, PhysicsShapeType.SPHERE, { mass: 0 }, scene);
            d.hp = HITS;
            d.eye.emissiveColor = EYE;
          }
        }
      }
    },
    get down() {
      return drones.filter((d) => !alive(d)).length;
    },
    get destroyed() {
      return destroyed;
    },
  };
}
