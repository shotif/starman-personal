import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
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

/** Sets every slider a mesh has a morph for; speech and the eyes are left alone. */
function setSliders(meshes: readonly AbstractMesh[], sliders: Record<string, number>): void {
  for (const mesh of meshes) {
    const manager = mesh.morphTargetManager;
    if (!manager) continue;
    for (let i = 0; i < manager.numTargets; i++) {
      const target = manager.getTarget(i);
      const value = sliders[target.name];
      if (value !== undefined) target.influence = value;
    }
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
    setSliders(worn, sliders);
  };

  return {
    async wear(looks) {
      sliders = looks.sliders;
      character.root.scaling.setAll(looks.height);
      setSliders(character.meshes, sliders);
      const skinFile = manifest.looks[body].skins.find((s) => s.id === looks.skin)?.file;
      if (skin && skinFile) skin.albedoTexture = texture(skinFile, false, skin.albedoTexture);
      const eyeFile = manifest.looks[body].eyes.find((e) => e.id === looks.eyes)?.file;
      if (eyes && eyeFile) eyes.albedoTexture = texture(eyeFile, true, eyes.albedoTexture);
      await wearHair(looks.hair);
      setSliders(worn, sliders);
    },
  };
}
