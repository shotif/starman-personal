import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Character } from './characters.ts';
import type { Body, Looks, Manifest } from './looks.ts';

/** Where the character files live (the art pipeline's public/assets/characters/). */
export const CHARACTERS = `${import.meta.env.BASE_URL}assets/characters/`;

/** Loads the manifest of bodies, sliders and looks the art pipeline writes. */
export async function loadManifest(): Promise<Manifest> {
  const response = await fetch(`${CHARACTERS}heroes.json`);
  if (!response.ok) throw new Error(`heroes.json: HTTP ${response.status}`);
  return (await response.json()) as Manifest;
}

/** Puts a set of looks on a character and changes them later (CREATOR.md, ART_PIPELINE.md §8). */
export interface Wardrobe {
  wear(looks: Looks): Promise<void>;
}

/** A mesh's own vertices before any slider, and its morph targets, kept for baking. */
interface Unbaked {
  /** The bounds the loader gave the mesh, in metres; recomputing them from the stored positions would be wrong. */
  bounds: BoundingInfo;
  positions: Float32Array;
  normals: Float32Array | null;
  targets: { name: string; positions: Float32Array | null; normals: Float32Array | null }[];
}
const unbaked = new WeakMap<AbstractMesh, Unbaked>();
const floats = (data: ArrayLike<number> | null) => (data ? Float32Array.from(data) : null);

/**
 * Bakes the sliders into each mesh's own vertices on the processor, instead of leaving them to the
 * GPU's morph targets. Some phone drivers read morph targets wrongly and draw black patches
 * wherever a slider moves the body (seen on the owner's Android phone, 24 October 2026; the same
 * looks draw cleanly on desktop GPUs). The GPU then draws plain geometry; the morph targets stay,
 * at zero, for speech. Each mesh gets its own copy of its geometry first, so the loaded template
 * that other characters are cloned from is never changed.
 */
function bakeSliders(meshes: readonly AbstractMesh[], sliders: Record<string, number>): void {
  for (const mesh of meshes) {
    const manager = mesh.morphTargetManager;
    if (!manager || !(mesh instanceof Mesh)) continue;
    let base = unbaked.get(mesh);
    if (!base) {
      // The character files store positions on a shared 16-bit grid and keep the scale to metres in
      // the skeleton (ART_PIPELINE.md §8), so bounds recomputed from the positions are about 2.5
      // times too small and the mesh is culled. Keep the loader's (taken before the geometry is
      // copied, which recomputes them), a little larger for what the sliders add.
      const { minimum, maximum } = mesh.getBoundingInfo();
      const centre = minimum.add(maximum).scale(0.5);
      const half = maximum.subtract(minimum).scale(0.5 * 1.15);
      const bounds = new BoundingInfo(centre.subtract(half), centre.add(half));
      mesh.makeGeometryUnique();
      const positions = floats(mesh.getVerticesData(VertexBuffer.PositionKind, true, true));
      if (!positions) continue;
      const targets = [];
      for (let i = 0; i < manager.numTargets; i++) {
        const t = manager.getTarget(i);
        targets.push({ name: t.name, positions: floats(t.getPositions()), normals: floats(t.getNormals()) });
      }
      base = { bounds, positions, normals: floats(mesh.getVerticesData(VertexBuffer.NormalKind, true, true)), targets };
      unbaked.set(mesh, base);
    }
    const positions = base.positions.slice();
    const normals = base.normals?.slice() ?? null;
    for (const target of base.targets) {
      const weight = sliders[target.name] ?? 0;
      if (weight === 0) continue;
      if (target.positions) {
        for (let i = 0; i < positions.length; i++) {
          positions[i] = (positions[i] ?? 0) + ((target.positions[i] ?? 0) - (base.positions[i] ?? 0)) * weight;
        }
      }
      if (normals && base.normals && target.normals) {
        for (let i = 0; i < normals.length; i++) {
          normals[i] = (normals[i] ?? 0) + ((target.normals[i] ?? 0) - (base.normals[i] ?? 0)) * weight;
        }
      }
    }
    if (normals) {
      for (let i = 0; i < normals.length; i += 3) {
        const x = normals[i] ?? 0;
        const y = normals[i + 1] ?? 0;
        const z = normals[i + 2] ?? 0;
        const length = Math.hypot(x, y, z) || 1;
        normals[i] = x / length;
        normals[i + 1] = y / length;
        normals[i + 2] = z / length;
      }
      mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
    }
    mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
    // The sliders' GPU morphs stay at zero; only speech will use morph targets.
    for (let i = 0; i < manager.numTargets; i++) {
      const target = manager.getTarget(i);
      if (target.name in sliders) target.influence = 0;
    }
    mesh.setBoundingInfo(new BoundingInfo(base.bounds.minimum.clone(), base.bounds.maximum.clone()));
  }
}

export function wardrobe(scene: Scene, character: Character, manifest: Manifest, body: Body): Wardrobe {
  const material = (suffix: string) =>
    character.meshes
      .map((m) => m.material)
      .find((m): m is PBRMaterial => m instanceof PBRMaterial && m.name.endsWith(`${body}_${suffix}`));
  const skin = material('skin');
  const eyes = material('eyes');
  const ownHair = character.meshes.filter((m) => m.material?.name.endsWith(`${body}_hair`));
  const ownHairId = manifest.bodies[body].defaultLooks.hair;
  let worn: AbstractMesh[] = [];
  let wornHair = ownHairId;
  let sliders: Record<string, number> = {};
  const textures = new Map<string, Texture>();

  /** A texture laid out as glTF lays them out (not flipped), loaded once. */
  const texture = (file: string, alpha: boolean, like: BaseTexture | null) => {
    let t = textures.get(file);
    if (!t) {
      t = new Texture(`${CHARACTERS}${file}`, scene, false, false);
      t.hasAlpha = alpha;
      if (like) t.coordinatesIndex = like.coordinatesIndex;
      textures.set(file, t);
    }
    return t;
  };

  const wearHair = async (id: string) => {
    if (id === wornHair) return;
    for (const m of worn) m.dispose();
    worn = [];
    wornHair = id;
    for (const m of ownHair) m.setEnabled(id === ownHairId);
    const option = manifest.looks[body].hair.find((h) => h.id === id);
    if (id === ownHairId || !option?.file || !character.skeleton) return;
    const part = await LoadAssetContainerAsync(`${CHARACTERS}${option.file}`, scene);
    if (wornHair !== id) return; // another style was chosen while this one loaded
    part.addAllToScene();
    const parent = ownHair[0]?.parent ?? character.model;
    const hair = part.meshes.filter((m) => m.skeleton);
    for (const m of hair) {
      // Same bones, order and inverse bind matrices as the hero (ART_PIPELINE.md §8).
      m.skeleton = character.skeleton;
      m.parent = parent;
    }
    for (const s of part.skeletons) s.dispose();
    for (const n of part.transformNodes) n.dispose();
    part.meshes.find((m) => m.name === '__root__')?.dispose();
    worn = hair;
    bakeSliders(worn, sliders);
  };

  return {
    async wear(looks) {
      sliders = looks.sliders;
      character.root.scaling.setAll(looks.height);
      bakeSliders(character.meshes, sliders);
      const skinFile = manifest.looks[body].skins.find((s) => s.id === looks.skin)?.file;
      if (skin && skinFile) skin.albedoTexture = texture(skinFile, false, skin.albedoTexture);
      const eyeFile = manifest.looks[body].eyes.find((e) => e.id === looks.eyes)?.file;
      if (eyes && eyeFile) eyes.albedoTexture = texture(eyeFile, true, eyes.albedoTexture);
      await wearHair(looks.hair);
      bakeSliders(worn, sliders);
    },
  };
}
