import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import {
  CharacterSupportedState,
  type CharacterSurfaceInfo,
  PhysicsCharacterController,
} from '@babylonjs/core/Physics/v2/characterController';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { Scene } from '@babylonjs/core/scene';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import slice from '../../story/slice.ink';
import { buildAbilities } from './abilities.ts';
import { ASSIST_CONE, pickAssistTarget } from './aim.ts';
import { CHARACTERS } from './appearance.ts';
import { buildAtmosphere } from './atmosphere.ts';
import type { GameAudio, Playing, Voice } from './audio.ts';
import { type Character, loadCharacterTemplate } from './characters.ts';
import { buildRange } from './combat.ts';
import { type Companion, spawnCompanion } from './companion.ts';
import { type Conversation, type Line, StoryRunner } from './conversation.ts';
import { COVER, type CoverProbe, type CoverState, coverStep } from './cover.ts';
import {
  DAMAGE,
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
import { Input } from './input.ts';
import type { Body, Looks, Manifest } from './looks.ts';
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
import { poseWeights } from './pose.ts';
import { CLASS_POWERS, POWERS, type PowerId } from './powers.ts';
import { QUALITY, type QualityTier } from './quality.ts';
import { overShoulder, type Point, type Shot, sideOf } from './shots.ts';
import { buildStation, type Mark } from './station.ts';
import { hitSide } from './swarm.ts';

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
  tookMast: boolean;
  merrowWarned: boolean;
  ilyaLost: boolean;
  firstLead: string;
  /** Ilya's readings came aboard (he brought them, or Dena did). */
  haveCurve: boolean;
  renApproval: number;
  joApproval: number;
}

/** A saved game: the hero, the story's state at its last checkpoint, and the difficulty. */
export interface SaveData {
  version: 1;
  looks: Looks;
  story: string;
  checkpoint: string;
  difficulty: Difficulty;
  at: number;
  /** Which script the story's state belongs to; a save from another resumes at its checkpoint. */
  script?: string;
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
  setDifficulty(difficulty: Difficulty): void;
  /** Stops the game's time (the pause menu), or starts it again. */
  setPaused(paused: boolean): void;
  /** A conversation's line is on screen: its voice plays, the speaker's mouth moves. Seconds long, or null. */
  speak(line: { speaker: string; id: string | null; codex?: string }): number | null;
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
  onSave(save: SaveData): void;
  onEnd(ending: Ending): void;
  /** The story opened an entry of the codex (src/game/codex.ts). */
  onCodex(id: string): void;
}

const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.35;
/** How far ahead the cover is looked for while in it: as far as it can be taken from, and a little. */
const COVER_AHEAD = COVER.reach + CAPSULE_RADIUS + 0.15;
/** The hero's capsule's collision group, and every group but it (Havok's 32-bit masks). */
const HERO_GROUP = 2;
const ALL_BUT_HERO = 0xffffffff - HERO_GROUP;
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
const FIRE_INTERVAL = 0.22;
const SHOT_POSE = 0.18;
const SHOT_RANGE = 60;
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
};
/** The ambience of each place. */
const AMBIENCE: Record<string, string> = {
  catwalk: 'wind',
  mast: 'wind',
  hangar: 'ambience_hangar',
};
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

  const place = buildStation(scene, q);
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
   * `pastHero` looks through the hero's own capsule.
   */
  const cast = (from: Vector3, to: Vector3, pastHero = false) => {
    physics.raycast(from, to, ray, pastHero ? { collideWith: ALL_BUT_HERO } : undefined);
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
  const others = ['ren', 'jo', 'hale', 'pell', 'dena', 'sorrel', 'ilya'];
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
  const grips: { hero: boolean; node: TransformNode }[] = [];
  void LoadAssetContainerAsync(`${import.meta.env.BASE_URL}assets/props/sidearm-meshy.glb`, scene)
    .then((gun) => {
      for (const c of [hero, characters.ren, characters.jo]) {
        const node = c?.hold(gun, SIDEARM.length, SIDEARM.rotation, SIDEARM.offset);
        if (node) grips.push({ hero: c === hero, node });
        node?.setEnabled(false);
      }
    })
    .catch(() => {
      // No sidearm: empty hands still fire.
    });

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
    // The companions' sidearms have a voice of their own, so the player hears who fired.
    audio.play(shooter === 0 ? 'pistol' : 'pistol_ally', { at: from, volume: shooter === 0 ? 1 : 0.8 });
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
  const world = { range, cast: (a: Vector3, b: Vector3) => cast(a, b), groundUnder };
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
  const companionsById: Record<string, Companion> = { ren, jo };
  /** Companions with the hero: Ren from the start, Jo once she joins. */
  const joined = new Set<Companion>([ren]);
  const people: Record<string, Person> = {};
  for (const id of ['hale', 'pell', 'dena', 'sorrel', 'ilya']) {
    const c = characters[id];
    if (!c) continue;
    people[id] = spawnPerson(scene, id, looksOf(options.manifest, id).name, c, nav, groundUnder);
  }
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
  let heroDefences: Defences = personDefences();
  let condition: Condition = { kind: 'up' };
  let helpUsed = false;
  let helper: Companion | null = null;
  /** Seconds of grace after being helped up: getting up under fire is not a second fall. */
  let grace = 0;
  let commanding = false;
  /** The hero's class's three powers (D-33), and how long the casting arm stays up. */
  const powers: PowerId[] = [...(CLASS_POWERS[options.looks.heroClass] ?? CLASS_POWERS.breacher ?? [])];
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
  /** Things that can be used, by id; a thing to look at has the knot of the hero's remark. */
  const usable = new Map<string, { at: Vector3; label: string; knot?: string }>();
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
  let ended = false;

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
  const abilities = buildAbilities({
    scene,
    swarm,
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
    heal: (amount) => {
      heroDefences = { ...heroDefences, health: Math.min(heroDefences.healthMax, heroDefences.health + amount) };
    },
    say: (text) => options.onNote(text),
    sound: (id, at) => {
      audio.play(id, { at });
    },
  });
  /** Uses the hero's power in a slot, facing where the camera looks, the casting arm up. */
  const usePower = (slot: number) => {
    const id = powers[slot];
    if (!id || commanding || talking || condition.kind !== 'up' || liftoff || ended) return;
    if (abilities.use(id)) {
      castPose = 0.55;
      heroYaw = yawOf({ x: -Math.cos(orbit.alpha), z: -Math.sin(orbit.alpha) });
      if (POWERS[id].id !== 'veil') abilities.effects.veil = 0;
    }
  };

  const startConversation = (id: string, knot: string) => {
    const partner = characterOf(id);
    if (!partner || talking) return;
    input.release();
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
    tookMast: runner.variable('took_mast') === true,
    merrowWarned: runner.variable('merrow_warned') === true,
    ilyaLost: runner.variable('ilya_lost') === true,
    firstLead: String(runner.variable('first_lead') ?? ''),
    haveCurve: runner.variable('have_curve') === true,
    renApproval: Number(runner.variable('ren_approval') ?? 0),
    joApproval: Number(runner.variable('jo_approval') ?? 0),
  });

  /** Plays a line's voice, the speaker's mouth moving with it; its length in seconds, or null. */
  const speakLine = (line: { speaker: string; id: string | null; codex?: string }): number | null => {
    if (line.codex) options.onCodex(line.codex);
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
        options.onObjective(c.rest);
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
        if (m) people[a]?.walkTo(m.at, b === 'boarding');
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
      case 'encounter':
        startEncounter(a);
        break;
      case 'use': {
        const m = markOf(b);
        if (m) usable.set(a, { at: m.at, label: c.args.slice(2).join(' ') });
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
      options.onSave({
        version: 1,
        looks: options.looks,
        story: state,
        checkpoint: name,
        difficulty,
        at: Date.now(),
        script: SCRIPT,
      });
    },
  });
  if (options.save) {
    // The story's state only fits the script it was saved from: a save from an older one starts
    // its chapter again (what was chosen before it is forgotten, the chapter and the hero are kept).
    try {
      if (options.save.script !== SCRIPT) throw new Error('saved from another version of the story');
      runner.load(options.save.story);
    } catch {
      runner.story.ChoosePathString(`slice.${options.save.checkpoint}`);
    }
  } else if (options.chapter) runner.story.ChoosePathString(`slice.${options.chapter}`);

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

  const shoot = () => {
    const from = camera.globalPosition.clone();
    let dir = camera.getTarget().subtract(from).normalize();
    // Aim assist on phones (D-17), and on Story for everyone; stronger or weaker by difficulty.
    if (options.assist || difficulty === 'story') {
      const id = pickAssistTarget(range.candidates(from), dir, ASSIST_CONE * DIFFICULTY[difficulty].assist);
      if (id !== null) dir = range.centre(id).subtract(from).normalize();
    }
    const end = from.add(dir.scale(SHOT_RANGE));
    const struck = cast(from.add(dir.scale(0.3)), end, true);
    const point = struck ? struck.point : end;
    // Out of the Veil, the first shot does double; shooting gives the hero away.
    const bonus = abilities.effects.veil > 0 ? 2 : 1;
    abilities.effects.veil = 0;
    const hitTarget = range.hit(struck?.body, 'hero', { amount: DAMAGE.pistol * bonus, kind: 'kinetic' });
    hero.fire();
    range.shot(hero.muzzle(), point, hitTarget);
    shotPose = SHOT_POSE;
  };

  /** The middle of a character's head, by their height. */
  const headOf = (character: Character) =>
    character.root.position.add(new Vector3(0, HEAD_HEIGHT * character.root.scaling.y, 0));
  /**
   * The shot for the conversation's present moment: over the hero's shoulder onto the partner while
   * the partner speaks or the hero chooses, and over the partner's onto the hero while the hero
   * speaks. When a wall stands where the camera would, it tries the other side of the line, and
   * failing that comes in short of the wall.
   */
  const conversationShot = (now: NonNullable<typeof talking>, partner: Character): Shot => {
    const heroHead = headOf(hero);
    const partnerHead = headOf(partner);
    const line = { x: partnerHead.x - heroHead.x, z: partnerHead.z - heroHead.z };
    const [listener, speaker] = now.speaker === 'hero' ? [partnerHead, heroHead] : [heroHead, partnerHead];
    const aspect = engine.getAspectRatio(camera);
    const shotFrom = (side: 1 | -1) => {
      const shot = overShoulder(listener, speaker, line, side, aspect);
      const at = vector(shot.position);
      const wall = cast(listener, at, true);
      return { shot, at, wall: wall ? wall.distance / Vector3.Distance(listener, at) : 1 };
    };
    let chosen = shotFrom(now.side);
    if (chosen.wall < 1) {
      const other = shotFrom(now.side === 1 ? -1 : 1);
      if (other.wall >= 1) {
        now.side = now.side === 1 ? -1 : 1;
        chosen = other;
      }
    }
    if (chosen.wall >= 1) return chosen.shot;
    const pulled = Vector3.Lerp(listener, chosen.at, Math.max(0.15, chosen.wall - 0.12));
    return { position: { x: pulled.x, y: pulled.y, z: pulled.z }, target: chosen.shot.target };
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
    const held = commanding || talking !== null || fallen || liftoff !== null || ended;
    const aiming = !held && (input.aiming || input.firing);
    if (aiming !== wasAiming) {
      wasAiming = aiming;
      options.onAim(aiming);
    }

    // Look: drag or mouse turns the camera round the hero, more finely while aiming.
    const look = input.takeLook();
    if (!talking && !liftoff) {
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
      const speed = cover.inCover ? 0 : SPEED.walk * push;
      desired.set(unit.x * speed, 0, unit.z * speed);
      heroYaw = turnTowards(heroYaw, yawOf(forward), 14 * dt);
      hero.setPose(
        poseWeights({
          mode: 'aim',
          speed: groundSpeed,
          direction: push > 0 ? { x: move.x / push, y: move.y / push } : { x: 0, y: 0 },
          firing: shotPose > 0,
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
      const pose = poseWeights({ mode: 'move', speed: groundSpeed });
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
      fireCooldown = FIRE_INTERVAL;
      shoot();
    }
    abilities.update(dt);
    castPose -= dt;
    /** Under a stim, the world slows for the hero: the swarm and its shots, the drones. */
    const worldDt = abilities.effects.stim > 0 ? dt * 0.35 : dt;
    range.update(worldDt);
    place.update(dt);

    // The fight, and the swarm.
    if (fight) {
      const step = fightStep(fight, swarm.live, dt);
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
    swarm.update(worldDt, {
      targets: [
        {
          id: 'hero',
          feet: hero.root.position,
          // Crouched behind cover the hero is a smaller mark: the cover takes the shots.
          height: cover.inCover && !aiming ? 1.1 : CAPSULE_HEIGHT,
          // Veiled, the machines cannot see the hero to shoot.
          down: fallen || liftoff !== null || abilities.effects.veil > 0,
        },
        ...team.map((c) => ({ id: c.name, feet: c.character.root.position, height: CAPSULE_HEIGHT, down: c.down })),
      ],
      cast: (from, to) => cast(from, to, true),
      difficulty,
      decoy: abilities.effects.decoy,
      onHit: (id, from, damage) => {
        const amount = damage * DIFFICULTY[difficulty].taken;
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
      },
    });

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
    if (condition.kind === 'up') heroDefences = recover(heroDefences, dt);
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
      p.converse(talking?.id === p.id ? hero.root.position.clone() : null, talking?.speaker === 'partner');
      p.update(dt, hero.root.position, heroForward, i);
    });

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
    for (const g of grips) g.node.setEnabled(fight !== null || (g.hero && aiming));
    coverBlend = lerp(coverBlend, cover.inCover && !aiming && !commanding ? 1 : 0, Math.min(1, real * 6));
    const framing = cameraFraming(engine.getAspectRatio(camera));
    const distance = lerp(framing.distance, framing.distance * 0.55, aimBlend);
    const shoulder = lerp(framing.shoulder, Math.max(framing.shoulder, 0.6), aimBlend);
    const eye = lerp(fallen ? 0.7 : CAMERA.eye, CAMERA.coverEye, coverBlend);
    camera.fov = lerp(CAMERA.fov, CAMERA.aimFov, aimBlend);
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
        powers: powers.map((id) => ({ id, name: POWERS[id].name, waiting: abilities.waiting(id) })),
        effects: [
          abilities.effects.stim > 0 ? 'Stim' : '',
          abilities.effects.brace > 0 ? 'Braced' : '',
          abilities.effects.veil > 0 ? 'Veiled' : '',
          abilities.effects.barrier > 0 ? 'Barrier' : '',
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
          /** Who is shown, and where (x, z), by name. */
          people: Object.fromEntries(
            ['hero', 'ren', 'jo', 'hale', 'pell', 'dena', 'sorrel', 'ilya'].map((id) => {
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
            fight = null;
            fightOver();
          }
          director.event(name);
        },
        ray: (a: number[], b: number[]) => {
          const h = cast(Vector3.FromArray(a), Vector3.FromArray(b));
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
  engine.runRenderLoop(() => {
    scene.render();
    if (!ready) {
      ready = true;
      options.onReady();
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
        const knot = usable.get(id)?.knot;
        usable.delete(id);
        if (knot) remark(knot);
        else audio.play(id === 'relay' ? 'relay' : 'ui_click', { at: hero.root.position });
        director.event(`used:${id}`);
      }
    },
    setSpeaker(who) {
      if (talking) talking.speaker = who;
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
      scene.dispose();
      engine.dispose();
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
