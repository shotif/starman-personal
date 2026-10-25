import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Damage } from './combat.ts';
import { FIELD_BLUE, fieldMaterial } from './fields.ts';
import {
  COMBO,
  type Cooldowns,
  cool,
  type PowerId,
  type PowerSpec,
  PRIMED_SECONDS,
  ready,
  strike,
  waiting,
} from './powers.ts';

/**
 * The powers in the game (COMBAT.md, src/game/powers.ts): what each does to the swarm and to the
 * hero, and how it looks. Every effect is light and short: a sphere, a flash, a glow.
 */
/**
 * Everything the powers act on: the swarm's machines and the Banked (src/game/banked.ts), one list,
 * the swarm's first.
 */
export interface Foes {
  readonly size: number;
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
}

/** The engines' machines, which Spoof can turn; people it cannot. */
const MACHINES = ['mote', 'lattice', 'tender'];

export interface AbilityContext {
  scene: Scene;
  swarm: Foes;
  /** A power as the hero has it: at its rank, with the training's and the weight's changes (growth.ts). */
  spec(id: PowerId): PowerSpec;
  /** The swarm machine under the crosshair (with a generous assist), within a range, or null. */
  machineAhead(range: number): number | null;
  /** A practice drone on the range under the crosshair (when no machine is), within reach. */
  droneAhead(range: number): number | null;
  /** Where a practice drone is, and a power's strike on it. */
  drone(id: number): { at: Vector3; knockDown(): void };
  /** The practice drones within a radius of a point. */
  dronesNear(at: Vector3, radius: number): number[];
  /** The point the crosshair rests on, within a range. */
  groundAhead(range: number): Vector3;
  heroChest(): Vector3;
  heroForward(): Vector3;
  /** Moves the hero at once (Hop). */
  moveHero(to: Vector3): void;
  /** Mends the hero's health by an amount, and companions near them. */
  heal(amount: number): void;
  /** Second Wind: a share of health back, and the whole shield. */
  rally(share: number): void;
  /** Whether nothing solid stands between two points (a gun post's sight). */
  sees(from: Vector3, to: Vector3): boolean;
  say(text: string): void;
  /** A sound from the audio manifest, placed where it happens. */
  sound(id: string, at: Vector3): void;
  /** One of the powers' models (D-69; MODELS.md), or null while it loads or if it could not. */
  model(id: PowerModel): AssetContainer | null;
}

/** The things the powers put in the world, made as models (ACT1_ART.md §4). */
export type PowerModel = 'gunpost' | 'emitter' | 'repair-drone' | 'seeker-drone';

export interface Abilities {
  /** Uses a power; false if it is not ready or has nothing to act on. */
  use(id: PowerId): boolean;
  /**
   * A companion's power on the machine she is fighting (Ren's Mark, Jo's Overload and Seeker Drone):
   * as she has it, from where she stands. Her cooldowns are her own (src/game/game.ts).
   */
  companionUse(spec: PowerSpec, machine: number, from: Vector3): boolean;
  /**
   * A companion's Barrier or Repair Drone on the hero (Mira's, PYRE.md §8): the effect as the hero's
   * own power gives it, without touching the hero's cooldowns.
   */
  support(spec: PowerSpec): void;
  update(dt: number): void;
  readonly cooldowns: Cooldowns;
  /** The hero's own effects now running. */
  readonly effects: {
    stim: number;
    brace: number;
    veil: number;
    barrier: number;
    decoy: Vector3 | null;
    /** Long Shot: seconds left for the next shot to do three times and go through. */
    longshot: number;
    /** Shelter: the dome, while it stands. */
    shelter: { at: Vector3; radius: number } | null;
  };
  /** Long Shot is spent by a shot. */
  spendLongShot(): void;
  /** A barrier's extra shield, spent before the hero's own (D-42). */
  absorb(amount: number): number;
  waiting(id: PowerId): number;
  clear(): void;
}

const VIOLET = new Color3(0.7, 0.35, 1);
const BLUE = new Color3(0.35, 0.75, 1);
const ORANGE = new Color3(1, 0.55, 0.2);
const GREEN = new Color3(0.4, 1, 0.55);

export function buildAbilities(ctx: AbilityContext): Abilities {
  const { scene, swarm } = ctx;
  const glow = (name: string, colour: Color3, alpha = 1) => {
    const m = new StandardMaterial(name, scene);
    m.disableLighting = true;
    m.emissiveColor = colour;
    m.alpha = alpha;
    return m;
  };
  /** Short-lived spheres: flashes, waves, thrown things. */
  const flashes: { mesh: Mesh; t: number; life: number; grow: number }[] = [];
  const flash = (at: Vector3, colour: Color3, size: number, life = 0.35, grow = 1.6) => {
    const mesh = CreateSphere('power-flash', { diameter: size, segments: 12 }, scene);
    mesh.material = glow('power-flash', colour, 0.55);
    mesh.position.copyFrom(at);
    mesh.isPickable = false;
    flashes.push({ mesh, t: 0, life, grow });
  };
  /** Things in flight: a charge arcing to the ground, a seeker drone homing on a machine. */
  const flights: {
    mesh: TransformNode;
    /** A model in flight turns to face where it goes; a glowing ball is let go with its material. */
    model: boolean;
    from: Vector3;
    to: () => Vector3;
    t: number;
    time: number;
    arc: number;
    land: () => void;
  }[] = [];
  const fly = (
    colour: Color3,
    size: number,
    time: number,
    arc: number,
    to: () => Vector3,
    land: () => void,
    start?: Vector3,
    model?: PowerModel,
  ) => {
    const from = start ?? ctx.heroChest();
    const made = model ? place(model, `power-flight-${model}`) : null;
    let mesh: TransformNode;
    if (made) mesh = made;
    else {
      const ball = CreateSphere('power-flight', { diameter: size, segments: 10 }, scene);
      ball.material = glow('power-flight', colour);
      ball.isPickable = false;
      mesh = ball;
    }
    mesh.position.copyFrom(from);
    flights.push({ mesh, model: !!made, from, to, t: 0, time, arc, land });
  };

  /** A copy of one of the powers' models under a node of its own; null until it has loaded. */
  const place = (id: PowerModel, name: string): TransformNode | null => {
    const model = ctx.model(id);
    if (!model) return null;
    const node = new TransformNode(name, scene);
    const entries = model.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: false });
    for (const root of entries.rootNodes) root.parent = node;
    for (const m of node.getChildMeshes(false)) m.isPickable = false;
    return node;
  };

  // The hero's own effects, and their looks.
  const effects = {
    stim: 0,
    brace: 0,
    veil: 0,
    barrier: 0,
    decoy: null as Vector3 | null,
    longshot: 0,
    shelter: null as { at: Vector3; radius: number } | null,
  };
  let shelterLeft = 0;
  // Shelter: a dome of field over the emitter the Warden throws down.
  const dome = CreateSphere('shelter-dome', { diameter: 2, segments: 24, slice: 0.5 }, scene);
  dome.material = fieldMaterial(scene, 'shelter-dome', FIELD_BLUE);
  dome.isPickable = false;
  dome.setEnabled(false);
  let emitter: TransformNode | null = null;
  let shelterFor = 0;
  /**
   * Gun posts set down: where, how long left and how long up, the time to the next shot, whether it
   * has begun to wind down, and its model's node (null for the stand-in boxes).
   */
  const posts: {
    node: TransformNode;
    at: Vector3;
    left: number;
    age: number;
    next: number;
    spec: PowerSpec;
    winding: boolean;
    model: boolean;
  }[] = [];
  /** Sinks: knots of bent space that drag machines in while they last. */
  const sinks: { mesh: Mesh; at: Vector3; left: number; radius: number }[] = [];
  let barrierShield = 0;
  let decoyLeft = 0;
  let repairLeft = 0;
  const shell = CreateSphere('barrier-shell', { diameter: 2.3, segments: 20 }, scene);
  shell.material = fieldMaterial(scene, 'barrier-shell', FIELD_BLUE, 0.55);
  shell.isPickable = false;
  shell.setEnabled(false);
  // The Repair Drone: its model once loaded, a green ball until then.
  const droneBall = CreateSphere('repair-drone', { diameter: 0.3, segments: 10 }, scene);
  droneBall.material = glow('repair-drone', GREEN);
  droneBall.isPickable = false;
  droneBall.setEnabled(false);
  let droneModel: TransformNode | null = null;
  const repairDrone = (): TransformNode => {
    droneModel ??= place('repair-drone', 'repair-drone-model');
    return droneModel ?? droneBall;
  };
  const flare = CreateSphere('decoy-flare', { diameter: 0.35, segments: 10 }, scene);
  flare.material = glow('decoy-flare', ORANGE);
  flare.isPickable = false;
  flare.setEnabled(false);
  const flareLight = new PointLight('decoy-light', Vector3.Zero(), scene);
  flareLight.diffuse = ORANGE;
  flareLight.intensity = 0;
  flareLight.range = 10;

  let cooldowns: Cooldowns = {};
  let clock = 0;

  /** A power's strike on a machine: its damage, priming, and the combination's burst. */
  const hitMachine = (id: PowerId, machine: number) => hitWith(ctx.spec(id), machine);
  const hitWith = (spec: PowerSpec, machine: number, by = 'hero') => {
    const status = swarm.status(machine);
    if (!status?.alive) return;
    const result = strike(spec, { primed: status.primed, shielded: status.shielded });
    if (result.combo) {
      swarm.unprime(machine);
      swarm.burst(status.at, COMBO.radius, { amount: COMBO.amount, kind: COMBO.kind }, by);
      flash(status.at, VIOLET, 1.2, 0.5, COMBO.radius * 1.6);
      ctx.sound('charge_blast', status.at);
      ctx.say('Combination!');
    }
    if (result.damage) swarm.strikeMachine(machine, result.damage, by);
    if (result.primes) swarm.affect(machine, 'prime', PRIMED_SECONDS);
  };

  const use = (id: PowerId): boolean => {
    if (!ready(cooldowns, id)) return false;
    const spec = ctx.spec(id);
    let target: number | null = null;
    if (spec.target === 'machine') {
      target = ctx.machineAhead(spec.range);
      if (target === null) {
        // On the range the practice drones stand in for machines: the power brings one down.
        const practice = ctx.droneAhead(spec.range);
        if (practice === null) {
          ctx.say('No target.');
          return false;
        }
        const d = ctx.drone(practice);
        const arcPower = ['overload', 'spoof', 'mark', 'seeker', 'cascade'].includes(id);
        ctx.sound(arcPower ? 'power_arc' : 'power_field', d.at);
        flash(d.at, arcPower ? BLUE : VIOLET, 1, 0.4, 2.2);
        d.knockDown();
        cooldowns = { ...cooldowns, [id]: spec.cooldown };
        return true;
      }
    }
    // Long Shot waits for a shot; the rest act now.
    if (id === 'longshot') {
      effects.longshot = spec.lasts ?? 6;
      flash(ctx.heroChest(), new Color3(1, 0.9, 0.6), 0.9, 0.35, 1.5);
      ctx.sound('power_arc', ctx.heroChest());
      cooldowns = { ...cooldowns, [id]: spec.cooldown };
      return true;
    }
    // Spoof turns a machine on its own kind; a person it cannot, and it costs nothing to try.
    if (id === 'spoof' && target !== null && !MACHINES.includes(swarm.status(target)?.kind ?? '')) {
      ctx.say('Spoof works on machines, not people.');
      return false;
    }
    const at =
      target !== null ? (swarm.status(target)?.at ?? ctx.groundAhead(spec.range)) : ctx.groundAhead(spec.range);
    const chest = ctx.heroChest();
    const field: PowerId[] = ['lift', 'pull', 'slam', 'shove', 'hop', 'sink', 'shear'];
    const arc: PowerId[] = ['overload', 'spoof', 'mark', 'cascade', 'blind'];
    const own: Partial<Record<PowerId, string>> = {
      stim: 'stim',
      brace: 'barrier',
      veil: 'veil',
      barrier: 'barrier',
      repair: 'repair',
      seeker: 'drone',
      flare: 'drone',
      charge: 'dodge',
      shrapnel: 'dodge',
      secondwind: 'stim',
      gunpost: 'drone',
      shelter: 'barrier',
    };
    const struck = field.includes(id) || arc.includes(id);
    ctx.sound(
      field.includes(id) ? 'power_field' : arc.includes(id) ? 'power_arc' : (own[id] ?? 'power_field'),
      struck ? at : chest,
    );
    switch (id) {
      case 'stim':
        effects.stim = spec.lasts ?? 5;
        flash(ctx.heroChest(), ORANGE, 1, 0.4, 2.5);
        break;
      case 'brace':
        effects.brace = spec.lasts ?? 6;
        flash(ctx.heroChest(), new Color3(1, 0.85, 0.5), 1.2, 0.4, 1.8);
        break;
      case 'veil':
        effects.veil = spec.lasts ?? 6;
        flash(ctx.heroChest(), new Color3(0.6, 0.7, 1), 1.4, 0.5, 2);
        break;
      case 'barrier':
        effects.barrier = spec.lasts ?? 8;
        barrierShield = 100;
        shell.setEnabled(true);
        break;
      case 'repair':
        repairLeft = spec.lasts ?? 4;
        repairDrone().setEnabled(true);
        break;
      case 'flare': {
        const spot = at.clone();
        fly(
          ORANGE,
          0.3,
          0.5,
          2,
          () => spot,
          () => {
            effects.decoy = spot;
            decoyLeft = spec.lasts ?? 6;
            flare.position.copyFrom(spot);
            flare.setEnabled(true);
            flareLight.position.copyFrom(spot.add(new Vector3(0, 0.4, 0)));
            flareLight.intensity = 6;
          },
        );
        break;
      }
      case 'charge': {
        const spot = at.clone();
        fly(
          ORANGE,
          0.28,
          0.7,
          2.5,
          () => spot,
          () => {
            // The charge sets off any primed machine near it, and hurts everything in its burst.
            for (let m = 0; m < swarm.size; m++) {
              const s = swarm.status(m);
              if (s?.alive && s.primed && Vector3.Distance(s.at, spot) < 4) hitMachine('charge', m);
            }
            swarm.burst(spot, 4, spec.damage ?? { amount: 90, kind: 'blast' }, 'hero');
            for (const d of ctx.dronesNear(spot, 4)) ctx.drone(d).knockDown();
            flash(spot, ORANGE, 1, 0.45, 5);
            ctx.sound('charge_blast', spot);
          },
        );
        break;
      }
      case 'seeker': {
        const machine = target ?? 0;
        fly(
          BLUE,
          0.3,
          0.9,
          1,
          () => swarm.status(machine)?.at ?? at,
          () => {
            hitMachine('seeker', machine);
            flash(swarm.status(machine)?.at ?? at, BLUE, 0.8, 0.35, 2.5);
          },
          undefined,
          'seeker-drone',
        );
        ctx.sound('drone', ctx.heroChest());
        break;
      }
      case 'overload':
      case 'slam':
        hitMachine(id, target ?? 0);
        flash(at, id === 'overload' ? BLUE : VIOLET, 1, 0.35, 2.4);
        break;
      case 'lift':
      case 'pull':
        hitMachine(id, target ?? 0);
        // Pulled, it ends up in front of the hero, within a strike's reach.
        swarm.affect(target ?? 0, id, spec.lasts ?? 3, ctx.heroChest().add(ctx.heroForward().scale(2.1)));
        flash(at, VIOLET, 0.9, 0.4, 2);
        break;
      case 'mark':
        swarm.affect(target ?? 0, 'mark', spec.lasts ?? 10);
        flash(at, new Color3(1, 0.75, 0.3), 0.7, 0.3, 2);
        break;
      case 'spoof':
        swarm.affect(target ?? 0, 'spoof', spec.lasts ?? 8);
        flash(at, new Color3(0.2, 0.95, 1), 0.8, 0.4, 2);
        break;
      case 'hop': {
        // A short warp jump to the floor under the machine, and a blow that throws it.
        const under = new Vector3(at.x, ctx.heroChest().y - 1.15, at.z);
        flash(ctx.heroChest(), VIOLET, 1.2, 0.3, 1.5);
        ctx.moveHero(under);
        hitMachine('hop', target ?? 0);
        flash(at, VIOLET, 1.2, 0.35, 2.6);
        break;
      }
      case 'shrapnel': {
        // A low, quick round that bursts where it lands: sets off primed machines, hurts all near.
        const spot = at.clone();
        const radius = spec.radius ?? 3;
        fly(
          ORANGE,
          0.18,
          0.35,
          0.6,
          () => spot,
          () => {
            for (let m = 0; m < swarm.size; m++) {
              const s = swarm.status(m);
              if (s?.alive && s.primed && Vector3.Distance(s.at, spot) < radius) hitMachine('shrapnel', m);
            }
            swarm.burst(spot, radius, spec.damage ?? { amount: 75, kind: 'blast' }, 'hero');
            for (const d of ctx.dronesNear(spot, radius)) ctx.drone(d).knockDown();
            flash(spot, ORANGE, 0.8, 0.4, radius * 1.4);
            ctx.sound('charge_blast', spot);
          },
        );
        break;
      }
      case 'secondwind':
        ctx.rally(spec.heal ?? 0.25);
        flash(ctx.heroChest(), GREEN, 1.2, 0.5, 2.4);
        break;
      case 'gunpost': {
        const spot = new Vector3(at.x, at.y - 0.2, at.z);
        // The model unfolds where it lands (D-69); three boxes stand in until it has loaded.
        const made = place('gunpost', 'gun-post');
        if (made) {
          made.position.copyFrom(spot);
          made.rotation.y = Math.atan2(spot.x - ctx.heroChest().x, spot.z - ctx.heroChest().z);
          made.scaling.set(1, 0.05, 1);
          posts.push({
            node: made,
            at: spot.add(new Vector3(0, 0.47, 0)),
            left: spec.lasts ?? 12,
            age: 0,
            next: 0.6,
            spec,
            winding: false,
            model: true,
          });
          ctx.sound('gunpost_deploy', spot);
          break;
        }
        const node = new TransformNode('gun-post', scene);
        const base = CreateCylinder(
          'gun-post-legs',
          { height: 0.5, diameterTop: 0.12, diameterBottom: 0.5, tessellation: 6 },
          scene,
        );
        base.position.y = 0.25;
        const head = CreateBox('gun-post-head', { width: 0.28, height: 0.22, depth: 0.5 }, scene);
        head.position.y = 0.62;
        const lamp = CreateBox('gun-post-lamp', { width: 0.12, height: 0.05, depth: 0.02 }, scene);
        lamp.position.set(0, 0.66, 0.26);
        const body = glow('gun-post-body', new Color3(0.16, 0.18, 0.21));
        base.material = body;
        head.material = body;
        lamp.material = glow('gun-post-lamp', BLUE);
        for (const m of [base, head, lamp]) {
          m.parent = node;
          m.isPickable = false;
        }
        node.position.copyFrom(spot);
        posts.push({
          node,
          at: spot.add(new Vector3(0, 0.62, 0)),
          left: spec.lasts ?? 12,
          age: 0,
          next: 0.4,
          spec,
          winding: false,
          model: false,
        });
        break;
      }
      case 'cascade': {
        // An overload on the target, then on to two more machines near it.
        const first = target ?? 0;
        const from = swarm.status(first)?.at ?? at;
        hitMachine('cascade', first);
        flash(from, BLUE, 1, 0.35, 2.4);
        const radius = spec.radius ?? 6;
        const near = Array.from({ length: swarm.size }, (_, m) => ({ m, s: swarm.status(m) }))
          .filter(({ m, s }) => m !== first && s?.alive && Vector3.Distance(s.at, from) < radius)
          .sort((a, b) => Vector3.Distance(a.s?.at ?? from, from) - Vector3.Distance(b.s?.at ?? from, from))
          .slice(0, 2);
        for (const { m, s } of near) {
          hitMachine('cascade', m);
          if (s) flash(s.at, BLUE, 0.8, 0.35, 2);
        }
        break;
      }
      case 'sink': {
        // A knot of bent space that drags the machines near it in and holds them; light ones longer.
        const spot = at.clone();
        const radius = spec.radius ?? 4;
        const mesh = CreateSphere('sink', { diameter: 1, segments: 16 }, scene);
        mesh.material = glow('sink', VIOLET, 0.35);
        mesh.position.copyFrom(spot);
        mesh.isPickable = false;
        sinks.push({ mesh, at: spot, left: spec.lasts ?? 5, radius });
        for (let m = 0; m < swarm.size; m++) {
          const s = swarm.status(m);
          if (!s?.alive || Vector3.Distance(s.at, spot) > radius) continue;
          hitMachine('sink', m);
          swarm.affect(m, 'pull', s.kind === 'mote' ? (spec.lasts ?? 5) : 1.5, spot);
        }
        for (const d of ctx.dronesNear(spot, radius)) ctx.drone(d).knockDown();
        break;
      }
      case 'shear': {
        // Torn field along a line ahead: everything within a metre and a half of it is struck.
        const origin = ctx.heroChest();
        const ahead = ctx.heroForward();
        const reach = spec.range;
        for (let m = 0; m < swarm.size; m++) {
          const s = swarm.status(m);
          if (!s?.alive) continue;
          const to = s.at.subtract(origin);
          const along = Vector3.Dot(to, ahead);
          if (along < 0 || along > reach) continue;
          const off = to.subtract(ahead.scale(along));
          if (Math.hypot(off.x, off.z) > 1.6) continue;
          hitMachine('shear', m);
        }
        for (let k = 1; k <= 5; k++) {
          const p = origin.add(ahead.scale((reach * k) / 5));
          flash(p, VIOLET, 0.6, 0.3 + k * 0.04, 1.6);
          for (const d of ctx.dronesNear(p, 1.6)) ctx.drone(d).knockDown();
        }
        break;
      }
      case 'blind': {
        const here = ctx.heroChest();
        const radius = spec.radius ?? 5;
        for (let m = 0; m < swarm.size; m++) {
          const s = swarm.status(m);
          if (s?.alive && Vector3.Distance(s.at, here) < radius) swarm.affect(m, 'blind', spec.lasts ?? 4);
        }
        flash(here, new Color3(1, 1, 0.9), 1.5, 0.3, radius * 1.2);
        break;
      }
      case 'shelter': {
        const radius = spec.radius ?? 2;
        // Thrown a step ahead: the emitter lands there, and the dome round it covers the hero.
        const ahead = ctx.heroForward();
        const ground = ctx
          .heroChest()
          .subtract(new Vector3(0, 1.2, 0))
          .add(new Vector3(ahead.x, 0, ahead.z).scale(0.7));
        effects.shelter = { at: ground, radius };
        shelterLeft = spec.lasts ?? 8;
        shelterFor = 0;
        dome.position.copyFrom(ground);
        dome.scaling.setAll(0.05);
        dome.visibility = 1;
        dome.setEnabled(true);
        // The emitter, thrown down, opens; the dome grows from it.
        emitter ??= place('emitter', 'shelter-emitter');
        if (emitter) {
          emitter.position.copyFrom(ground);
          emitter.setEnabled(true);
        }
        ctx.sound('barrier', ground);
        break;
      }
      case 'shove': {
        // A wave of force ahead: everything in front within reach is struck, and primed ones set off.
        const origin = ctx.heroChest();
        const ahead = ctx.heroForward();
        for (let m = 0; m < swarm.size; m++) {
          const s = swarm.status(m);
          if (!s?.alive) continue;
          const to = s.at.subtract(origin);
          if (to.length() > spec.range || Vector3.Dot(to.normalize(), ahead) < 0.35) continue;
          hitMachine('shove', m);
          swarm.affect(m, 'pull', 0.8, s.at.add(to.normalize().scale(5)));
        }
        for (const d of ctx.dronesNear(origin.add(ahead.scale(spec.range / 2)), spec.range / 2 + 1)) {
          ctx.drone(d).knockDown();
        }
        flash(origin.add(ahead.scale(2)), VIOLET, 1.5, 0.4, 4);
        break;
      }
    }
    cooldowns = { ...cooldowns, [id]: spec.cooldown };
    return true;
  };

  const companionUse = (spec: PowerSpec, machine: number, from: Vector3): boolean => {
    const status = swarm.status(machine);
    if (!status?.alive) return false;
    switch (spec.id) {
      case 'mark':
        swarm.affect(machine, 'mark', spec.lasts ?? 10);
        flash(status.at, new Color3(1, 0.75, 0.3), 0.7, 0.3, 2);
        ctx.sound('power_arc', status.at);
        return true;
      case 'overload':
        hitWith(spec, machine, 'partner');
        flash(status.at, BLUE, 1, 0.35, 2.4);
        ctx.sound('power_arc', status.at);
        return true;
      case 'seeker':
        fly(
          BLUE,
          0.3,
          0.9,
          1,
          () => swarm.status(machine)?.at ?? status.at,
          () => {
            hitWith(spec, machine, 'partner');
            flash(swarm.status(machine)?.at ?? status.at, BLUE, 0.8, 0.35, 2.5);
          },
          from,
          'seeker-drone',
        );
        ctx.sound('drone', from);
        return true;
      default:
        return false;
    }
  };

  const support = (spec: PowerSpec) => {
    if (spec.id === 'barrier') {
      effects.barrier = spec.lasts ?? 8;
      barrierShield = 100;
      shell.setEnabled(true);
    } else if (spec.id === 'repair') {
      repairLeft = spec.lasts ?? 4;
      repairDrone().setEnabled(true);
    }
  };

  return {
    use,
    companionUse,
    support,
    spendLongShot() {
      effects.longshot = 0;
    },
    get cooldowns() {
      return cooldowns;
    },
    effects,
    waiting: (id) => waiting(cooldowns, id, ctx.spec(id).cooldown),
    absorb(amount) {
      if (barrierShield <= 0) return amount;
      const taken = Math.min(barrierShield, amount);
      barrierShield -= taken;
      if (barrierShield <= 0) {
        effects.barrier = 0;
        shell.setEnabled(false);
      }
      return amount - taken;
    },
    clear() {
      cooldowns = {};
      effects.stim = 0;
      effects.brace = 0;
      effects.veil = 0;
      effects.barrier = 0;
      effects.decoy = null;
      effects.longshot = 0;
      effects.shelter = null;
      shelterLeft = 0;
      dome.setEnabled(false);
      for (const p of posts.splice(0)) p.node.dispose(false, true);
      for (const k of sinks.splice(0)) {
        k.mesh.material?.dispose();
        k.mesh.dispose();
      }
      barrierShield = 0;
      decoyLeft = 0;
      repairLeft = 0;
      shell.setEnabled(false);
      droneBall.setEnabled(false);
      droneModel?.setEnabled(false);
      emitter?.setEnabled(false);
      flare.setEnabled(false);
      flareLight.intensity = 0;
    },
    update(dt) {
      clock += dt;
      cooldowns = cool(cooldowns, dt);
      effects.stim = Math.max(0, effects.stim - dt);
      effects.brace = Math.max(0, effects.brace - dt);
      effects.veil = Math.max(0, effects.veil - dt);
      effects.barrier = Math.max(0, effects.barrier - dt);
      if (effects.barrier <= 0 && shell.isEnabled()) {
        barrierShield = 0;
        shell.setEnabled(false);
      }
      if (shell.isEnabled()) shell.position.copyFrom(ctx.heroChest());
      effects.longshot = Math.max(0, effects.longshot - dt);
      if (shelterLeft > 0) {
        shelterLeft -= dt;
        shelterFor += dt;
        // It grows from the emitter in a third of a second, and fades in its last second.
        const r = effects.shelter?.radius ?? 2;
        dome.scaling.setAll(r * Math.min(1, 0.05 + shelterFor / 0.3));
        dome.visibility = Math.min(1, shelterLeft);
        if (shelterLeft <= 0) {
          effects.shelter = null;
          dome.setEnabled(false);
          emitter?.setEnabled(false);
        }
      }
      // Gun posts: each shoots the nearest machine it can see, twice a second, until it runs down.
      for (let i = posts.length - 1; i >= 0; i--) {
        const p = posts[i];
        if (!p) continue;
        p.left -= dt;
        p.age += dt;
        p.next -= dt;
        // A model unfolds in its first half-second and folds in its last.
        if (p.model) {
          p.node.scaling.y = Math.max(0.05, Math.min(1, p.age / 0.5, p.left / 0.5));
          if (!p.winding && p.left <= 0.6) {
            p.winding = true;
            ctx.sound('gunpost_down', p.at);
          }
        }
        if (p.next <= 0) {
          p.next = 0.45;
          let best: { m: number; at: Vector3; d: number } | null = null;
          for (let m = 0; m < swarm.size; m++) {
            const s = swarm.status(m);
            if (!s?.alive) continue;
            const d = Vector3.Distance(s.at, p.at);
            if (d > (p.spec.radius ?? 22) || (best && d >= best.d) || !ctx.sees(p.at, s.at)) continue;
            best = { m, at: s.at, d };
          }
          if (best && !p.winding && p.age >= 0.5) {
            // It turns to what it shoots; the flash at its muzzle.
            p.node.rotation.y = Math.atan2(best.at.x - p.at.x, best.at.z - p.at.z);
            swarm.strikeMachine(best.m, p.spec.damage ?? { amount: 12, kind: 'kinetic' }, 'hero');
            flash(best.at, new Color3(1, 0.85, 0.5), 0.25, 0.15, 1.2);
            const muzzle = p.at.add(
              best.at
                .subtract(p.at)
                .normalize()
                .scale(p.model ? 0.36 : 0.25),
            );
            flash(muzzle, new Color3(1, 0.9, 0.6), 0.18, 0.1, 1);
            ctx.sound('gunpost_fire', p.at);
          }
        }
        if (p.left <= 0) {
          p.node.dispose(false, true);
          posts.splice(i, 1);
        }
      }
      // Sinks hold what they caught, and fade.
      for (let i = sinks.length - 1; i >= 0; i--) {
        const k = sinks[i];
        if (!k) continue;
        k.left -= dt;
        k.mesh.scaling.setAll(0.7 + 0.25 * Math.sin(clock * 9) + Math.min(1, k.left) * 0.3);
        k.mesh.rotation.y += dt * 3;
        if (k.left <= 0) {
          k.mesh.material?.dispose();
          k.mesh.dispose();
          sinks.splice(i, 1);
        }
      }
      if (repairLeft > 0) {
        repairLeft -= dt;
        ctx.heal(10 * dt);
        const c = ctx.heroChest();
        // It circles the hero, bobbing a little, its nozzle towards them.
        const d = repairDrone();
        d.position.set(
          c.x + Math.cos(clock * 3) * 0.9,
          c.y + 0.5 + Math.sin(clock * 7) * 0.05,
          c.z + Math.sin(clock * 3) * 0.9,
        );
        if (d !== droneBall) d.lookAt(c);
        if (repairLeft <= 0) d.setEnabled(false);
      }
      if (decoyLeft > 0) {
        decoyLeft -= dt;
        flareLight.intensity = 5 + Math.sin(clock * 30) * 1.5;
        if (decoyLeft <= 0) {
          effects.decoy = null;
          flare.setEnabled(false);
          flareLight.intensity = 0;
        }
      }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        if (!f) continue;
        f.t += dt;
        const k = Math.min(1, f.t / f.time);
        const to = f.to();
        const next = Vector3.Lerp(f.from, to, k).add(new Vector3(0, Math.sin(k * Math.PI) * f.arc, 0));
        // A drone faces where it is going.
        if (f.model && Vector3.DistanceSquared(next, f.mesh.position) > 1e-6) f.mesh.lookAt(next);
        f.mesh.position = next;
        if (k >= 1) {
          f.land();
          if (!f.model) (f.mesh as Mesh).material?.dispose();
          f.mesh.dispose(false, !f.model);
          flights.splice(i, 1);
        }
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        if (!f) continue;
        f.t += dt;
        const k = f.t / f.life;
        f.mesh.scaling.setAll(1 + k * f.grow);
        const m = f.mesh.material as StandardMaterial;
        m.alpha = 0.55 * (1 - k);
        if (k >= 1) {
          f.mesh.dispose();
          m.dispose();
          flashes.splice(i, 1);
        }
      }
    },
  };
}
