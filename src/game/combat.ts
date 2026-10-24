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

/**
 * The proof's practice range (COVER_AND_AIM.md): drones that hover, take three hits, fall when
 * destroyed and come back; and the flash, tracer and spark of a shot.
 */
export interface Range {
  /** Live drones, as seen from a point (the camera), for aim assist. */
  candidates(from: Vector3): AimCandidate[];
  /** A drone's centre. */
  centre(id: number): Vector3;
  /** Applies a hit to whatever body a shot struck; true if it was a drone. */
  hit(body: PhysicsBody | null | undefined): boolean;
  /** Shows a shot from the muzzle to where it struck (or where it ended). */
  shot(from: Vector3, to: Vector3, struck: boolean): void;
  update(dt: number): void;
  /** How many drones are down right now. */
  readonly down: number;
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

  const tracer = CreateBox('tracer', { width: 0.025, height: 0.025, depth: 1 }, scene);
  tracer.material = glow(scene, 'tracer-glow', new Color3(1, 0.85, 0.5));
  tracer.isPickable = false;
  tracer.setEnabled(false);
  const flash = CreateSphere('muzzle-flash', { diameter: 0.14, segments: 6 }, scene);
  flash.material = tracer.material;
  flash.isPickable = false;
  flash.setEnabled(false);
  const spark = CreateSphere('spark', { diameter: 0.12, segments: 6 }, scene);
  spark.material = glow(scene, 'spark-glow', new Color3(1, 0.5, 0.2));
  spark.isPickable = false;
  spark.setEnabled(false);
  let effectFor = 0;

  const alive = (d: Drone) => d.respawnIn <= 0;

  return {
    candidates(from) {
      return drones.filter(alive).map((d) => {
        const offset = d.body.position.subtract(from);
        return { id: d.id, offset: { x: offset.x, y: offset.y, z: offset.z } };
      });
    },
    centre(id) {
      return drones[id]?.body.position.clone() ?? Vector3.Zero();
    },
    hit(struck) {
      const drone = drones.find((d) => alive(d) && d.aggregate.body === struck);
      if (!drone) return false;
      drone.hp -= 1;
      drone.flashFor = FLASH_SECONDS;
      drone.eye.emissiveColor = EYE_HIT;
      if (drone.hp <= 0) {
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
    shot(from, to, struck) {
      const length = Vector3.Distance(from, to);
      tracer.position = Vector3.Lerp(from, to, 0.5);
      tracer.scaling.z = length;
      tracer.lookAt(to);
      tracer.setEnabled(true);
      flash.position.copyFrom(from);
      flash.setEnabled(true);
      spark.position.copyFrom(to);
      spark.setEnabled(struck);
      effectFor = 0.06;
    },
    update(dt) {
      if (effectFor > 0) {
        effectFor -= dt;
        if (effectFor <= 0) {
          tracer.setEnabled(false);
          flash.setEnabled(false);
          spark.setEnabled(false);
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
  };
}
