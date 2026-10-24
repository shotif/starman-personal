import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { Scene } from '@babylonjs/core/scene';
import type { Shooter, TargetGroup } from './combat.ts';
import { BOLT, boltMeetsBody, type FirePhase, fireStep, MOTE, pickSpot } from './swarm.ts';

/**
 * The swarm in the scene (COMBAT.md): motes that fly to places that see their target, glow and fire
 * slow bolts, which walls and cover stop. The rules are in src/game/swarm.ts; this draws them and
 * measures the world for them. The motes are simple shapes until the art pass (SLICE.md).
 */
export interface Swarm extends TargetGroup {
  /** Sends motes in from these points, one each, if any are free. */
  wake(from: readonly Vector3[]): void;
  update(dt: number, world: SwarmWorld): void;
  /** Motes flying now, brought down since the start, and bolts fired. */
  readonly live: number;
  readonly down: number;
  readonly fired: number;
  /** Each flying mote's state, for the `?debug` hook. */
  inspect(): { at: number[]; spot: number[] | null; phase: string; blind: number; target: Shooter }[];
}

/** What the swarm needs to know of the world each frame. */
export interface SwarmWorld {
  hero: { feet: Vector3; height: number };
  partner: { feet: Vector3 };
  cast(from: Vector3, to: Vector3): { point: Vector3; distance: number; body: PhysicsBody | null | undefined } | null;
  /** A bolt struck the hero, fired from `from`. */
  onHeroHit(from: Vector3): void;
}

/** How many motes there can be at once. */
const POOL = 8;
const BOLTS = 24;
/** The fallen stay on the floor this long. */
const FALLEN_SECONDS = 4;
const RED = new Color3(1, 0.22, 0.12);
const BODY_RADIUS = 0.3;

interface Mote {
  root: TransformNode;
  shell: Mesh;
  emitter: PBRMaterial;
  fins: TransformNode;
  aggregate: PhysicsAggregate | null;
  active: boolean;
  hp: number;
  fallen: number;
  phase: FirePhase;
  spot: Vector3 | null;
  stay: number;
  /** Seconds since it last saw its target; it moves on when this grows. */
  blind: number;
  retry: number;
  target: Shooter;
  flash: number;
}

interface Bolt {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  from: Vector3;
}

const chestOf = (feet: Vector3, height: number) => feet.add(new Vector3(0, height * 0.65, 0));

export function buildSwarm(scene: Scene, maxLights: number): Swarm {
  const plate = new PBRMaterial('mote-plate', scene);
  plate.albedoColor = new Color3(0.16, 0.13, 0.12);
  plate.metallic = 0.8;
  plate.roughness = 0.4;
  plate.maxSimultaneousLights = maxLights;
  const glowing = (name: string) => {
    const m = new PBRMaterial(name, scene);
    m.albedoColor = new Color3(0.02, 0.02, 0.02);
    m.emissiveColor = RED.scale(0.5);
    m.metallic = 0;
    m.roughness = 0.6;
    return m;
  };

  const motes: Mote[] = Array.from({ length: POOL }, (_, i) => {
    const root = new TransformNode(`mote-${i}`, scene);
    const shell = CreateSphere(`mote-${i}-shell`, { diameter: BODY_RADIUS * 2, segments: 12 }, scene);
    shell.material = plate;
    shell.parent = root;
    const emitter = glowing(`mote-${i}-emitter`);
    const lens = CreateSphere(`mote-${i}-lens`, { diameter: 0.16, segments: 8 }, scene);
    lens.material = emitter;
    // Everything hangs from the shell, so a mote brought down falls whole.
    lens.parent = shell;
    lens.position.z = BODY_RADIUS - 0.02;
    lens.isPickable = false;
    const fins = new TransformNode(`mote-${i}-fins`, scene);
    fins.parent = shell;
    for (let f = 0; f < 3; f++) {
      const fin = CreateBox(`mote-${i}-fin-${f}`, { width: 0.05, height: 0.5, depth: 0.22 }, scene);
      fin.material = plate;
      fin.parent = fins;
      fin.rotation.z = (f * Math.PI * 2) / 3;
      fin.position.set(Math.sin(fin.rotation.z) * -0.32, Math.cos(fin.rotation.z) * 0.32, -0.08);
      fin.isPickable = false;
    }
    root.setEnabled(false);
    return {
      root,
      shell,
      emitter,
      fins,
      aggregate: null,
      active: false,
      hp: 0,
      fallen: 0,
      phase: { kind: 'rest', left: 1 },
      spot: null,
      stay: 0,
      blind: 0,
      retry: 0,
      target: 'hero',
      flash: 0,
    };
  });

  const boltGlow = glowing('bolt-glow');
  boltGlow.emissiveColor = new Color3(1, 0.45, 0.25);
  const sparkGlow = glowing('bolt-spark-glow');
  sparkGlow.emissiveColor = new Color3(1, 0.6, 0.3);
  const bolts: Bolt[] = Array.from({ length: BOLTS }, (_, i) => {
    const mesh = CreateBox(`bolt-${i}`, { width: 0.12, height: 0.12, depth: 0.7 }, scene);
    mesh.material = boltGlow;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, velocity: Vector3.Zero(), life: 0, from: Vector3.Zero() };
  });
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const mesh = CreateSphere(`bolt-spark-${i}`, { diameter: 0.25, segments: 6 }, scene);
    mesh.material = sparkGlow;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, time: 0 };
  });
  const spark = (at: Vector3) => {
    const free = sparks.find((s) => s.time <= 0) ?? sparks[0];
    if (!free) return;
    free.mesh.position.copyFrom(at);
    free.mesh.setEnabled(true);
    free.time = 0.12;
  };

  let down = 0;
  let fired = 0;
  let clock = 0;
  const flying = (m: Mote) => m.active && m.hp > 0;
  const isMoteBody = (body: PhysicsBody | null | undefined) => !!body && motes.some((m) => m.aggregate?.body === body);
  /** Whether nothing but a mote stands between two points. */
  const clearBetween = (world: SwarmWorld, a: Vector3, b: Vector3) => {
    const along = b.subtract(a);
    const length = along.length();
    if (length < 1e-3) return true;
    // Start just outside the mote's own shell.
    const start = a.add(along.scale(Math.min(0.45, length / 2) / length));
    const hit = world.cast(start, b);
    return !hit || isMoteBody(hit.body);
  };

  const fire = (m: Mote, aim: Vector3) => {
    const bolt = bolts.find((b) => b.life <= 0);
    if (!bolt) return;
    const from = m.root.position.add(m.root.forward.scale(BODY_RADIUS + 0.1));
    // A spread that grows with distance: close bolts are near their mark, far ones often miss.
    const reach = BOLT.spread + BOLT.spreadPerMetre * Vector3.Distance(from, aim);
    const spread = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).scale(2 * reach);
    bolt.velocity = aim.add(spread).subtract(from).normalize().scale(BOLT.speed);
    bolt.mesh.position.copyFrom(from);
    bolt.mesh.lookAt(from.add(bolt.velocity));
    bolt.mesh.setEnabled(true);
    bolt.life = BOLT.life;
    bolt.from = from;
    fired += 1;
  };

  const bringDown = (m: Mote) => {
    m.hp = 0;
    m.fallen = FALLEN_SECONDS;
    m.emitter.emissiveColor = Color3.Black();
    m.aggregate?.dispose();
    // A loose body falls on its own, so it leaves the node that flew it.
    m.shell.setParent(null);
    m.aggregate = new PhysicsAggregate(m.shell, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.3 }, scene);
    m.aggregate.body.applyImpulse(new Vector3(0, 0.5, 0), m.shell.getAbsolutePosition());
    down += 1;
  };

  return {
    size: POOL,
    centre(id) {
      return motes[id]?.root.position.clone() ?? Vector3.Zero();
    },
    alive(id) {
      const m = motes[id];
      return !!m && flying(m);
    },
    owns(id, body) {
      const m = motes[id];
      return !!m && !!body && m.aggregate?.body === body;
    },
    hit(body, by) {
      const m = motes.find((x) => flying(x) && !!body && x.aggregate?.body === body);
      if (!m) return false;
      m.hp -= 1;
      m.flash = 0.12;
      // It turns on whoever shot it, and moves at once.
      m.target = by;
      m.spot = null;
      if (m.hp <= 0) bringDown(m);
      return true;
    },
    wake(from) {
      let i = 0;
      for (const m of motes) {
        const at = from[i];
        if (!at) break;
        if (m.active) continue;
        i += 1;
        m.active = true;
        m.hp = MOTE.hits;
        m.fallen = 0;
        m.spot = null;
        m.blind = 0;
        m.retry = 0;
        m.target = 'hero';
        m.phase = { kind: 'rest', left: 0.8 + Math.random() * 1.2 };
        m.shell.parent = m.root;
        m.shell.position.setAll(0);
        m.shell.rotationQuaternion = null;
        m.shell.rotation.setAll(0);
        m.root.position.copyFrom(at);
        m.root.setEnabled(true);
        m.emitter.emissiveColor = RED.scale(0.5);
        m.aggregate = new PhysicsAggregate(m.shell, PhysicsShapeType.SPHERE, { mass: 0 }, scene);
        // Moved by the game each frame, and felt by rays and bodies where it is.
        m.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
        m.aggregate.body.disablePreStep = false;
      }
    },
    update(dt, world) {
      clock += dt;
      const heroChest = chestOf(world.hero.feet, world.hero.height);
      const partnerChest = chestOf(world.partner.feet, 1.8);
      const others = (self: Mote) => motes.filter((o) => o !== self && flying(o)).map((o) => o.spot ?? o.root.position);

      for (const m of motes) {
        if (!m.active) continue;
        if (m.hp <= 0) {
          m.fallen -= dt;
          if (m.fallen <= 0) {
            m.aggregate?.dispose();
            m.aggregate = null;
            m.active = false;
            m.shell.parent = m.root;
            m.root.setEnabled(false);
          }
          continue;
        }
        const targetFeet = m.target === 'hero' ? world.hero.feet : world.partner.feet;
        const aim = m.target === 'hero' ? heroChest : partnerChest;
        const here = m.root.position;
        const sees = clearBetween(world, here, aim);
        m.blind = sees ? 0 : m.blind + dt;

        // Move on when it has stayed long enough, lost sight of its target, or has nowhere yet.
        m.retry -= dt;
        if ((!m.spot || m.stay <= 0 || m.blind > 1.2) && m.retry <= 0) {
          const spot = pickSpot({
            me: here,
            target: targetFeet,
            others: others(m),
            rng: Math.random,
            clear: (a, b) => clearBetween(world, new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z)),
            aimAt: aim,
          });
          if (spot) {
            m.spot = new Vector3(spot.x, spot.y, spot.z);
            m.stay = MOTE.stayMin + Math.random() * (MOTE.stayMax - MOTE.stayMin);
            m.blind = 0;
          }
          m.retry = 0.5;
        }
        if (m.spot) {
          const to = m.spot.subtract(here);
          const distance = to.length();
          if (distance > 0.05) here.addInPlace(to.scale(Math.min(1, (MOTE.speed * dt) / distance)));
          if (distance < 0.3) m.stay -= dt;
        }
        // A slow bob, and the fins turning, so it never looks quite still.
        m.root.position.y += Math.sin(clock * 3 + m.shell.uniqueId) * 0.002;
        m.fins.rotation.z += dt * 2.5;
        m.root.lookAt(aim);

        const step = fireStep(m.phase, dt, sees, Math.random);
        m.phase = step.phase;
        const charge = m.phase.kind === 'charge' ? 1 - m.phase.left / MOTE.charge : 0;
        m.flash -= dt;
        m.emitter.emissiveColor = m.flash > 0 ? new Color3(1, 1, 1) : RED.scale(0.5 + charge * 2.5);
        if (step.fire) fire(m, aim);
      }

      for (const bolt of bolts) {
        if (bolt.life <= 0) continue;
        bolt.life -= dt;
        const a = bolt.mesh.position.clone();
        const b = a.add(bolt.velocity.scale(dt));
        const wall = world.cast(a, b);
        const wallAt = wall && !isMoteBody(wall.body) ? wall.distance / Math.max(1e-6, Vector3.Distance(a, b)) : null;
        const heroAt = boltMeetsBody(a, b, world.hero.feet, world.hero.height, 0.3);
        const partnerAt = boltMeetsBody(a, b, world.partner.feet, 1.8, 0.3);
        const first = Math.min(wallAt ?? 2, heroAt ?? 2, partnerAt ?? 2);
        if (first <= 1) {
          spark(Vector3.Lerp(a, b, first));
          bolt.life = 0;
          bolt.mesh.setEnabled(false);
          if (first === heroAt) world.onHeroHit(bolt.from);
          continue;
        }
        bolt.mesh.position.copyFrom(b);
        if (bolt.life <= 0) bolt.mesh.setEnabled(false);
      }
      for (const s of sparks) {
        if (s.time <= 0) continue;
        s.time -= dt;
        if (s.time <= 0) s.mesh.setEnabled(false);
      }
    },
    get live() {
      return motes.filter(flying).length;
    },
    get down() {
      return down;
    },
    get fired() {
      return fired;
    },
    inspect() {
      const round = (v: Vector3) => [v.x, v.y, v.z].map((n) => Math.round(n * 100) / 100);
      return motes.filter(flying).map((m) => ({
        at: round(m.root.position),
        spot: m.spot ? round(m.spot) : null,
        phase: m.phase.kind,
        blind: Math.round(m.blind * 10) / 10,
        target: m.target,
      }));
    },
  };
}
