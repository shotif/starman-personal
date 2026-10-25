import '@babylonjs/core/Lights/Clustered/clusteredLightingSceneComponent';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';
import type { QualitySettings } from './quality.ts';

/**
 * The kit Calder Station is built from (SLICE.md): boxes with Poly Haven's CC0 materials, rooms with
 * doorways and windows, doors that slide, lights by area. Static pieces are merged by material when
 * the place is finished, so a phone draws a few dozen meshes rather than hundreds; the pieces stay,
 * hidden, as the physics bodies and the navigation mesh's source.
 */
export interface Surface {
  material: PBRMaterial;
  /** Metres covered by one repeat of the texture; 0 for an untextured colour. */
  tile: number;
}

export type Side = 'n' | 's' | 'e' | 'w';

/** A gap in a wall: a doorway (from the floor) or a window (from `bottom`), between two coordinates. */
export interface Gap {
  side: Side;
  from: number;
  to: number;
  /** The top of the gap; a doorway is 2.5 m. */
  top?: number;
  /** The bottom of a window; 0 for a doorway. */
  bottom?: number;
  /** Glazed: a window pane fills it. */
  glass?: boolean;
}

export interface RoomSpec {
  name: string;
  x: [number, number];
  z: [number, number];
  height: number;
  floor?: Surface;
  wall?: Surface;
  ceiling?: Surface | null;
  gaps?: Gap[];
  /** Sides with no wall (another room's wall stands there, or it is open). */
  open?: Side[];
}

/** A piece of furniture or a machine part that a model will take the place of (MODELS.md). */
interface Prop {
  model: string;
  /** Where its base stands, and which way it faces (radians about y; 0 faces north, +z). */
  at: Vector3;
  yaw: number;
  /** The space it fills: width (x), height, depth (z), before turning. */
  size: [number, number, number];
  /** Keep its proportions and fit its longest side (most things), or stretch to the box (crates). */
  fit: 'longest' | 'box';
  /** The boxes shown until the model is there. */
  standIn: TransformNode;
  /** A node the model belongs to (it moves with it: the ship), or none. */
  parent: TransformNode | null;
}

/**
 * Where the models are: on the low tier, the copies with their textures fitted within 512 px
 * (scripts/art/models-low.ts), a quarter of the memory.
 */
export const modelsAt = (detailed: boolean) => `${import.meta.env.BASE_URL}assets/models/${detailed ? '' : 'low/'}`;

/** The models the asset scripts made (public/assets/models/models.json). */
interface ModelManifest {
  models: Record<string, { file: string; size?: number; front?: string }>;
}

export interface Door {
  id: string;
  /** Opens (slides into the wall) or closes. */
  set(open: boolean): void;
  readonly open: boolean;
  /** Locked doors show red and do not open by themselves. */
  lock(locked: boolean): void;
  readonly centre: Vector3;
  update(dt: number): void;
}

const material = (
  scene: Scene,
  name: string,
  colour: Color3,
  metallic: number,
  roughness: number,
  maxLights: number,
) => {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = colour;
  m.metallic = metallic;
  m.roughness = roughness;
  m.maxSimultaneousLights = maxLights;
  return m;
};

/** Gives a box texture coordinates from its place in the world, so neighbouring boxes line up. */
export function boxProjectUVs(mesh: Mesh, tile: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!positions || !normals || tile <= 0) return;
  mesh.computeWorldMatrix(true);
  const world = mesh.getWorldMatrix();
  const uvs = new Float32Array((positions.length / 3) * 2);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < positions.length / 3; i++) {
    Vector3.TransformCoordinatesFromFloatsToRef(
      positions[i * 3] ?? 0,
      positions[i * 3 + 1] ?? 0,
      positions[i * 3 + 2] ?? 0,
      world,
      p,
    );
    Vector3.TransformNormalFromFloatsToRef(
      normals[i * 3] ?? 0,
      normals[i * 3 + 1] ?? 0,
      normals[i * 3 + 2] ?? 0,
      world,
      n,
    );
    const nx = Math.abs(n.x);
    const ny = Math.abs(n.y);
    const nz = Math.abs(n.z);
    const [u, v] = ny >= nx && ny >= nz ? [p.x, p.z] : nx >= nz ? [p.z, p.y] : [p.x, p.y];
    uvs[i * 2] = u / tile;
    uvs[i * 2 + 1] = v / tile;
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

export function buildKit(scene: Scene, q: QualitySettings) {
  const base = `${import.meta.env.BASE_URL}assets/materials`;
  /**
   * A Poly Haven material: colour, OpenGL normal map, and AO/roughness/metal packed in one texture;
   * on the low tier colour only, with a fixed sheen (`metal`, `rough`), to spare a phone's memory.
   * With the maps, `metal` scales the map's metalness: painted panels are not bare metal, and bare
   * metal in a dim room shows little but its reflections.
   */
  const textured = (id: string, tile: number, tint: Color3, name = id, metal = 0.3, rough = 0.7): Surface => {
    const m = material(scene, name, tint, metal, q.detailMaps ? 1 : rough, q.maxLights);
    m.albedoTexture = new Texture(`${base}/${id}/albedo.jpg`, scene);
    if (q.detailMaps) {
      m.bumpTexture = new Texture(`${base}/${id}/normal.jpg`, scene);
      m.invertNormalMapX = true;
      m.metallicTexture = new Texture(`${base}/${id}/arm.jpg`, scene);
      m.useAmbientOcclusionFromMetallicTextureRed = true;
      m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = true;
    }
    return { material: m, tile };
  };
  const plain = (name: string, colour: Color3, metallic: number, roughness: number): Surface => ({
    material: material(scene, name, colour, metallic, roughness, q.maxLights),
    tile: 0,
  });
  const glowing = (name: string, colour: Color3, intensity = 1.4): Surface => {
    const m = material(scene, name, new Color3(0.02, 0.02, 0.02), 0, 0.6, q.maxLights);
    m.emissiveColor = colour;
    m.emissiveIntensity = intensity;
    return { material: m, tile: 0 };
  };
  const glass = (() => {
    const m = material(scene, 'glass', new Color3(0.55, 0.65, 0.75), 0.1, 0.05, q.maxLights);
    m.alpha = 0.18;
    m.backFaceCulling = false;
    return { material: m, tile: 0 } as Surface;
  })();

  const surfaces = {
    floor: textured('metal_plate', 1.5, new Color3(0.8, 0.82, 0.85), 'floor', 0.5, 0.5),
    deck: textured('rubber_tiles', 1.2, new Color3(0.75, 0.78, 0.8), 'deck', 0, 0.85),
    wall: textured('metal_plate_02', 2, new Color3(0.9, 0.92, 0.95), 'wall', 0.5, 0.55),
    panel: textured('blue_metal_plate', 2.5, new Color3(0.85, 0.9, 0.95), 'panel', 0.4, 0.55),
    warm: textured('metal_plate_02', 2.5, new Color3(0.95, 0.82, 0.68), 'warm', 0.5, 0.55),
    trim: textured('rusty_metal_02', 1, new Color3(0.45, 0.47, 0.5), 'trim', 0.6, 0.6),
    rust: textured('corrugated_iron_02', 2.4, new Color3(0.8, 0.74, 0.68), 'rust', 0.6, 0.6),
    crate: textured('container_side', 1.2, new Color3(1, 1, 1), 'crate', 0.5, 0.6),
    crateBlue: textured('container_side', 1.2, new Color3(0.45, 0.65, 0.95), 'crate-blue', 0.5, 0.6),
    crateOrange: textured('container_side', 1.2, new Color3(1, 0.62, 0.35), 'crate-orange', 0.5, 0.6),
    /** The clinic's floor, its tiles square to the walls. */
    tiles: textured('interior_tiles', 1.4, new Color3(0.9, 0.92, 0.92), 'tiles', 0, 0.4),
    /** The catwalk and the mast's platform, out in the open: a grated plate, rust toned down. */
    grate: textured('metal_grate_rusty', 1.2, new Color3(0.62, 0.6, 0.6), 'grate', 0.6, 0.6),
    /** The hangar's floor. */
    concrete: textured('concrete_floor_worn_001', 3, new Color3(0.75, 0.75, 0.75), 'concrete', 0, 0.8),
    dark: plain('dark', new Color3(0.07, 0.08, 0.09), 0.6, 0.45),
    hull: plain('hull', new Color3(0.5, 0.54, 0.58), 0.7, 0.42),
    hullDark: plain('hull-dark', new Color3(0.2, 0.22, 0.25), 0.7, 0.4),
    stripe: plain('stripe', new Color3(0.85, 0.55, 0.12), 0.2, 0.5),
    fabric: textured('fabric_leather_02', 0.8, new Color3(0.45, 0.55, 0.65), 'fabric', 0, 0.8),
    wood: plain('wood', new Color3(0.42, 0.3, 0.2), 0, 0.7),
    paper: plain('paper', new Color3(0.82, 0.8, 0.72), 0, 0.95),
    plant: plain('plant', new Color3(0.18, 0.42, 0.2), 0, 0.8),
    soil: plain('soil', new Color3(0.2, 0.14, 0.1), 0, 1),
    ground: textured('cracked_red_ground', 4, new Color3(0.8, 0.66, 0.58), 'ground', 0, 0.95),
    rock: textured('cracked_red_ground', 6, new Color3(0.55, 0.44, 0.4), 'rock', 0, 0.9),
    glow: glowing('glow', new Color3(0.75, 0.88, 1)),
    screen: glowing('screen', new Color3(0.2, 0.5, 0.7), 0.75),
    screenWarm: glowing('screen-warm', new Color3(0.8, 0.48, 0.2), 0.75),
    red: glowing('red', new Color3(1, 0.12, 0.08), 1.6),
    /** The emergency lamps' glass: dark until the lights go. */
    lamp: glowing('lamp', new Color3(0.08, 0.02, 0.02), 1.6),
    green: glowing('green', new Color3(0.2, 1, 0.4), 1.4),
    glass,
  };

  /** Static pieces, by zone and material, merged when the place is finished. */
  const pieces = new Map<string, { material: PBRMaterial; zone: string; meshes: Mesh[] }>();
  const navigationMeshes: Mesh[] = [];
  const doors: Door[] = [];
  const lights: { light: PointLight; emergency: boolean; base: number; zone: string }[] = [];
  const props: Prop[] = [];
  let count = 0;
  /** The part of the place being built: pieces and lights are grouped by it. */
  let zone = 'outside';
  const enter = (name: string) => {
    zone = name;
  };

  const keep = (mesh: Mesh, look: Surface) => {
    boxProjectUVs(mesh, look.tile);
    mesh.material = look.material;
    const key = `${zone}|${look.material.name}`;
    const group = pieces.get(key) ?? { material: look.material, zone, meshes: [] };
    group.meshes.push(mesh);
    pieces.set(key, group);
  };

  /** A solid box (physics, and the navigation mesh's source unless `nav` is false). */
  const solid = (
    size: [number, number, number],
    at: [number, number, number],
    look: Surface,
    opts: { nav?: boolean; rotY?: number; rot?: [number, number, number]; name?: string } = {},
  ): Mesh => {
    const mesh = CreateBox(opts.name ?? `solid-${count++}`, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    if (opts.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    mesh.computeWorldMatrix(true);
    keep(mesh, look);
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
    if (opts.nav !== false) navigationMeshes.push(mesh);
    return mesh;
  };

  const pictures = `${import.meta.env.BASE_URL}assets/textures`;
  const pictureLooks = new Map<string, Surface>();
  /** One of the 2D pictures (IMAGES.md): screens glow by themselves; signs and posters take the light. */
  const pictureLook = (id: string, glows: boolean): Surface => {
    const known = pictureLooks.get(id);
    if (known) return known;
    const m = material(scene, `picture-${id}`, glows ? new Color3(0, 0, 0) : new Color3(1, 1, 1), 0, 0.6, q.maxLights);
    const texture = new Texture(`${pictures}/${id}.webp`, scene);
    texture.anisotropicFilteringLevel = 4;
    if (glows) {
      m.emissiveTexture = texture;
      m.emissiveColor = new Color3(1, 1, 1);
      m.emissiveIntensity = 0.85;
    } else {
      m.albedoTexture = texture;
    }
    const look = { material: m, tile: 0 };
    pictureLooks.set(id, look);
    return look;
  };
  /**
   * A picture, `size` wide and high, facing `yaw` (0 north). `tilt` lays it back: π/2 lies flat,
   * face up, its top away from `yaw`. Screens (ids `screen-…`) glow; the rest take the light.
   */
  const picture = (id: string, size: [number, number], at: [number, number, number], yaw: number, tilt = 0): Mesh => {
    const mesh = CreatePlane(`picture-${count++}`, { width: size[0], height: size[1] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.rotation.set(tilt, yaw + Math.PI, 0);
    mesh.isPickable = false;
    keep(mesh, pictureLook(id, id.startsWith('screen-')));
    return mesh;
  };

  /** A box seen but not felt (trim, lights, details). */
  const deco = (size: [number, number, number], at: [number, number, number], look: Surface, rotY = 0): Mesh => {
    const mesh = CreateBox(`deco-${count++}`, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.rotation.y = rotY;
    keep(mesh, look);
    return mesh;
  };

  /**
   * A prop: an invisible collider (physics and the navigation mesh, as a solid box would be), and
   * stand-in boxes drawn by `build` until the model arrives. Coordinates given to `build` are the
   * prop's own: x across, y up from its base, z towards its front.
   */
  const prop = (
    model: string,
    at: [number, number, number],
    yaw: number,
    size: [number, number, number],
    build: (box: (size: [number, number, number], at: [number, number, number], look: Surface) => void) => void,
    options: { fit?: 'longest' | 'box'; solid?: boolean; parent?: TransformNode; standIn?: TransformNode } = {},
  ) => {
    const base = new Vector3(at[0], at[1], at[2]);
    if (options.solid !== false) {
      const collider = CreateBox(
        `prop-${model}-${count++}`,
        { width: size[0], height: size[1], depth: size[2] },
        scene,
      );
      collider.position = base.add(new Vector3(0, size[1] / 2, 0));
      collider.rotation.y = yaw;
      collider.isVisible = false;
      collider.computeWorldMatrix(true);
      new PhysicsAggregate(collider, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
      navigationMeshes.push(collider);
    }
    const standIn = options.standIn ?? new TransformNode(`stand-in-${model}-${count++}`, scene);
    if (!options.standIn) {
      standIn.position.copyFrom(base);
      standIn.rotation.y = yaw;
    }
    build((s, p, look) => {
      const mesh = CreateBox(`stand-in-${count++}`, { width: s[0], height: s[1], depth: s[2] }, scene);
      mesh.position.set(p[0], p[1], p[2]);
      mesh.parent = standIn;
      boxProjectUVs(mesh, look.tile);
      mesh.material = look.material;
      mesh.isPickable = false;
      mesh.receiveShadows = q.shadowMapSize > 0;
    });
    props.push({ model, at: base, yaw, size, fit: options.fit ?? 'longest', standIn, parent: options.parent ?? null });
  };

  /**
   * Puts the models in place of their stand-ins, where the asset scripts have made them: each model
   * file loaded once, an instance per prop, fitted to its space. A model that is missing or fails to
   * load leaves its stand-ins as they are.
   */
  const furnish = async (extra: Record<string, AssetContainer | null> = {}) => {
    let manifest: ModelManifest | null = null;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}assets/models/models.json`);
      manifest = response.ok ? ((await response.json()) as ModelManifest) : null;
    } catch {
      manifest = null;
    }
    const containers = new Map<string, Promise<AssetContainer | null>>();
    const load = (id: string) => {
      if (id in extra) return Promise.resolve(extra[id] ?? null);
      let c = containers.get(id);
      if (!c) {
        const entry = manifest?.models[id];
        c = entry
          ? LoadAssetContainerAsync(`${modelsAt(q.detailMaps)}${entry.file}`, scene).catch(() => null)
          : Promise.resolve(null);
        containers.set(id, c);
      }
      return c;
    };
    await Promise.all(
      props.map(async (p) => {
        const container = await load(p.model);
        if (!container) return;
        const holder = new TransformNode(`model-${p.model}`, scene);
        const entries = container.instantiateModelsToScene((n) => `${p.model}-${n}`, false, {
          doNotInstantiate: false,
        });
        for (const node of entries.rootNodes) node.parent = holder;
        // Measure the model as it stands, then fit it to the prop's space.
        const meshes = holder.getChildMeshes(false);
        const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        const max = min.scale(-1);
        for (const m of meshes) {
          m.computeWorldMatrix(true);
          min.minimizeInPlace(m.getBoundingInfo().boundingBox.minimumWorld);
          max.maximizeInPlace(m.getBoundingInfo().boundingBox.maximumWorld);
        }
        const extent = max.subtract(min);
        if (!Number.isFinite(extent.x) || extent.x <= 0) {
          holder.dispose();
          return;
        }
        if (p.fit === 'box') {
          holder.scaling.set(p.size[0] / extent.x, p.size[1] / extent.y, p.size[2] / extent.z);
        } else {
          const k = Math.max(p.size[0], p.size[2]) / Math.max(extent.x, extent.z);
          holder.scaling.setAll(k);
        }
        const centre = min.add(max).scale(0.5);
        const placed = new TransformNode(`placed-${p.model}`, scene);
        holder.parent = placed;
        holder.position.set(-centre.x * holder.scaling.x, -min.y * holder.scaling.y, -centre.z * holder.scaling.z);
        placed.parent = p.parent;
        placed.position.copyFrom(p.at);
        placed.rotation.y = p.yaw;
        placed.computeWorldMatrix(true);
        holder.computeWorldMatrix(true);
        for (const m of meshes) {
          m.isPickable = false;
          m.receiveShadows = q.shadowMapSize > 0;
          // A model that moves with its parent (the ship) keeps a live world matrix.
          if (!p.parent) m.freezeWorldMatrix();
        }
        p.standIn.setEnabled(false);
      }),
    );
  };

  /** An upright cylinder, solid or not. */
  const column = (radius: number, height: number, at: [number, number, number], look: Surface, isSolid = true) => {
    const mesh = CreateCylinder(`column-${count++}`, { diameter: radius * 2, height, tessellation: 12 }, scene);
    mesh.position.set(at[0], at[1] + height / 2, at[2]);
    keep(mesh, look);
    if (isSolid) {
      new PhysicsAggregate(mesh, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
      navigationMeshes.push(mesh);
    }
    return mesh;
  };

  const T = 0.2; // wall thickness

  /** A wall along one side of a room, with its gaps cut out (doorways reach the floor, windows do not). */
  const wall = (spec: RoomSpec, side: Side, look: Surface) => {
    const [x0, x1] = spec.x;
    const [z0, z1] = spec.z;
    const h = spec.height;
    const alongX = side === 'n' || side === 's';
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const fixed = side === 'n' ? z1 : side === 's' ? z0 : side === 'e' ? x1 : x0;
    const gaps = (spec.gaps ?? []).filter((g) => g.side === side).sort((a, b) => a.from - b.from);
    const segment = (from: number, to: number, y0: number, y1: number, material: Surface) => {
      if (to - from < 0.01 || y1 - y0 < 0.01) return;
      const mid = (from + to) / 2;
      const size: [number, number, number] = alongX ? [to - from, y1 - y0, T] : [T, y1 - y0, to - from];
      const at: [number, number, number] = alongX ? [mid, (y0 + y1) / 2, fixed] : [fixed, (y0 + y1) / 2, mid];
      // Walls stand in the navigation mesh, so people walk round them and through doorways.
      solid(size, at, material);
    };
    let cursor = a0 - (alongX ? T / 2 : 0);
    const end = a1 + (alongX ? T / 2 : 0);
    for (const gap of gaps) {
      segment(cursor, gap.from, 0, h, look);
      const top = gap.top ?? 2.5;
      const bottom = gap.bottom ?? 0;
      segment(gap.from, gap.to, top, h, look);
      if (bottom > 0) segment(gap.from, gap.to, 0, bottom, look);
      if (gap.glass) {
        const mid = (gap.from + gap.to) / 2;
        const size: [number, number, number] = alongX
          ? [gap.to - gap.from, top - bottom, 0.04]
          : [0.04, top - bottom, gap.to - gap.from];
        const at: [number, number, number] = alongX
          ? [mid, (top + bottom) / 2, fixed]
          : [fixed, (top + bottom) / 2, mid];
        // Glass stops people and shots, and is seen through.
        const pane = solid(size, at, glass, { nav: false });
        pane.isPickable = false;
      }
      cursor = gap.to;
    }
    segment(cursor, end, 0, h, look);
  };

  const room = (spec: RoomSpec) => {
    const [x0, x1] = spec.x;
    const [z0, z1] = spec.z;
    const floorLook = spec.floor ?? surfaces.floor;
    const wallLook = spec.wall ?? surfaces.wall;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    solid([x1 - x0, 0.2, z1 - z0], [cx, -0.1, cz], floorLook, { name: `${spec.name}-floor` });
    if (spec.ceiling !== null)
      solid([x1 - x0, 0.2, z1 - z0], [cx, spec.height + 0.1, cz], spec.ceiling ?? surfaces.dark, { nav: false });
    for (const side of ['n', 's', 'e', 'w'] as Side[]) {
      if (spec.open?.includes(side)) continue;
      wall(spec, side, wallLook);
    }
  };

  /** A ceiling light: a glowing panel and a point light, which the lights-out dims. */
  const light = (at: [number, number, number], colour = new Color3(0.82, 0.9, 1), intensity = 9, range = 10) => {
    const l = new PointLight(`light-${count++}`, new Vector3(at[0], at[1], at[2]), scene);
    l.diffuse = colour;
    l.intensity = intensity;
    l.range = range;
    lights.push({ light: l, emergency: false, base: intensity, zone });
    deco([1.4, 0.05, 0.3], [at[0], at[1] + 0.12, at[2]], surfaces.glow);
    return l;
  };
  /** A red emergency lamp, dark until the lights go. */
  const emergency = (at: [number, number, number]) => {
    const l = new PointLight(`emergency-${count++}`, new Vector3(at[0], at[1], at[2]), scene);
    l.diffuse = new Color3(1, 0.12, 0.06);
    l.intensity = 0;
    l.range = 11;
    lights.push({ light: l, emergency: true, base: 7, zone });
    deco([0.3, 0.12, 0.3], [at[0], at[1] + 0.1, at[2]], surfaces.lamp);
    return l;
  };

  /**
   * A sliding door in a gap of `width` centred on `at`, across a wall running along x (`alongX`) or
   * along z. It slides into the wall to one side when opened.
   */
  const door = (id: string, at: [number, number, number], width: number, alongX: boolean, startOpen = false): Door => {
    const height = 2.5;
    const panel = CreateBox(
      `door-${id}`,
      alongX ? { width, height, depth: 0.12 } : { width: 0.12, height, depth: width },
      scene,
    );
    panel.material = surfaces.panel.material;
    boxProjectUVs(panel, surfaces.panel.tile);
    const closed = new Vector3(at[0], height / 2, at[2]);
    const opened = closed.add(alongX ? new Vector3(width * 0.95, 0, 0) : new Vector3(0, 0, width * 0.95));
    panel.position.copyFrom(startOpen ? opened : closed);
    const aggregate = new PhysicsAggregate(panel, PhysicsShapeType.BOX, { mass: 0 }, scene);
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    aggregate.body.disablePreStep = false;
    // A lamp over the door: green when it will open, red when locked.
    // Thin and high, so a camera passing under it through the doorway does not meet it.
    const lamp = CreateBox(
      `door-${id}-lamp`,
      alongX ? { width: 0.3, height: 0.08, depth: 0.22 } : { width: 0.22, height: 0.08, depth: 0.3 },
      scene,
    );
    lamp.position.set(at[0], height + 0.3, at[2]);
    let isOpen = startOpen;
    let locked = false;
    let t = startOpen ? 1 : 0;
    const paint = () => {
      lamp.material = locked ? surfaces.red.material : surfaces.green.material;
    };
    paint();
    const d: Door = {
      id,
      centre: closed.clone(),
      get open() {
        return isOpen;
      },
      set(open) {
        isOpen = open;
      },
      lock(value) {
        locked = value;
        paint();
      },
      update(dt) {
        const target = isOpen ? 1 : 0;
        if (t === target) return;
        t = Math.max(0, Math.min(1, t + Math.sign(target - t) * dt * 2.2));
        Vector3.LerpToRef(closed, opened, t * t * (3 - 2 * t), panel.position);
      },
    };
    doors.push(d);
    return d;
  };

  /** When the station's power fails: the white lights fall to a glimmer and the red ones come on. */
  const lightsOut = (out: boolean) => {
    for (const l of lights) l.light.intensity = l.emergency ? (out ? l.base : 0) : out ? l.base * 0.08 : l.base;
    surfaces.glow.material.emissiveColor = out ? new Color3(0.12, 0.1, 0.1) : new Color3(0.75, 0.88, 1);
    surfaces.lamp.material.emissiveColor = out ? new Color3(1, 0.12, 0.08) : new Color3(0.08, 0.02, 0.02);
  };

  /**
   * Merges the static pieces by zone and material, and lights them: through a light cluster where the
   * device supports one, otherwise each light shines only on its own zone (a device without clusters
   * lights each mesh by its first few lights only).
   */
  const finish = () => {
    const byZone = new Map<string, Mesh[]>();
    for (const [, group] of pieces) {
      const merged = Mesh.MergeMeshes(group.meshes, false, true);
      if (merged) {
        merged.name = `${group.zone}-${group.material.name}`;
        merged.receiveShadows = q.shadowMapSize > 0;
        merged.isPickable = false;
        merged.freezeWorldMatrix();
        const list = byZone.get(group.zone) ?? [];
        list.push(merged);
        byZone.set(group.zone, list);
      }
      for (const m of group.meshes) {
        m.isVisible = false;
        m.freezeWorldMatrix();
      }
    }
    const cluster = new ClusteredLightContainer('station-lights', [], scene);
    if (cluster.isSupported) {
      for (const l of lights) cluster.addLight(l.light);
    } else {
      cluster.dispose();
      for (const l of lights) l.light.includedOnlyMeshes = byZone.get(l.zone) ?? [];
    }
  };

  return {
    scene,
    surfaces,
    enter,
    solid,
    deco,
    picture,
    column,
    room,
    light,
    emergency,
    door,
    lightsOut,
    finish,
    prop,
    furnish,
    /** Every prop placed: its model, where its base stands, its turn and its box (for checks). */
    placed: () =>
      props.map((p) => ({ model: p.model, at: p.at.asArray(), yaw: p.yaw, size: p.size, moves: !!p.parent })),
    navigationMeshes,
    doors,
  };
}

export type Kit = ReturnType<typeof buildKit>;
