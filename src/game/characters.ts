import '@babylonjs/core/Animations/animatable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import { foldMissing, type LocomotionWeights, locomotionWeights } from './motion.ts';

registerBuiltInLoaders();

/** A person in the world: a root at their feet, turned by `root.rotation.y`, and their animations. */
export interface Character {
  root: TransformNode;
  meshes: AbstractMesh[];
  /** True when the model brought animations; the stand-in capsule has none. */
  animated: boolean;
  /** Blends idle, walk, run and sprint for a ground speed in metres a second. */
  setLocomotion(speed: number): void;
}

/** Loads a character model once, to be placed many times. Null when it cannot be loaded. */
export async function loadCharacterTemplate(scene: Scene, url: string): Promise<AssetContainer | null> {
  try {
    return await LoadAssetContainerAsync(url, scene);
  } catch (error) {
    console.warn(`Could not load ${url}; using a stand-in.`, error);
    return null;
  }
}

const LOCOMOTION_PATTERNS: Record<keyof LocomotionWeights, { want: RegExp; avoid: RegExp }> = {
  idle: { want: /idle/i, avoid: /crouch|aim|gun|pistol|rifle|sword|melee|talk|sit|swim/i },
  walk: { want: /walk/i, avoid: /back|left|right|strafe|crouch|aim|gun|pistol|rifle|zombie/i },
  run: { want: /jog|run/i, avoid: /back|left|right|strafe|crouch|aim|gun|pistol|rifle|zombie|sprint/i },
  sprint: { want: /sprint/i, avoid: /back|left|right|strafe|crouch|aim|gun|pistol|rifle/i },
};

/** Picks the animation for each locomotion slot by name, preferring the shortest matching name. */
export function pickLocomotion(
  groups: readonly AnimationGroup[],
): Partial<Record<keyof LocomotionWeights, AnimationGroup>> {
  const picked: Partial<Record<keyof LocomotionWeights, AnimationGroup>> = {};
  for (const key of Object.keys(LOCOMOTION_PATTERNS) as (keyof LocomotionWeights)[]) {
    const { want, avoid } = LOCOMOTION_PATTERNS[key];
    const matches = groups.filter((g) => want.test(g.name) && !avoid.test(g.name));
    matches.sort((a, b) => a.name.length - b.name.length);
    if (matches[0]) picked[key] = matches[0];
  }
  return picked;
}

/** Places a character from a template, scaled to `height` metres; a capsule if there is no model. */
export function spawnCharacter(
  scene: Scene,
  template: AssetContainer | null,
  name: string,
  options: { height?: number; tint?: Color3 } = {},
): Character {
  const height = options.height ?? 1.8;
  const root = new TransformNode(name, scene);
  if (!template) return standIn(scene, root, height, options.tint);

  const entries = template.instantiateModelsToScene((source) => `${name}-${source}`, true);
  const model = new TransformNode(`${name}-model`, scene);
  model.parent = root;
  for (const node of entries.rootNodes) node.parent = model;

  const meshes = model.getChildMeshes(false);
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = min.scale(-1);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(box.minimumWorld);
    max.maximizeInPlace(box.maximumWorld);
  }
  const modelHeight = max.y - min.y;
  if (Number.isFinite(modelHeight) && modelHeight > 0) {
    const scale = height / modelHeight;
    model.scaling.setAll(scale);
    model.position.y = -min.y * scale;
  }

  if (options.tint) {
    for (const mesh of meshes) {
      if (mesh.material instanceof PBRMaterial) mesh.material.albedoColor = options.tint;
    }
  }

  const groups = entries.animationGroups;
  for (const group of groups) group.stop();
  const slots = pickLocomotion(groups);
  const has = { idle: !!slots.idle, walk: !!slots.walk, run: !!slots.run, sprint: !!slots.sprint };
  for (const group of Object.values(slots)) {
    group.start(true);
    group.weight = 0;
  }

  return {
    root,
    meshes,
    animated: Object.keys(slots).length > 0,
    setLocomotion(speed) {
      const weights = foldMissing(locomotionWeights(speed), has);
      for (const key of Object.keys(slots) as (keyof LocomotionWeights)[]) {
        const group = slots[key];
        if (group) group.weight = weights[key];
      }
    },
  };
}

function standIn(scene: Scene, root: TransformNode, height: number, tint?: Color3): Character {
  const body = CreateCapsule(`${root.name}-body`, { height, radius: 0.32 }, scene);
  body.parent = root;
  body.position.y = height / 2;
  const visor = CreateBox(`${root.name}-visor`, { width: 0.36, height: 0.12, depth: 0.12 }, scene);
  visor.parent = root;
  visor.position.set(0, height - 0.2, 0.26);
  const skin = new PBRMaterial(`${root.name}-skin`, scene);
  skin.albedoColor = tint ?? new Color3(0.8, 0.8, 0.82);
  skin.metallic = 0.1;
  skin.roughness = 0.5;
  body.material = skin;
  const glass = new PBRMaterial(`${root.name}-glass`, scene);
  glass.albedoColor = new Color3(0.05, 0.07, 0.1);
  glass.emissiveColor = new Color3(0.3, 0.6, 0.9);
  visor.material = glass;
  const meshes: Mesh[] = [body, visor];
  return { root, meshes, animated: false, setLocomotion() {} };
}
