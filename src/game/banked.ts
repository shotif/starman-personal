import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';
import {
  BANKED,
  BARRIER,
  type BankedKind,
  type BankedState,
  bankedStep,
  barrierStep,
  barrierStops,
  type Cover,
  type Flat,
  hitChance,
  neediest,
  newState,
  SUPPORT,
} from './banked-rules.ts';
import type { Character } from './characters.ts';
import type { Damage, TargetGroup } from './combat.ts';
import { type Defences, type Difficulty, recover, takeHit } from './defences.ts';
import { FIELD_AMBER, fieldMaterial, ripple, struckAt } from './fields.ts';
import type { BankedCall } from './fight-talk.ts';
import { modelsAt } from './kit.ts';
import { applyLineage, type Body, defaultLooks, type Looks, type Manifest } from './looks.ts';
import { turnTowards, yawOf } from './motion.ts';
import type { AgentHandle, Navigation } from './navigation.ts';
import { dress } from './people.ts';
import { poseWeights } from './pose.ts';
import { HELD, SIDEARM } from './weapons.ts';

/**
 * The Banked in a fight (D-51; ACT1.md increment 4; COMBAT.md, *The Banked*): people who take
 * cover, come up to fire, move when flanked, fall back, go round; an engineer who shields them and
 * sends out the engines' motes; a warden behind a barrier. The rules are src/game/banked-rules.ts;
 * this is their bodies, their walking, their shots and how they look. A target group of the range,
 * so the hero's shots, aim assist, powers and the companions find them as they find the swarm.
 */
export interface BankedWorld {
  /** Who they may shoot: the hero and the companions. */
  targets: { id: string; feet: Vector3; height: number; down: boolean; moving: boolean }[];
  /** The first wall or piece of cover between two points (people pass), or null. */
  obstacle(from: Vector3, to: Vector3): Vector3 | null;
  onHit(id: string, from: Vector3, damage: number): void;
  difficulty: Difficulty;
  /** Where whoever struck stands (the hero, a companion), for the warden's barrier. */
  positionOf(by: string): Vector3 | null;
  /** The swarm's machines up now, and sending more out (the engineer's motes). */
  motesLive(): number;
  sendMotes(from: Vector3[]): void;
}

export interface BankedEvent {
  kind: 'fire' | 'glint' | 'down' | 'shield' | 'motes' | 'barrier' | 'talk' | 'impact' | 'miss';
  who: BankedKind;
  at: Vector3;
  /** For `talk`: what there is to say (D-67), and which of the squad would say it. */
  call?: BankedCall;
  member?: number;
}

export interface BankedGroup extends TargetGroup {
  /** Banked standing in the fight. */
  readonly live: number;
  /** Calls a squad in at these points (one each, in order). */
  wake(kinds: readonly BankedKind[], at: readonly Vector3[]): void;
  clear(): void;
  update(dt: number, world: BankedWorld): void;
  status(
    id: number,
  ): { alive: boolean; at: Vector3; primed: boolean; shielded: boolean; marked: boolean; kind: string } | null;
  strikeMachine(id: number, damage: Damage, by: string): boolean;
  affect(
    id: number,
    effect: 'lift' | 'pull' | 'prime' | 'mark' | 'spoof' | 'blind',
    seconds: number,
    towards?: Vector3,
  ): void;
  burst(at: Vector3, radius: number, damage: Damage, by: string): number;
  unprime(id: number): void;
  drainEvents(): BankedEvent[];
  /** The figure of one of the squad (by its place in the group), for its voice and mouth. */
  speaker(member: number): Character | null;
  inspect(): {
    /** Its place in the group (for `strikeMachine` and the powers' list after the swarm's). */
    id: number;
    kind: BankedKind;
    at: number[];
    mode: string;
    health: number;
    shield: number;
    barrier: number;
    crouched: boolean;
    cover: number | null;
    pulled: boolean;
    blinded: boolean;
  }[];
}

/** Banked collision group: the hero's and the companions' shots meet it; the people's bodies do not. */
export const BANKED_GROUP = 8;

/**
 * Who they are under the armour: the people of every power (D-37), from the creator's options. The
 * troopers and the warden wear the Banked's armour, the engineer its light cut (D-66).
 */
const LOOKS: {
  body: Body;
  lineage: string;
  skin: string;
  hair: string;
  eyes: string;
  height?: number;
  outfit: string;
}[] = [
  { body: 'man', lineage: 'heavyworlder', skin: 'tone4', hair: 'shaved', eyes: 'brown', outfit: 'armour' },
  { body: 'woman', lineage: 'spacer', skin: 'tone2', hair: 'shaved', eyes: 'grey', outfit: 'armour' },
  { body: 'man', lineage: 'earthborn', skin: 'tone5', hair: 'shaved', eyes: 'brown', outfit: 'armour' },
  { body: 'woman', lineage: 'earthborn', skin: 'tone3', hair: 'shaved', eyes: 'green', outfit: 'armour-light' },
  { body: 'man', lineage: 'heavyworlder', skin: 'tone1', hair: 'shaved', eyes: 'blue', height: 1.12, outfit: 'armour' },
];
/**
 * What each kind wears besides the armour (D-66; models in art/models.json): a closed helmet for
 * the troopers and the warden, an open one for the engineer, whose face is seen; the engineer's
 * pack, where her motes ride, and the warden's barrier projector. Each on a bone: its size, and its
 * bottom's offset from the bone at rest (to the figure's right, up, forward), checked from four sides.
 */
const GEAR: Record<BankedKind, { model: string; bone: string; size: number; offset: [number, number, number] }[]> = {
  trooper: [{ model: 'banked-helmet', bone: 'head', size: 0.31, offset: [0, -0.1, 0.0] }],
  engineer: [
    { model: 'banked-headset', bone: 'head', size: 0.27, offset: [0, -0.02, -0.01] },
    { model: 'banked-pack', bone: 'spine_03', size: 0.5, offset: [0, -0.3, -0.11] },
  ],
  warden: [
    { model: 'banked-helmet', bone: 'head', size: 0.31, offset: [0, -0.1, 0.0] },
    { model: 'banked-projector', bone: 'spine_03', size: 0.62, offset: [0, -0.3, -0.14] },
  ],
};
/** The pool: three troopers, an engineer and a warden; a squad is at most five (ACT1.md). */
const POOL: BankedKind[] = ['trooper', 'trooper', 'trooper', 'engineer', 'warden'];
/** The uniform under the armour: near-black, so the charcoal plates and their gold read (D-66). */
const UNDER = new Color3(0.32, 0.32, 0.35);
const EYE = 1.55;
const CHEST = 1.2;
const LYING = 6;

interface Member {
  kind: BankedKind;
  character: Character;
  anchor: TransformNode;
  agent: AgentHandle | null;
  body: Mesh;
  aggregate: PhysicsAggregate;
  active: boolean;
  alive: boolean;
  fallen: number;
  defences: Defences;
  state: BankedState;
  yaw: number;
  primed: number;
  marked: number;
  lifted: number;
  pulled: number;
  pullTo: Vector3 | null;
  blinded: number;
  barrier: number;
  barrierSince: number;
  sinceShield: number;
  sinceMotes: number;
  shotPose: number;
  crouched: boolean;
  glint: Mesh;
  tracer: Mesh;
  tracerTime: number;
  shell: Mesh | null;
}

export async function buildBanked(
  scene: Scene,
  setup: {
    templates: Record<Body, AssetContainer | null>;
    manifest: Manifest;
    nav: Navigation | null;
    groundUnder(at: Vector3): number | null;
    covers: Cover[];
    /** The area (room) a point is in: cover counts only in the room a Banked stands in. */
    areaOf(at: Vector3): string | null;
    detailed: boolean;
  },
): Promise<BankedGroup> {
  const coverArea = setup.covers.map((c) => setup.areaOf(new Vector3(c.at.x, c.y + 0.5, c.at.z)));
  const glow = (name: string, colour: Color3, alpha = 1) => {
    const m = new StandardMaterial(name, scene);
    m.disableLighting = true;
    m.emissiveColor = colour;
    m.alpha = alpha;
    return m;
  };
  const glintMaterial = glow('banked-glint', new Color3(1, 0.75, 0.3));
  const tracerMaterial = glow('banked-tracer', new Color3(1, 0.7, 0.35));
  // The warden's barrier is a field, drawn as every field is, in the Banked's amber (D-69).
  const barrierMaterial = fieldMaterial(scene, 'banked-barrier', FIELD_AMBER);
  const flashMaterial = glow('banked-shield', new Color3(0.4, 0.75, 1), 0.35);

  // Their weapons: the hero's models (src/game/weapons.ts), held as the hero holds them.
  const load = (file: string) => LoadAssetContainerAsync(file, scene).catch(() => null);
  const [rifle, pistol, shotgun] = await Promise.all([
    load(`${modelsAt(setup.detailed)}rifle.glb`),
    load(`${import.meta.env.BASE_URL}assets/props/sidearm-meshy.glb`),
    load(`${modelsAt(setup.detailed)}shotgun.glb`),
  ]);
  const gearModels = new Map(
    await Promise.all(
      [...new Set(Object.values(GEAR).flatMap((g) => g.map((x) => x.model)))].map(
        async (id) => [id, await load(`${modelsAt(setup.detailed)}${id}.glb`)] as const,
      ),
    ),
  );
  const GUNS = {
    rifle: { model: rifle, ...HELD.rifle, long: true },
    pistol: { model: pistol, ...HELD.pistol, long: false },
    shotgun: { model: shotgun, ...HELD.shotgun, long: true },
  };

  const members: Member[] = await Promise.all(
    POOL.map(async (kind, i) => {
      const spec = LOOKS[i] ?? LOOKS[0];
      const base = applyLineage(setup.manifest, defaultLooks(setup.manifest, spec?.body ?? 'man'), spec?.lineage ?? '');
      const looks: Looks = {
        ...base,
        name: BANKED[kind].name,
        skin: spec?.skin ?? base.skin,
        hair: spec?.hair ?? base.hair,
        eyes: spec?.eyes ?? base.eyes,
        height: spec?.height ?? base.height,
        // On the low tier, the armour's lighter copy (ART_PIPELINE.md §8): a phone's busiest fights.
        outfit: spec ? (setup.detailed ? spec.outfit : `${spec.outfit}-low`) : undefined,
      };
      const id = `banked-${i}`;
      const character = await dress(scene, setup.templates, setup.manifest, id, looks);
      for (const mesh of character.meshes) {
        const material = mesh.material;
        if (material instanceof PBRMaterial && material.name.endsWith(`${looks.body}_suit`)) {
          material.albedoColor = UNDER.clone();
        }
      }
      for (const g of GEAR[kind]) {
        const model = gearModels.get(g.model);
        if (model) character.attach(model, g.bone, g.size, g.offset);
      }
      if (kind === 'warden') character.root.scaling.scaleInPlace(1.08);
      const gun = GUNS[BANKED[kind].carries];
      if (gun.model) {
        const grip = character.hold(
          gun.model,
          gun.length,
          SIDEARM.rotation,
          SIDEARM.offset,
          gun.along,
          gun.long,
          gun.lift,
        );
        if (grip) character.wield(grip, gun.length);
      }
      const anchor = new TransformNode(`${id}-agent`, scene);
      const body = CreateCapsule(`${id}-body`, { radius: 0.32, height: 1.75 }, scene);
      body.isVisible = false;
      body.isPickable = false;
      body.position.set(0, -60, 0);
      const aggregate = new PhysicsAggregate(body, PhysicsShapeType.CAPSULE, { mass: 1 }, scene);
      aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
      aggregate.body.disablePreStep = false;
      aggregate.shape.filterMembershipMask = BANKED_GROUP;
      aggregate.shape.filterCollideMask = 2;
      const glint = CreateSphere(`${id}-glint`, { diameter: 0.09, segments: 8 }, scene);
      glint.material = glintMaterial;
      glint.isPickable = false;
      glint.setEnabled(false);
      const tracer = CreateBox(`${id}-tracer`, { width: 0.02, height: 0.02, depth: 1 }, scene);
      tracer.material = tracerMaterial;
      tracer.isPickable = false;
      tracer.setEnabled(false);
      let shell: Mesh | null = null;
      if (kind === 'warden') {
        // The barrier: a curved field a third of a circle round, in front.
        shell = CreateCylinder(
          `${id}-barrier`,
          {
            height: 1.9,
            diameter: 2.3,
            arc: BARRIER.arcDegrees / 360,
            enclose: false,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          scene,
        );
        shell.material = barrierMaterial;
        shell.isPickable = false;
        shell.parent = character.root;
        shell.position.y = 1.05;
        // Babylon's arc sweeps from +X towards -Z: half of it round, the middle lies at a yaw of
        // 90° + half the arc; turned back by that, it stands square in front.
        shell.rotation.y = -(Math.PI / 2 + ((BARRIER.arcDegrees / 2) * Math.PI) / 180);
      }
      character.root.setEnabled(false);
      return {
        kind,
        character,
        anchor,
        agent: null,
        body,
        aggregate,
        active: false,
        alive: false,
        fallen: 0,
        defences: defencesOf(kind, 1),
        state: newState(),
        yaw: 0,
        primed: 0,
        marked: 0,
        lifted: 0,
        pulled: 0,
        pullTo: null,
        blinded: 0,
        barrier: 0,
        barrierSince: 99,
        sinceShield: 0,
        sinceMotes: 10,
        shotPose: 0,
        crouched: false,
        glint,
        tracer,
        tracerTime: 0,
        shell,
      } satisfies Member;
    }),
  );

  let events: BankedEvent[] = [];
  const heard = (kind: BankedEvent['kind'], who: BankedKind, at: Vector3) => events.push({ kind, who, at: at.clone() });
  const flying = (m: Member) => m.active && m.alive;
  const chestOf = (m: Member) => m.character.root.position.add(new Vector3(0, CHEST, 0));
  /** Something one of them could say (D-67): the game decides, by the rules of fight-talk.ts. */
  const call = (c: BankedCall, m: Member) =>
    events.push({ kind: 'talk', who: m.kind, at: chestOf(m), call: c, member: members.indexOf(m) });
  /** Whether a trooper has called the hero in sight yet, this fight. */
  let spotted = false;
  let heroHidden = 0;
  let difficulty: Difficulty = 'standard';

  const stand = (m: Member, here: Vector3) =>
    m.character.root.position.set(here.x, setup.groundUnder(here) ?? here.y, here.z);

  const bringDown = (m: Member) => {
    m.alive = false;
    m.fallen = LYING;
    m.agent?.stop();
    m.body.position.set(0, -60, 0);
    m.glint.setEnabled(false);
    m.character.aimHeld(null);
    if (m.shell) m.shell.setEnabled(false);
    heard('down', m.kind, chestOf(m));
    // The others see it: the nearest says so, or the last one left knows it is alone.
    const left = members.filter(flying);
    const fell = m.character.root.position;
    const nearest = left.reduce<Member | null>(
      (a, b) =>
        !a || Vector3.Distance(b.character.root.position, fell) < Vector3.Distance(a.character.root.position, fell)
          ? b
          : a,
      null,
    );
    if (nearest) call(left.length === 1 ? 'last' : 'allyDown', nearest);
  };
  const retire = (m: Member) => {
    m.active = false;
    m.character.root.setEnabled(false);
    m.body.position.set(0, -60, 0);
  };

  const strike = (m: Member, damage: Damage, by: string): boolean => {
    if (!flying(m)) return false;
    // The warden's barrier takes what comes from in front while it stands (D-51): field powers are
    // stopped outright, arc does double to it.
    const from = lastWorld?.positionOf(by) ?? null;
    if (m.kind === 'warden' && from) {
      const at = m.character.root.position;
      const facing = { x: Math.sin(m.yaw), z: Math.cos(m.yaw) };
      if (barrierStops(m.barrier, facing, { x: at.x, z: at.z }, { x: from.x, z: from.z })) {
        const had = m.barrier;
        if (damage.kind !== 'field') {
          m.barrier = Math.max(0, m.barrier - damage.amount * (damage.kind === 'arc' ? 2 : 1));
        }
        m.barrierSince = 0;
        heard('barrier', m.kind, chestOf(m));
        const struck = struckAt(at.add(new Vector3(0, 1.05 * m.character.root.scaling.y, 0)), 1.15, from);
        ripple(scene, struck.at, struck.normal, FIELD_AMBER);
        if (had > 0 && m.barrier <= 0) call('barrierDown', m);
        return false;
      }
    }
    const shielded = m.defences.shield > 0;
    const result = takeHit(m.defences, damage.amount * (m.marked > 0 ? 1.5 : 1), damage.kind, damage.plate ?? 0);
    m.defences = result.defences;
    if (result.down) bringDown(m);
    else if (m.kind === 'engineer' && shielded && m.defences.shield <= 0) call('exposed', m);
    return result.down;
  };

  let lastWorld: BankedWorld | null = null;

  const group: BankedGroup = {
    get size() {
      return members.length;
    },
    get live() {
      return members.filter(flying).length;
    },
    centre: (id) => (members[id] ? chestOf(members[id]) : Vector3.Zero()),
    alive: (id) => !!members[id] && flying(members[id]),
    owns: (id, body) => !!members[id] && !!body && members[id].aggregate.body === body,
    hit(body, by, damage) {
      const m = members.find((x) => flying(x) && !!body && x.aggregate.body === body);
      if (!m) return false;
      strike(m, damage, by);
      return true;
    },
    wake(kinds, at) {
      // A new fight: nobody has called the hero in sight yet.
      if (!members.some(flying)) spotted = false;
      kinds.forEach((kind, i) => {
        // One out of the fight, or else one lying where they fell (the next wave may come before they
        // would have been cleared away).
        const m = members.find((x) => x.kind === kind && !x.active) ?? members.find((x) => x.kind === kind && !x.alive);
        const where = at[i % Math.max(1, at.length)];
        if (!m || !where) return;
        m.active = true;
        m.alive = true;
        m.fallen = 0;
        m.defences = defencesOf(kind, toughness(difficulty));
        m.state = newState();
        m.primed = m.marked = m.lifted = m.pulled = m.blinded = 0;
        m.pullTo = null;
        m.barrier = kind === 'warden' ? BARRIER.strength : 0;
        m.barrierSince = 99;
        m.sinceShield = 0;
        m.sinceMotes = 10;
        m.character.root.setEnabled(true);
        m.anchor.position.copyFrom(where);
        if (setup.nav) {
          if (!m.agent) m.agent = setup.nav.addAgent(where, m.anchor, BANKED[kind].speed.run);
          else m.agent.teleport(where);
        }
        stand(m, where);
        if (m.shell) m.shell.setEnabled(true);
      });
    },
    clear() {
      for (const m of members) {
        retire(m);
        m.alive = false;
      }
    },
    status(id) {
      const m = members[id];
      if (!m) return null;
      return {
        alive: flying(m),
        at: chestOf(m),
        primed: m.primed > 0,
        shielded: m.defences.shield > 0 || m.barrier > 0,
        marked: m.marked > 0,
        kind: m.kind,
      };
    },
    strikeMachine(id, damage, by) {
      const m = members[id];
      return m ? strike(m, damage, by) : false;
    },
    affect(id, effect, seconds, towards) {
      const m = members[id];
      if (!m || !flying(m)) return;
      // A shield stops field powers: no lifting a shielded trooper (D-42). Spoof is for machines.
      if ((effect === 'lift' || effect === 'pull') && (m.defences.shield > 0 || m.barrier > 0)) return;
      if (effect === 'lift') {
        m.lifted = seconds;
        call('lifted', m);
      } else if (effect === 'pull') {
        m.pulled = seconds;
        m.pullTo = towards?.clone() ?? null;
        call('lifted', m);
      } else if (effect === 'prime') m.primed = seconds;
      else if (effect === 'mark') {
        m.marked = seconds;
        for (const mesh of m.character.meshes) {
          mesh.renderOutline = true;
          mesh.outlineColor = new Color3(1, 0.7, 0.2);
          mesh.outlineWidth = 0.01;
        }
      } else if (effect === 'blind') {
        m.blinded = seconds;
        call('blinded', m);
      }
    },
    burst(at, radius, damage, by) {
      let struck = 0;
      for (const m of members) {
        if (!flying(m)) continue;
        const d = Vector3.Distance(chestOf(m), at);
        if (d > radius) continue;
        struck += 1;
        strike(m, { ...damage, amount: damage.amount * (1 - 0.5 * (d / radius)) }, by);
      }
      return struck;
    },
    unprime(id) {
      const m = members[id];
      if (m) m.primed = 0;
    },
    speaker(member) {
      return members[member]?.character ?? null;
    },
    drainEvents() {
      const out = events;
      events = [];
      return out;
    },
    inspect: () =>
      members.filter(flying).map((m) => ({
        id: members.indexOf(m),
        kind: m.kind,
        at: m.character.root.position.asArray().map((n) => Math.round(n * 100) / 100),
        mode: m.state.mode,
        health: Math.round(m.defences.health),
        shield: Math.round(m.defences.shield),
        barrier: Math.round(m.barrier),
        crouched: m.crouched,
        cover: m.state.cover,
        pulled: m.pulled > 0 || m.lifted > 0,
        blinded: m.blinded > 0,
      })),
    update(dt, world) {
      lastWorld = world;
      difficulty = world.difficulty;
      const standing = world.targets.filter((t) => !t.down);
      const squad = members.filter(flying);
      // The hero hidden from all of them: after a while one goes round.
      const hero = standing.find((t) => t.id === 'hero');
      const heroSeen =
        !!hero &&
        squad.some((m) => !world.obstacle(m.character.root.position.add(new Vector3(0, EYE, 0)), chestAt(hero)));
      const hidden = heroHidden;
      heroHidden = heroSeen ? 0 : heroHidden + dt;
      const troopers = squad.filter((m) => m.kind === 'trooper');
      // The hero dug in: one of the troopers says to pin them down.
      if (hidden < 4 && heroHidden >= 4 && troopers[0]) call('suppress', troopers[0]);
      const flanker = troopers.length >= 2 ? troopers[0] : null;
      const held = squad.map((m) => m.state.cover).filter((c): c is number => c !== null);

      for (const m of members) {
        if (!m.active) continue;
        m.tracerTime -= dt;
        if (m.tracerTime <= 0) m.tracer.setEnabled(false);
        if (!m.alive) {
          m.fallen -= dt;
          m.character.setPose(poseWeights({ mode: 'down' }), dt);
          if (m.fallen <= 0) retire(m);
          continue;
        }
        const root = m.character.root;
        m.primed = Math.max(0, m.primed - dt);
        m.blinded = Math.max(0, m.blinded - dt);
        m.marked = Math.max(0, m.marked - dt);
        if (m.marked <= 0) for (const mesh of m.character.meshes) mesh.renderOutline = false;
        m.defences = recover(m.defences, dt);
        if (m.kind === 'warden') {
          m.barrierSince += dt;
          const was = m.barrier;
          m.barrier = barrierStep(m.barrier, m.barrierSince, dt);
          if (m.shell) {
            m.shell.setEnabled(m.barrier > 0);
            m.shell.visibility = 0.35 + 0.65 * (m.barrier / BARRIER.strength);
          }
          if (was <= 0 && m.barrier > 0) {
            heard('barrier', m.kind, chestOf(m));
            call('barrierBack', m);
          }
        }
        m.body.position.set(root.position.x, root.position.y + 0.88, root.position.z);

        // Lifted or pulled: helpless, and nothing else.
        if (m.lifted > 0 || m.pulled > 0) {
          m.glint.setEnabled(false);
          if (m.lifted > 0) {
            m.lifted -= dt;
            root.position.y += dt * 1.2 * (m.lifted > 2 ? 1 : 0);
          } else {
            m.pulled -= dt;
            if (m.pullTo) {
              const to = m.pullTo.subtract(root.position);
              to.y = 0;
              const d = to.length();
              if (d > 0.3) root.position.addInPlace(to.scale(Math.min(1, (10 * dt) / d)));
            }
          }
          m.character.setPose({ lower: { jump_loop: 1 }, upper: null, blend: 8 }, dt);
          if (m.lifted <= 0 && m.pulled <= 0) {
            // Down again where it hangs: back on the floor and on its way.
            m.agent?.teleport(root.position);
            stand(m, root.position);
          }
          continue;
        }

        // Its target: the hero most of all; a companion nearer by half; never the hero when blinded.
        const sees = (t: (typeof standing)[number]) =>
          !world.obstacle(root.position.add(new Vector3(0, EYE, 0)), chestAt(t));
        const candidates = standing.filter((t) => !(t.id === 'hero' && m.blinded > 0));
        const target = [...candidates].sort(
          (a, b) =>
            Vector3.Distance(a.feet, root.position) * (a.id === 'hero' ? 0.6 : 1) -
            Vector3.Distance(b.feet, root.position) * (b.id === 'hero' ? 0.6 : 1),
        )[0];
        const here = m.agent ? m.agent.position() : root.position.clone();
        const flat = (v: Vector3): Flat => ({ x: v.x, z: v.z });
        // Cover held by the others, and cover in another room (a wall between), are out of reach.
        const room = setup.areaOf(here.add(new Vector3(0, 0.5, 0)));
        const taken = new Set(held.filter((c) => c !== m.state.cover));
        coverArea.forEach((area, i) => {
          if (area !== room) taken.add(i);
        });
        const before = m.state;
        const step = bankedStep(
          m.state,
          {
            kind: m.kind,
            me: flat(here),
            health: m.defences.health / m.defences.healthMax,
            target: target ? flat(target.feet) : null,
            sees: !!target && sees(target),
            covers: setup.covers,
            taken,
            allies: squad.filter((o) => o !== m).map((o) => flat(o.character.root.position)),
            heroHidden,
            flanker: m === flanker,
            random: Math.random(),
          },
          dt,
        );
        m.state = step.state;
        // What it does, said: falling back, going round, into cover.
        if (!before.fellBack && step.state.fellBack) call('fallBack', m);
        else if (step.state.flankWait > before.flankWait + 1 && step.moveTo) call('flank', m);
        else if (before.mode === 'seek' && step.state.mode === 'hide') call('cover', m);
        if (step.state.cover !== null) held.push(step.state.cover);
        if (step.moveTo) m.agent?.goTo(new Vector3(step.moveTo.x, here.y, step.moveTo.z));
        else m.agent?.stop();
        stand(m, m.agent ? m.agent.position() : root.position);
        m.crouched = step.crouch;

        // Facing: the target while fighting, the way it runs while running.
        const velocity = m.agent?.velocity() ?? Vector3.Zero();
        const speed = Math.hypot(velocity.x, velocity.z);
        const fighting = (step.state.mode === 'peek' || step.state.mode === 'open') && !!target;
        if (fighting && target) {
          m.yaw = turnTowards(
            m.yaw,
            yawOf({ x: target.feet.x - root.position.x, z: target.feet.z - root.position.z }),
            8 * dt,
          );
        } else if (speed > 0.3) m.yaw = turnTowards(m.yaw, yawOf(velocity), 8 * dt);
        root.rotation.y = m.yaw;

        // The gun: at the target while fighting; a long gun low and ready otherwise.
        const long = BANKED[m.kind].carries !== 'pistol';
        if (fighting && target)
          m.character.aimHeld(chestAt(target).subtract(root.position.add(new Vector3(0, 1.4, 0))));
        else if (long) {
          const down = (40 * Math.PI) / 180;
          m.character.aimHeld(
            new Vector3(Math.sin(m.yaw) * Math.cos(down), -Math.sin(down), Math.cos(m.yaw) * Math.cos(down)),
          );
        } else m.character.aimHeld(null);

        // The glint before a volley; the shot.
        m.glint.setEnabled(step.glint);
        if (step.glint) {
          m.glint.position.copyFrom(m.character.muzzle());
          m.glint.scaling.setAll(0.8 + Math.random() * 0.6);
          if (!m.glint.metadata?.heard) {
            heard('glint', m.kind, m.glint.position);
            if (!spotted && m.kind === 'trooper') {
              spotted = true;
              call('spotted', m);
            }
          }
          m.glint.metadata = { heard: true };
        } else m.glint.metadata = null;
        m.shotPose -= dt;
        if (step.fire && target) {
          m.shotPose = 0.18;
          m.character.fire();
          shoot(m, target, world);
        }

        // Pose: crouched in cover, aiming while fighting, walking or running with the gun ready.
        if (step.crouch) m.character.setPose({ lower: { crouch_idle: 1 }, upper: null }, dt);
        else if (fighting) {
          m.character.setPose(
            poseWeights({
              mode: 'aim',
              speed,
              direction: speed > 0.3 ? { x: 0, y: 1 } : { x: 0, y: 0 },
              firing: m.shotPose > 0,
              gun: BANKED[m.kind].carries,
            }),
            dt,
          );
        } else m.character.setPose(poseWeights({ mode: 'move', speed, ready: BANKED[m.kind].carries }), dt);

        // The engineer: a shield on whoever needs it, and the engines' motes.
        if (m.kind === 'engineer') {
          m.sinceShield += dt;
          m.sinceMotes += dt;
          if (m.sinceShield >= SUPPORT.shieldEvery) {
            const others = squad.filter((o) => o !== m);
            const who = neediest(
              flat(root.position),
              others.map((o) => ({
                at: flat(o.character.root.position),
                shield: o.defences.shield,
                shieldMax: Math.max(o.defences.shieldMax, SUPPORT.shield),
                alive: flying(o),
              })),
            );
            const ally = who !== null ? others[who] : undefined;
            if (ally) {
              m.sinceShield = 0;
              ally.defences = {
                ...ally.defences,
                shieldMax: Math.max(ally.defences.shieldMax, SUPPORT.shield),
                shield: Math.min(
                  Math.max(ally.defences.shieldMax, SUPPORT.shield),
                  ally.defences.shield + SUPPORT.shield,
                ),
              };
              flashAt(chestOf(ally));
              heard('shield', m.kind, chestOf(ally));
              call('shield', m);
            }
          }
          if (
            m.sinceMotes >= SUPPORT.motesEvery &&
            world.motesLive() < SUPPORT.motesAlive &&
            step.state.mode !== 'seek'
          ) {
            m.sinceMotes = 0;
            const up = root.position.add(new Vector3(0, 2.4, 0));
            world.sendMotes(
              [up.add(new Vector3(0.6, 0, 0)), up.add(new Vector3(-0.6, 0.3, 0))].slice(0, SUPPORT.motes),
            );
            heard('motes', m.kind, up);
            call('motes', m);
          }
        }
      }
    },
  };

  /** A shot at a target: stopped by what stands between, else hits by chance (COMBAT.md, *Shots*). */
  function shoot(m: Member, target: BankedWorld['targets'][number], world: BankedWorld) {
    const from = m.character.muzzle();
    const aim = chestAt(target);
    const blocked = world.obstacle(from, aim);
    let end: Vector3;
    if (blocked) {
      end = blocked;
      heard('impact', m.kind, blocked);
    } else {
      const chance = hitChance(Vector3.Distance(from, aim), target.moving, world.difficulty);
      if (Math.random() < chance) {
        world.onHit(target.id, from, BANKED[m.kind].weapon.damage);
        end = aim;
      } else {
        end = aim.add(
          new Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.3) * 1.0, (Math.random() - 0.5) * 1.4),
        );
        // A near miss snaps past whoever it was meant for.
        heard('miss', m.kind, aim);
      }
    }
    m.tracer.position = Vector3.Lerp(from, end, 0.5);
    m.tracer.scaling.z = Vector3.Distance(from, end);
    m.tracer.lookAt(end);
    m.tracer.setEnabled(true);
    m.tracerTime = 0.06;
    heard('fire', m.kind, from);
  }

  /** A shield thrown round an ally: a short blue flash. */
  function flashAt(at: Vector3) {
    const s = CreateSphere('banked-shield-flash', { diameter: 2, segments: 12 }, scene);
    s.material = flashMaterial;
    s.position.copyFrom(at);
    s.isPickable = false;
    let t = 0;
    const tick = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;
      s.scaling.setAll(1 + t * 0.6);
      s.visibility = Math.max(0, 1 - t / 0.5);
      if (t >= 0.5) {
        scene.onBeforeRenderObservable.remove(tick);
        s.dispose();
      }
    });
  }

  return group;
}

const chestAt = (t: { feet: Vector3; height: number }) => t.feet.add(new Vector3(0, t.height * 0.68, 0));
const toughness = (d: Difficulty) => (d === 'story' ? 0.75 : d === 'hard' ? 1.25 : 1);

/** A kind's defences (D-42), scaled by the difficulty's toughness (D-46). */
export function defencesOf(kind: BankedKind, scale: number): Defences {
  const s = BANKED[kind];
  return {
    shield: s.shield * scale,
    shieldMax: s.shield * scale,
    plate: s.plate * scale,
    plateMax: s.plate * scale,
    plateBlock: s.plateBlock,
    health: s.health * scale,
    healthMax: s.health * scale,
    sinceHit: Number.POSITIVE_INFINITY,
  };
}
