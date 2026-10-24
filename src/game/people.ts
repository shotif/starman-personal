import type { AssetContainer } from '@babylonjs/core/assetContainer';
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
  { name: string; body: Body; lineage: string; skin: string; hair: string; eyes: string; height?: number }
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
    skin: 'tone1',
    hair: 'short',
    eyes: 'blue',
    height: 0.98,
  },
  ilya: { name: 'Ilya', body: 'man', lineage: 'spacer', skin: 'tone2', hair: 'long', eyes: 'green' },
};

/** The looks of a named person, from the manifest's options. */
export function looksOf(manifest: Manifest, id: string): Looks {
  const spec = CAST_LOOKS[id];
  if (!spec) return defaultLooks(manifest, 'man');
  const looks = applyLineage(manifest, defaultLooks(manifest, spec.body), spec.lineage);
  return {
    ...looks,
    name: spec.name,
    skin: spec.skin,
    hair: spec.hair,
    eyes: spec.eyes,
    height: spec.height ?? looks.height,
  };
}

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
  if (templates[looks.body]) await wardrobe(scene, character, manifest, looks.body).wear(looks);
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
