import '@babylonjs/core/Lights/Clustered/clusteredLightingSceneComponent';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { Light } from '@babylonjs/core/Lights/light';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';
import type { QualitySettings } from './quality.ts';

/**
 * The proof's place: a station corridor that opens into a room with crates to take cover behind
 * later. Built from boxes with Poly Haven's CC0 materials (art/materials.json) until the real art
 * exists (D-22).
 * Everything solid is a static physics body, and the floor and obstacles feed the navigation mesh.
 */
export interface Level {
  /** Meshes the navigation mesh is built from (the floor and everything standing on it). */
  navigationMeshes: Mesh[];
  /** Meshes the camera must not pass through. */
  cameraBlockers: Mesh[];
  /** Adds a mesh (a character) to the shadow map, when shadows are on. */
  castShadow(mesh: Mesh): void;
  /** Where the hero starts, and where the companion starts. */
  heroStart: Vector3;
  companionStart: Vector3;
}

interface Surface {
  material: PBRMaterial;
  /** Metres covered by one repeat of the texture. */
  tile: number;
}

interface Palette {
  floor: Surface;
  wall: Surface;
  trim: Surface;
  crate: Surface;
  glow: PBRMaterial;
}

function material(scene: Scene, name: string, colour: Color3, metallic: number, roughness: number, maxLights: number) {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = colour;
  m.metallic = metallic;
  m.roughness = roughness;
  m.maxSimultaneousLights = maxLights;
  return m;
}

/**
 * A Poly Haven material: base colour, an OpenGL-convention normal map, and ambient occlusion,
 * roughness and metal packed in the red, green and blue of one texture.
 */
function surface(scene: Scene, id: string, tile: number, tint: Color3, maxLights: number): Surface {
  const folder = `${import.meta.env.BASE_URL}assets/materials/${id}`;
  const m = material(scene, id, tint, 1, 1, maxLights);
  m.albedoTexture = new Texture(`${folder}/albedo.jpg`, scene);
  m.bumpTexture = new Texture(`${folder}/normal.jpg`, scene);
  // Babylon is left-handed: an OpenGL normal map needs its X flipped, as the glTF loader does.
  m.invertNormalMapX = true;
  m.metallicTexture = new Texture(`${folder}/arm.jpg`, scene);
  m.useAmbientOcclusionFromMetallicTextureRed = true;
  m.useRoughnessFromMetallicTextureGreen = true;
  m.useMetallnessFromMetallicTextureBlue = true;
  return { material: m, tile };
}

function palette(scene: Scene, q: QualitySettings): Palette {
  const glow = material(scene, 'glow', new Color3(0.02, 0.02, 0.02), 0, 0.6, q.maxLights);
  glow.emissiveColor = new Color3(0.75, 0.88, 1);
  glow.emissiveIntensity = 1.4;
  return {
    floor: surface(scene, 'metal_plate', 1.5, new Color3(0.8, 0.82, 0.85), q.maxLights),
    wall: surface(scene, 'metal_plate_02', 2, new Color3(0.9, 0.92, 0.95), q.maxLights),
    trim: surface(scene, 'rusty_metal_02', 1, new Color3(0.45, 0.47, 0.5), q.maxLights),
    crate: surface(scene, 'container_side', 1.2, new Color3(1, 1, 1), q.maxLights),
    glow,
  };
}

/**
 * Gives a box texture coordinates from its place in the world, so a material repeats every
 * `tile` metres on every face and lines up between neighbouring boxes, however long they are.
 */
function boxProjectUVs(mesh: Mesh, tile: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!positions || !normals) return;
  const uvs = new Float32Array((positions.length / 3) * 2);
  const { x: ox, y: oy, z: oz } = mesh.position;
  for (let i = 0; i < positions.length / 3; i++) {
    const x = (positions[i * 3] ?? 0) + ox;
    const y = (positions[i * 3 + 1] ?? 0) + oy;
    const z = (positions[i * 3 + 2] ?? 0) + oz;
    const nx = Math.abs(normals[i * 3] ?? 0);
    const ny = Math.abs(normals[i * 3 + 1] ?? 0);
    const nz = Math.abs(normals[i * 3 + 2] ?? 0);
    // Project along the face's main axis: floors and ceilings by x and z, side walls by z and y.
    const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
    uvs[i * 2] = u / tile;
    uvs[i * 2 + 1] = v / tile;
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

export function buildLevel(scene: Scene, q: QualitySettings): Level {
  const p = palette(scene, q);
  const navigationMeshes: Mesh[] = [];
  const cameraBlockers: Mesh[] = [];
  const bodies: PhysicsAggregate[] = [];

  /** A solid box with its centre at (x, y, z). */
  const box = (name: string, size: [number, number, number], at: [number, number, number], look: Surface) => {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    boxProjectUVs(mesh, look.tile);
    mesh.material = look.material;
    mesh.receiveShadows = q.shadowMapSize > 0;
    mesh.freezeWorldMatrix();
    bodies.push(new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene));
    cameraBlockers.push(mesh);
    return mesh;
  };

  // The corridor runs along +z from z = -2 to z = 26: 4 m wide, 3.2 m high.
  const corridorLength = 28;
  const corridorMid = -2 + corridorLength / 2;
  navigationMeshes.push(box('corridor-floor', [4, 0.2, corridorLength], [0, -0.1, corridorMid], p.floor));
  box('corridor-ceiling', [4, 0.2, corridorLength], [0, 3.3, corridorMid], p.wall);
  box('corridor-wall-left', [0.2, 3.2, corridorLength], [-2.1, 1.6, corridorMid], p.wall);
  box('corridor-wall-right', [0.2, 3.2, corridorLength], [2.1, 1.6, corridorMid], p.wall);
  box('corridor-end', [4, 3.2, 0.2], [0, 1.6, -2.1], p.wall);

  // Ribs every 3 m give the corridor depth: two pillars and a beam, with a light strip between.
  for (let z = 0; z <= 24; z += 3) {
    box(`rib-left-${z}`, [0.3, 3.2, 0.4], [-1.85, 1.6, z], p.trim);
    box(`rib-right-${z}`, [0.3, 3.2, 0.4], [1.85, 1.6, z], p.trim);
    box(`rib-beam-${z}`, [3.4, 0.3, 0.4], [0, 3.05, z], p.trim);
    const strip = CreateBox(`strip-${z}`, { width: 0.18, height: 0.04, depth: 2.2 }, scene);
    strip.position.set(0, 3.18, z + 1.5);
    strip.material = p.glow;
    strip.freezeWorldMatrix();
  }

  // The room at the end: 12 m wide, 12 m deep, 4 m high, with an opening to the corridor.
  navigationMeshes.push(box('room-floor', [12, 0.2, 12], [0, -0.1, 32], p.floor));
  box('room-ceiling', [12, 0.2, 12], [0, 4.1, 32], p.wall);
  box('room-wall-left', [0.2, 4, 12], [-6.1, 2, 32], p.wall);
  box('room-wall-right', [0.2, 4, 12], [6.1, 2, 32], p.wall);
  box('room-wall-far', [12, 4, 0.2], [0, 2, 38.1], p.wall);
  box('room-wall-near-left', [4, 4, 0.2], [-4, 2, 26.1], p.wall);
  box('room-wall-near-right', [4, 4, 0.2], [4, 2, 26.1], p.wall);
  box('room-lintel', [4, 0.8, 0.2], [0, 3.6, 26.1], p.wall);

  // Crates: low cover (1 m) and high cover (1.6 m). The first stands in the corridor on the way
  // in, so cover can be tried at once.
  const crates: [number, number, number, number][] = [
    [0, 10.5, 1.2, 1],
    [-3, 30, 1.6, 1],
    [2.5, 29, 2.4, 1],
    [-1, 34, 1.2, 1.6],
    [3.5, 35, 1.2, 1.6],
  ];
  for (const [x, z, w, h] of crates) {
    navigationMeshes.push(box(`crate-${x}-${z}`, [w, h, 1.2], [x, h / 2, z], p.crate));
  }

  // Light. A soft fill, a key light that casts the shadows, and a row of ceiling lights.
  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
  fill.intensity = 0.35;
  fill.groundColor = new Color3(0.12, 0.12, 0.14);
  const key = new DirectionalLight('key', new Vector3(-0.35, -1, 0.45), scene);
  key.position = new Vector3(6, 12, 10);
  key.intensity = 1.2;
  let shadows: ShadowGenerator | null = null;
  if (q.shadowMapSize > 0) {
    shadows = new ShadowGenerator(q.shadowMapSize, key);
    shadows.usePercentageCloserFiltering = true;
    shadows.bias = 0.002;
  }

  const ceilingLights: Light[] = [];
  for (let z = 1.5; z <= 24; z += 6)
    ceilingLights.push(pointLight(scene, `corridor-light-${z}`, new Vector3(0, 2.9, z)));
  for (const [x, z] of [
    [-3, 29],
    [3, 29],
    [-3, 35],
    [3, 35],
  ] as const) {
    ceilingLights.push(pointLight(scene, `room-light-${x}-${z}`, new Vector3(x, 3.7, z)));
  }
  // Clustered lighting lets every ceiling light count where the device supports it; otherwise
  // only the first few do, which is why the corridor also glows by its strips.
  const cluster = new ClusteredLightContainer('ceiling-lights', [], scene);
  if (cluster.isSupported) {
    for (const light of ceilingLights) cluster.addLight(light);
  } else {
    cluster.dispose();
  }

  return {
    navigationMeshes,
    cameraBlockers,
    castShadow(mesh) {
      shadows?.addShadowCaster(mesh, true);
    },
    heroStart: new Vector3(0, 1, 1),
    companionStart: new Vector3(-1, 0, -0.5),
  };
}

function pointLight(scene: Scene, name: string, at: Vector3): PointLight {
  const light = new PointLight(name, at, scene);
  light.diffuse = new Color3(0.82, 0.9, 1);
  light.intensity = 9;
  light.range = 9;
  return light;
}
