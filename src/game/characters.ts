import '@babylonjs/core/Animations/animatable';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AnimationGroupMask, AnimationGroupMaskMode } from '@babylonjs/core/Animations/animationGroupMask';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Material } from '@babylonjs/core/Materials/material';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import { CLIPS, type Clip, ONE_SHOT, type Pose, type Weights } from './pose.ts';

registerBuiltInLoaders();

/** A person in the world: a root at their feet, turned by `root.rotation.y`, and their animations. */
export interface Character {
  /** Moves the mouth to a voice's loudness, 0 to 1 (set by the wardrobe; silent for a stand-in). */
  speak(level: number): void;
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
  /** Gives parts added later (hair) the whole figure's bounds, as `spawnCharacter` gives its own. */
  fitBounds(parts: readonly AbstractMesh[]): void;
  /**
   * Puts a model in the right hand (the sidearm): scaled to `length` metres along its longest side,
   * turned by `rotation` (radians, about x, y and z of the hand) and moved by `offset` (metres).
   */
  hold(
    model: AssetContainer,
    length: number,
    rotation: [number, number, number],
    offset: [number, number, number],
    along?: number,
    reversed?: boolean,
    lift?: number,
  ): TransformNode | null;
  /**
   * Points the gun in hand along a direction (world space): where the crosshair looks while aiming,
   * low and ready in a fight; or null to let it follow the hand. The hand's animation turns the hand
   * its own way (the pistol's pose by some 45°), so a gun that only followed it pointed off to the
   * side of the aim (the owner, 25 October 2026).
   */
  aimHeld(direction: Vector3 | null): void;
  /** Which held model the shots come from (the weapon in hand, D-56), and its length. */
  wield(node: TransformNode, length: number): void;
  /**
   * Wears a rigid piece on a bone (a helmet on the head, a pack on the back: D-66): scaled to `size`
   * metres along its longest side, its bottom's middle set `offset` metres from the bone (in the
   * figure's own frame: x to its right, y up, z forward) as the figure stands at rest, then carried
   * by the bone.
   */
  attach(model: AssetContainer, bone: string, size: number, offset: [number, number, number]): TransformNode | null;
  /** Fades the whole figure: 1 drawn as usual, 0 hidden. */
  setFade(visibility: number): void;
}

/** Fades every mesh under a node; while faded, each draws only its nearest surface. */
function fader(node: TransformNode): (visibility: number) => void {
  let current = 1;
  /** Each material's own transparency, put back when the figure is whole again. */
  const own = new Map<Material, number | null>();
  return (visibility) => {
    if (visibility === current) return;
    const fading = visibility < 1;
    current = visibility;
    for (const mesh of node.getChildMeshes(false)) {
      mesh.visibility = visibility;
      mesh.isVisible = visibility > 0.02;
      const material = mesh.material;
      if (!material) continue;
      // The model's materials say they are opaque, and an opaque material ignores the mesh's
      // visibility: it blends only while the figure fades.
      if (!own.has(material)) own.set(material, material.transparencyMode);
      const mode = own.get(material) ?? null;
      material.transparencyMode = !fading
        ? mode
        : mode === Material.MATERIAL_ALPHATEST
          ? Material.MATERIAL_ALPHATESTANDBLEND
          : Material.MATERIAL_ALPHABLEND;
      // Without a depth pass first, a faded face shows the eyes and mouth through the skin.
      material.needDepthPrePass = fading;
    }
  };
}

/**
 * Gives each part a box around the whole figure in any pose, as seen from `root`. A skinned mesh is
 * culled by the box of its bind pose, which the animation does not move: crouched in cover the head
 * drops half a metre below the boxes of the hair and the eyes, and a camera close to the face culled
 * them (seen on the owner's phone, 24 October 2026).
 */
function fitFigureBounds(root: TransformNode, figure: { min: Vector3; max: Vector3 }, parts: readonly AbstractMesh[]) {
  root.computeWorldMatrix(true);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
    Vector3.TransformCoordinates(
      new Vector3(
        i & 1 ? figure.max.x : figure.min.x,
        i & 2 ? figure.max.y : figure.min.y,
        i & 4 ? figure.max.z : figure.min.z,
      ),
      root.getWorldMatrix(),
    ),
  );
  for (const part of parts) {
    if (part.getTotalVertices() === 0) continue;
    const toLocal = part.computeWorldMatrix(true).clone().invert();
    const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const max = min.scale(-1);
    for (const corner of corners) {
      const local = Vector3.TransformCoordinates(corner, toLocal);
      min.minimizeInPlace(local);
      max.maximizeInPlace(local);
    }
    part.setBoundingInfo(new BoundingInfo(min, max));
  }
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

/**
 * Where a long gun's grip is from the right wrist in the rifle clips: along the aim, down, and in
 * towards the body's middle, where the palm's face meets it (metres; RIFLE["palm"] in common.py).
 */
const PALM = { forward: 0.075, down: 0.035, inward: 0.025 };

/** The bones the aim and shoot clips own while aiming: the spine, arms, hands, neck and head. */
const UPPER_BODY = /^(spine_0[123]|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_|neck_|head)/i;
const UPPER_CLIPS: readonly Clip[] = [
  'pistol_aim',
  'pistol_shoot',
  'rifle_aim',
  'rifle_shoot',
  'rifle_ready',
  'shotgun_aim',
  'shotgun_shoot',
  'shotgun_ready',
  'marksman_aim',
  'marksman_shoot',
  'marksman_ready',
  'power_cast',
];

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
  // The figure's box as seen from the root, which stands at the origin until it is placed: the
  // standing body, with room around it for arms reaching out and below it for the feet.
  const size = Number.isFinite(modelHeight) && modelHeight > 0 ? modelHeight * model.scaling.y : 1.8;
  const figure = {
    min: new Vector3(-0.45 * size, -0.1 * size, -0.45 * size),
    max: new Vector3(0.45 * size, 1.1 * size, 0.45 * size),
  };
  fitFigureBounds(root, figure, meshes);

  if (options.tint) {
    for (const mesh of meshes) {
      if (mesh.material instanceof PBRMaterial) mesh.material.albedoColor = options.tint;
    }
  }

  const sourceName = (n: string) => (n.startsWith(prefix) ? n.slice(prefix.length) : n);
  const nodes = model.getDescendants(false).filter((n): n is TransformNode => n instanceof TransformNode);
  const upperNames = nodes.filter((n) => UPPER_BODY.test(sourceName(n.name))).map((n) => n.name);
  const hand = nodes.find((n) => sourceName(n.name).toLowerCase() === 'hand_r') ?? null;
  let held: TransformNode | null = null;
  let heldLength = 0;
  /**
   * Each gun held: its grip (on the hand), and a node of its own in the world that points it along the
   * aim, with how the model sits under each.
   */
  const guns = new Map<
    TransformNode,
    {
      holder: TransformNode;
      free: TransformNode;
      inHand: { position: Vector3; turn: number };
      aimed: { position: Vector3; turn: number };
      along: number;
      /** A long gun, held two-handed: its grip is seated in the right palm. */
      long: boolean;
    }
  >();
  let aimDirection: Vector3 | null = null;
  if (hand) {
    scene.onAfterAnimationsObservable.add(() => {
      for (const [grip, gun] of guns) {
        const aimed = grip === held && aimDirection !== null && grip.isEnabled();
        if (aimed && aimDirection && hand) {
          grip.computeWorldMatrix(true);
          if (gun.long) {
            // The rifle clips put the grip a little forward of, below and inside the right wrist
            // (PALM, matching RIFLE["palm"] in scripts/art/common.py): it goes there.
            const up = Vector3.Up().subtract(aimDirection.scale(aimDirection.y)).normalize();
            const right = Vector3.Cross(up, aimDirection).normalize();
            gun.free.position.copyFrom(
              hand
                .getAbsolutePosition()
                .add(aimDirection.scale(PALM.forward))
                .subtract(up.scale(PALM.down))
                .subtract(right.scale(PALM.inward)),
            );
          } else gun.free.position.copyFrom(grip.getAbsolutePosition());
          // Babylon's look rotation turns -Z towards the direction given: asked for the opposite,
          // the node's +Z, the barrel, points along the aim.
          gun.free.rotationQuaternion = Quaternion.FromLookDirectionLH(aimDirection.negate(), Vector3.Up());
        }
        const pose = aimed ? gun.aimed : gun.inHand;
        const parent = aimed ? gun.free : grip;
        if (gun.holder.parent !== parent) {
          gun.holder.parent = parent;
          gun.holder.position.copyFrom(pose.position);
          gun.holder.rotation.y = pose.turn;
        }
        gun.free.setEnabled(aimed);
      }
    });
  }

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
  /** One-shot clips playing now: they start from their first frame when they fade in. */
  const playing = new Set<Clip>();
  /**
   * Plays a clip once from the start, then holds its last frame for as long as it is asked for. The
   * hold starts on the next frame: a start from inside the group's own end is ignored, which left
   * the group "started" but driving nothing, and a bone only it moves (the casting arm) kept its
   * last value for good: the hero ran with an arm held out (the owner's phone, 25 October 2026).
   */
  const playOnce = (group: AnimationGroup) => {
    group.stop();
    group.start(false, 1, group.from, group.to);
    group.onAnimationGroupEndObservable.addOnce(() => {
      scene.onBeforeRenderObservable.addOnce(() => {
        group.stop();
        group.start(true, 1, group.to, group.to);
      });
    });
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
    fitBounds: (parts) => fitFigureBounds(root, figure, parts),
    setFade: fader(model),
    speak() {},
    setPose(pose, dt) {
      const t = Math.min(1, dt * (pose.blend ?? 12));
      const legWeights = withIdle(pose.lower, lower);
      const torsoWeights = withIdle(pose.upper ?? pose.lower, upper);
      for (const clip of ONE_SHOT) {
        const wanted = (legWeights[clip] ?? 0) > 0 || (torsoWeights[clip] ?? 0) > 0;
        if (wanted && !playing.has(clip)) {
          playing.add(clip);
          for (const group of [lower.get(clip), upper.get(clip)]) if (group) playOnce(group);
        } else if (!wanted) {
          playing.delete(clip);
        }
      }
      for (const [clip, group] of lower) fade(group, legWeights[clip] ?? 0, t);
      for (const [clip, group] of upper) fade(group, torsoWeights[clip] ?? 0, t);
    },
    fire() {
      for (const clip of ['pistol_shoot', 'rifle_shoot', 'shotgun_shoot', 'marksman_shoot'] as const) {
        const shoot = upper.get(clip);
        if (shoot) shoot.goToFrame(shoot.from);
      }
    },
    muzzle() {
      const gun = held ? guns.get(held) : undefined;
      if (gun && gun.holder.parent === gun.free) {
        return gun.free.getAbsolutePosition().add(gun.free.forward.scale(heldLength * 0.5 + gun.along));
      }
      if (held) return held.getAbsolutePosition().add(held.forward.scale(heldLength * 0.5));
      if (hand) return hand.getAbsolutePosition().clone();
      return root.position.add(new Vector3(0, 1.4, 0));
    },
    wield(node, length) {
      held = node;
      heldLength = length;
    },
    aimHeld(direction) {
      aimDirection = direction && direction.lengthSquared() > 1e-8 ? direction.normalizeToNew() : null;
    },
    attach(part, boneName, size, offset) {
      const bone = nodes.find((n) => sourceName(n.name).toLowerCase() === boneName) ?? null;
      if (!bone) return null;
      const entries = part.instantiateModelsToScene((n) => `${name}-${boneName}-${n}`, false, {
        doNotInstantiate: false,
      });
      const holder = new TransformNode(`${name}-${boneName}-worn`, scene);
      for (const node of entries.rootNodes) node.parent = holder;
      const meshes = holder.getChildMeshes(false);
      const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      const max = min.scale(-1);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        min.minimizeInPlace(mesh.getBoundingInfo().boundingBox.minimumWorld);
        max.maximizeInPlace(mesh.getBoundingInfo().boundingBox.maximumWorld);
        mesh.isPickable = false;
      }
      const extent = max.subtract(min);
      const k = size / Math.max(extent.x, extent.y, extent.z, 1e-6);
      // Its bottom's middle at the holder's origin, at its size.
      const bottom = new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2);
      const inner = new TransformNode(`${name}-${boneName}-part`, scene);
      inner.parent = holder;
      for (const node of entries.rootNodes) node.parent = inner;
      inner.position = bottom.scale(-1);
      holder.scaling.setAll(k);
      // Where the bone stands at rest, in the figure's own frame, and the piece there; then the bone
      // carries it, keeping where it is.
      root.computeWorldMatrix(true);
      for (const n of nodes) n.computeWorldMatrix(true);
      const inRoot = Vector3.TransformCoordinates(bone.getAbsolutePosition(), root.getWorldMatrix().clone().invert());
      holder.parent = root;
      holder.position.copyFrom(inRoot.add(new Vector3(...offset)));
      holder.computeWorldMatrix(true);
      holder.setParent(bone);
      return holder;
    },
    hold(model, length, rotation, offset, along = 0, reversed = false, lift = 0) {
      if (!hand) return null;
      const entries = model.instantiateModelsToScene((n) => `${name}-held-${n}`, false, { doNotInstantiate: false });
      const holder = new TransformNode(`${name}-held`, scene);
      for (const node of entries.rootNodes) node.parent = holder;
      const meshes = holder.getChildMeshes(false);
      const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      const max = min.scale(-1);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        min.minimizeInPlace(mesh.getBoundingInfo().boundingBox.minimumWorld);
        max.maximizeInPlace(mesh.getBoundingInfo().boundingBox.maximumWorld);
        mesh.isPickable = false;
      }
      const extent = max.subtract(min);
      const k = length / Math.max(extent.x, extent.y, extent.z, 1e-6);
      const centre = min.add(max).scale(0.5);
      const grip = new TransformNode(`${name}-grip`, scene);
      holder.parent = grip;
      holder.scaling.setAll(k);
      // A long gun slides forward along its barrel (its +Z), so its grip, not its middle, is in the hand.
      // A model that faces the other way from the sidearm's file is turned half round first.
      const inHand = reversed
        ? { position: new Vector3(centre.x * k, -centre.y * k, centre.z * k - along), turn: Math.PI }
        : { position: new Vector3(-centre.x * k, -centre.y * k, -centre.z * k + along), turn: 0 };
      // Pointed along the aim, the node's +Z is the barrel: the long guns' files face +Z, the sidearm's
      // the other way. `lift` raises the gun so its grip, below its middle, is at the hand.
      const aimed = reversed
        ? { position: new Vector3(-centre.x * k, -centre.y * k + lift, -centre.z * k + along), turn: 0 }
        : { position: new Vector3(centre.x * k, -centre.y * k + lift, centre.z * k + along), turn: Math.PI };
      holder.position.copyFrom(inHand.position);
      holder.rotation.y = inHand.turn;
      const free = new TransformNode(`${name}-aimed`, scene);
      free.setEnabled(false);
      // The hand bone carries the character's scale (the model's units) and the import's mirror of one
      // axis; undo both so the size holds and a rotation can seat the gun.
      grip.parent = hand;
      const handScale = new Vector3();
      hand.computeWorldMatrix(true).decompose(handScale);
      grip.scaling.set(1 / handScale.x, 1 / handScale.y, 1 / handScale.z);
      grip.rotation.set(...rotation);
      grip.position.set(offset[0] / handScale.x, offset[1] / handScale.y, offset[2] / handScale.z);
      held = grip;
      heldLength = length;
      guns.set(grip, { holder, free, inHand, aimed, along, long: reversed });
      return grip;
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
    fitBounds() {},
    hold: () => null,
    setFade: fader(root),
    speak() {},
    setPose() {},
    aimHeld() {},
    wield() {},
    attach: () => null,
    fire() {},
    muzzle: () => root.position.add(new Vector3(0, height * 0.75, 0)),
  };
}
