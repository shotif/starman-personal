import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Swarm } from './motes.ts';
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
export interface AbilityContext {
  scene: Scene;
  swarm: Swarm;
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
  say(text: string): void;
  /** A sound from the audio manifest, placed where it happens. */
  sound(id: string, at: Vector3): void;
}

export interface Abilities {
  /** Uses a power; false if it is not ready or has nothing to act on. */
  use(id: PowerId): boolean;
  update(dt: number): void;
  readonly cooldowns: Cooldowns;
  /** The hero's own effects now running. */
  readonly effects: { stim: number; brace: number; veil: number; barrier: number; decoy: Vector3 | null };
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
    mesh: Mesh;
    from: Vector3;
    to: () => Vector3;
    t: number;
    time: number;
    arc: number;
    land: () => void;
  }[] = [];
  const fly = (colour: Color3, size: number, time: number, arc: number, to: () => Vector3, land: () => void) => {
    const mesh = CreateSphere('power-flight', { diameter: size, segments: 10 }, scene);
    mesh.material = glow('power-flight', colour);
    mesh.isPickable = false;
    const from = ctx.heroChest();
    mesh.position.copyFrom(from);
    flights.push({ mesh, from, to, t: 0, time, arc, land });
  };

  // The hero's own effects, and their looks.
  const effects = { stim: 0, brace: 0, veil: 0, barrier: 0, decoy: null as Vector3 | null };
  let barrierShield = 0;
  let decoyLeft = 0;
  let repairLeft = 0;
  const shell = CreateSphere('barrier-shell', { diameter: 2.3, segments: 16 }, scene);
  shell.material = glow('barrier-shell', BLUE, 0.16);
  shell.isPickable = false;
  shell.setEnabled(false);
  const drone = CreateSphere('repair-drone', { diameter: 0.3, segments: 10 }, scene);
  drone.material = glow('repair-drone', GREEN);
  drone.isPickable = false;
  drone.setEnabled(false);
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
  const hitMachine = (id: PowerId, machine: number) => {
    const status = swarm.status(machine);
    if (!status?.alive) return;
    const result = strike(ctx.spec(id), { primed: status.primed, shielded: status.shielded });
    if (result.combo) {
      swarm.unprime(machine);
      swarm.burst(status.at, COMBO.radius, { amount: COMBO.amount, kind: COMBO.kind }, 'hero');
      flash(status.at, VIOLET, 1.2, 0.5, COMBO.radius * 1.6);
      ctx.sound('charge_blast', status.at);
      ctx.say('Combination!');
    }
    if (result.damage) swarm.strikeMachine(machine, result.damage, 'hero');
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
        const arcPower = ['overload', 'spoof', 'mark', 'seeker'].includes(id);
        ctx.sound(arcPower ? 'power_arc' : 'power_field', d.at);
        flash(d.at, arcPower ? BLUE : VIOLET, 1, 0.4, 2.2);
        d.knockDown();
        cooldowns = { ...cooldowns, [id]: spec.cooldown };
        return true;
      }
    }
    const at =
      target !== null ? (swarm.status(target)?.at ?? ctx.groundAhead(spec.range)) : ctx.groundAhead(spec.range);
    const chest = ctx.heroChest();
    const field: PowerId[] = ['lift', 'pull', 'slam', 'shove', 'hop'];
    const arc: PowerId[] = ['overload', 'spoof', 'mark'];
    const own: Partial<Record<PowerId, string>> = {
      stim: 'stim',
      brace: 'barrier',
      veil: 'veil',
      barrier: 'barrier',
      repair: 'repair',
      seeker: 'drone',
      flare: 'drone',
      charge: 'dodge',
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
        drone.setEnabled(true);
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
        );
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

  return {
    use,
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
      barrierShield = 0;
      decoyLeft = 0;
      repairLeft = 0;
      shell.setEnabled(false);
      drone.setEnabled(false);
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
      if (repairLeft > 0) {
        repairLeft -= dt;
        ctx.heal(10 * dt);
        const c = ctx.heroChest();
        drone.position.set(c.x + Math.cos(clock * 3) * 0.9, c.y + 0.6, c.z + Math.sin(clock * 3) * 0.9);
        if (repairLeft <= 0) drone.setEnabled(false);
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
        f.mesh.position = Vector3.Lerp(f.from, to, k).add(new Vector3(0, Math.sin(k * Math.PI) * f.arc, 0));
        if (k >= 1) {
          f.land();
          f.mesh.material?.dispose();
          f.mesh.dispose();
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
