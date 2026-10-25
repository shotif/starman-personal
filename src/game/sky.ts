import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Constants } from '@babylonjs/core/Engines/constants';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
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
  /** Above the air, in orbit: the dusk goes, the stars and the star stay. */
  space(above: boolean): void;
  /** In a lane: the star is gone, and the stars round the ship are blue-shifted and few. */
  lane(on: boolean): void;
  /**
   * At Pyre Remnant (PYRE.md): no sun, the faint red haze of Pyre's thrown-off layers over half the
   * sky, and Fomalhaut with its fading companion low in the west.
   */
  pyre(on: boolean): void;
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
  // And below the horizon, shown only in space.
  const lowSpecks: Mesh[] = [];
  for (let i = 0; i < 300; i++) {
    const y = -(random() * 0.95 + 0.05);
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    const speck = CreateBox(`star-low-${i}`, { size: 0.9 + random() * 1.8 }, scene);
    speck.position = new Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r).scale(SKY_RADIUS * 0.95);
    lowSpecks.push(speck);
  }
  const stars = Mesh.MergeMeshes(specks, true, true);
  const starColour = new Color3(0.75, 0.78, 0.9);
  const starMaterial = unlit(scene, 'stars', starColour);
  // The sky is drawn near the camera, so it writes no depth: a planet farther off still hides it.
  starMaterial.disableDepthWrite = true;
  const lowStars = Mesh.MergeMeshes(lowSpecks, true, true);
  if (lowStars) {
    lowStars.material = starMaterial;
    lowStars.infiniteDistance = true;
    lowStars.isPickable = false;
    lowStars.applyFog = false;
    lowStars.setEnabled(false);
  }
  if (stars) {
    stars.material = starMaterial;
    stars.infiniteDistance = true;
    stars.isPickable = false;
    stars.applyFog = false;
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
    m.applyFog = false;
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
    ring.applyFog = false;
    ring.setEnabled(false);
  }

  let remnant: Mesh[] | null = null;
  let lane: { meshes: Mesh[]; flow: DynamicTexture; gate: Mesh } | null = null;
  /** What the sky is showing: each mode is kept, and the meshes follow all of them together. */
  const mode = { swarm: false, space: false, lane: false, pyre: false };
  const apply = () => {
    const sunUp = !mode.lane && !mode.pyre;
    for (const m of [disc, halo]) m.setEnabled(sunUp);
    ring?.setEnabled(mode.swarm && sunUp);
    const inSpace = mode.space || mode.pyre;
    dome.setEnabled(!inSpace);
    lowStars?.setEnabled(inSpace);
    if (mode.pyre && !remnant) remnant = buildRemnant(scene);
    for (const m of remnant ?? []) m.setEnabled(mode.pyre && !mode.lane);
    if (mode.lane && !lane) lane = buildLane(scene);
    for (const m of lane?.meshes ?? []) m.setEnabled(mode.lane);
    starMaterial.emissiveColor = mode.lane ? new Color3(0.55, 0.75, 1.15) : starColour;
    scene.clearColor = mode.lane
      ? new Color4(0.012, 0.008, 0.045, 1)
      : mode.pyre
        ? new Color4(0.012, 0.006, 0.012, 1)
        : new Color4(0.01, 0.01, 0.02, 1);
  };
  let turn = 0;
  let laneTime = 0;
  return {
    sun,
    swarm(visible) {
      mode.swarm = visible;
      apply();
    },
    space(above) {
      mode.space = above;
      apply();
    },
    lane(on) {
      mode.lane = on;
      apply();
    },
    pyre(on) {
      mode.pyre = on;
      apply();
    },
    update(dt) {
      // In the lane the light flows past, and the gate ahead breathes.
      if (lane && mode.lane) {
        lane.flow.vOffset = (lane.flow.vOffset - dt * 0.05) % 1;
        laneTime += dt;
        lane.gate.scaling.setAll(1 + 0.06 * Math.sin(laneTime * 0.9));
      }
      if (!ring?.isEnabled()) return;
      turn += dt * 0.03;
      ring.rotationQuaternion = Quaternion.RotationAxis(sun, turn);
    },
  };
}

/** Where Fomalhaut stands in the station's sky: low in the west, seen through the commons' great window. */
export const FOMALHAUT = new Vector3(-0.93, 0.2, -0.3).normalize();
/** Fomalhaut B is 0.92 light-years from Fomalhaut; from Pyre, 12 light-years off, about 3.9° from it. */
const COMPANION_APART = (3.9 * Math.PI) / 180;

/**
 * Pyre's remnant as the station sees it. Its outer layers, thrown off about a century and a half ago at
 * a few thousand kilometres a second, are a shell about two light-years out, glowing faintly where they
 * run into the gas the star shed before it died: threads of red, and a little teal, over half the sky,
 * drawn on a canvas once. Fomalhaut (magnitude about −0.4 from here, only Canopus brighter) and its
 * companion (about 5, a K4 dwarf, faint and orange); Canopus itself, high to the north. The black hole
 * cannot be seen: a few tens of kilometres across, it shows only in the mirror, by the light it bends.
 */
/** The lane's course: Lantern's nose, and the bridge's window, look west (src/game/lantern.ts). */
const LANE_AHEAD = new Vector3(-1, 0, 0);
/** Reborn's jump: violet to blue light (its createJumpTunnel's two colours). */
const LANE_VIOLET = new Color3(0.28, 0.12, 0.75);
const LANE_CYAN = new Color3(0.35, 0.85, 1);

/**
 * Inside a lane (D-70; ACT1_ART.md §5): a tunnel of light round the ship, drawn as Starman Reborn
 * draws a jump, seen from inside. Streaks of violet to blue flow back along its walls, and far ahead
 * the gate's light. A tube about the camera, like the sky, that only adds light: one mesh and one
 * texture, drawn once and scrolled.
 */
function buildLane(scene: Scene): { meshes: Mesh[]; flow: DynamicTexture; gate: Mesh } {
  const flow = new DynamicTexture('lane-flow', { width: 512, height: 1024 }, scene, true);
  const g = flow.getContext() as CanvasRenderingContext2D;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 1024);
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // A faint glow along the whole wall, then streaks: long, thin, each fading at both ends.
  for (let i = 0; i < 40; i++) {
    const x = random() * 512;
    const c = Color3.Lerp(LANE_VIOLET, LANE_CYAN, random()).scale(0.25);
    const band = g.createLinearGradient(x - 18, 0, x + 18, 0);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.5, c.toHexString());
    band.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = band;
    g.fillRect(x - 18, 0, 36, 1024);
  }
  for (let i = 0; i < 260; i++) {
    const x = random() * 512;
    const y = random() * 1024;
    const length = 60 + random() * 380;
    const c = Color3.Lerp(LANE_VIOLET, LANE_CYAN, random()).scale(0.5 + random() * 0.9);
    c.clampToRef(0, 1, c);
    const streak = g.createLinearGradient(0, y, 0, y + length);
    streak.addColorStop(0, 'rgba(0,0,0,0)');
    streak.addColorStop(0.5, c.toHexString());
    streak.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = streak;
    const w = 1 + random() * 2.5;
    // Drawn twice where it runs off the end, so the texture wraps without a seam.
    g.fillRect(x, y, w, length);
    if (y + length > 1024) g.fillRect(x, y - 1024, w, length);
  }
  flow.update();
  flow.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
  flow.wrapV = DynamicTexture.WRAP_ADDRESSMODE;
  flow.uScale = 3;
  flow.vScale = 4;

  const tube = CreateCylinder(
    'lane-tube',
    { height: 1600, diameter: 140, tessellation: 48, cap: Mesh.NO_CAP, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  // Its length along the course.
  tube.rotation.z = Math.PI / 2;
  const tubeMaterial = new StandardMaterial('lane-tube', scene);
  tubeMaterial.disableLighting = true;
  tubeMaterial.diffuseColor = Color3.Black();
  tubeMaterial.emissiveTexture = flow;
  tubeMaterial.emissiveColor = new Color3(0.04, 0.02, 0.1);
  tubeMaterial.alphaMode = Constants.ALPHA_ADD;
  tubeMaterial.disableDepthWrite = true;
  tubeMaterial.backFaceCulling = false;
  tube.material = tubeMaterial;

  // The gate: the lane's far end, a soft white-violet light straight ahead.
  const glow = new DynamicTexture('lane-gate', { width: 256, height: 256 }, scene, false);
  const gg = glow.getContext() as CanvasRenderingContext2D;
  const radial = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
  radial.addColorStop(0, 'rgba(240,230,255,1)');
  radial.addColorStop(0.12, 'rgba(190,170,255,0.85)');
  radial.addColorStop(0.45, 'rgba(110,90,230,0.25)');
  radial.addColorStop(1, 'rgba(0,0,0,0)');
  gg.fillStyle = radial;
  gg.fillRect(0, 0, 256, 256);
  glow.update();
  glow.hasAlpha = true;
  const gate = CreateDisc('lane-gate', { radius: 90, tessellation: 32 }, scene);
  gate.position = LANE_AHEAD.scale(700);
  gate.lookAt(Vector3.Zero());
  const gateMaterial = new StandardMaterial('lane-gate', scene);
  gateMaterial.disableLighting = true;
  gateMaterial.emissiveTexture = glow;
  gateMaterial.opacityTexture = glow;
  gateMaterial.alphaMode = Constants.ALPHA_ADD;
  gateMaterial.disableDepthWrite = true;
  gateMaterial.backFaceCulling = false;
  gate.material = gateMaterial;

  for (const m of [tube, gate]) {
    m.infiniteDistance = true;
    m.isPickable = false;
    m.applyFog = false;
    m.setEnabled(false);
  }
  return { meshes: [tube, gate], flow, gate };
}

function buildRemnant(scene: Scene): Mesh[] {
  const size = 1024;
  const texture = new DynamicTexture('remnant', { width: size, height: size / 2 }, scene, true);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, size, size / 2);
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Threads: long faint curves, thickest round the western half of the sky (u near 0.5).
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i++) {
    const u = 0.5 + (random() - 0.5) * (random() < 0.75 ? 0.55 : 1);
    const v = 0.2 + random() * 0.6;
    const x = (((u % 1) + 1) % 1) * size;
    const y = v * (size / 2);
    const teal = random() < 0.12;
    const alpha = 0.03 + random() * 0.07;
    ctx.strokeStyle = teal ? `rgba(70,170,170,${alpha})` : `rgba(210,60,50,${alpha})`;
    ctx.lineWidth = 1 + random() * 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const reach = 40 + random() * 160;
    ctx.bezierCurveTo(
      x + (random() - 0.5) * reach,
      y + (random() - 0.5) * reach * 0.6,
      x + (random() - 0.5) * reach,
      y + (random() - 0.5) * reach * 0.6,
      x + (random() - 0.5) * reach * 1.4,
      y + (random() - 0.5) * reach * 0.5,
    );
    ctx.stroke();
  }
  // A broad dim glow under the threads.
  const glow = ctx.createRadialGradient(size * 0.5, size * 0.25, 10, size * 0.5, size * 0.25, size * 0.36);
  glow.addColorStop(0, 'rgba(120,30,30,0.18)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size / 2);
  texture.update();
  texture.hasAlpha = true;

  const shell = CreateSphere(
    'remnant',
    { diameter: SKY_RADIUS * 1.9, segments: 24, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  const material = new StandardMaterial('remnant', scene);
  material.disableLighting = true;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.diffuseColor = Color3.Black();
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  // The texture's middle (u = 0.5) faces the west, behind Fomalhaut.
  shell.rotation.y = Math.PI / 2;
  shell.material = material;
  shell.infiniteDistance = true;
  shell.isPickable = false;
  shell.applyFog = false;

  const distance = SKY_RADIUS * 0.94;
  const point = (name: string, dir: Vector3, size: number, colour: Color3, glowRadius: number, glowAlpha: number) => {
    const core = CreateDisc(name, { radius: size, tessellation: 16 }, scene);
    core.material = unlit(scene, name, colour);
    const halo = CreateDisc(`${name}-halo`, { radius: glowRadius, tessellation: 24 }, scene);
    halo.material = unlit(scene, `${name}-halo`, colour, glowAlpha);
    for (const m of [halo, core]) {
      m.position = dir.scale(distance);
      m.billboardMode = Mesh.BILLBOARDMODE_ALL;
      m.infiniteDistance = true;
      m.isPickable = false;
      m.applyFog = false;
    }
    core.position = dir.scale(distance * 0.995);
    return [core, halo];
  };
  const side = Vector3.Cross(FOMALHAUT, Vector3.Up()).normalize();
  const companion = FOMALHAUT.scale(Math.cos(COMPANION_APART))
    .add(side.scale(Math.sin(COMPANION_APART) * 0.6))
    .add(Vector3.Up().scale(-Math.sin(COMPANION_APART) * 0.8))
    .normalize();
  const canopus = new Vector3(0.2, 0.75, 0.62).normalize();
  return [
    shell,
    ...point('fomalhaut', FOMALHAUT, 2.2, new Color3(0.86, 0.92, 1.25), 9, 0.2),
    ...point('fomalhaut-b', companion, 1.1, new Color3(1, 0.62, 0.32), 2.6, 0.12),
    ...point('canopus', canopus, 2.4, new Color3(1, 0.98, 0.9), 10, 0.18),
  ];
}
