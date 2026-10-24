import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import type { Scene } from '@babylonjs/core/scene';
import type { Damage, TargetGroup } from './combat.ts';
import { type Defences, DIFFICULTY, type Difficulty, moteDefences, takeHit } from './defences.ts';
import { BOLT, boltMeetsBody, type FirePhase, fireStep, MACHINES, type MachineKind, pickSpot } from './swarm.ts';

/**
 * The swarm in the scene (COMBAT.md): motes that fly to places that see their target and fire slow
 * bolts; lattices that hang back and charge a beam along a line they draw first; a tender that sends
 * out motes. Walls and cover stop bolts and beams. The rules are in src/game/swarm.ts; this draws
 * them and measures the world for them. Simple shapes until the art pass (SLICE.md).
 */
export interface Swarm extends TargetGroup {
  /** Sends machines of a kind in from these points, one each, if any are free. */
  wake(from: readonly Vector3[], kind?: MachineKind): void;
  /** Takes every machine and shot away at once (a restart). */
  clear(): void;
  update(dt: number, world: SwarmWorld): void;
  /** Machines flying now, brought down since the start, and shots fired. */
  readonly live: number;
  readonly down: number;
  readonly fired: number;
  /** Each flying machine's state, for the `?debug` hook. */
  inspect(): { kind: MachineKind; at: number[]; phase: string; target: string }[];
}

/** Someone the swarm can shoot at: the hero or a companion. */
export interface SwarmTarget {
  id: string;
  feet: Vector3;
  /** Standing height, or less when crouched behind cover. */
  height: number;
  down: boolean;
}

/** What the swarm needs to know of the world each frame. */
export interface SwarmWorld {
  /** The hero first, then the companions. */
  targets: SwarmTarget[];
  cast(from: Vector3, to: Vector3): { point: Vector3; distance: number; body: PhysicsBody | null | undefined } | null;
  /** A shot struck someone, fired from `from`, for `damage` at Standard. */
  onHit(id: string, from: Vector3, damage: number): void;
  difficulty: Difficulty;
}

const POOL: Record<MachineKind, number> = { mote: 14, lattice: 3, tender: 1 };
const BOLTS = 32;
/** The fallen stay on the floor this long. */
const FALLEN_SECONDS = 5;
const RED = new Color3(1, 0.22, 0.12);

interface Machine {
  kind: MachineKind;
  root: TransformNode;
  shell: Mesh;
  emitter: PBRMaterial;
  spin: TransformNode;
  aggregate: PhysicsAggregate | null;
  active: boolean;
  defences: Defences;
  alive: boolean;
  fallen: number;
  phase: FirePhase;
  spot: Vector3 | null;
  stay: number;
  blind: number;
  retry: number;
  target: string;
  flash: number;
  /** A lattice's beam: where it will fire, locked when the charge starts. */
  aim: Vector3 | null;
  /** A tender's motes still flying. */
  brood: Machine[];
}

interface Bolt {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  from: Vector3;
  damage: number;
}

const chestOf = (feet: Vector3, height: number) => feet.add(new Vector3(0, height * 0.65, 0));

/** A machine's defences (D-42), scaled by the difficulty's toughness. */
function defencesOf(kind: MachineKind, toughness: number): Defences {
  const layers = (shield: number, plate: number, block: number, health: number): Defences => ({
    shield: shield * toughness,
    shieldMax: shield * toughness,
    plate: plate * toughness,
    plateMax: plate * toughness,
    plateBlock: block,
    health: health * toughness,
    healthMax: health * toughness,
    sinceHit: Number.POSITIVE_INFINITY,
  });
  if (kind === 'lattice') return layers(0, 120, 8, 80);
  if (kind === 'tender') return layers(150, 150, 10, 150);
  return moteDefences(toughness);
}

export function buildSwarm(scene: Scene, maxLights: number): Swarm {
  const plate = new PBRMaterial('mote-plate', scene);
  plate.albedoColor = new Color3(0.16, 0.13, 0.12);
  plate.metallic = 0.8;
  plate.roughness = 0.4;
  plate.maxSimultaneousLights = maxLights;
  const glowing = (name: string, colour = RED.scale(0.5)) => {
    const m = new PBRMaterial(name, scene);
    m.albedoColor = new Color3(0.02, 0.02, 0.02);
    m.emissiveColor = colour;
    m.metallic = 0;
    m.roughness = 0.6;
    return m;
  };

  let made = 0;
  const machine = (kind: MachineKind): Machine => {
    const i = made++;
    const rules = MACHINES[kind];
    const root = new TransformNode(`${kind}-${i}`, scene);
    const shell = CreateSphere(`${kind}-${i}-shell`, { diameter: rules.radius * 2, segments: 12 }, scene);
    shell.material = plate;
    shell.parent = root;
    if (kind === 'tender') shell.scaling.y = 0.55;
    const emitter = glowing(`${kind}-${i}-emitter`);
    // Everything hangs from the shell, so a machine brought down falls whole.
    const lens = CreateSphere(`${kind}-${i}-lens`, { diameter: rules.radius * 0.55, segments: 8 }, scene);
    lens.material = emitter;
    lens.parent = shell;
    lens.position.z = rules.radius * 0.9;
    lens.isPickable = false;
    const spin = new TransformNode(`${kind}-${i}-spin`, scene);
    spin.parent = shell;
    if (kind === 'mote') {
      for (let f = 0; f < 3; f++) {
        const fin = CreateBox(`mote-${i}-fin-${f}`, { width: 0.05, height: 0.5, depth: 0.22 }, scene);
        fin.material = plate;
        fin.parent = spin;
        fin.rotation.z = (f * Math.PI * 2) / 3;
        fin.position.set(Math.sin(fin.rotation.z) * -0.32, Math.cos(fin.rotation.z) * 0.32, -0.08);
        fin.isPickable = false;
      }
    } else if (kind === 'lattice') {
      // Six motes locked into a frame round the core.
      for (let f = 0; f < 6; f++) {
        const node = CreateSphere(`lattice-${i}-node-${f}`, { diameter: 0.42, segments: 8 }, scene);
        node.material = plate;
        node.parent = spin;
        const a = (f * Math.PI * 2) / 6;
        node.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
        node.isPickable = false;
        const strut = CreateBox(`lattice-${i}-strut-${f}`, { width: 0.06, height: 0.95, depth: 0.06 }, scene);
        strut.material = emitter;
        strut.parent = spin;
        strut.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0);
        strut.rotation.z = a - Math.PI / 2;
        strut.isPickable = false;
      }
    } else {
      const ring = CreateTorus(`tender-${i}-ring`, { diameter: 3.8, thickness: 0.3, tessellation: 40 }, scene);
      ring.material = emitter;
      ring.parent = spin;
      ring.isPickable = false;
      for (let f = 0; f < 4; f++) {
        const pod = CreateSphere(`tender-${i}-pod-${f}`, { diameter: 0.7, segments: 8 }, scene);
        pod.material = plate;
        pod.parent = spin;
        const a = (f * Math.PI) / 2;
        pod.position.set(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9);
        pod.isPickable = false;
      }
    }
    root.setEnabled(false);
    return {
      kind,
      root,
      shell,
      emitter,
      spin,
      aggregate: null,
      active: false,
      defences: defencesOf(kind, 1),
      alive: false,
      fallen: 0,
      phase: { kind: 'rest', left: 1 },
      spot: null,
      stay: 0,
      blind: 0,
      retry: 0,
      target: 'hero',
      flash: 0,
      aim: null,
      brood: [],
    };
  };
  const machines: Machine[] = (['mote', 'lattice', 'tender'] as MachineKind[]).flatMap((kind) =>
    Array.from({ length: POOL[kind] }, () => machine(kind)),
  );

  const boltGlow = glowing('bolt-glow', new Color3(1, 0.45, 0.25));
  const sparkGlow = glowing('bolt-spark-glow', new Color3(1, 0.6, 0.3));
  const beamGlow = glowing('beam-glow', new Color3(1, 0.15, 0.1));
  beamGlow.alpha = 0.55;
  const bolts: Bolt[] = Array.from({ length: BOLTS }, (_, i) => {
    const mesh = CreateBox(`bolt-${i}`, { width: 0.09, height: 0.09, depth: 0.7 }, scene);
    mesh.material = boltGlow;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, velocity: Vector3.Zero(), life: 0, from: Vector3.Zero(), damage: 0 };
  });
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const mesh = CreateSphere(`bolt-spark-${i}`, { diameter: 0.25, segments: 6 }, scene);
    mesh.material = sparkGlow;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, time: 0 };
  });
  /** One line per lattice: the warning while it charges, and the beam when it fires. */
  const beams = machines
    .filter((m) => m.kind === 'lattice')
    .map((m, i) => {
      const mesh = CreateBox(`beam-${i}`, { width: 0.05, height: 0.05, depth: 1 }, scene);
      mesh.material = beamGlow;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      return { owner: m, mesh, time: 0 };
    });
  const spark = (at: Vector3, size = 1) => {
    const free = sparks.find((s) => s.time <= 0) ?? sparks[0];
    if (!free) return;
    free.mesh.position.copyFrom(at);
    free.mesh.scaling.setAll(size);
    free.mesh.setEnabled(true);
    free.time = 0.12;
  };
  const drawLine = (mesh: Mesh, from: Vector3, to: Vector3, width: number) => {
    mesh.position = Vector3.Lerp(from, to, 0.5);
    mesh.scaling.set(width, width, Vector3.Distance(from, to));
    mesh.lookAt(to);
    mesh.setEnabled(true);
  };

  let down = 0;
  let fired = 0;
  let clock = 0;
  let toughness = 1;
  const flying = (m: Machine) => m.active && m.alive;
  const isMachineBody = (body: PhysicsBody | null | undefined) =>
    !!body && machines.some((m) => m.aggregate?.body === body);
  /** Whether nothing but a machine stands between two points. */
  const clearBetween = (world: SwarmWorld, a: Vector3, b: Vector3, skip = 0.45) => {
    const along = b.subtract(a);
    const length = along.length();
    if (length < 1e-3) return true;
    const start = a.add(along.scale(Math.min(skip, length / 2) / length));
    const hit = world.cast(start, b);
    return !hit || isMachineBody(hit.body);
  };

  const fireBolt = (m: Machine, aim: Vector3, damage: number) => {
    const bolt = bolts.find((b) => b.life <= 0);
    if (!bolt) return;
    const from = m.root.position.add(m.root.forward.scale(MACHINES[m.kind].radius + 0.1));
    // A spread that grows with distance: close bolts are near their mark, far ones often miss.
    const reach = BOLT.spread + BOLT.spreadPerMetre * Vector3.Distance(from, aim);
    const spread = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).scale(2 * reach);
    bolt.velocity = aim.add(spread).subtract(from).normalize().scale(BOLT.speed);
    bolt.mesh.position.copyFrom(from);
    bolt.mesh.lookAt(from.add(bolt.velocity));
    bolt.mesh.setEnabled(true);
    bolt.life = BOLT.life;
    bolt.from = from;
    bolt.damage = damage;
    fired += 1;
  };

  const wakeKind = (from: readonly Vector3[], kind: MachineKind): Machine[] => {
    const woken: Machine[] = [];
    let i = 0;
    for (const m of machines) {
      const at = from[i];
      if (!at) break;
      if (m.kind !== kind || m.active) continue;
      i += 1;
      m.active = true;
      m.alive = true;
      m.defences = defencesOf(kind, toughness);
      m.fallen = 0;
      m.spot = null;
      m.blind = 0;
      m.retry = 0;
      m.aim = null;
      m.brood = [];
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
      woken.push(m);
    }
    return woken;
  };

  const bringDown = (m: Machine) => {
    m.alive = false;
    m.fallen = FALLEN_SECONDS;
    m.emitter.emissiveColor = Color3.Black();
    m.aim = null;
    m.aggregate?.dispose();
    // A loose body falls on its own, so it leaves the node that flew it.
    m.shell.setParent(null);
    m.aggregate = new PhysicsAggregate(
      m.shell,
      PhysicsShapeType.SPHERE,
      { mass: m.kind === 'mote' ? 1 : 6, restitution: 0.25 },
      scene,
    );
    m.aggregate.body.applyImpulse(new Vector3(0, 0.5, 0), m.shell.getAbsolutePosition());
    down += 1;
    // A lattice comes apart into the motes it was made of.
    if (m.kind === 'lattice') {
      const at = m.root.position;
      wakeKind(
        [at.add(new Vector3(0.8, 0.3, 0)), at.add(new Vector3(-0.8, 0.3, 0)), at.add(new Vector3(0, 0.8, 0))],
        'mote',
      );
    }
  };

  const retire = (m: Machine) => {
    m.aggregate?.dispose();
    m.aggregate = null;
    m.active = false;
    m.alive = false;
    m.shell.parent = m.root;
    m.root.setEnabled(false);
  };

  return {
    size: machines.length,
    centre(id) {
      return machines[id]?.root.position.clone() ?? Vector3.Zero();
    },
    alive(id) {
      const m = machines[id];
      return !!m && flying(m);
    },
    owns(id, body) {
      const m = machines[id];
      return !!m && !!body && m.aggregate?.body === body;
    },
    hit(body, by, damage: Damage) {
      const m = machines.find((x) => flying(x) && !!body && x.aggregate?.body === body);
      if (!m) return false;
      const result = takeHit(m.defences, damage.amount, damage.kind);
      m.defences = result.defences;
      m.flash = 0.12;
      // It turns on whoever shot it; a mote moves at once.
      m.target = by;
      if (m.kind === 'mote') m.spot = null;
      if (result.down) bringDown(m);
      return true;
    },
    wake(from, kind = 'mote') {
      wakeKind(from, kind);
    },
    clear() {
      for (const m of machines) if (m.active) retire(m);
      for (const b of bolts) {
        b.life = 0;
        b.mesh.setEnabled(false);
      }
      for (const beam of beams) {
        beam.time = 0;
        beam.mesh.setEnabled(false);
      }
    },
    update(dt, world) {
      clock += dt;
      const level = DIFFICULTY[world.difficulty];
      toughness = level.toughness;
      const standing = world.targets.filter((t) => !t.down);
      const others = (self: Machine) =>
        machines.filter((o) => o !== self && flying(o)).map((o) => o.spot ?? o.root.position);

      for (const m of machines) {
        if (!m.active) continue;
        if (!m.alive) {
          m.fallen -= dt;
          if (m.fallen <= 0) retire(m);
          continue;
        }
        const rules = MACHINES[m.kind];
        // Its target, or the nearest one standing if its target is down.
        let target = world.targets.find((t) => t.id === m.target);
        if (!target || target.down) {
          target = [...standing].sort(
            (a, b) => Vector3.Distance(a.feet, m.root.position) - Vector3.Distance(b.feet, m.root.position),
          )[0];
          if (target) m.target = target.id;
        }
        const here = m.root.position;
        const aim = target ? chestOf(target.feet, target.height) : null;
        const sees = !!aim && clearBetween(world, here, aim, rules.radius + 0.15);
        m.blind = sees ? 0 : m.blind + dt;

        // Shut in with no way to its target (a room's corner, behind a wall), it comes out elsewhere,
        // as the swarm does from its vents: somewhere that sees its target, and is in the open.
        if (target && aim && m.blind > 4 && m.retry <= 0) {
          const out = pickSpot({
            me: here,
            target: target.feet,
            others: others(m),
            rng: Math.random,
            clear: (a, b) =>
              a === here ||
              clearBetween(world, new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z), rules.radius + 0.15),
            aimAt: aim,
            rules,
            tries: 20,
          });
          if (out) {
            here.set(out.x, out.y, out.z);
            m.spot = null;
            m.blind = 0;
          }
        }
        // Move on when it has stayed long enough, lost sight of its target, or has nowhere yet.
        m.retry -= dt;
        if (target && aim && (!m.spot || m.stay <= 0 || m.blind > 1.2) && m.retry <= 0) {
          const spot = pickSpot({
            me: here,
            target: target.feet,
            others: others(m),
            rng: Math.random,
            clear: (a, b) =>
              clearBetween(world, new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z), rules.radius + 0.15),
            aimAt: aim,
            rules,
          });
          if (spot) {
            m.spot = new Vector3(spot.x, spot.y, spot.z);
            m.stay = rules.stayMin + Math.random() * (rules.stayMax - rules.stayMin);
            m.blind = 0;
          }
          m.retry = 0.5;
        }
        if (m.spot) {
          const to = m.spot.subtract(here);
          const distance = to.length();
          if (distance > 0.05) here.addInPlace(to.scale(Math.min(1, (rules.speed * dt) / distance)));
          if (distance < 0.3) m.stay -= dt;
        }
        // A slow bob and a turning frame, so it never looks quite still.
        m.root.position.y += Math.sin(clock * 3 + m.shell.uniqueId) * 0.002;
        m.spin.rotation.z += dt * (m.kind === 'mote' ? 2.5 : 0.8);
        if (m.kind === 'tender') m.spin.rotation.y += dt * 0.6;
        if (aim) m.root.lookAt(m.kind === 'lattice' && m.aim ? m.aim : aim);

        // A tender's shield returns after five quiet seconds.
        m.defences = { ...m.defences, sinceHit: m.defences.sinceHit + dt };
        if (m.kind === 'tender' && m.defences.sinceHit > 5) {
          m.defences.shield = Math.min(m.defences.shieldMax, m.defences.shield + 30 * dt);
        }

        const step = fireStep(m.phase, dt, sees, Math.random, {
          charge: rules.charge,
          restMin: rules.restMin * level.rest,
          restMax: rules.restMax * level.rest,
        });
        // A lattice locks its aim when the charge starts, and draws the line it will fire along.
        if (m.kind === 'lattice') {
          if (step.phase.kind === 'charge' && !m.aim && aim) m.aim = aim.clone();
          if (step.phase.kind === 'rest' && !step.fire) m.aim = null;
          const line = beams.find((b) => b.owner === m);
          if (line && m.aim && step.phase.kind === 'charge') drawLine(line.mesh, here, m.aim, 0.5);
          else if (line && line.time <= 0) line.mesh.setEnabled(false);
        }
        m.phase = step.phase;
        const charge = m.phase.kind === 'charge' ? 1 - m.phase.left / rules.charge : 0;
        m.flash -= dt;
        m.emitter.emissiveColor = m.flash > 0 ? new Color3(1, 1, 1) : RED.scale(0.5 + charge * 2.5);
        if (!step.fire || !aim) continue;
        if (rules.weapon === 'bolt') fireBolt(m, aim, rules.damage);
        else if (rules.weapon === 'beam') {
          // The beam: along the locked line until the first wall, striking whoever stands in it.
          const lockedAt = m.aim ?? aim;
          const dir = lockedAt.subtract(here).normalize();
          const start = here.add(dir.scale(rules.radius + 0.1));
          const end = start.add(dir.scale(40));
          const wall = world.cast(start, end);
          const stop = wall && !isMachineBody(wall.body) ? wall.point : end;
          for (const t of standing) {
            if (boltMeetsBody(start, stop, t.feet, t.height, 0.3, 0.12) !== null) world.onHit(t.id, here, rules.damage);
          }
          const line = beams.find((b) => b.owner === m);
          if (line) {
            drawLine(line.mesh, start, stop, 4);
            line.time = 0.25;
          }
          spark(stop, 2);
          fired += 1;
          m.aim = null;
        } else {
          // A tender sends out motes in threes, up to six of its own at once.
          m.brood = m.brood.filter(flying);
          const room = Math.min(3, 6 - m.brood.length);
          if (room > 0) {
            const at = m.root.position;
            const exits = [
              at.add(new Vector3(1.5, -0.5, 0)),
              at.add(new Vector3(-1.5, -0.5, 0)),
              at.add(new Vector3(0, -0.5, 1.5)),
            ];
            m.brood.push(...wakeKind(exits.slice(0, room), 'mote'));
          }
        }
      }

      for (const bolt of bolts) {
        if (bolt.life <= 0) continue;
        bolt.life -= dt;
        const a = bolt.mesh.position.clone();
        const b = a.add(bolt.velocity.scale(dt));
        const wall = world.cast(a, b);
        const wallAt =
          wall && !isMachineBody(wall.body) ? wall.distance / Math.max(1e-6, Vector3.Distance(a, b)) : null;
        let first = wallAt ?? 2;
        let struck: SwarmTarget | null = null;
        for (const t of standing) {
          const at = boltMeetsBody(a, b, t.feet, t.height, 0.3);
          if (at !== null && at < first) {
            first = at;
            struck = t;
          }
        }
        if (first <= 1) {
          spark(Vector3.Lerp(a, b, first));
          bolt.life = 0;
          bolt.mesh.setEnabled(false);
          if (struck) world.onHit(struck.id, bolt.from, bolt.damage);
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
      for (const beam of beams) {
        if (beam.time <= 0) continue;
        beam.time -= dt;
        if (beam.time <= 0) beam.mesh.setEnabled(false);
      }
    },
    get live() {
      return machines.filter(flying).length;
    },
    get down() {
      return down;
    },
    get fired() {
      return fired;
    },
    inspect() {
      const round = (v: Vector3) => [v.x, v.y, v.z].map((n) => Math.round(n * 100) / 100);
      return machines.filter(flying).map((m) => ({
        kind: m.kind,
        at: round(m.root.position),
        phase: m.phase.kind,
        target: m.target,
      }));
    },
  };
}
