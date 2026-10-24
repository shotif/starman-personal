import '@babylonjs/core/Animations/animatable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AnimationGroupMask, AnimationGroupMaskMode } from '@babylonjs/core/Animations/animationGroupMask';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
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
import { CLIPS, type Clip, type Pose, type Weights } from './pose.ts';

registerBuiltInLoaders();

/** A person in the world: a root at their feet, turned by `root.rotation.y`, and their animations. */
export interface Character {
  root: TransformNode;
  meshes: AbstractMesh[];
  /** True when the model brought animations; the stand-in capsule has none. */
  animated: boolean;
  /**
   * Fades towards the clips a pose asks for (src/game/pose.ts) over `dt` seconds; the upper body
   * follows `pose.upper` when it has its own clips, and the legs otherwise.
   */
  setPose(pose: Pose, dt: number): void;
  /** Restarts the shooting clip, for one shot. */
  fire(): void;
  /** Where a shot leaves from: the right hand, in world space. */
  muzzle(): Vector3;
  /** The skeleton, for parts that bind to it (hair); null for the stand-in. */
  skeleton: Skeleton | null;
  /** The node the model's meshes hang from, for parts added later. */
  model: TransformNode | null;
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

/** The bones the aim and shoot clips own while aiming: the spine, arms, hands, neck and head. */
const UPPER_BODY = /^(spine_0[123]|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_|neck_|head)/i;
const UPPER_CLIPS: readonly Clip[] = ['pistol_aim', 'pistol_shoot'];

/**
 * Places a character from a template with its feet on the ground: at the model's own size (the MPFB
 * people are modelled in metres), or scaled to `height` metres when given (the mannequin). A capsule
 * stands in when there is no model.
 */
export function spawnCharacter(
  scene: Scene,
  template: AssetContainer | null,
  name: string,
  options: { height?: number; tint?: Color3 } = {},
): Character {
  const root = new TransformNode(name, scene);
  if (!template) return standIn(scene, root, options.height ?? 1.8, options.tint);

  const prefix = `${name}-`;
  const entries = template.instantiateModelsToScene((source) => `${prefix}${source}`, true);
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
    const scale = options.height ? options.height / modelHeight : 1;
    model.scaling.setAll(scale);
    model.position.y = -min.y * scale;
  }

  if (options.tint) {
    for (const mesh of meshes) {
      if (mesh.material instanceof PBRMaterial) mesh.material.albedoColor = options.tint;
    }
  }

  const sourceName = (n: string) => (n.startsWith(prefix) ? n.slice(prefix.length) : n);
  const nodes = model.getDescendants(false).filter((n): n is TransformNode => n instanceof TransformNode);
  const upperNames = nodes.filter((n) => UPPER_BODY.test(sourceName(n.name))).map((n) => n.name);
  const hand = nodes.find((n) => sourceName(n.name).toLowerCase() === 'hand_r') ?? null;

  // Every walking clip plays twice: once on the legs and hips, once on the upper body, each held
  // by a mask that never changes. Aiming fades the upper copies out and the aim clip in, so the
  // arms never snap through the rest pose.
  const legs = new AnimationGroupMask(upperNames, AnimationGroupMaskMode.Exclude);
  const torso = new AnimationGroupMask(upperNames, AnimationGroupMaskMode.Include);
  const lower = new Map<Clip, AnimationGroup>();
  const upper = new Map<Clip, AnimationGroup>();
  for (const group of entries.animationGroups) {
    group.stop();
    const clip = sourceName(group.name) as Clip;
    if (!(CLIPS as readonly string[]).includes(clip)) continue;
    if (UPPER_CLIPS.includes(clip)) {
      group.mask = torso;
      upper.set(clip, group);
    } else {
      const top = group.clone(`${group.name}-upper`);
      top.mask = torso;
      upper.set(clip, top);
      group.mask = legs;
      lower.set(clip, group);
    }
  }
  const current = new Map<AnimationGroup, number>();
  for (const group of [...lower.values(), ...upper.values()]) {
    group.start(true);
    group.weight = 0;
    current.set(group, 0);
  }
  /** Fades a clip's weight towards its target. */
  const fade = (group: AnimationGroup, target: number, t: number) => {
    const next = (current.get(group) ?? 0) + (target - (current.get(group) ?? 0)) * t;
    const weight = Math.abs(next - target) < 1e-3 ? target : next;
    current.set(group, weight);
    group.weight = weight;
  };
  /** A clip the model lacks hands its weight to idle. */
  const withIdle = (weights: Weights, have: Map<Clip, AnimationGroup>): Weights => {
    let orphaned = 0;
    for (const [clip, weight] of Object.entries(weights) as [Clip, number][]) {
      if (!have.has(clip)) orphaned += weight;
    }
    return orphaned > 0 ? { ...weights, idle: (weights.idle ?? 0) + orphaned } : weights;
  };

  return {
    root,
    meshes,
    animated: lower.size > 0,
    skeleton: entries.skeletons[0] ?? null,
    model,
    setPose(pose, dt) {
      const t = Math.min(1, dt * 12);
      const legWeights = withIdle(pose.lower, lower);
      const torsoWeights = withIdle(pose.upper ?? pose.lower, upper);
      for (const [clip, group] of lower) fade(group, legWeights[clip] ?? 0, t);
      for (const [clip, group] of upper) fade(group, torsoWeights[clip] ?? 0, t);
    },
    fire() {
      const shoot = upper.get('pistol_shoot');
      if (shoot) shoot.goToFrame(shoot.from);
    },
    muzzle() {
      if (hand) return hand.getAbsolutePosition().clone();
      return root.position.add(new Vector3(0, 1.4, 0));
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
  return {
    root,
    meshes,
    animated: false,
    skeleton: null,
    model: null,
    setPose() {},
    fire() {},
    muzzle: () => root.position.add(new Vector3(0, height * 0.75, 0)),
  };
}
