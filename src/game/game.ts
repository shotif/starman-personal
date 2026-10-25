import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import {
  CharacterSupportedState,
  type CharacterSurfaceInfo,
  PhysicsCharacterController,
} from '@babylonjs/core/Physics/v2/characterController';
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { Scene } from '@babylonjs/core/scene';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import slice from '../../story/slice.ink';
import { buildAbilities, type Foes } from './abilities.ts';
import { ASSIST_CONE, pickAssistTarget } from './aim.ts';
import { CHARACTERS } from './appearance.ts';
import { buildAtmosphere } from './atmosphere.ts';
import type { GameAudio, Playing, Voice } from './audio.ts';
import { BANKED_GROUP, type BankedGroup, buildBanked } from './banked.ts';
import { coverPoints } from './banked-rules.ts';
import { type Character, loadCharacterTemplate } from './characters.ts';
import { buildRange } from './combat.ts';
import { type Companion, spawnCompanion } from './companion.ts';
import { type Conversation, type Line, StoryRunner } from './conversation.ts';
import { COVER, type CoverProbe, type CoverState, coverStep } from './cover.ts';
import {
  type Defences,
  DIFFICULTY,
  type Difficulty,
  helpedUp,
  personDefences,
  recover,
  restored,
  takeHit,
} from './defences.ts';
import { type Command, Director } from './director.ts';
import { type Fight, fightStep, startFight, type Wave } from './encounters.ts';
import { createEngine, gpuName, type Renderer, rendererName } from './engine.ts';
import { type Condition, conditionStep, FALLING, fall, needsHelp } from './falling.ts';
import {
  COMPANION_POWERS,
  type CompanionGrowth,
  companionAuto,
  type Growth,
  gainOnce,
  levelOf,
  type Modifiers,
  modifiers,
  newCompanionGrowth,
  rankOf,
  sound as soundGrowth,
  XP_BEFORE,
} from './growth.ts';
import { Input } from './input.ts';
import { modelsAt } from './kit.ts';
import { buildLantern } from './lantern.ts';
import type { Body, Looks, Manifest } from './looks.ts';
import { pay, spend } from './money.ts';
import { buildSwarm } from './motes.ts';
import {
  cameraDistance,
  cameraFraming,
  cameraRelative,
  closeFade,
  SPEED,
  targetSpeed,
  turnTowards,
  type Vec3Like,
  yawOf,
} from './motion.ts';
import { createNavigation, type Navigation } from './navigation.ts';
import { dress, looksOf, type Person, spawnPerson } from './people.ts';
import { knotOf, PEOPLE_OF, type PlaceId, placeOf } from './places.ts';
import { poseWeights } from './pose.ts';
import { atRank, type Cooldowns, cool, ready as isReady, POWERS, type PowerId, type PowerSpec } from './powers.ts';
import { buildPyre } from './pyre.ts';
import { QUALITY, type QualityTier } from './quality.ts';
import { overShoulder, type Point, type Shot, sideOf } from './shots.ts';
import { buildStation, type Mark } from './station.ts';
import { hitSide } from './swarm.ts';
import {
  carriedWeight,
  damageAt,
  fitted,
  KINDS,
  type Kit,
  MODS,
  type ModId,
  modsOn,
  soundKit,
  spreadAfter,
  swap as swapKit,
  take,
  WEAPONS,
  type WeaponKind,
  weightScale,
} from './weapons.ts';

export interface GameStats {
  fps: number;
  renderer: string;
  /** The graphics chip, where the browser tells it. */
  gpu: string;
  tier: QualityTier;
  activeMeshes: number;
}

/** The hero's and the companions' shields and health, for the screen (D-42). */
export interface Vitals {
  shield: number;
  health: number;
  companions: { name: string; shield: number; health: number; down: boolean }[];
  /** Down and waiting for help, with seconds left, or rising, or up. */
  condition: Condition;
  helpComing: boolean;
  inCover: boolean;
  /** The hero's three powers: how far each is from ready (0 ready, 1 just used). */
  powers: { id: PowerId; name: string; waiting: number }[];
  /** The weapon in hand, and the other carried, by name. */
  weapon: { name: string; other: string | null };
  /** The hero's own effects now running. */
  effects: string[];
}

/** What the hero can do where they stand: talk to someone, or use something. */
export interface Prompt {
  kind: 'talk' | 'use';
  label: string;
}

/** What the player chose, for the end of the slice. */
export interface Ending {
  /** The chapter the story had reached (its checkpoint). */
  chapter: string;
  tookMast: boolean;
  merrowWarned: boolean;
  ilyaLost: boolean;
  firstLead: string;
  /** Ilya's readings came aboard (he brought them, or Dena did). */
  haveCurve: boolean;
  renApproval: number;
  joApproval: number;
  /** Pyre Remnant (PYRE.md): what became of the Orchard's people, and what was saved. */
  unlisted: string;
  pyreSaved: string;
}

/** A saved game: the hero, the story's state at its last checkpoint, and the difficulty. */
export interface SaveData {
  version: 1;
  looks: Looks;
  story: string;
  checkpoint: string;
  difficulty: Difficulty;
  at: number;
  /** Where the hero is: the place to build when the game resumes (Calder when missing). */
  place?: PlaceId;
  /** Which script the story's state belongs to; a save from another resumes at its checkpoint. */
  script?: string;
  /** The hero's growth and the companions' (ACT1.md, increment 3); a save from before it is given its chapter's. */
  growth?: SavedGrowth;
  /** The weapons and mods the hero has, and the two carried (D-56). */
  kit?: Kit;
}

export interface SavedGrowth {
  hero: Growth;
  crew: Record<string, CompanionGrowth>;
}

/** A short fingerprint of the compiled script (FNV-1a), to tell saves from an older one. */
const SCRIPT = (() => {
  let h = 0x811c9dc5;
  for (let i = 0; i < slice.length; i++) h = Math.imul(h ^ slice.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
})();

/** The orders of the command view (ORDERS.md). */
export type OrderKind = 'go' | 'attack' | 'follow';

export interface Game {
  input: Input;
  /** Opens or closes the command view, where time nearly stops. */
  setCommandView(open: boolean): void;
  /** Gives an order about what the crosshair points at to one companion (by name) or all, and closes the command view. */
  order(kind: OrderKind, who?: string): void;
  /** Talks to whoever, or uses whatever, the prompt names. */
  interact(): void;
  /** Uses the hero's power in slot 0, 1 or 2 (COMBAT.md). */
  usePower(slot: number): void;
  /** Who is speaking now, so they gesture and the camera knows. */
  setSpeaker(who: 'hero' | 'partner' | null): void;
  endConversation(): void;
  /** The player goes on from a chapter's card (the end of the prologue). */
  continueStory(): void;
  /** The engine, for the star map's own scene on the same drawing context (src/game/mapScene.ts). */
  engine: AbstractEngine;
  /** The star map takes the screen (the place stops drawing, and so its time), or gives it back. */
  showMap(view: { render(): void } | null): void;
  /** A course set on the star map, to a lead (`pyre`): the story waits for it. */
  setCourse(id: string): void;
  /**
   * The hero's growth and the companions', for the growth screen: `fighting` while changes wait, and
   * the companions met so far.
   */
  growth(): SavedGrowth & { fighting: boolean; crewKnown: string[] };
  /** Applies the growth screen's changes (made by growth.ts's rules); false during a fight. */
  setGrowth(next: SavedGrowth): boolean;
  /** The weapons, mods and credits, for the armoury and the trader; `fighting` while changes wait. */
  kit(): { kit: Kit; fighting: boolean; makeDo: boolean };
  /** Applies the armoury's changes (made by weapons.ts's rules); false during a fight. */
  setKit(next: Kit): boolean;
  /** The other carried weapon to hand. */
  swapWeapon(): void;
  setDifficulty(difficulty: Difficulty): void;
  /** Stops the game's time (the pause menu), or starts it again. */
  setPaused(paused: boolean): void;
  /** A conversation's line is on screen: its voice plays, the speaker's mouth moves. Seconds long, or null. */
  speak(line: {
    speaker: string;
    id: string | null;
    codex?: string;
    xp?: number;
    why?: string;
    spend?: number;
  }): number | null;
  /** Stops the voice now speaking (a line skipped). */
  hush(): void;
  /** The companions with the hero now. */
  companions(): string[];
  dispose(): void;
}

export interface GameOptions {
  tier: QualityTier;
  /** The hero the player made (CREATOR.md). */
  looks: Looks;
  manifest: Manifest;
  renderer: Renderer;
  /** Aim assist turns shots towards a nearby target (D-17: on phones). */
  assist: boolean;
  difficulty: Difficulty;
  /** The sound system, shared with the title (src/game/audio.ts). */
  audio: GameAudio;
  /** A saved game to resume, or null for a new one. */
  save: SaveData | null;
  /** For testing: start at a chapter of the slice (a stitch of `slice`). */
  chapter?: string | null;
  /** The place to build (only one is in memory at a time); otherwise the save's, or the chapter's. */
  place?: PlaceId;
  onStats(stats: GameStats): void;
  onReady(): void;
  /** Called when the hero starts or stops aiming, to show the crosshair. */
  onAim(aiming: boolean): void;
  /** Someone says something in the world (a companion, a voice on the comms). */
  onSay(name: string, line: string, id: string | null): void;
  /** A brief note on the screen ("No target.", "Combination!"). */
  onNote(text: string): void;
  onPrompt(prompt: Prompt | null): void;
  /** A conversation starts: the screen shows it, and calls `setSpeaker` and `endConversation`. */
  onConversation(conversation: Conversation, partner: string): void;
  onObjective(text: string | null): void;
  onCaption(text: string): void;
  onHint(id: string): void;
  /** A shot hit the hero, from this edge of the screen (COMBAT.md). */
  onHit(side: 'front' | 'back' | 'left' | 'right'): void;
  onVitals(vitals: Vitals): void;
  /** The screen fades to black, or back. */
  onFade(black: boolean): void;
  /** A save to keep; `quiet` when only growth changed, with no sound or note. */
  onSave(save: SaveData, quiet?: boolean): void;
  onEnd(ending: Ending): void;
  /** A chapter's card, between parts of the story (`prologue`); the story waits for `continueStory`. */
  onCard(card: string, ending: Ending): void;
  /**
   * The story moves the hero to another place: this game is done, and a new one should start from
   * this save, in that place, behind its loading painting.
   */
  onTravel(save: SaveData): void;
  /** The story opened an entry of the codex (src/game/codex.ts). */
  onCodex(id: string): void;
  /**
   * A screen was opened from the world: the star map (which calls `showMap` and `setCourse`), or the
   * armoury (which calls `setKit`).
   */
  onScreen(id: string): void;
  /** A level reached, and the powers it brought (by name). */
  onLevel(level: number, powers: string[]): void;
  /** The growth changed: the points the hero and the companions have to spend. */
  onGrowth(points: number): void;
  /** A white flash (the lane taking the ship). */
  onFlash(): void;
  /** A shot the player watches (the ship leaving): the controls and the powers step aside. */
  onShot(on: boolean): void;
}

const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.35;
/** How far ahead the cover is looked for while in it: as far as it can be taken from, and a little. */
const COVER_AHEAD = COVER.reach + CAPSULE_RADIUS + 0.15;
/** The hero's capsule's collision group, and every group but it (Havok's 32-bit masks). */
const HERO_GROUP = 2;
/** People's bodies: the hero bumps into them; shots, sight lines and the camera pass them. */
const PEOPLE_GROUP = 4;
const ALL_BUT_PEOPLE = 0xffffffff - PEOPLE_GROUP;
const ALL_BUT_HERO = 0xffffffff - HERO_GROUP - PEOPLE_GROUP;
/** Walls and cover only: what stops a Banked shot or sight line (people and the Banked pass). */
const WALLS_ONLY = ALL_BUT_HERO - BANKED_GROUP;
const GRAVITY = new Vector3(0, -18, 0);
const vector = (p: Point) => new Vector3(p.x, p.y, p.z);
/** The middle of the head above the feet, for a character of standard height. */
const HEAD_HEIGHT = 1.6;
/** How near the hero must be to talk to someone, or use something. */
const TALK_REACH = 3;
const USE_REACH = 1.9;
const UP = Vector3.Up();
const DOWN = Vector3.Down();
const CAMERA = { minDistance: 0.3, eye: 1.55, coverEye: 1.05, minBeta: 0.55, maxBeta: 1.85, fov: 0.95, aimFov: 0.72 };
/** Seconds between shots, and how long the shooting clip shows after each. */
const SHOT_POSE = 0.18;
const SHOT_RANGE = 60;
/** The chapters before Jo is met in the hangar. */
const BEFORE_JO = ['night_shift', 'range', 'to_control', 'control', 'concourse', 'mast', 'escort', 'gate'];
/** How long *Lantern*'s leaving is watched: breaking orbit, the lane's flash, and a moment in it. */
const DEPART_SECONDS = 8.5;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** How fast time runs in the command view. */
const COMMAND_TIME = 0.05;
const LIFTOFF_SECONDS = 8;
/** Without aim, a power takes the nearest target within this angle of where the hero faces (70°). */
const POWER_CONE_COS = Math.cos((70 * Math.PI) / 180);
/**
 * The sidearm in the hand: its length, and how it sits in the hand bone. Solved from the aiming pose
 * so the barrel runs along the forearm, upright, with the grip in the palm (the gun model's barrel
 * is its +x and its top +y); a probe looked at it from four sides.
 */
const SIDEARM = {
  length: 0.21,
  rotation: [0.093, -1.141, 1.672] as [number, number, number],
  offset: [-0.01, -0.125, -0.008] as [number, number, number],
};
/** Each weapon's model in the hand: its length, and how far it slides forward to put its grip in the hand. */
const HELD: Record<WeaponKind, { length: number; along: number; lift: number }> = {
  pistol: { length: SIDEARM.length, along: 0, lift: 0.03 },
  rifle: { length: 0.95, along: 0.17, lift: 0.07 },
  shotgun: { length: 0.9, along: 0.12, lift: 0.06 },
  marksman: { length: 1.15, along: 0.22, lift: 0.06 },
};
/** Who speaks a line, by the name its tag gives, in the cast. */
const SPEAKERS: Record<string, string> = {
  Ren: 'ren',
  Jo: 'jo',
  Hale: 'hale',
  Pell: 'pell',
  Dena: 'dena',
  Sorrel: 'sorrel',
  Ilya: 'ilya',
  hero: 'hero',
  // Pyre Remnant (PYRE.md).
  Mira: 'mira',
  Linde: 'linde',
  Ruth: 'ruth',
  Quaye: 'quaye',
  Matti: 'matti',
  Nell: 'nell',
  Tilly: 'tilly',
  Joost: 'joost',
  Esben: 'esben',
  Lenz: 'lenz',
  Researcher: 'crowd4',
  Auditor: 'aud1',
};
/** The ambience of each place. */
const AMBIENCE: Record<string, string> = {
  catwalk: 'wind',
  mast: 'wind',
  hangar: 'ambience_hangar',
  engineering: 'ambience_hangar',
  dock: 'ambience_hangar',
  freight_way: 'ambience_hangar',
  landing: 'ambience_hangar',
};
/** People farther than this from the camera are neither drawn nor moved (a phone's crowd). */
const PEOPLE_REACH = 34;
/** After a companion's help, this long before shots count again. */
const GRACE_SECONDS = 2.5;
/** The strike: two blows, how far they reach from the chest, and what each does (COMBAT.md). */
const MELEE = { seconds: 0.78, reach: 2.8, damage: 50 };
/** The dodge: how fast, how long (shots pass through it), and how soon it can come again. */
const DODGE = { speed: 9, seconds: 0.38, cooldown: 0.7 };

export async function startGame(canvas: HTMLCanvasElement, options: GameOptions): Promise<Game> {
  const q = QUALITY[options.tier];
  const engine = await createEngine(canvas, options.tier, options.renderer);
  const applyScaling = () =>
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));

  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  const physics = new HavokPlugin(true, havok);
  scene.enablePhysics(GRAVITY, physics);

  const placeId: PlaceId = options.place ?? options.save?.place ?? placeOf(options.save?.checkpoint ?? options.chapter);
  const place =
    placeId === 'lantern' ? buildLantern(scene, q) : placeId === 'pyre' ? buildPyre(scene, q) : buildStation(scene, q);
  let difficulty = options.difficulty;
  const audio = options.audio;
  /** The voice speaking now, and whose mouth it moves. */
  let voiceNow: { voice: Voice; who: Character | null } | null = null;
  /** The music the chapter asks for; a fight's music overrides it while the fight lasts. */
  let chapterMusic: string | null = null;
  let alarm: Playing | null = null;
  let heartbeat: Playing | null = null;
  /** The swarm's hum, while machines fly. */
  let hum: Playing | null = null;
  let stepDistance = 0;
  const ray = new PhysicsRaycastResult();
  /**
   * Distance to the first thing a ray meets, its point and normal; null if it meets nothing.
   * `pastHero` looks through the hero's own capsule; every ray looks through people's bodies.
   */
  const cast = (from: Vector3, to: Vector3, pastHero = false, mask?: number) => {
    physics.raycast(from, to, ray, { collideWith: mask ?? (pastHero ? ALL_BUT_HERO : ALL_BUT_PEOPLE) });
    return ray.hasHit
      ? {
          distance: Vector3.Distance(from, ray.hitPointWorld),
          point: ray.hitPointWorld.clone(),
          normal: ray.hitNormalWorld.clone(),
          body: ray.body,
        }
      : null;
  };
  /**
   * The height of the ground under a point near it, or null with none within reach (falling).
   * Havok's character controller keeps its capsule a few centimetres clear of every surface, and the
   * navigation mesh lies up to a voxel above the floor: either alone left the characters standing
   * on air (seen on the owner's phone, 24 October 2026). The feet are put on the floor itself.
   */
  const groundUnder = (at: Vector3) => {
    const hit = cast(new Vector3(at.x, at.y + 0.25, at.z), new Vector3(at.x, at.y - 0.3, at.z), true);
    return hit ? hit.point.y : null;
  };

  // The cast: the hero the player made, the companions and the people of the station.
  const templates: Record<Body, Awaited<ReturnType<typeof loadCharacterTemplate>>> = {
    man: null,
    woman: null,
  };
  [templates.man, templates.woman] = await Promise.all([
    loadCharacterTemplate(scene, `${CHARACTERS}${options.manifest.bodies.man.file}`),
    loadCharacterTemplate(scene, `${CHARACTERS}${options.manifest.bodies.woman.file}`),
  ]);
  // The companions (Mira once she can have joined, PYRE.md) and the people of this place only.
  const crewIds = placeId === 'calder' ? ['ren', 'jo'] : ['ren', 'jo', 'mira'];
  const peopleIds = PEOPLE_OF[placeId];
  const others = [...crewIds, ...peopleIds];
  const [hero, ...dressed] = await Promise.all([
    dress(scene, templates, options.manifest, 'hero', options.looks),
    ...others.map((id) => dress(scene, templates, options.manifest, id, looksOf(options.manifest, id))),
  ]);
  const characters: Record<string, Character> = { hero };
  others.forEach((id, i) => {
    const c = dressed[i];
    if (c) characters[id] = c;
  });
  for (const c of [hero, characters.ren, characters.jo]) for (const mesh of c?.meshes ?? []) place.castShadow(mesh);
  // The sidearm (the style test's Meshy model) in the hands of those who fight.
  // It is drawn only in a fight, or while the hero aims: nobody carries a gun to the galley.
  /** The weapons and mods (D-56), and how long the trigger has been held (the rifle strays). */
  let kit: Kit = soundKit(options.save?.kit, options.looks.heroClass);
  let triggerHeld = 0;
  const weaponNow = () => fitted(kit.carried[0], modsOn(kit, kit.carried[0]));
  // The hero has the long guns too (D-56): each its own Meshy model, the one in hand drawn.
  const grips: { hero: boolean; node: TransformNode; kind: WeaponKind }[] = [];
  /** The hero's shots come from the weapon in hand. */
  const wieldNow = () => {
    const g = grips.find((x) => x.hero && x.kind === kit.carried[0]);
    if (g) hero.wield(g.node, HELD[g.kind].length);
  };
  void LoadAssetContainerAsync(`${import.meta.env.BASE_URL}assets/props/sidearm-meshy.glb`, scene)
    .then((gun) => {
      for (const c of [hero, characters.ren, characters.jo]) {
        const node = c?.hold(gun, SIDEARM.length, SIDEARM.rotation, SIDEARM.offset, 0, false, HELD.pistol.lift);
        if (node) grips.push({ hero: c === hero, node, kind: 'pistol' });
        node?.setEnabled(false);
      }
      wieldNow();
    })
    .catch(() => {
      // No sidearm: empty hands still fire.
    });
  for (const kind of ['rifle', 'shotgun', 'marksman'] as const) {
    void LoadAssetContainerAsync(`${modelsAt(q.detailMaps)}${kind}.glb`, scene)
      .then((gun) => {
        const held = HELD[kind];
        // The long guns' files face +Z; the sidearm's (the style test's) faces the other way.
        const node = hero.hold(gun, held.length, SIDEARM.rotation, SIDEARM.offset, held.along, true, held.lift);
        if (node) grips.push({ hero: true, node, kind });
        node?.setEnabled(false);
        wieldNow();
      })
      .catch(() => {
        // Not loaded: the shots still come, from the hand.
      });
  }

  const controller = new PhysicsCharacterController(
    place.heroStart.at.add(new Vector3(0, CAPSULE_HEIGHT / 2 + 0.05, 0)),
    { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
    scene,
  );
  // The controller's capsule is a body rays can meet. It has a group of its own, so the swarm's rays
  // can look past it to the hero (COMBAT.md) while walls and cover still stop them.
  controller.shape.filterMembershipMask = HERO_GROUP;

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.2, 3.4, place.heroStart.at.clone(), scene);
  camera.inputs.clear();
  camera.minZ = 0.05;
  camera.maxZ = 5000;
  camera.fov = CAMERA.fov;
  const atmosphere = buildAtmosphere(scene, camera, options.tier);
  let lightsAreOut = false;
  /** The player's view round the hero; a conversation or a scene takes the camera, and hands it back. */
  const orbit = { alpha: -Math.PI / 2 - place.heroStart.yaw, beta: 1.32 };
  /** Puts the camera at `position`, looking at `target`. */
  const aimCamera = (position: Vector3, target: Vector3) => {
    const v = position.subtract(target);
    const r = v.length() || 1e-3;
    // Keep the camera's angles as its target moves: plain `target =` would re-aim it from where it
    // stood, turning it a little every frame, and the hero, walking "forward", would drift.
    camera.setTarget(target, false, false, true);
    camera.alpha = Math.atan2(v.z, v.x);
    camera.beta = Math.acos(Math.min(1, Math.max(-1, v.y / r)));
    camera.radius = r;
  };

  const range = buildRange(scene, place.drones, q.maxLights);
  range.onShot = (from, shooter) => {
    // The companions' sidearms have a voice of their own, so the player hears who fired; the hero's
    // heavier weapons sound deeper (until each has a sound of its own).
    const pitch: Record<WeaponKind, { rate: number; volume: number }> = {
      pistol: { rate: 1, volume: 1 },
      rifle: { rate: 1.15, volume: 0.8 },
      shotgun: { rate: 0.7, volume: 1.2 },
      marksman: { rate: 0.6, volume: 1.2 },
    };
    const p = shooter === 0 ? pitch[kit.carried[0]] : { rate: 1, volume: 0.8 };
    audio.play(shooter === 0 ? 'pistol' : 'pistol_ally', { at: from, volume: p.volume, rate: p.rate });
  };
  const swarm = buildSwarm(scene, q.maxLights, q.detailMaps);
  range.join(swarm);
  const input = new Input(canvas);

  let nav: Navigation | null = null;
  const navStarted = performance.now();
  try {
    nav = await createNavigation(scene, place.navigationMeshes);
  } catch (error) {
    console.warn('Navigation could not start; companions only follow.', error);
  }
  const navMilliseconds = Math.round(performance.now() - navStarted);
  // The Banked (ACT1.md increment 4), where a place has them, or called onto the range with
  // `?banked`: a squad of people who fight from cover. They join the range after the swarm, so the
  // powers' one list of foes is the swarm's machines and then the Banked.
  const banked: BankedGroup | null =
    placeId === 'pyre' || new URLSearchParams(location.search).has('banked')
      ? await buildBanked(scene, {
          templates,
          manifest: options.manifest,
          nav,
          groundUnder,
          covers: coverPoints(place.props),
          areaOf: (at) => place.areaAt(at),
          detailed: q.detailMaps,
        })
      : null;
  if (banked) range.join(banked);
  const foes: Foes = {
    get size() {
      return swarm.size + (banked?.size ?? 0);
    },
    status: (i) => (i < swarm.size ? swarm.status(i) : (banked?.status(i - swarm.size) ?? null)),
    strikeMachine: (i, d, by) =>
      i < swarm.size ? swarm.strikeMachine(i, d, by) : (banked?.strikeMachine(i - swarm.size, d, by) ?? false),
    affect: (i, e, seconds, towards) =>
      i < swarm.size ? swarm.affect(i, e, seconds, towards) : banked?.affect(i - swarm.size, e, seconds, towards),
    burst: (at, r, d, by) => swarm.burst(at, r, d, by) + (banked?.burst(at, r, d, by) ?? 0),
    unprime: (i) => (i < swarm.size ? swarm.unprime(i) : banked?.unprime(i - swarm.size)),
  };
  const world = {
    range,
    cast: (a: Vector3, b: Vector3) => cast(a, b),
    groundUnder,
    power: (name: string, target: number, eye: Vector3) => companionPower(name, target, eye),
  };
  const sayAs = (name: string) => (line: string) => options.onSay(name, line, null);
  const ren = spawnCompanion(
    scene,
    'Ren',
    nav,
    characters.ren ?? hero,
    place.marks.ren?.at ?? Vector3.Zero(),
    world,
    sayAs('Ren'),
  );
  const jo = spawnCompanion(scene, 'Jo', nav, characters.jo ?? hero, new Vector3(-11.3, 0, 6), world, sayAs('Jo'));
  jo.show(false);
  const mira = characters.mira
    ? spawnCompanion(scene, 'Mira', nav, characters.mira, new Vector3(-11.3, 0, 6), world, sayAs('Mira'))
    : null;
  mira?.show(false);
  const companionsById: Record<string, Companion> = mira ? { ren, jo, mira } : { ren, jo };
  /** Companions with the hero: Ren from the start, Jo once she joins. */
  const joined = new Set<Companion>([ren]);
  const people: Record<string, Person> = {};
  for (const id of peopleIds) {
    const c = characters[id];
    if (!c) continue;
    people[id] = spawnPerson(scene, id, looksOf(options.manifest, id).name, c, nav, groundUnder);
  }
  /**
   * A body for each person, moved with them, that only the hero's capsule meets: the hero walked
   * through the crew (the owner's phone, 25 October 2026). Lying down or out of the story, it is
   * put away under the floor.
   */
  const bodies = Object.entries({ ...companionsById, ...people }).map(([id, who]) => {
    const mesh = CreateCapsule(`${id}-body`, { radius: 0.3, height: 1.7 }, scene);
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.position.set(0, -50, 0);
    const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 1 }, scene);
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    aggregate.body.disablePreStep = false;
    aggregate.shape.filterMembershipMask = PEOPLE_GROUP;
    aggregate.shape.filterCollideMask = HERO_GROUP;
    const standing = () =>
      who.character.root.isEnabled() && !('lost' in who && who.lost) && !('down' in who && who.down);
    return { mesh, who, standing };
  });
  const moveBodies = () => {
    for (const b of bodies) {
      const root = b.who.character.root;
      if (b.standing()) b.mesh.position.set(root.position.x, root.position.y + 0.85, root.position.z);
      else b.mesh.position.set(root.position.x, -50, root.position.z);
    }
  };
  // The walkers step round the hero, too: a place in their crowd that follows the hero.
  const heroInCrowd = nav ? nav.addAgent(place.heroStart.at, new TransformNode('hero-in-crowd', scene), 0) : null;
  const nameOf = (id: string) => companionsById[id]?.name ?? people[id]?.name ?? id;
  const characterOf = (id: string) => (id === 'hero' ? hero : (companionsById[id]?.character ?? people[id]?.character));

  // The hero's state.
  let heroYaw = place.heroStart.yaw;
  const desired = new Vector3();
  const heroForward = new Vector3(Math.sin(heroYaw), 0, Math.cos(heroYaw));
  let cover: CoverState = { inCover: false };
  let aimBlend = 0;
  let coverBlend = 0;
  let wasAiming = false;
  let fireCooldown = 0;
  let shotPose = 0;
  // Growth (ACT1.md, increment 3): the hero's, kept in saves; a save from before it is given what its
  // chapter had reached.
  const heroClass = options.looks.heroClass;
  const savedGrowth = options.save?.growth;
  let growth: Growth = soundGrowth(
    savedGrowth?.hero ?? (options.save ? { xp: XP_BEFORE[options.save.checkpoint] ?? 0 } : undefined),
    heroClass,
  );
  const crew: Record<string, CompanionGrowth> = {
    ren: savedGrowth?.crew?.ren ?? newCompanionGrowth(),
    jo: savedGrowth?.crew?.jo ?? newCompanionGrowth(),
    mira: savedGrowth?.crew?.mira ?? newCompanionGrowth(),
  };
  for (const who of Object.keys(crew))
    crew[who] = companionAuto(crew[who] ?? newCompanionGrowth(), who, levelOf(growth.xp));
  let mods: Modifiers = modifiers(options.looks, growth.training);
  /** Seconds left of the Striker's momentum after a power. */
  let momentum = 0;
  let heroDefences: Defences = personDefences(mods);
  let condition: Condition = { kind: 'up' };
  let helpUsed = false;
  let helper: Companion | null = null;
  /** Seconds of grace after being helped up: getting up under fire is not a second fall. */
  let grace = 0;
  let commanding = false;
  /** How long the casting arm stays up. The powers in hand are `growth.hand` (D-53). */
  let castPose = 0;
  /** A strike (two blows) or a dodge in progress (COMBAT.md). */
  let strike: { t: number; blows: number } | null = null;
  let dodge: { t: number; dir: Vector3; clip: 'roll' | 'dodge_left' | 'dodge_right' } | null = null;
  let dodgeCooldown = 0;

  // The story.
  const runner = new StoryRunner(slice, {
    name: options.looks.name,
    heroClass: options.looks.heroClass,
    origin: options.looks.origin,
    moment: options.looks.moment,
  });
  /** Conversations people offer, by person. */
  const talkKnots: Record<string, string | null> = {};
  /**
   * Things that can be used, by id; a thing to look at has the knot of the hero's remark, and the
   * star map stays to be used again.
   */
  const usable = new Map<
    string,
    { at: Vector3; label: string; knot?: string; screen?: string; find?: WeaponKind | ModId }
  >();
  /** Remarks to say, one after another, and the seconds before the next. */
  const remarks: Line[] = [];
  let remarkWait = 0;
  let markerTarget: string | null = null;
  let drillFrom: number | null = null;
  let fight: Fight | null = null;
  /** Where everyone stood when the fight began, to start it again from there (D-43). */
  let snapshot: { hero: Vector3; yaw: number; companions: { c: Companion; at: Vector3; yaw: number }[] } | null = null;
  let area: string | null = null;
  /** True while a saved game (or a new one) sets its scene up: `start` commands apply. */
  let resuming = true;
  let liftoff: { t: number } | null = null;
  /** *Lantern* leaving orbit, and the shot that watches it (out of the bridge's window). */
  let departing: { t: number; shot: { from: Vector3; to: Vector3 } | null } | null = null;
  let ended = false;
  /** The last chapter saved, for a save made on the way to another place. */
  let lastCheckpoint = options.save?.checkpoint ?? options.chapter ?? 'night_shift';

  /** A conversation in progress: with whom, who is speaking, and the side of the line the camera keeps. */
  let talking: { id: string; knot: string; speaker: 'hero' | 'partner' | null; side: 1 | -1 } | null = null;
  let talkBlend = 0;
  let lastShot: Shot | null = null;
  let prompt: Prompt | null = null;
  let promptTarget: { kind: 'talk'; id: string } | { kind: 'use'; id: string } | null = null;

  const markOf = (name: string): Mark | null => place.marks[name] ?? null;

  /** Moves the hero at once, facing `yaw`, with the camera behind. */
  const moveHero = (at: Vector3, yaw: number) => {
    controller.setPosition(at.add(new Vector3(0, CAPSULE_HEIGHT / 2 + 0.05, 0)));
    controller.setVelocity(Vector3.Zero());
    hero.root.position.copyFrom(at);
    heroYaw = yaw;
    orbit.alpha = -Math.PI / 2 - yaw;
    orbit.beta = 1.32;
    cover = { inCover: false };
  };

  /** Puts someone at a mark; a companion `behind` the mark stands a little back and to the side. */
  const putAt = (who: string, markName: string, behind = false) => {
    const m = markOf(markName);
    if (!m) return;
    let at = m.at;
    if (behind) {
      const back = new Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
      at = m.at.subtract(back.scale(1.6)).add(new Vector3(back.z, 0, -back.x).scale(-0.9));
    }
    if (who === 'hero') moveHero(at, m.yaw);
    else if (companionsById[who]) companionsById[who]?.place(at, m.yaw);
    else people[who]?.place(at, m.yaw);
  };

  /** The swarm's ids in the range's numbering start after the drones. */
  const swarmFirst = place.drones.length;
  /**
   * A power's target: what the crosshair points at; failing that, the nearest in front of the hero,
   * within reach and in sight. On a phone a thumb on a power button is not aiming, and the camera
   * then looks down at the hero's back: a machine up by the vents was never under it, and Pull
   * always said there was no target (the owner's phone, 25 October 2026).
   */
  const powerTarget = (reach: number, wanted: (id: number) => boolean): number | null => {
    const from = camera.globalPosition.clone();
    const dir = camera.getTarget().subtract(from).normalize();
    const aimed = pickAssistTarget(
      range.candidates(from).filter((c) => wanted(c.id)),
      dir,
      ASSIST_CONE * 1.6,
      reach + 6,
    );
    if (aimed !== null) return aimed;
    const chest = hero.root.position.add(new Vector3(0, 1.3, 0));
    const ahead = new Vector3(-Math.cos(orbit.alpha), 0, -Math.sin(orbit.alpha));
    let best: number | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const c of range.candidates(chest)) {
      if (!wanted(c.id)) continue;
      const offset = new Vector3(c.offset.x, c.offset.y, c.offset.z);
      const d = offset.length();
      if (d > reach || d >= nearest) continue;
      const flat = new Vector3(offset.x, 0, offset.z);
      if (flat.length() > 0.01 && Vector3.Dot(flat.normalize(), ahead) < POWER_CONE_COS) continue;
      const between = cast(chest, chest.add(offset), true);
      if (between && !range.isDrone(c.id, between.body)) continue;
      best = c.id;
      nearest = d;
    }
    return best;
  };
  /** A power as the hero has it: its rank, the training's and talents' changes (growth.ts). */
  const powerSpec = (id: PowerId): PowerSpec => {
    const ranked = atRank(POWERS[id], rankOf(growth, id));
    // What is carried weighs on the powers (D-56).
    const out: PowerSpec = {
      ...ranked,
      cooldown: ranked.cooldown * mods.cooldownScale * weightScale(carriedWeight(kit)),
    };
    if (out.damage?.kind === 'field') out.damage = { ...out.damage, amount: out.damage.amount * mods.fieldDamage };
    if (id === 'mark') out.range *= mods.markReach;
    if (out.heal !== undefined) out.heal *= mods.healScale;
    return out;
  };
  const abilities = buildAbilities({
    scene,
    swarm: foes,
    spec: powerSpec,
    machineAhead: (reach) => {
      const id = powerTarget(reach, (c) => c >= swarmFirst);
      return id === null ? null : id - swarmFirst;
    },
    droneAhead: (reach) => powerTarget(reach, (c) => c < swarmFirst),
    drone: (id) => ({ at: range.centre(id), knockDown: () => range.knockDown(id) }),
    dronesNear: (at, radius) =>
      place.drones
        .map((_, id) => id)
        .filter((id) => range.alive(id) && Vector3.Distance(range.centre(id), at) < radius),
    groundAhead: (reach) => {
      const from = camera.globalPosition.clone();
      const dir = camera.getTarget().subtract(from).normalize();
      const hit = cast(from.add(dir.scale(0.3)), from.add(dir.scale(reach + 6)), true);
      return hit ? hit.point.add(hit.normal.scale(0.2)) : from.add(dir.scale(reach));
    },
    heroChest: () => hero.root.position.add(new Vector3(0, 1.2, 0)),
    heroForward: () => new Vector3(-Math.cos(orbit.alpha), 0, -Math.sin(orbit.alpha)),
    moveHero: (to) => {
      const yaw = heroYaw;
      const beta = orbit.beta;
      const alpha = orbit.alpha;
      moveHero(to, yaw);
      orbit.alpha = alpha;
      orbit.beta = beta;
    },
    rally: (share) => {
      heroDefences = {
        ...heroDefences,
        health: Math.min(heroDefences.healthMax, heroDefences.health + heroDefences.healthMax * share),
        shield: heroDefences.shieldMax,
      };
    },
    sees: (a, b) => {
      const hit = cast(a, b, true);
      return !hit || Vector3.Distance(hit.point, b) < 0.8;
    },
    heal: (amount) => {
      heroDefences = {
        ...heroDefences,
        health: Math.min(heroDefences.healthMax, heroDefences.health + amount * mods.healScale),
      };
    },
    say: (text) => options.onNote(text),
    sound: (id, at) => {
      audio.play(id, { at });
    },
  });
  /** The companions' powers' cooldowns, and how long each is veiled (Ren's Veil). */
  const crewCooldowns: Record<string, Cooldowns> = {};
  const crewVeil: Record<string, number> = {};
  /**
   * A companion's power on the machine she is shooting (D-49: Ren's Mark and Veil, Jo's Overload and
   * Seeker Drone), at her ranks, half again slower than the hero's: Mark on one not marked, Veil when
   * her shield is low, Overload on a shield, a Seeker Drone otherwise. True if she used one.
   */
  function companionPower(name: string, target: number, eye: Vector3): boolean {
    const who = name.toLowerCase();
    const c = companionsById[who];
    if (who === 'mira' && c) return miraSupport(c);
    if (!c || target < swarmFirst) return false;
    const machine = target - swarmFirst;
    const status = foes.status(machine);
    if (!status?.alive) return false;
    const cds = crewCooldowns[who] ?? {};
    const own = COMPANION_POWERS[who] ?? [];
    for (const id of own) {
      if (!isReady(cds, id)) continue;
      const ranked = atRank(POWERS[id], crew[who]?.ranks[id] ?? 1);
      const spec: PowerSpec = { ...ranked, cooldown: ranked.cooldown * 1.5 * mods.companionCooldown };
      if (id === 'veil') {
        if (c.defences.shield > c.defences.shieldMax * 0.3) continue;
        crewVeil[who] = spec.lasts ?? 6;
        audio.play('veil', { at: c.character.root.position, volume: 0.6 });
      } else if (id === 'mark' && status.marked) continue;
      else if (id === 'overload' && !status.shielded && own.includes('seeker') && isReady(cds, 'seeker')) continue;
      else if (!abilities.companionUse(spec, machine, eye)) continue;
      crewCooldowns[who] = { ...cds, [id]: spec.cooldown };
      return true;
    }
    return false;
  }

  /**
   * Mira's powers (PYRE.md §8), on whoever needs them: a Barrier on the one who has lost their shield,
   * a Repair Drone on the one most hurt (the hero first), half again slower to return than the hero's.
   */
  function miraSupport(mira: Companion): boolean {
    const cds = crewCooldowns.mira ?? {};
    const team = [...joined].filter((t) => t.visible && !t.down);
    const use = (id: PowerId) => {
      const ranked = atRank(POWERS[id], crew.mira?.ranks[id] ?? 1);
      crewCooldowns.mira = { ...cds, [id]: ranked.cooldown * 1.5 * mods.companionCooldown };
      audio.play(id === 'barrier' ? 'barrier' : 'drone', { at: mira.character.root.position, volume: 0.6 });
      return ranked;
    };
    if (isReady(cds, 'barrier')) {
      if (heroDefences.shield <= 0 && abilities.effects.barrier <= 0 && condition.kind === 'up') {
        abilities.support(use('barrier'));
        options.onSay('Mira', 'Barrier on you!', null);
        return true;
      }
      const bare = team.find((t) => t.defences.shield <= 0);
      if (bare) {
        use('barrier');
        bare.screen();
        return true;
      }
    }
    if (isReady(cds, 'repair')) {
      if (heroDefences.health < heroDefences.healthMax * 0.6 && condition.kind === 'up') {
        abilities.support(use('repair'));
        options.onSay('Mira', 'Drone coming to you. Hold still.', null);
        return true;
      }
      const hurt = team
        .filter((t) => t.defences.health < t.defences.healthMax * 0.6)
        .sort((x, y) => x.defences.health / x.defences.healthMax - y.defences.health / y.defences.healthMax)[0];
      if (hurt) {
        hurt.mend((40 * (atRank(POWERS.repair, crew.mira?.ranks.repair ?? 1).lasts ?? 4)) / 4);
        use('repair');
        return true;
      }
    }
    return false;
  }

  /** The other carried weapon to hand (X, the wheel, or the phone's button). */
  const swapWeapon = () => {
    const next = swapKit(kit);
    if (next === kit) return;
    kit = next;
    wieldNow();
    triggerHeld = 0;
    fireCooldown = Math.max(fireCooldown, 0.35);
    audio.play('ui_choice', { volume: 0.6 });
    options.onNote(WEAPONS[kit.carried[0]].name);
    keepGrowth();
  };

  /** Uses the hero's power in a slot, facing where the camera looks, the casting arm up. */
  const usePower = (slot: number) => {
    const id = growth.hand[slot];
    if (!id || commanding || talking || condition.kind !== 'up' || liftoff || ended) return;
    if (abilities.use(id)) {
      castPose = 0.55;
      momentum = 4;
      heroYaw = yawOf({ x: -Math.cos(orbit.alpha), z: -Math.sin(orbit.alpha) });
      if (POWERS[id].id !== 'veil') abilities.effects.veil = 0;
    }
  };

  const startConversation = (id: string, knot: string) => {
    const partner = characterOf(id);
    if (!partner || talking) return;
    input.release();
    // What the ship can afford, for choices that cost credits (PYRE.md §7).
    runner.set('credits', kit.credits);
    const conversation = runner.converse(knot);
    talking = {
      id,
      knot,
      speaker: null,
      side: sideOf(hero.root.position, partner.root.position, camera.position),
    };
    options.onPrompt(null);
    prompt = null;
    options.onConversation(conversation, nameOf(id));
  };

  const wakeWave = (wave: Wave) => {
    const vents = [...(place.vents[wave.vents] ?? [])].sort(() => Math.random() - 0.5);
    let i = 0;
    const next = () => {
      const v = vents[i % Math.max(1, vents.length)] ?? hero.root.position.add(new Vector3(0, 6, 10));
      i += 1;
      // A little apart when more come from one vent than there are vents.
      return i > vents.length ? v.add(new Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5)) : v;
    };
    const take = (n = 0) => Array.from({ length: n }, next);
    swarm.wake(take(wave.motes), 'mote');
    swarm.wake(take(wave.lattices), 'lattice');
    swarm.wake(take(wave.tenders), 'tender');
    // The Banked come in on foot, at the vents' points on the floor.
    if (banked) {
      const kinds = [
        ...Array(wave.troopers ?? 0).fill('trooper'),
        ...Array(wave.engineers ?? 0).fill('engineer'),
        ...Array(wave.wardens ?? 0).fill('warden'),
      ];
      banked.wake(kinds, take(kinds.length));
    }
  };

  const startEncounter = (id: string) => {
    fight = startFight(id);
    helpUsed = false;
    snapshot = {
      hero: hero.root.position.clone(),
      yaw: heroYaw,
      companions: [...joined].map((c) => ({
        c,
        at: c.character.root.position.clone(),
        yaw: c.character.root.rotation.y,
      })),
    };
  };

  /** Back to just before the fight (D-43): everyone where they stood, whole, and the fight from its start. */
  const restartFight = () => {
    options.onFade(true);
    swarm.clear();
    banked?.clear();
    if (snapshot) {
      moveHero(snapshot.hero, snapshot.yaw);
      for (const s of snapshot.companions) {
        s.c.raise();
        s.c.place(s.at, s.yaw);
        s.c.order({ kind: 'follow' }, true);
      }
    }
    heroDefences = restored(heroDefences);
    abilities.clear();
    condition = { kind: 'up' };
    helper?.help(null);
    helper = null;
    helpUsed = false;
    if (fight) fight = startFight(fight.id);
    window.setTimeout(() => options.onFade(false), 450);
  };

  const fightOver = () => {
    helpUsed = false;
    for (const c of joined) if (c.down) c.raise();
  };

  const ending = (): Ending => ({
    chapter: lastCheckpoint,
    tookMast: runner.variable('took_mast') === true,
    merrowWarned: runner.variable('merrow_warned') === true,
    ilyaLost: runner.variable('ilya_lost') === true,
    firstLead: String(runner.variable('first_lead') ?? ''),
    haveCurve: runner.variable('have_curve') === true,
    renApproval: Number(runner.variable('ren_approval') ?? 0),
    joApproval: Number(runner.variable('jo_approval') ?? 0),
    unlisted: String(runner.variable('unlisted') ?? ''),
    pyreSaved: String(runner.variable('pyre_saved') ?? ''),
  });

  /** The points the hero and the companions have to spend, for the pause menu's mark. */
  const pointsToSpend = () => {
    const level = levelOf(growth.xp);
    const crewPoints = Object.values(crew).reduce((n, c) => n + (c.auto ? 0 : 2 * (level - 1) - c.spent), 0);
    return Math.max(0, 2 * (level - 1) - growth.spent) + Math.max(0, crewPoints);
  };
  /** The last save made, so a change to growth can be kept at once with the same story. */
  let lastSave: SaveData | null = options.save ?? null;
  const keepGrowth = () => {
    if (lastSave) {
      lastSave = { ...lastSave, growth: { hero: growth, crew: { ...crew } }, kit };
      options.onSave(lastSave, true);
    }
    options.onGrowth(pointsToSpend());
  };
  /**
   * Experience the story gives (never a kill), once for each key: a note, and a level's news when one
   * is reached.
   */
  const grant = (amount: number, why: string, key: string) => {
    if (!Number.isFinite(amount) || amount <= 0 || growth.got.includes(key)) return;
    const g = gainOnce(growth, heroClass, key, amount);
    growth = g.growth;
    options.onNote(`+${amount} · ${why}`);
    if (g.levels.length > 0) {
      const level = levelOf(growth.xp);
      for (const who of Object.keys(crew)) crew[who] = companionAuto(crew[who] ?? newCompanionGrowth(), who, level);
      audio.play('objective');
      options.onLevel(
        level,
        g.powers.map((p) => POWERS[p].name),
      );
    }
    keepGrowth();
  };

  /** Plays a line's voice, the speaker's mouth moving with it; its length in seconds, or null. */
  const speakLine = (line: {
    speaker: string;
    id: string | null;
    codex?: string;
    xp?: number;
    why?: string;
    spend?: number;
  }): number | null => {
    if (line.codex) options.onCodex(line.codex);
    if (line.xp) grant(line.xp, line.why ?? 'A hard choice', `line:${line.id ?? line.speaker}`);
    if (line.spend) {
      const before = kit.credits;
      kit = spend(kit, `spend:${line.id ?? line.speaker}`, line.spend);
      if (kit.credits !== before) {
        options.onNote(`−${line.spend} credits`);
        keepGrowth();
      }
    }
    voiceNow?.voice.stop();
    voiceNow?.who?.speak(0);
    voiceNow = null;
    if (!line.id) return null;
    const voice = audio.voice(line.id, options.looks.body);
    if (!voice) return null;
    const id = SPEAKERS[line.speaker];
    voiceNow = { voice, who: id ? (characterOf(id) ?? null) : null };
    return voice.seconds;
  };

  /** Says a line in the world: the caption, the voice and the mouth; how long it takes, in seconds. */
  const say = (line: Line): number => {
    options.onSay(line.speaker === 'hero' ? options.looks.name || 'You' : line.speaker, line.text, line.id);
    const voiced = speakLine(line);
    // A line without a voice yet is given the time it takes to read.
    return (voiced ?? 1 + line.text.split(/\s+/).length * 0.3) + 0.35;
  };

  /** The hero's remark on something looked at: the knot's lines, said in turn. */
  const remark = (knot: string) => {
    const conversation = runner.converse(knot);
    for (let beat = conversation.next(); beat.kind !== 'end'; beat = conversation.next()) {
      if (beat.kind === 'line')
        remarks.push({ speaker: beat.speaker, text: beat.text, id: beat.id, codex: beat.codex });
      else conversation.choose(beat.choices[0]?.index ?? 0);
    }
    remarkWait = 0;
  };

  const run = (c: Command) => {
    const [a = '', b = ''] = c.args;
    switch (c.verb) {
      case 'music':
        chapterMusic = a === 'none' ? null : a;
        break;
      case 'lights':
        if (a === 'out' && !lightsAreOut) {
          audio.play('power_fail');
          alarm = audio.play('alarm', { loop: true, volume: 0.5 });
          window.setTimeout(() => alarm?.stop(1.5), 7000);
        }
        lightsAreOut = a === 'out';
        place.lightsOut(lightsAreOut);
        atmosphere.setMood({ lightsOut: lightsAreOut, outdoors: area === 'catwalk' || area === 'mast' });
        break;
      case 'sky':
        place.sky.swarm(c.args.includes('swarm'));
        place.sky.space(c.args.includes('space'));
        place.sky.pyre(c.args.includes('pyre'));
        place.atPyre?.(c.args.includes('pyre'));
        place.lane(c.args.includes('lane'));
        break;
      case 'start':
        // A companion stands a little behind the hero's mark; anyone else on their own.
        if (resuming) putAt(a, b, !!companionsById[a]);
        break;
      case 'place':
        putAt(a, b);
        break;
      case 'hide':
      case 'show':
        if (companionsById[a]) companionsById[a]?.show(c.verb === 'show');
        else people[a]?.show(c.verb === 'show');
        break;
      case 'open':
      case 'close': {
        const door = place.doors[a];
        if (door && door.open !== (c.verb === 'open') && !resuming) {
          audio.play(c.verb === 'open' ? 'door_open' : 'door_close', { at: door.centre });
        }
        door?.set(c.verb === 'open');
        break;
      }
      case 'lock':
      case 'unlock':
        place.doors[a]?.lock(c.verb === 'lock');
        if (c.verb === 'lock') place.doors[a]?.set(false);
        break;
      case 'caption':
        options.onCaption(c.rest);
        break;
      case 'hint':
        options.onHint(a);
        break;
      case 'objective':
        options.onObjective(c.rest === 'none' ? null : c.rest);
        break;
      case 'marker':
        markerTarget = a === 'none' ? null : a;
        break;
      case 'talk':
        talkKnots[a] = b || null;
        break;
      case 'drill':
        drillFrom = range.destroyed;
        break;
      case 'scene':
        startConversation(a, b);
        break;
      case 'walk': {
        const m = markOf(b);
        // Those who walk aboard a ship are taken from view as they reach it.
        if (m) people[a]?.walkTo(m.at, b === 'boarding' || b === 'berth' || b === 'banked_berth');
        break;
      }
      case 'follow':
        if (companionsById[a]) companionsById[a]?.order({ kind: 'follow' }, true);
        else people[a]?.follow(true);
        break;
      case 'stay': {
        const comp = companionsById[a];
        if (comp) comp.place(comp.character.root.position.clone(), comp.character.root.rotation.y);
        else people[a]?.follow(false);
        break;
      }
      case 'join': {
        const comp = companionsById[a];
        if (comp) {
          joined.add(comp);
          comp.order({ kind: 'follow' }, true);
        }
        break;
      }
      case 'leave': {
        // Back to the ship (D-59): out of the squad and out of sight.
        const comp = companionsById[a];
        if (comp) {
          joined.delete(comp);
          comp.show(false);
        }
        break;
      }
      case 'encounter':
        startEncounter(a);
        break;
      case 'use': {
        const m = markOf(b);
        if (m) usable.set(a, { at: m.at, label: c.args.slice(2).join(' ') });
        break;
      }
      case 'screen': {
        // A thing that opens a screen (the star map, the armoury), and stays to be used again.
        const m = markOf(b);
        if (m) usable.set(a, { at: m.at, label: c.args.slice(2).join(' '), screen: a });
        break;
      }
      case 'find': {
        // A weapon or a mod to take (D-56), once only: a chapter played again does not offer it twice.
        const m = markOf(b);
        const what = c.args[2] as WeaponKind | ModId;
        if (m && !kit.found.includes(`find:${a}`))
          usable.set(a, { at: m.at, label: c.args.slice(3).join(' '), find: what });
        break;
      }
      case 'depart': {
        options.onObjective(null);
        audio.play('liftoff', { volume: 0.55 });
        const shot = place.depart(() => options.onFlash());
        departing = { t: 0, shot };
        options.onShot(true);
        break;
      }
      case 'look': {
        const m = markOf(b);
        if (m && c.args[2]) usable.set(a, { at: m.at, label: c.args.slice(3).join(' '), knot: c.args[2] });
        break;
      }
      case 'forget':
        usable.delete(a);
        break;
      case 'codex':
        options.onCodex(a);
        break;
      case 'xp':
        grant(Number(a), c.args.slice(1).join(' '), `xp:${c.args.slice(1).join(' ')}`);
        break;
      case 'pay': {
        // Credits the story gives (D-62), once for each reason.
        const why = c.args.slice(1).join(' ');
        const before = kit.credits;
        kit = pay(kit, `pay:${why}`, Number(a));
        if (kit.credits !== before) {
          options.onNote(`+${kit.credits - before} credits · ${why}`);
          keepGrowth();
        }
        break;
      }
      case 'down':
        people[a]?.fall();
        break;
      case 'liftoff':
        audio.play('liftoff');
        liftoff = { t: 0 };
        place.freeShip();
        options.onObjective(null);
        break;
      case 'end':
        ended = true;
        options.onEnd(ending());
        break;
      case 'card':
        input.release();
        options.onCard(a, ending());
        break;
      case 'travel': {
        // Already there (a chapter that starts with its travel, resumed): nothing to do.
        if (a === placeId) {
          window.setTimeout(() => director.event('done:travel'), 0);
          break;
        }
        // Elsewhere: saved just past this command, the game hands over to a new one in that place.
        ended = true;
        options.onFade(true);
        const save: SaveData = {
          version: 1,
          looks: options.looks,
          story: runner.save(),
          checkpoint: lastCheckpoint,
          difficulty,
          at: Date.now(),
          script: SCRIPT,
          place: a as PlaceId,
          growth: { hero: growth, crew: { ...crew } },
          kit,
        };
        options.onSave(save);
        options.onTravel(save);
        break;
      }
    }
  };

  const director = new Director(runner, {
    command: run,
    bark: (line) => {
      // The story's own lines come first.
      remarks.length = 0;
      return say(line);
    },
    checkpoint: (name, state) => {
      lastCheckpoint = name;
      lastSave = {
        version: 1,
        looks: options.looks,
        story: state,
        checkpoint: name,
        difficulty,
        at: Date.now(),
        script: SCRIPT,
        place: placeId,
        growth: { hero: growth, crew: { ...crew } },
        kit,
      };
      options.onSave(lastSave);
    },
  });
  if (options.save) {
    // The story's state only fits the script it was saved from: a save from an older one starts
    // its chapter again (what was chosen before it is forgotten, the chapter and the hero are kept).
    try {
      if (options.save.script !== SCRIPT) throw new Error('saved from another version of the story');
      runner.load(options.save.story);
    } catch {
      runner.story.ChoosePathString(`${knotOf(options.save.checkpoint)}.${options.save.checkpoint}`);
    }
  } else if (options.chapter) runner.story.ChoosePathString(`${knotOf(options.chapter)}.${options.chapter}`);

  /** The orders of the command view, to one companion or all (ORDERS.md). */
  const view = () => {
    const from = camera.globalPosition.clone();
    return { from, dir: camera.getTarget().subtract(from).normalize() };
  };
  const order = (kind: OrderKind, who?: string) => {
    const { from, dir } = view();
    const team = [...joined].filter((c) => !c.down && (!who || who === 'all' || c.name === who));
    if (kind === 'follow') {
      for (const [i, c] of team.entries()) c.order({ kind: 'follow' }, i > 0);
    } else if (kind === 'attack') {
      const id = pickAssistTarget(range.candidates(from), dir, ASSIST_CONE * 1.5);
      if (id === null) options.onSay(team[0]?.name ?? 'Ren', 'No target there.', null);
      else for (const [i, c] of team.entries()) c.order({ kind: 'attack', target: id }, i > 0);
    } else {
      const struck = cast(from.add(dir.scale(0.3)), from.add(dir.scale(SHOT_RANGE)), true);
      const target = range.droneOf(struck?.body);
      if (!struck) options.onSay(team[0]?.name ?? 'Ren', "I can't reach that.", null);
      else if (target !== null) for (const [i, c] of team.entries()) c.order({ kind: 'attack', target }, i > 0);
      else {
        // On the floor, that spot; against a wall or a crate, just in front of it.
        const at = struck.normal.y > 0.6 ? struck.point : struck.point.add(struck.normal.scale(0.7));
        for (const [i, c] of team.entries()) {
          c.order({ kind: 'hold', at: { x: at.x + i * 1.2, y: hero.root.position.y, z: at.z } }, i > 0);
        }
      }
    }
    setCommandView(false);
  };
  const setCommandView = (open: boolean) => {
    commanding = open;
    const factor = open ? COMMAND_TIME : 1;
    scene.animationTimeScale = factor;
    nav?.setTimeFactor(factor);
  };

  /** The two cover rays from the hero's feet along a ground direction (COVER_AND_AIM.md). */
  const probeCover = (feet: Vector3, dir: Vec3Like): CoverProbe => {
    const reach = COVER.reach + 0.4;
    const along = new Vector3(dir.x, 0, dir.z);
    const knee = cast(
      feet.add(new Vector3(0, COVER.kneeHeight, 0)),
      feet.add(new Vector3(0, COVER.kneeHeight, 0)).add(along.scale(reach)),
    );
    const chest = cast(
      feet.add(new Vector3(0, COVER.chestHeight, 0)),
      feet.add(new Vector3(0, COVER.chestHeight, 0)).add(along.scale(reach)),
    );
    let normal: Vec3Like | null = null;
    if (knee) {
      const flat = Math.hypot(knee.normal.x, knee.normal.z);
      if (flat > 0.5) normal = { x: knee.normal.x / flat, z: knee.normal.z / flat };
    }
    return {
      knee: knee ? Math.max(0, knee.distance - CAPSULE_RADIUS) : null,
      chest: chest ? Math.max(0, chest.distance - CAPSULE_RADIUS) : null,
      normal,
    };
  };

  /** A direction turned at random within a cone of `degrees` (a weapon's spread). */
  const stray = (dir: Vector3, degrees: number): Vector3 => {
    if (degrees <= 0) return dir;
    const side = Vector3.Cross(dir, Vector3.Up()).normalize();
    const up = Vector3.Cross(side, dir).normalize();
    const r = Math.tan((degrees * Math.PI) / 180) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    return dir
      .add(side.scale(Math.cos(a) * r))
      .add(up.scale(Math.sin(a) * r))
      .normalize();
  };
  const shoot = () => {
    const w = weaponNow();
    const from = camera.globalPosition.clone();
    let dir = camera.getTarget().subtract(from).normalize();
    // Aim assist on phones (D-17), and on Story for everyone; stronger or weaker by difficulty.
    if (options.assist || difficulty === 'story') {
      const id = pickAssistTarget(range.candidates(from), dir, ASSIST_CONE * DIFFICULTY[difficulty].assist);
      if (id !== null) dir = range.centre(id).subtract(from).normalize();
    }
    // Out of the Veil, the first shot does double; shooting gives the hero away.
    const bonus = abilities.effects.veil > 0 ? 2 : 1;
    abilities.effects.veil = 0;
    // Long Shot: this shot does three times, and goes on through the machines behind.
    const longShot = abilities.effects.longshot > 0;
    if (longShot) abilities.spendLongShot();
    const drive = mods.weaponDamage * (momentum > 0 ? 1 + mods.momentum : 1) * (longShot ? 3 : 1);
    // Each slug strays within the weapon's spread (the rifle's grows while it fires; the Shade's
    // training and a stabiliser narrow it), and weakens with distance (the shotgun's).
    const spread = spreadAfter(w, triggerHeld) * mods.spreadScale;
    let shown: { point: Vector3; hit: boolean } | null = null;
    let struck: ReturnType<typeof cast> = null;
    for (let i = 0; i < w.pellets; i++) {
      const d = stray(dir, spread);
      const end = from.add(d.scale(w.reach));
      const met = cast(from.add(d.scale(0.3)), end, true);
      const amount = damageAt(w, met?.distance ?? w.reach) * bonus * drive;
      const hit = range.hit(met?.body, 'hero', { amount, kind: 'kinetic', plate: w.plateBonus });
      if (i === 0) {
        struck = met;
        shown = { point: met ? met.point : end, hit };
      }
    }
    const damage = { amount: w.damage * bonus * drive, kind: 'kinetic' as const, plate: w.plateBonus };
    if (longShot) {
      for (let m = 0; m < swarm.size; m++) {
        const s = swarm.status(m);
        if (!s?.alive || (struck && Vector3.Distance(s.at, struck.point) < 1)) continue;
        const to = s.at.subtract(from);
        const along = Vector3.Dot(to, dir);
        if (along > 0 && along < w.reach && to.subtract(dir.scale(along)).length() < 0.7) {
          swarm.strikeMachine(m, damage, 'hero');
        }
      }
    }
    hero.fire();
    if (shown) range.shot(hero.muzzle(), shown.point, shown.hit);
    shotPose = SHOT_POSE;
  };

  /** The middle of a character's head, by their height. */
  const headOf = (character: Character) =>
    character.root.position.add(new Vector3(0, HEAD_HEIGHT * character.root.scaling.y, 0));
  /**
   * The shot for the conversation's present moment: over the hero's shoulder onto the partner while
   * the partner speaks or the hero chooses, and over the partner's onto the hero while the hero
   * speaks. The first shot that sees both faces is taken: over either shoulder, then a two-shot
   * from beside the pair, near or far, then over a shoulder in short of the wall, then from above.
   * (A wall close behind the listener once left the camera outside the room, showing the wall's
   * back: the owner's phone, 25 October 2026.)
   */
  /** Where a camera at `at` would stand seen from `anchor`: there, or in short of the first wall. */
  const clearOf = (anchor: Vector3, at: Vector3, margin = 0.25): Vector3 => {
    const wall = cast(anchor, at, true);
    if (!wall) return at;
    const towards = at.subtract(anchor).normalize();
    return anchor.add(towards.scale(Math.max(0.05, wall.distance - margin)));
  };
  const conversationShot = (now: NonNullable<typeof talking>, partner: Character): Shot =>
    shotBetween(headOf(hero), headOf(partner), now);
  /** The conversation's shot between two heads (pure of the characters, so it can be checked anywhere). */
  const shotBetween = (
    heroHead: Vector3,
    partnerHead: Vector3,
    now: { speaker: 'hero' | 'partner' | null; side: 1 | -1 },
  ): Shot => {
    const line = { x: partnerHead.x - heroHead.x, z: partnerHead.z - heroHead.z };
    const [listener, speaker] = now.speaker === 'hero' ? [partnerHead, heroHead] : [heroHead, partnerHead];
    const aspect = engine.getAspectRatio(camera);
    const other: 1 | -1 = now.side === 1 ? -1 : 1;
    const over = (side: 1 | -1) => overShoulder(listener, speaker, line, side, aspect);
    const target = over(now.side).target;
    // A camera sees the pair when no wall stands between it and either face.
    const sees = (at: Vector3) => !cast(heroHead, at, true) && !cast(partnerHead, at, true);
    const shot = (at: Vector3): Shot => ({ position: { x: at.x, y: at.y, z: at.z }, target });
    for (const side of [now.side, other]) {
      const at = vector(over(side).position);
      if (!sees(at)) continue;
      // Stay on the side that works, so the shots do not swap back and forth.
      now.side = side;
      return shot(at);
    }
    const middle = Vector3.Lerp(heroHead, partnerHead, 0.5);
    const apart = Math.hypot(line.x, line.z) || 1;
    for (const reach of [2.1, 1.4]) {
      for (const side of [now.side, other]) {
        const across = new Vector3((side * line.z) / apart, 0, (-side * line.x) / apart).scale(reach);
        const at = middle.add(across).add(new Vector3(0, 0.3, 0));
        if (sees(at)) return shot(at);
      }
    }
    for (const side of [now.side, other]) {
      const at = clearOf(listener, vector(over(side).position), 0.3);
      if (sees(at)) return shot(at);
    }
    // Above the pair, looking down on the one speaking.
    const high = clearOf(middle, middle.add(new Vector3(0, 0.9, 0)), 0.2);
    if (sees(high)) return shot(high);
    return shot(clearOf(listener, vector(over(now.side).position), 0.3));
  };

  // The marker over the objective: drawn over everything, the same size on screen at any distance.
  const marker = CreatePolyhedron('objective-marker', { type: 1, size: 0.16 }, scene);
  const markerMaterial = new StandardMaterial('objective-marker', scene);
  markerMaterial.emissiveColor = new Color3(1, 0.78, 0.3);
  markerMaterial.disableLighting = true;
  marker.material = markerMaterial;
  marker.renderingGroupId = 2;
  marker.isPickable = false;
  marker.setEnabled(false);
  // A small glint over each thing to look at, near enough to notice: they are found by walking.
  const glintMaterial = new StandardMaterial('look-glint', scene);
  glintMaterial.emissiveColor = new Color3(0.6, 0.85, 1);
  glintMaterial.disableLighting = true;
  const glints = new Map<string, ReturnType<typeof CreatePolyhedron>>();
  const showGlints = (feet: Vector3) => {
    for (const [id, thing] of usable) {
      if (!thing.knot) continue;
      let glint = glints.get(id);
      if (!glint) {
        glint = CreatePolyhedron(`glint-${id}`, { type: 1, size: 0.045 }, scene);
        glint.material = glintMaterial;
        glint.isPickable = false;
        glints.set(id, glint);
      }
      const near = Math.hypot(thing.at.x - feet.x, thing.at.z - feet.z) < 7 && !talking && !fight;
      glint.setEnabled(near);
      if (near) {
        glint.position.set(thing.at.x, thing.at.y + 1.4 + Math.sin(clock * 2.6) * 0.04, thing.at.z);
        glint.rotation.y = clock * 2;
        glint.scaling.setAll(0.85 + 0.2 * Math.sin(clock * 4));
      }
    }
    for (const [id, glint] of glints) {
      if (usable.get(id)?.knot) continue;
      glint.dispose();
      glints.delete(id);
    }
  };
  const markerPosition = (): Vector3 | null => {
    if (!markerTarget) return null;
    const who = characterOf(markerTarget);
    if (who?.root.isEnabled() && markerTarget !== 'hero') return who.root.position.add(new Vector3(0, 2.25, 0));
    const m = markOf(markerTarget);
    return m ? m.at.add(new Vector3(0, 1.9, 0)) : null;
  };

  let clock = 0;
  let vitalsTime = 0;
  let paused = false;
  /** Where the hero's gun points while aiming. */
  const gunAim = new Vector3(0, 0, 1);
  /** For testing: the camera held at a view instead of following the hero. */
  let debugView: { from: Vector3; to: Vector3 } | null = null;
  scene.onBeforeRenderObservable.add(() => {
    if (paused) {
      input.takeLook();
      return;
    }
    // In the command view time nearly stops: the game's rules run slow, the camera does not.
    const real = Math.min(engine.getDeltaTime() / 1000, 0.1);
    const dt = real * (commanding ? COMMAND_TIME : 1);
    clock += real;
    const fallen = condition.kind !== 'up';
    // In the command view, a conversation, a scene, or down, the player's movement and shots wait.
    const held = commanding || talking !== null || fallen || liftoff !== null || departing !== null || ended;
    const aiming = !held && (input.aiming || input.firing);
    if (aiming !== wasAiming) {
      wasAiming = aiming;
      options.onAim(aiming);
    }

    // Look: drag or mouse turns the camera round the hero, more finely while aiming.
    const look = input.takeLook();
    if (!talking && !liftoff && !departing) {
      const fine = aiming ? 0.6 : 1;
      orbit.alpha -= look.x * 0.0055 * fine;
      orbit.beta = Math.min(CAMERA.maxBeta, Math.max(CAMERA.minBeta, orbit.beta - look.y * 0.0045 * fine));
    }

    // Move: relative to where the camera looks.
    const forward: Vec3Like = { x: -Math.cos(orbit.alpha), z: -Math.sin(orbit.alpha) };
    const move = held ? { x: 0, y: 0 } : input.move();
    const push = Math.min(1, Math.hypot(move.x, move.y));
    const direction = cameraRelative(move, forward);
    const length = Math.hypot(direction.x, direction.z);
    const unit = length > 0 ? { x: direction.x / length, z: direction.z / length } : { x: 0, z: 0 };
    const feet = hero.root.position;

    // Cover: walk into low cover to take it; push away, sprint, or run out of it to leave. The ray
    // that checks the cover is still there reaches as far as cover can be taken from.
    const ahead = cover.inCover
      ? cast(
          feet.add(new Vector3(0, COVER.kneeHeight, 0)),
          feet.add(new Vector3(-cover.normal.x * COVER_AHEAD, COVER.kneeHeight, -cover.normal.z * COVER_AHEAD)),
        )
      : null;
    const result = coverStep(cover, {
      move: { x: unit.x * push, z: unit.z * push },
      sprint: input.sprint,
      aiming,
      probe: !cover.inCover && push > 0.3 && !held ? probeCover(feet, unit) : null,
      coverAhead: ahead !== null,
    });
    cover = fallen ? { inCover: false } : result.state;
    /** How far the hero's front is from the cover, to settle against it. */
    const coverGap = ahead ? ahead.distance - CAPSULE_RADIUS : 0;

    // A strike or a dodge, when asked for and the hero is free to.
    const wantsStrike = input.takeStrike();
    const wantsDodge = input.takeDodge();
    dodgeCooldown -= dt;
    if (!held && !strike && !dodge && wantsStrike) strike = { t: 0, blows: 0 };
    if (!held && !dodge && wantsDodge && dodgeCooldown <= 0) {
      // Where the stick points, or straight back; a roll forward or back, a sidestep to a side.
      const dir = push > 0.2 ? new Vector3(unit.x, 0, unit.z) : new Vector3(-heroForward.x, 0, -heroForward.z);
      const across = dir.x * heroForward.z - dir.z * heroForward.x;
      const along = dir.x * heroForward.x + dir.z * heroForward.z;
      const clip = Math.abs(across) > Math.abs(along) ? (across > 0 ? 'dodge_right' : 'dodge_left') : 'roll';
      dodge = { t: 0, dir, clip };
      audio.play('dodge', { at: hero.root.position });
      strike = null;
      cover = { inCover: false };
      // A dodge outruns one shot.
      grace = Math.max(grace, DODGE.seconds);
    }

    const velocity = controller.getVelocity();
    const groundSpeed = Math.hypot(velocity.x, velocity.z);
    const partner = talking ? characterOf(talking.id) : null;
    if (dodge) {
      dodge.t += dt;
      desired.set(dodge.dir.x * DODGE.speed, 0, dodge.dir.z * DODGE.speed);
      if (dodge.clip === 'roll') heroYaw = turnTowards(heroYaw, yawOf(dodge.dir), 20 * dt);
      hero.setPose({ lower: { [dodge.clip]: 1 }, upper: null, blend: 18 }, dt);
      if (dodge.t >= DODGE.seconds) {
        dodge = null;
        dodgeCooldown = DODGE.cooldown;
      }
    } else if (strike && condition.kind === 'up') {
      // Two blows at what is in front: a machine pulled or lifted into reach, one that came too close.
      strike.t += dt;
      desired.set(0, 0, 0);
      heroYaw = turnTowards(heroYaw, yawOf(forward), 14 * dt);
      hero.setPose({ lower: strike.t < 0.36 ? { punch_jab: 1 } : { punch_cross: 1 }, upper: null, blend: 16 }, dt);
      const blowAt = [0.16, 0.5];
      if (strike.blows < blowAt.length && strike.t >= (blowAt[strike.blows] ?? 1)) {
        strike.blows += 1;
        const chest = hero.root.position.add(new Vector3(0, 1.3, 0));
        const ahead = new Vector3(heroForward.x, 0, heroForward.z);
        let landed = false;
        for (let m = 0; m < swarm.size; m++) {
          const st = swarm.status(m);
          if (!st?.alive) continue;
          const to = st.at.subtract(chest);
          if (to.length() > MELEE.reach || Vector3.Dot(to.normalize(), ahead) < 0.4) continue;
          swarm.strikeMachine(m, { amount: MELEE.damage, kind: 'kinetic' }, 'hero');
          swarm.affect(m, 'pull', 0.4, st.at.add(ahead.scale(3)));
          landed = true;
        }
        if (landed) {
          options.onNote('Hit!');
          audio.play('punch', { at: chest });
        }
      }
      if (strike.t >= MELEE.seconds) strike = null;
    } else if (condition.kind === 'down') {
      desired.set(0, 0, 0);
      hero.setPose(poseWeights({ mode: 'down' }), dt);
    } else if (condition.kind === 'rising') {
      desired.set(0, 0, 0);
      hero.setPose(poseWeights({ mode: 'kneel' }), dt);
    } else if (talking && partner) {
      desired.set(0, 0, 0);
      const to = partner.root.position.subtract(feet);
      heroYaw = turnTowards(heroYaw, yawOf({ x: to.x, z: to.z }), 8 * dt);
      hero.setPose(poseWeights({ mode: 'talk', speaking: talking.speaker === 'hero' }), dt);
    } else if (aiming) {
      // Aiming: face where the camera looks and walk in any direction; from cover, stand and aim.
      // Aboard a ship the Laneborn are at home (D-55).
      const speed = cover.inCover ? 0 : SPEED.walk * push * (placeId === 'lantern' ? mods.shipSpeed : 1);
      desired.set(unit.x * speed, 0, unit.z * speed);
      heroYaw = turnTowards(heroYaw, yawOf(forward), 14 * dt);
      hero.setPose(
        poseWeights({
          mode: 'aim',
          speed: groundSpeed,
          direction: push > 0 ? { x: move.x / push, y: move.y / push } : { x: 0, y: 0 },
          firing: shotPose > 0,
          // The long guns are held to the shoulder (rifle clips made in Blender, ACT1.md increment 3).
          rifle: kit.carried[0] !== 'pistol',
        }),
        dt,
      );
    } else if (cover.inCover && castPose > 0) {
      desired.set(0, 0, 0);
      hero.setPose({ lower: { crouch_idle: 1 }, upper: { power_cast: 1 } }, dt);
    } else if (cover.inCover) {
      desired.set(result.velocity.x, 0, result.velocity.z);
      // Settle against the cover, rather than crouching short of it.
      if (coverGap > 0.1) {
        const settle = Math.min(2, coverGap * 5);
        desired.addInPlace(new Vector3(-cover.normal.x * settle, 0, -cover.normal.z * settle));
      }
      heroYaw = turnTowards(heroYaw, yawOf({ x: -cover.normal.x, z: -cover.normal.z }), 10 * dt);
      hero.setPose(poseWeights({ mode: 'cover', slide: result.slide }), dt);
    } else {
      const speed = held ? 0 : targetSpeed(push, input.sprint);
      if (length > 0 && speed > 0 && castPose <= 0) {
        desired.set(unit.x * speed, 0, unit.z * speed);
        heroYaw = turnTowards(heroYaw, yawOf(direction), 11 * dt);
      } else {
        desired.set(castPose > 0 ? unit.x * SPEED.walk * push : 0, 0, castPose > 0 ? unit.z * SPEED.walk * push : 0);
      }
      // In a fight a long gun is held low and ready; a pistol hangs at the side.
      const pose = poseWeights({ mode: 'move', speed: groundSpeed, ready: !!fight && kit.carried[0] !== 'pistol' });
      hero.setPose(castPose > 0 ? { ...pose, upper: { power_cast: 1 } } : pose, dt);
    }
    heroForward.set(Math.sin(heroYaw), 0, Math.cos(heroYaw));

    const position = controller.getPosition();
    const bottom = position.subtract(new Vector3(0, CAPSULE_HEIGHT / 2, 0));
    hero.root.position.set(position.x, groundUnder(bottom) ?? bottom.y, position.z);
    hero.root.rotation.y = heroYaw;
    // Footsteps on the deck: one every stride, louder at a run.
    stepDistance += groundSpeed * dt;
    const stride = groundSpeed > 4 ? 1.1 : 0.75;
    if (stepDistance > stride && condition.kind === 'up') {
      stepDistance = 0;
      audio.play(`step_${1 + Math.floor(Math.random() * 4)}`, {
        at: hero.root.position,
        volume: Math.min(1, 0.25 + groundSpeed * 0.1),
        rate: 0.92 + Math.random() * 0.16,
      });
    }

    // Shoot: where the crosshair points, or at the nearest target near it with aim assist.
    fireCooldown -= dt;
    shotPose -= dt;
    if (!held && input.firing && fireCooldown <= 0) {
      fireCooldown = weaponNow().interval;
      shoot();
    }
    // The trigger held: the rifle strays more; let go, it steadies.
    triggerHeld = !held && input.firing ? triggerHeld + dt : Math.max(0, triggerHeld - dt * 3);
    if (input.takeSwap() && !held) swapWeapon();
    abilities.update(dt);
    for (const who of Object.keys(crewCooldowns)) crewCooldowns[who] = cool(crewCooldowns[who] ?? {}, dt);
    for (const who of Object.keys(crewVeil)) crewVeil[who] = Math.max(0, (crewVeil[who] ?? 0) - dt);
    castPose -= dt;
    /** Under a stim, the world slows for the hero: the swarm and its shots, the drones. */
    const worldDt = abilities.effects.stim > 0 ? dt * 0.35 : dt;
    range.update(worldDt);
    place.update(dt);

    // The fight, and the swarm.
    if (fight) {
      const step = fightStep(fight, swarm.live + (banked?.live ?? 0), dt);
      fight = step.fight;
      if (step.wake) wakeWave(step.wake);
      if (step.cleared) {
        const id = fight.id;
        fight = null;
        fightOver();
        director.event(`cleared:${id}`);
      }
    }
    const team = [...joined].filter((c) => c.visible);
    const targets = [
      {
        id: 'hero',
        feet: hero.root.position,
        // Crouched behind cover the hero is a smaller mark: the cover takes the shots.
        height: cover.inCover && !aiming ? 1.1 : CAPSULE_HEIGHT,
        // Veiled, the machines cannot see the hero to shoot.
        down: fallen || liftoff !== null || abilities.effects.veil > 0,
        moving: groundSpeed > 1,
      },
      // A veiled companion is as unseen as a veiled hero.
      ...team.map((c) => ({
        id: c.name,
        feet: c.character.root.position,
        height: CAPSULE_HEIGHT,
        down: c.down || (crewVeil[nameKey(c)] ?? 0) > 0,
        moving: false,
      })),
    ];
    /** A shot that reached the hero or a companion, from the swarm or the Banked. */
    const onHit = (id: string, from: Vector3, damage: number) => {
      const amount = damage * DIFFICULTY[difficulty].taken;
      // Shelter: a bolt from outside the dome stops at it.
      const dome = abilities.effects.shelter;
      const feet = id === 'hero' ? hero.root.position : team.find((c) => c.name === id)?.character.root.position;
      if (
        dome &&
        feet &&
        Vector3.Distance(feet, dome.at) < dome.radius + 0.3 &&
        Vector3.Distance(from, dome.at) > dome.radius
      ) {
        audio.play('shield_hit', { at: feet, volume: 0.5 });
        return;
      }
      if (id === 'hero') {
        if (condition.kind === 'down' || grace > 0) return;
        // Braced, the hero takes half; a barrier takes what it can first.
        const left = abilities.absorb(amount * (abilities.effects.brace > 0 ? 0.5 : 1));
        const shielded = heroDefences.shield > 0;
        const r = takeHit(heroDefences, left, 'kinetic');
        audio.play(shielded ? 'shield_hit' : 'health_hit', { volume: 0.8 });
        if (shielded && r.defences.shield <= 0) audio.play('shield_down');
        if (r.down) audio.play('down');
        heroDefences = r.defences;
        options.onHit(hitSide(forward, hero.root.position, from));
        if (r.down) {
          condition = fall(helpUsed);
          input.release();
        }
      } else {
        team.find((c) => c.name === id)?.hurt(amount);
      }
    };
    swarm.update(worldDt, {
      targets,
      cast: (from, to) => cast(from, to, true),
      difficulty,
      decoy: abilities.effects.decoy,
      onHit,
    });
    if (banked) {
      banked.update(worldDt, {
        targets,
        obstacle: (from, to) => cast(from, to, true, WALLS_ONLY)?.point ?? null,
        onHit,
        difficulty,
        positionOf: (by) =>
          by === 'hero'
            ? hero.root.position
            : ((companionsById[by.toLowerCase()] ?? (by === 'partner' ? ren : null))?.character.root.position ?? null),
        motesLive: () => swarm.live,
        sendMotes: (from) => swarm.wake(from, 'mote'),
      });
      // What the Banked did, heard where it happened.
      for (const e of banked.drainEvents()) {
        if (e.kind === 'fire') {
          if (e.who === 'warden') audio.play('beam_fire', { at: e.at, volume: 0.9 });
          else audio.play('pistol_ally', { at: e.at, volume: 0.7, rate: e.who === 'trooper' ? 0.8 : 1.1 });
        } else if (e.kind === 'glint' && e.who === 'warden') audio.play('beam_charge', { at: e.at, volume: 0.7 });
        else if (e.kind === 'down') audio.play('health_hit', { at: e.at, volume: 0.7, rate: 0.8 });
        else if (e.kind === 'shield') audio.play('barrier', { at: e.at, volume: 0.6 });
        else if (e.kind === 'motes') audio.play('tender_spawn', { at: e.at, volume: 0.7 });
        else if (e.kind === 'barrier') audio.play('shield_hit', { at: e.at, volume: 0.5, rate: 0.7 });
      }
    }

    // What the swarm did, heard where it happened.
    for (const e of swarm.drainEvents()) {
      const sound =
        e.kind === 'fire'
          ? 'bolt_fire'
          : e.kind === 'impact'
            ? 'bolt_hit'
            : e.kind === 'charge'
              ? 'beam_charge'
              : e.kind === 'beam'
                ? 'beam_fire'
                : e.kind === 'spawn'
                  ? 'tender_spawn'
                  : e.kind === 'whizz'
                    ? 'bolt_whizz'
                    : e.machine === 'lattice'
                      ? 'lattice_break'
                      : e.machine === 'tender'
                        ? 'tender_down'
                        : 'machine_down';
      audio.play(sound, { at: e.at, volume: e.kind === 'impact' ? 0.45 : e.kind === 'fire' ? 0.6 : 1 });
    }
    // The swarm's hum, from the nearest machine, while any fly.
    const flying = fight ? swarm.inspect() : [];
    if (flying.length > 0) {
      let nearest: number[] = flying[0]?.at ?? [];
      let best = Number.POSITIVE_INFINITY;
      for (const f of flying) {
        const d = ((f.at[0] ?? 0) - feet.x) ** 2 + ((f.at[2] ?? 0) - feet.z) ** 2;
        if (d < best) {
          best = d;
          nearest = f.at;
        }
      }
      const at = { x: nearest[0] ?? 0, y: nearest[1] ?? 0, z: nearest[2] ?? 0 };
      hum ??= audio.play('mote_hum', { loop: true, at, volume: 0.7 });
      hum?.setPosition(at);
    } else if (hum) {
      hum.stop(0.8);
      hum = null;
    }

    // The hero's shield and health return out of fire; down, a companion may come (D-43).
    if (condition.kind === 'up') heroDefences = recover(heroDefences, dt, mods.shieldSooner);
    momentum = Math.max(0, momentum - dt);
    if (condition.kind === 'down' && !helper) {
      helper =
        team
          .filter((c) => !c.down && c.objective.kind === 'follow')
          .sort(
            (a, b) =>
              Vector3.Distance(a.character.root.position, feet) - Vector3.Distance(b.character.root.position, feet),
          )[0] ?? null;
    }
    const facts = {
      companionFree: !!helper && !helper.down,
      companionDistance: helper ? Vector3.Distance(helper.character.root.position, feet) : Number.POSITIVE_INFINITY,
      helpUsed,
    };
    if (helper && needsHelp(condition, facts)) helper.help(feet);
    const fallStep = conditionStep(condition, facts, dt);
    condition = fallStep.condition;
    grace = Math.max(0, grace - dt);
    if (fallStep.helpedUp) {
      audio.play('revive');
      heroDefences = helpedUp(heroDefences);
      grace = GRACE_SECONDS + FALLING.rising;
      helpUsed = true;
      helper?.help(null);
      helper = null;
    }
    if (condition.kind === 'restart') restartFight();
    if (condition.kind === 'up' && helper) {
      helper.help(null);
      helper = null;
    }

    // Companions and people.
    for (const c of Object.values(companionsById)) {
      if (!c.visible) continue;
      c.converse(talking?.id === nameKey(c) ? hero.root.position.clone() : null, talking?.speaker === 'partner');
      c.update(dt, hero.root.position, heroForward);
    }
    Object.values(people).forEach((p, i) => {
      // Far from the camera, a person is neither drawn nor moved (unless walking somewhere of their own).
      if (p.visible) {
        const near = Vector3.DistanceSquared(p.character.root.position, camera.position) < PEOPLE_REACH ** 2;
        if (p.character.root.isEnabled() !== near) p.character.root.setEnabled(near);
        if (!near) return;
      }
      p.converse(talking?.id === p.id ? hero.root.position.clone() : null, talking?.speaker === 'partner');
      p.update(dt, hero.root.position, heroForward, i);
    });
    moveBodies();
    heroInCrowd?.teleport(hero.root.position);

    // The drill on the range: three drones down since it began.
    if (drillFrom !== null && range.destroyed - drillFrom >= 3) {
      drillFrom = null;
      director.event('cleared:drill');
    }

    // Where the hero is, for the story.
    const here = place.areaAt(hero.root.position.add(new Vector3(0, 0.5, 0)));
    if (here !== area) {
      area = here;
      atmosphere.setMood({ lightsOut: lightsAreOut, outdoors: area === 'catwalk' || area === 'mast' });
    }
    if (area && director.waiting?.includes(`enter:${area}`)) director.event(`enter:${area}`);
    director.update(dt);
    // Remarks wait for a conversation to end, and each for the one before it.
    remarkWait -= dt;
    if (remarks.length > 0 && !talking && remarkWait <= 0) {
      const line = remarks.shift();
      if (line) remarkWait = say(line);
    }

    // What the hero can talk to or use where they stand.
    let next: typeof promptTarget = null;
    let label = '';
    if (!held && !fight) {
      // Of what is in reach, the nearest, counting what the player faces as nearer.
      const facing = { x: -Math.cos(orbit.alpha), z: -Math.sin(orbit.alpha) };
      const score = (at: Vector3, d: number) => {
        const dx = at.x - feet.x;
        const dz = at.z - feet.z;
        const cos = d > 0.01 ? (dx * facing.x + dz * facing.z) / Math.hypot(dx, dz) : 1;
        return d + 1.2 * (1 - cos);
      };
      let best = Number.POSITIVE_INFINITY;
      for (const [id, knot] of Object.entries(talkKnots)) {
        if (!knot) continue;
        const c = characterOf(id);
        if (!c?.root.isEnabled()) continue;
        const d = Vector3.Distance(c.root.position, feet);
        const s = score(c.root.position, d);
        if (d < TALK_REACH && s < best) {
          best = s;
          next = { kind: 'talk', id };
          label = `Talk to ${nameOf(id)}`;
        }
      }
      for (const [id, thing] of usable) {
        const d = Vector3.Distance(new Vector3(thing.at.x, feet.y, thing.at.z), feet);
        const s = score(thing.at, d);
        if (d < USE_REACH && s < best) {
          best = s;
          next = { kind: 'use', id };
          label = thing.label;
        }
      }
    }
    const nextPrompt: Prompt | null = next ? { kind: next.kind, label } : null;
    if (nextPrompt?.label !== prompt?.label || nextPrompt?.kind !== prompt?.kind) {
      prompt = nextPrompt;
      options.onPrompt(prompt);
    }
    promptTarget = next;

    // The camera: the player's view, a conversation's shots, or the lift-off.
    aimBlend = lerp(aimBlend, aiming || commanding ? 1 : 0, Math.min(1, real * 9));
    for (const g of grips) {
      g.node.setEnabled((fight !== null || (g.hero && aiming)) && (!g.hero || g.kind === kit.carried[0]));
    }
    // The gun points where the crosshair looks while aiming (not where the hand's animation turns
    // it); a long gun in a fight is held low and ready; otherwise it follows the hand.
    if (aiming) {
      // (A camera held for a test keeps the aim it had, so the gun can be looked at from the side.)
      if (!debugView) {
        const from = camera.globalPosition.clone();
        const look = camera.getTarget().subtract(from).normalize();
        const hit = cast(from.add(look.scale(0.3)), from.add(look.scale(60)), true);
        const point = hit ? hit.point : from.add(look.scale(60));
        gunAim.copyFrom(point.subtract(hero.root.position.add(new Vector3(0, 1.4, 0))));
      }
      hero.aimHeld(gunAim);
    } else if (fight && kit.carried[0] !== 'pistol') {
      const down = Math.PI * (40 / 180);
      hero.aimHeld(new Vector3(heroForward.x * Math.cos(down), -Math.sin(down), heroForward.z * Math.cos(down)));
    } else hero.aimHeld(null);
    coverBlend = lerp(coverBlend, cover.inCover && !aiming && !commanding ? 1 : 0, Math.min(1, real * 6));
    const framing = cameraFraming(engine.getAspectRatio(camera));
    const distance = lerp(framing.distance, framing.distance * 0.55, aimBlend);
    const shoulder = lerp(framing.shoulder, Math.max(framing.shoulder, 0.6), aimBlend);
    const eye = lerp(fallen ? 0.7 : CAMERA.eye, CAMERA.coverEye, coverBlend);
    // Aiming narrows the view, the marksman rifle (and a scope) further.
    camera.fov = lerp(CAMERA.fov, CAMERA.aimFov * weaponNow().zoom, aimBlend);
    const right = { x: forward.z, z: -forward.x };
    const pivot = new Vector3(feet.x + right.x * shoulder, feet.y + eye, feet.z + right.z * shoulder);
    const back = new Vector3(
      Math.cos(orbit.alpha) * Math.sin(orbit.beta),
      Math.cos(orbit.beta),
      Math.sin(orbit.alpha) * Math.sin(orbit.beta),
    );
    const head = new Vector3(feet.x, feet.y + eye, feet.z);
    const blocked = cast(head, pivot.add(back.scale(distance)), true);
    const hit = blocked ? Vector3.Distance(pivot, blocked.point) : null;
    let from = pivot.add(back.scale(cameraDistance(hit, distance, CAMERA.minDistance)));
    let lookAt = pivot;

    talkBlend = lerp(talkBlend, talking ? 1 : 0, Math.min(1, real * 3));
    if (talking && partner) lastShot = conversationShot(talking, partner);
    if (talkBlend > 1e-3 && lastShot) {
      const t = talkBlend * talkBlend * (3 - 2 * talkBlend);
      from = Vector3.Lerp(from, vector(lastShot.position), t);
      lookAt = Vector3.Lerp(lookAt, vector(lastShot.target), t);
    } else {
      lastShot = null;
    }

    if (liftoff) {
      // The surveyor rises out of the hangar's open roof; the camera watches from the floor.
      liftoff.t += real;
      const t = liftoff.t;
      const rise = Math.max(0, t - 1.2);
      place.ship.position.y = rise * rise * 1.6;
      place.ship.position.x = 30 + Math.max(0, t - 3) ** 2 * 1.2;
      const ship = place.ship.position.add(new Vector3(0, 3, 0));
      from = (markOf('hangar')?.at ?? Vector3.Zero()).add(new Vector3(-6, 1.6, -4));
      lookAt = ship;
      for (const who of [hero, ...Object.values(companionsById).map((c) => c.character)]) who.root.setEnabled(false);
      if (t > LIFTOFF_SECONDS - 1.2 && t - real <= LIFTOFF_SECONDS - 1.2) options.onFade(true);
      if (t >= LIFTOFF_SECONDS) {
        liftoff = null;
        place.ship.setEnabled(false);
        hero.root.setEnabled(true);
        director.event('done:liftoff');
        window.setTimeout(() => options.onFade(false), 300);
      }
    }
    if (departing) {
      departing.t += real;
      if (departing.shot) {
        from = departing.shot.from;
        lookAt = departing.shot.to;
      }
      if (departing.t >= DEPART_SECONDS) {
        departing = null;
        options.onShot(false);
        director.event('done:depart');
      }
    }
    // Whatever the shot, and wherever a blend between two shots passes, never beyond a wall: the
    // camera is always where the hero's head could see it from.
    if (!liftoff && !departing) from = clearOf(head, from, 0.2);
    if (debugView) {
      from = debugView.from;
      lookAt = debugView.to;
    }
    aimCamera(from, lookAt);
    // Anyone the camera is pressed against fades, rather than filling the screen.
    hero.setFade(Math.min(closeFade(Vector3.Distance(from, head)), abilities.effects.veil > 0 ? 0.25 : 1));
    for (const c of Object.values(companionsById))
      c.character.setFade(closeFade(Vector3.Distance(from, headOf(c.character))));

    // The ears go with the camera; the speaking mouth moves; the music follows the fight.
    audio.listen(from, lookAt.subtract(from).normalize());
    if (voiceNow) {
      voiceNow.who?.speak(voiceNow.voice.level());
      if (voiceNow.voice.ended()) {
        voiceNow.who?.speak(0);
        voiceNow = null;
      }
    }
    audio.music(fight ? 'combat' : chapterMusic);
    audio.ambience(liftoff ? null : (AMBIENCE[area ?? ''] ?? 'ambience_station'));
    const wounded = condition.kind === 'up' && heroDefences.health / heroDefences.healthMax < 0.35;
    if (wounded && !heartbeat) heartbeat = audio.play('heartbeat', { loop: true, volume: 0.6 });
    if (!wounded && heartbeat) {
      heartbeat.stop(0.6);
      heartbeat = null;
    }

    showGlints(feet);
    // The objective's marker.
    const mp = markerPosition();
    const showMarker = !!mp && !talking && !liftoff && Vector3.Distance(mp, feet) > 3;
    marker.setEnabled(showMarker);
    if (mp && showMarker) {
      marker.position.copyFrom(mp);
      marker.position.y += Math.sin(clock * 2.4) * 0.08;
      marker.rotation.y = clock * 1.5;
      marker.scaling.setAll(Math.max(1, Vector3.Distance(from, mp) * 0.09));
    }

    // The screen's vitals, a few times a second.
    vitalsTime += real;
    if (vitalsTime > 0.08) {
      vitalsTime = 0;
      options.onVitals({
        shield: heroDefences.shield / heroDefences.shieldMax,
        health: heroDefences.health / heroDefences.healthMax,
        companions: team.map((c) => ({
          name: c.name,
          shield: c.defences.shield / c.defences.shieldMax,
          health: c.defences.health / c.defences.healthMax,
          down: c.down,
        })),
        condition,
        helpComing: !!helper && !helpUsed,
        inCover: cover.inCover,
        powers: growth.hand.map((id) => ({ id, name: POWERS[id].name, waiting: abilities.waiting(id) })),
        weapon: {
          name: WEAPONS[kit.carried[0]].name,
          other: kit.carried[1] ? WEAPONS[kit.carried[1]].name : null,
        },
        effects: [
          abilities.effects.stim > 0 ? 'Stim' : '',
          abilities.effects.brace > 0 ? 'Braced' : '',
          abilities.effects.veil > 0 ? 'Veiled' : '',
          abilities.effects.barrier > 0 ? 'Barrier' : '',
          abilities.effects.shelter ? 'Shelter' : '',
          abilities.effects.longshot > 0 ? 'Long Shot ready' : '',
        ].filter(Boolean),
      });
    }
  });

  /** A companion's key in the cast (her name in lower case). */
  function nameKey(c: Companion) {
    return c.name.toLowerCase();
  }

  scene.onAfterPhysicsObservable.add(() => {
    // Capped, so a long pause (a tab in the background, a slow frame) cannot throw the hero
    // through a wall in one step.
    const dt = Math.min(scene.deltaTime / 1000, 1 / 20);
    if (!dt || paused) return;
    const support = controller.checkSupport(dt, DOWN);
    controller.setVelocity(characterVelocity(controller, dt, support, desired, heroForward));
    controller.integrate(dt, support, GRAVITY);
  });

  // `?debug` in the address exposes the game's state for testing in the browser's console.
  if (new URLSearchParams(location.search).has('debug')) {
    const facing = () => ({ x: -Math.cos(orbit.alpha), z: -Math.sin(orbit.alpha) });
    Object.assign(window, {
      lightkeeper: {
        scene,
        /** Gives the hero weapons and mods, as the armoury would (a kit's parts, made sound). */
        arm: (k: Partial<Kit>) => {
          kit = soundKit({ ...kit, ...k }, heroClass);
          wieldNow();
        },
        kit: () => kit,
        /** The Banked in the fight, and calling a squad in (kinds, at the range's entry). */
        banked: () => banked?.inspect() ?? [],
        /** Takes a companion out of the scene (a test that wants the Banked to themselves). */
        standDown: (id: string) => companionsById[id]?.show(false),
        /** Brings down every foe in the fight, machines and Banked. */
        downAll: () => {
          // More than one blow each: a warden's barrier takes the first from in front.
          for (let i = 0; i < foes.size; i++) {
            for (let blow = 0; blow < 3 && foes.status(i)?.alive; blow++) {
              foes.strikeMachine(i, { amount: 5000, kind: 'blast' }, 'hero');
            }
          }
        },
        /** A blow on one of the Banked, as if the hero (standing where they stand) struck it. */
        strikeBanked: (id: number, amount: number, kind: 'kinetic' | 'arc' | 'blast' | 'field' = 'kinetic') =>
          banked?.strikeMachine(id, { amount, kind }, 'hero') ?? false,
        /** A power's effect on one of the Banked, as the powers give it. */
        affectBanked: (id: number, effect: 'lift' | 'pull' | 'blind' | 'mark', seconds: number) =>
          banked?.affect(id, effect, seconds, hero.root.position.add(new Vector3(0, 1, 2))),
        callBanked: (kinds: ('trooper' | 'engineer' | 'warden')[]) =>
          banked?.wake(kinds, place.vents.banked_range ?? [hero.root.position.add(new Vector3(0, 0, 8))]),
        fov: () => camera.fov,
        /** Uses a power whether or not it is in hand, as the hero has it; true if it acted. */
        power: (id: PowerId) => abilities.use(id),
        effects: () => ({ ...abilities.effects, defences: heroDefences }),
        /** Experience, as the story gives it. */
        xp: (amount: number) => grant(amount, 'Testing', `test:${performance.now()}`),
        /** Credits, as the story pays them (D-62). */
        credits: (amount: number) => {
          kit = pay(kit, `test:${performance.now()}`, amount);
          keepGrowth();
          return kit.credits;
        },
        growth: () => ({ hero: growth, crew, mods, defences: heroDefences }),
        state: () => ({
          feet: hero.root.position.asArray(),
          area,
          cover,
          aiming: input.aiming,
          commanding,
          waiting: director.waiting,
          fight: fight?.id ?? null,
          condition,
          defences: heroDefences,
          companions: [...joined].map((c) => ({
            name: c.name,
            objective: c.objective,
            feet: c.character.root.position.asArray(),
          })),
          swarm: { live: swarm.live, down: swarm.down, fired: swarm.fired, machines: swarm.inspect() },
          drones: { destroyed: range.destroyed },
          camera: camera.position.asArray(),
          /** Who is shown, and where (x, z), by name. */
          people: Object.fromEntries(
            ['hero', ...others].map((id) => {
              const c = characterOf(id);
              return [id, c?.root.isEnabled() ? [c.root.position.x, c.root.position.z] : null];
            }),
          ),
          prompt,
          talk: talkKnots,
          navMilliseconds,
        }),
        /** Hurts the hero, as a shot would (for testing what happens when they fall). */
        hurt: (amount: number) => {
          const r = takeHit(heroDefences, amount, 'kinetic');
          heroDefences = r.defences;
          if (r.down && condition.kind === 'up') condition = fall(helpUsed);
        },
        /** Turns the hero's view to a point (for an automatic player in tests). */
        aimAt: (p: number[]) => {
          const target = Vector3.FromArray(p);
          const eye = hero.root.position.add(new Vector3(0, CAMERA.eye, 0));
          const to = target.subtract(eye);
          orbit.alpha = Math.atan2(-to.z, -to.x);
          orbit.beta = Math.min(CAMERA.maxBeta, Math.max(CAMERA.minBeta, Math.acos(-to.y / to.length())));
        },
        /** Holds the camera at a view (positions as [x, y, z]), or lets it follow the hero again (null). */
        view: (from: number[] | null, to?: number[]) => {
          debugView = from && to ? { from: Vector3.FromArray(from), to: Vector3.FromArray(to) } : null;
        },
        /** Where a walker from `from` would end up on the way to `to` (it stops short of what it cannot reach). */
        route: (from: number[], to: number[]) => {
          const path = nav?.path(Vector3.FromArray(from), Vector3.FromArray(to)) ?? [];
          return path.length > 0 ? (path[path.length - 1] as Vector3).asArray() : null;
        },
        /** Where a node is (a bone, by name), for placing a view. */
        where: (name: string) => scene.getTransformNodeByName(name)?.getAbsolutePosition().asArray() ?? null,
        /** Sets how the sidearm sits in the hand (for finding the grip by eye). */
        grip: (rotation: [number, number, number], offset: [number, number, number]) => {
          for (const { node } of grips) {
            const s = new Vector3();
            if (node.parent instanceof TransformNode) node.parent.computeWorldMatrix(true).decompose(s);
            node.rotation.set(...rotation);
            node.position.set(offset[0] / s.x, offset[1] / s.y, offset[2] / s.z);
          }
        },
        /** Holds or lets go of aim and fire, as the touch buttons do. */
        trigger: (aim: boolean, fire: boolean) => {
          input.aimToggle = aim;
          input.fireTouch = fire;
        },
        /** Starts a fight by name, wherever the hero is. */
        fight: (id: string) => startEncounter(id),
        /** Reports an event to the story, as if it had happened (skipping a fight: `cleared:<id>`). */
        event: (name: string) => {
          if (name.startsWith('cleared:') && fight) {
            swarm.clear();
            banked?.clear();
            fight = null;
            fightOver();
          }
          director.event(name);
        },
        /**
         * Where the conversation's camera would stand for a hero and a partner whose feet are at these
         * points, with the camera's last guard against walls, as the game places it.
         */
        talkCamera: (heroFeet: number[], partnerFeet: number[], heroSpeaks: boolean) => {
          const lift = new Vector3(0, HEAD_HEIGHT, 0);
          const heroHead = Vector3.FromArray(heroFeet).add(lift);
          const partnerHead = Vector3.FromArray(partnerFeet).add(lift);
          const shot = shotBetween(heroHead, partnerHead, { speaker: heroSpeaks ? 'hero' : 'partner', side: 1 });
          return clearOf(heroHead, vector(shot.position), 0.2).asArray();
        },
        /** Every prop placed (model, base, turn, box), for checking which way each faces. */
        props: () => place.props,
        ray: (a: number[], b: number[], pastHero = false) => {
          const h = cast(Vector3.FromArray(a), Vector3.FromArray(b), pastHero);
          return h ? { distance: h.distance, point: h.point.asArray() } : null;
        },
        wake: (count = 3, kind: 'mote' | 'lattice' | 'tender' = 'mote') =>
          swarm.wake(
            Array.from({ length: count }, (_, i) => hero.root.position.add(new Vector3(-4 + i * 3, 4, 10))),
            kind,
          ),
        probe: () => probeCover(hero.root.position, facing()),
        /** Moves the hero (feet at x, z, y) and turns the camera to look along yaw, pitched by beta. */
        teleport: (x: number, z: number, yaw = 0, beta = orbit.beta, y = 0) => {
          moveHero(new Vector3(x, y, z), yaw);
          orbit.beta = beta;
        },
      },
    });
  }

  let ready = false;
  let statsTime = 0;
  /** The star map, drawn instead of the place while it is open (its own scene, the same engine). */
  let overlay: { render(): void } | null = null;
  engine.runRenderLoop(() => {
    if (overlay && ready) {
      overlay.render();
      return;
    }
    scene.render();
    if (!ready) {
      ready = true;
      options.onReady();
      // `?banked`: a squad on the range, to try them (ACT1.md increment 4).
      if (banked && new URLSearchParams(location.search).has('banked')) startEncounter('banked_drill');
      options.onGrowth(pointsToSpend());
      director.step();
      // The chapter's scene is set; from here `start` commands are for a resumed game only. (Cleared
      // in the first frame's update instead, it came before this step, and a resumed game left the
      // hero in the bunk room and everyone unplaced at one spot: the owner's phone, 25 October 2026.)
      resuming = false;
    }
    statsTime += engine.getDeltaTime();
    if (statsTime > 500) {
      statsTime = 0;
      options.onStats({
        fps: Math.round(engine.getFps()),
        renderer: rendererName(engine),
        gpu: gpuName(engine),
        tier: options.tier,
        activeMeshes: scene.getActiveMeshes().length,
      });
    }
  });

  const onResize = () => {
    applyScaling();
    engine.resize();
  };
  window.addEventListener('resize', onResize);

  return {
    input,
    engine,
    showMap(view) {
      overlay = view;
      if (view) input.release();
    },
    setCourse(id) {
      director.event(`course:${id}`);
    },
    kit: () => ({ kit, fighting: !!fight, makeDo: mods.modCost < 1 }),
    setKit(next) {
      if (fight) return false;
      kit = soundKit(next, heroClass);
      wieldNow();
      keepGrowth();
      return true;
    },
    swapWeapon: () => swapWeapon(),
    growth: () => ({
      hero: growth,
      crew: { ...crew },
      fighting: !!fight,
      // Jo is met in the hangar; Mira joins in her clinic at Pyre Remnant (PYRE.md).
      crewKnown: [
        'ren',
        ...(BEFORE_JO.includes(lastCheckpoint) ? [] : ['jo']),
        ...(runner.variable('second') ? ['mira'] : []),
      ],
    }),
    setGrowth(next) {
      if (fight) return false;
      growth = soundGrowth(next.hero, heroClass);
      for (const who of Object.keys(crew)) {
        const c = next.crew[who];
        if (c) crew[who] = companionAuto(c, who, levelOf(growth.xp));
      }
      mods = modifiers(options.looks, growth.training);
      // Out of a fight the hero is whole, and the new limits hold at once.
      heroDefences = restored(personDefences(mods));
      keepGrowth();
      return true;
    },
    setCommandView,
    order,
    usePower,
    speak: (line) => speakLine(line),
    hush() {
      voiceNow?.voice.stop();
      voiceNow?.who?.speak(0);
      voiceNow = null;
    },
    interact() {
      if (!promptTarget || talking) return;
      if (promptTarget.kind === 'talk') {
        const knot = talkKnots[promptTarget.id];
        if (knot) startConversation(promptTarget.id, knot);
      } else {
        const id = promptTarget.id;
        const thing = usable.get(id);
        if (thing?.screen) {
          audio.play('ui_click');
          input.release();
          // The armoury's rack: the old captain's weapons, there for the taking the first time.
          if (thing.screen === 'armoury') {
            for (const k of KINDS) kit = take(kit, `armoury:${k}`, k);
            keepGrowth();
          }
          options.onScreen(thing.screen);
          director.event(`used:${id}`);
          return;
        }
        if (thing?.find) {
          kit = take(kit, `find:${id}`, thing.find);
          usable.delete(id);
          audio.play('ui_click');
          const found = thing.find in MODS ? MODS[thing.find as ModId].name : WEAPONS[thing.find as WeaponKind].name;
          options.onNote(`Found: ${found}. Fit it at the armoury.`);
          keepGrowth();
          director.event(`used:${id}`);
          return;
        }
        const knot = thing?.knot;
        usable.delete(id);
        if (knot) remark(knot);
        else audio.play(id === 'relay' ? 'relay' : 'ui_click', { at: hero.root.position });
        director.event(`used:${id}`);
      }
    },
    setSpeaker(who) {
      if (talking) talking.speaker = who;
    },
    continueStory() {
      director.event('done:card');
    },
    endConversation() {
      if (!talking) return;
      const { id, knot } = talking;
      talking = null;
      // A conversation is had once; the story offers another if it has one.
      talkKnots[id] = null;
      director.event(`talked:${knot}`);
    },
    setDifficulty(d) {
      difficulty = d;
    },
    setPaused(on) {
      paused = on;
      scene.animationTimeScale = on ? 0 : commanding ? COMMAND_TIME : 1;
      nav?.setTimeFactor(on ? 0 : commanding ? COMMAND_TIME : 1);
      if (on) input.release();
    },
    companions: () => [...joined].map((c) => c.name),
    dispose() {
      window.removeEventListener('resize', onResize);
      input.dispose();
      engine.stopRenderLoop();
      // The drawing context is let go at once, not when the browser gets round to it: a phone holds
      // one place at a time, and the next is about to load.
      const gl = (engine as unknown as { _gl?: WebGLRenderingContext | null })._gl;
      scene.dispose();
      engine.dispose();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/**
 * The velocity the character controller should take this step: on the ground it follows the
 * surface towards the desired velocity; in the air it keeps falling. After Babylon's character
 * controller example.
 */
function characterVelocity(
  controller: PhysicsCharacterController,
  dt: number,
  support: CharacterSurfaceInfo,
  desired: Vector3,
  forward: Vector3,
): Vector3 {
  const current = controller.getVelocity();
  if (support.supportedState === CharacterSupportedState.SUPPORTED) {
    let output = controller.calculateMovement(
      dt,
      forward,
      support.averageSurfaceNormal,
      current,
      support.averageSurfaceVelocity,
      desired,
      UP,
    );
    output.subtractInPlace(support.averageSurfaceVelocity);
    if (output.dot(UP) > 1e-3) {
      // Keep the speed along a slope horizontal rather than letting it lift the character.
      const length = output.length();
      output.normalizeFromLength(length);
      const horizontal = length / support.averageSurfaceNormal.dot(UP);
      output = support.averageSurfaceNormal.cross(output).cross(UP).scale(horizontal);
    }
    return output.addInPlace(support.averageSurfaceVelocity);
  }
  const output = controller.calculateMovement(dt, forward, UP, current, Vector3.ZeroReadOnly, desired, UP);
  output.addInPlace(UP.scale(-output.dot(UP)));
  output.addInPlace(UP.scale(current.dot(UP)));
  return output.addInPlace(GRAVITY.scale(dt));
}

export { Mesh };
