import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { wardrobe } from './appearance.ts';
import { type Character, spawnCharacter } from './characters.ts';
import { applyLineage, type Body, defaultLooks, type Looks, type Manifest } from './looks.ts';
import { turnTowards, yawOf } from './motion.ts';
import type { AgentHandle, Navigation } from './navigation.ts';
import { poseWeights } from './pose.ts';

/**
 * The people of Calder Station who are not companions (SLICE.md): the chief, Pell, the night shift.
 * Each stands at a mark until the story moves them; they talk, walk to a mark (and board the ship,
 * which takes them from view), follow the hero when escorted, and lie where they fell if lost.
 */
export interface Person {
  readonly id: string;
  readonly name: string;
  readonly character: Character;
  /** The conversation they will have when the hero talks to them, or null. */
  talk: string | null;
  readonly visible: boolean;
  readonly lost: boolean;
  feet(): Vector3;
  place(at: Vector3, yaw: number): void;
  /** Walks to a point; `vanish` takes them from view when they arrive (aboard the ship). */
  walkTo(at: Vector3, vanish: boolean): void;
  follow(on: boolean): void;
  converse(facing: Vector3 | null, speaking: boolean): void;
  show(visible: boolean): void;
  /** Lost in the fight: they lie where they fell, for good. */
  fall(): void;
  update(dt: number, heroFeet: Vector3, heroForward: Vector3, index: number): void;
}

/** How each named person looks (bodies from the creator's options; CREATOR.md). */
export const CAST_LOOKS: Record<
  string,
  {
    name: string;
    body: Body;
    lineage: string;
    skin: string;
    hair: string;
    eyes: string;
    height?: number;
    /** Sliders beyond the lineage's: `age_old` for the older (D-65). */
    sliders?: Record<string, number>;
  }
> = {
  ren: { name: 'Ren', body: 'woman', lineage: 'earthborn', skin: 'tone5', hair: 'braid', eyes: 'brown' },
  jo: { name: 'Jo', body: 'woman', lineage: 'spacer', skin: 'tone2', hair: 'short', eyes: 'grey', height: 0.97 },
  hale: {
    name: 'Hale',
    body: 'man',
    lineage: 'heavyworlder',
    skin: 'tone3',
    hair: 'shaved',
    eyes: 'grey',
    height: 1.02,
    sliders: { age_old: 0.45 },
  },
  pell: { name: 'Pell', body: 'man', lineage: 'spacer', skin: 'tone4', hair: 'cropped', eyes: 'brown' },
  dena: {
    name: 'Dena',
    body: 'woman',
    lineage: 'heavyworlder',
    skin: 'tone3',
    hair: 'bun',
    eyes: 'hazel',
    height: 0.96,
  },
  sorrel: {
    name: 'Sorrel',
    body: 'man',
    lineage: 'earthborn',
    skin: 'old1',
    hair: 'short-grey',
    eyes: 'blue',
    height: 0.98,
    sliders: { age_old: 1 },
  },
  ilya: { name: 'Ilya', body: 'man', lineage: 'spacer', skin: 'tone2', hair: 'long', eyes: 'green' },
  // Pyre Remnant (PYRE.md): the doctor and her brother share their family's skin and eyes.
  mira: { name: 'Mira', body: 'woman', lineage: 'spacer', skin: 'tone3', hair: 'ponytail', eyes: 'grey' },
  joost: { name: 'Joost', body: 'man', lineage: 'spacer', skin: 'tone3', hair: 'long', eyes: 'grey' },
  linde: {
    name: 'Linde',
    body: 'man',
    lineage: 'earthborn',
    skin: 'old1',
    hair: 'cropped-grey',
    eyes: 'blue',
    height: 0.97,
    sliders: { age_old: 1 },
  },
  ruth: {
    name: 'Ruth',
    body: 'woman',
    lineage: 'heavyworlder',
    skin: 'tone6',
    hair: 'afro',
    eyes: 'brown',
    sliders: { age_old: 0.3 },
  },
  quaye: {
    name: 'Quaye',
    body: 'man',
    lineage: 'earthborn',
    skin: 'tone5',
    hair: 'cropped',
    eyes: 'brown',
    height: 1.02,
  },
  matti: { name: 'Matti', body: 'man', lineage: 'earthborn', skin: 'tone2', hair: 'cropped', eyes: 'hazel' },
  nell: { name: 'Nell', body: 'woman', lineage: 'earthborn', skin: 'tone2', hair: 'braid', eyes: 'hazel' },
  tilly: {
    name: 'Tilly',
    body: 'woman',
    lineage: 'spacer',
    skin: 'old2',
    hair: 'bun-grey',
    eyes: 'green',
    sliders: { age_old: 0.4 },
  },
  esben: { name: 'Esben', body: 'man', lineage: 'spacer', skin: 'tone1', hair: 'short', eyes: 'grey' },
  lenz: { name: 'Lenz', body: 'man', lineage: 'heavyworlder', skin: 'tone4', hair: 'shaved', eyes: 'brown' },
  // People who do not speak (but the researcher who heckles Quaye).
  crowd1: { name: 'Researcher', body: 'woman', lineage: 'earthborn', skin: 'tone5', hair: 'bun', eyes: 'brown' },
  crowd2: { name: 'Technician', body: 'man', lineage: 'earthborn', skin: 'tone3', hair: 'short', eyes: 'green' },
  crowd3: { name: 'Observer', body: 'woman', lineage: 'spacer', skin: 'tone1', hair: 'long', eyes: 'blue' },
  crowd4: { name: 'Researcher', body: 'man', lineage: 'spacer', skin: 'tone6', hair: 'afro', eyes: 'brown' },
  ref1: { name: 'Grower', body: 'man', lineage: 'heavyworlder', skin: 'tone2', hair: 'cropped', eyes: 'hazel' },
  ref2: { name: 'Grower', body: 'woman', lineage: 'earthborn', skin: 'tone4', hair: 'ponytail', eyes: 'brown' },
  ref3: { name: 'Grower', body: 'man', lineage: 'earthborn', skin: 'tone3', hair: 'short', eyes: 'grey' },
  aud1: { name: 'Auditor', body: 'man', lineage: 'earthborn', skin: 'tone2', hair: 'cropped', eyes: 'grey' },
  aud2: { name: 'Auditor', body: 'woman', lineage: 'spacer', skin: 'tone5', hair: 'bun', eyes: 'brown' },
  dome1: { name: 'Observer', body: 'woman', lineage: 'spacer', skin: 'tone2', hair: 'short', eyes: 'blue' },
  dome2: { name: 'Observer', body: 'man', lineage: 'earthborn', skin: 'tone4', hair: 'cropped', eyes: 'brown' },
};

/** The looks of a named person, from the manifest's options. */
export function looksOf(manifest: Manifest, id: string): Looks {
  const spec = CAST_LOOKS[id];
  if (!spec) return defaultLooks(manifest, 'man');
  const looks = applyLineage(manifest, defaultLooks(manifest, spec.body), spec.lineage);
  return {
    ...looks,
    name: spec.name,
    sliders: { ...looks.sliders, ...spec.sliders },
    skin: spec.skin,
    hair: spec.hair,
    eyes: spec.eyes,
    height: spec.height ?? looks.height,
  };
}

/**
 * What each wears: the shared uniform, tinted by work (station security is the hero's grey). The
 * tint multiplies the uniform's texture, so values above 1 lighten it.
 */
export const COSTUMES: Record<string, [number, number, number]> = {
  ren: [0.72, 1.12, 0.82],
  jo: [1.55, 0.95, 0.55],
  hale: [0.7, 0.92, 0.76],
  pell: [0.72, 0.92, 1.45],
  dena: [1.7, 1.55, 1.28],
  sorrel: [1.25, 0.98, 0.76],
  ilya: [0.7, 1.22, 1.28],
  // Pyre Remnant (D-65): the station's blue, the clinic's white, the archive's brown, the Orchard's
  // earth colours, a trader's red, the dock's orange, and the gold of the Banked.
  mira: [1.9, 1.95, 2],
  joost: [0.72, 0.95, 1.6],
  linde: [1.2, 1.05, 0.85],
  ruth: [0.7, 0.85, 1.5],
  quaye: [1.65, 1.4, 0.88],
  matti: [1.75, 0.95, 0.5],
  nell: [0.95, 1.1, 0.7],
  tilly: [1.4, 0.7, 0.65],
  esben: [1.5, 1.3, 0.85],
  lenz: [0.9, 0.95, 1],
  crowd1: [0.8, 0.95, 1.5],
  crowd2: [1.1, 1.1, 1.25],
  crowd3: [0.85, 1.2, 1.3],
  crowd4: [0.75, 0.9, 1.4],
  ref1: [1, 0.9, 0.65],
  ref2: [0.85, 1.05, 0.7],
  ref3: [1.05, 0.85, 0.7],
  aud1: [2.2, 1.7, 0.8],
  aud2: [2.2, 1.7, 0.8],
  dome1: [0.75, 0.95, 1.55],
  dome2: [0.8, 0.98, 1.5],
};

/** Where people out of the story wait, out of the way: the bunk room's far corner. */
const PARKED = new Vector3(-11.3, 0, 7.3);

/** Dresses a character from a template in a person's looks. */
export async function dress(
  scene: Scene,
  templates: Record<Body, AssetContainer | null>,
  manifest: Manifest,
  id: string,
  looks: Looks,
): Promise<Character> {
  const character = spawnCharacter(scene, templates[looks.body], id);
  if (templates[looks.body]) {
    const clothes = wardrobe(scene, character, manifest, looks.body);
    await clothes.wear(looks);
    character.speak = (level) => clothes.speak(level);
  }
  const tint = COSTUMES[id];
  if (tint) {
    for (const mesh of character.meshes) {
      const material = mesh.material;
      if (material instanceof PBRMaterial && material.name.endsWith(`${looks.body}_suit`)) {
        material.albedoColor = new Color3(...tint);
      }
    }
  }
  return character;
}

export function spawnPerson(
  scene: Scene,
  id: string,
  name: string,
  character: Character,
  nav: Navigation | null,
  groundUnder: (at: Vector3) => number | null,
): Person {
  let yaw = 0;
  let visible = true;
  let lost = false;
  let following = false;
  let target: Vector3 | null = null;
  let vanishOnArrival = false;
  let talking: { facing: Vector3; speaking: boolean } | null = null;
  let homeYaw = 0;
  const anchor = new TransformNode(`${id}-agent`, scene);
  const agent: AgentHandle | null = nav ? nav.addAgent(Vector3.Zero(), anchor, 3.6) : null;
  const feet = () => character.root.position;
  const stand = (here: Vector3) => character.root.position.set(here.x, groundUnder(here) ?? here.y, here.z);

  const person: Person = {
    id,
    name,
    character,
    talk: null,
    get visible() {
      return visible;
    },
    get lost() {
      return lost;
    },
    feet,
    place(at, y) {
      target = null;
      following = false;
      agent?.teleport(at);
      anchor.position.copyFrom(at);
      character.root.position.copyFrom(at);
      yaw = y;
      homeYaw = y;
      character.root.rotation.y = y;
      person.show(true);
    },
    walkTo(at, vanish) {
      following = false;
      target = at.clone();
      vanishOnArrival = vanish;
      agent?.goTo(at);
    },
    follow(on) {
      following = on;
      target = null;
      if (!on) agent?.stop();
    },
    converse(facing, speaking) {
      if (facing && !talking) agent?.stop();
      talking = facing ? { facing, speaking } : null;
    },
    show(v) {
      visible = v;
      character.root.setEnabled(v);
      if (!v) {
        // Out of the story: out of everyone's way too.
        agent?.teleport(PARKED);
        target = null;
        following = false;
      }
    },
    fall() {
      lost = true;
      following = false;
      target = null;
      agent?.stop();
    },
    update(dt, heroFeet, heroForward, index) {
      if (!visible) return;
      const here = agent ? agent.position() : feet();
      stand(here);
      if (lost) {
        character.setPose(poseWeights({ mode: 'down' }), dt);
        return;
      }
      if (talking) {
        yaw = turnTowards(yaw, yawOf(talking.facing.subtract(here)), 8 * dt);
        character.root.rotation.y = yaw;
        character.setPose(poseWeights({ mode: 'talk', speaking: talking.speaking }), dt);
        return;
      }
      if (following && agent) {
        // In a loose line behind the hero, each a little further back.
        const back = 2.2 + index * 0.9;
        const side = (index % 2 ? 1 : -1) * 0.8;
        const spot = heroFeet
          .subtract(heroForward.scale(back))
          .add(new Vector3(heroForward.z * side, 0, -heroForward.x * side));
        if (Vector3.Distance(spot, here) > 1.2) agent.goTo(spot);
      }
      if (target && Vector3.Distance(new Vector3(target.x, here.y, target.z), here) < 0.6) {
        target = null;
        if (vanishOnArrival) person.show(false);
      }
      const velocity = agent ? agent.velocity() : Vector3.Zero();
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > 0.3) yaw = turnTowards(yaw, yawOf(velocity), 8 * dt);
      else if (!following && !target) yaw = turnTowards(yaw, homeYaw, 3 * dt);
      character.root.rotation.y = yaw;
      character.setPose(poseWeights({ mode: 'move', speed }), dt);
    },
  };
  return person;
}
