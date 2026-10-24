import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/**
 * The sky over Ross 128 b (SLICE.md). Ross 128 is real: a quiet red dwarf eleven light-years from the
 * Sun. From its planet, 7.4 million km out, its disc is about 2.1° across, four times the Sun's from
 * Earth. Everything else here is fiction: the dusk, and the swarm that rings the star after the
 * lights go. The sky is drawn at an infinite distance, so it is the same from the station and from
 * the ship.
 */
export interface Sky {
  /** Where the star stands, as a direction from the viewer. */
  sun: Vector3;
  /** Shows the swarm's ring round the star. */
  swarm(visible: boolean): void;
  /** Turns the swarm's ring, slowly, so it reads as machines rather than stars. */
  update(dt: number): void;
}

const SKY_RADIUS = 900;

/** Colours a mesh's vertices by height: a dusk near the star's side, dark overhead. */
function paintDome(dome: Mesh, sun: Vector3) {
  const positions = dome.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return;
  const colours = new Float32Array((positions.length / 3) * 4);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3] ?? 0;
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    const up = y / length;
    const towards = Math.max(0, (x * sun.x + y * sun.y + z * sun.z) / length);
    // Dark violet overhead, a dim rust at the horizon, warmest towards the star.
    const horizon = Math.max(0, 1 - Math.abs(up) * 3.2);
    const glow = towards ** 6;
    colours[i * 4] = 0.015 + horizon * 0.16 + glow * 0.45;
    colours[i * 4 + 1] = 0.012 + horizon * 0.06 + glow * 0.12;
    colours[i * 4 + 2] = 0.04 + horizon * 0.07 + glow * 0.04;
    colours[i * 4 + 3] = 1;
  }
  dome.setVerticesData(VertexBuffer.ColorKind, colours);
}

const unlit = (scene: Scene, name: string, colour: Color3, alpha = 1) => {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.emissiveColor = colour;
  m.alpha = alpha;
  m.backFaceCulling = false;
  return m;
};

export function buildSky(scene: Scene): Sky {
  // Low in the west, just above the horizon: the station sits near the planet's dayside edge.
  const sun = new Vector3(-0.92, 0.12, 0.37).normalize();
  scene.clearColor = new Color4(0.01, 0.01, 0.02, 1);

  const dome = CreateSphere('sky', { diameter: SKY_RADIUS * 2, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene);
  paintDome(dome, sun);
  // Unlit, its colour taken from the vertices (emissive white times the vertex colour).
  const domeMaterial = unlit(scene, 'sky', new Color3(1, 1, 1));
  domeMaterial.diffuseColor = Color3.Black();
  dome.useVertexColors = true;
  dome.material = domeMaterial;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.applyFog = false;

  // Stars: a few hundred specks, none near the star's glow.
  const specks: Mesh[] = [];
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 420; i++) {
    const y = random() * 0.95 + 0.05;
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    const dir = new Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
    if (Vector3.Dot(dir, sun) > 0.93) continue;
    const s = 0.9 + random() * 1.8;
    const speck = CreateBox(`star-${i}`, { size: s }, scene);
    speck.position = dir.scale(SKY_RADIUS * 0.95);
    specks.push(speck);
  }
  const stars = Mesh.MergeMeshes(specks, true, true);
  if (stars) {
    stars.material = unlit(scene, 'stars', new Color3(0.75, 0.78, 0.9));
    stars.infiniteDistance = true;
    stars.isPickable = false;
  }

  // The star: a disc 2.1° across, with a soft halo round it.
  const distance = SKY_RADIUS * 0.9;
  const diameter = 2 * distance * Math.tan(((2.1 / 2) * Math.PI) / 180);
  const disc = CreateDisc('ross-128', { radius: diameter / 2, tessellation: 48 }, scene);
  disc.material = unlit(scene, 'ross-128', new Color3(1, 0.42, 0.18));
  const halo = CreateDisc('ross-128-halo', { radius: diameter * 2.4, tessellation: 48 }, scene);
  halo.material = unlit(scene, 'ross-128-halo', new Color3(0.9, 0.25, 0.08), 0.22);
  for (const m of [halo, disc]) {
    m.position = sun.scale(distance);
    m.billboardMode = Mesh.BILLBOARDMODE_ALL;
    m.infiniteDistance = true;
    m.isPickable = false;
  }
  disc.position = sun.scale(distance * 0.99);

  // The swarm: points of light in a slow ring round the star, a little wider than its halo, in the
  // plane facing the viewer, turning about the line to the star.
  const u = Vector3.Cross(sun, Vector3.Up()).normalize();
  const v = Vector3.Cross(u, sun).normalize();
  const motes: Mesh[] = [];
  for (let i = 0; i < 90; i++) {
    const m = CreateBox(`swarm-${i}`, { size: 1.4 + (i % 3) * 0.5 }, scene);
    const angle = (i / 90) * Math.PI * 2;
    const r = diameter * (1.6 + 0.35 * Math.sin(i * 1.7));
    m.position = sun
      .scale(distance * 0.98)
      .add(u.scale(Math.cos(angle) * r))
      .add(v.scale(Math.sin(angle) * r));
    motes.push(m);
  }
  const ring = Mesh.MergeMeshes(motes, true, true);
  if (ring) {
    ring.material = unlit(scene, 'swarm-ring', new Color3(1, 0.7, 0.45));
    ring.infiniteDistance = true;
    ring.isPickable = false;
    ring.setEnabled(false);
  }

  let turn = 0;
  return {
    sun,
    swarm(visible) {
      ring?.setEnabled(visible);
    },
    update(dt) {
      if (!ring?.isEnabled()) return;
      turn += dt * 0.03;
      ring.rotationQuaternion = Quaternion.RotationAxis(sun, turn);
    },
  };
}
