import '@babylonjs/core/Lights/Clustered/clusteredLightingSceneComponent';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
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
  /** A Poly Haven material: colour, OpenGL normal map, and AO/roughness/metal packed in one texture. */
  const textured = (id: string, tile: number, tint: Color3): Surface => {
    const m = material(scene, id, tint, 1, 1, q.maxLights);
    m.albedoTexture = new Texture(`${base}/${id}/albedo.jpg`, scene);
    m.bumpTexture = new Texture(`${base}/${id}/normal.jpg`, scene);
    m.invertNormalMapX = true;
    m.metallicTexture = new Texture(`${base}/${id}/arm.jpg`, scene);
    m.useAmbientOcclusionFromMetallicTextureRed = true;
    m.useRoughnessFromMetallicTextureGreen = true;
    m.useMetallnessFromMetallicTextureBlue = true;
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
    floor: textured('metal_plate', 1.5, new Color3(0.8, 0.82, 0.85)),
    deck: textured('metal_plate', 1.5, new Color3(0.55, 0.6, 0.66)),
    wall: textured('metal_plate_02', 2, new Color3(0.9, 0.92, 0.95)),
    panel: textured('metal_plate_02', 2.5, new Color3(0.62, 0.72, 0.78)),
    warm: textured('metal_plate_02', 2.5, new Color3(0.95, 0.82, 0.68)),
    trim: textured('rusty_metal_02', 1, new Color3(0.45, 0.47, 0.5)),
    rust: textured('rusty_metal_02', 2, new Color3(0.8, 0.7, 0.62)),
    crate: textured('container_side', 1.2, new Color3(1, 1, 1)),
    crateBlue: textured('container_side', 1.2, new Color3(0.45, 0.65, 0.95)),
    crateOrange: textured('container_side', 1.2, new Color3(1, 0.62, 0.35)),
    dark: plain('dark', new Color3(0.07, 0.08, 0.09), 0.6, 0.45),
    hull: plain('hull', new Color3(0.72, 0.74, 0.76), 0.75, 0.32),
    hullDark: plain('hull-dark', new Color3(0.2, 0.22, 0.25), 0.7, 0.4),
    stripe: plain('stripe', new Color3(0.85, 0.55, 0.12), 0.2, 0.5),
    fabric: plain('fabric', new Color3(0.22, 0.3, 0.38), 0, 0.9),
    wood: plain('wood', new Color3(0.42, 0.3, 0.2), 0, 0.7),
    plant: plain('plant', new Color3(0.18, 0.42, 0.2), 0, 0.8),
    soil: plain('soil', new Color3(0.2, 0.14, 0.1), 0, 1),
    ground: plain('ground', new Color3(0.36, 0.24, 0.18), 0, 0.95),
    rock: plain('rock', new Color3(0.27, 0.19, 0.15), 0, 0.9),
    glow: glowing('glow', new Color3(0.75, 0.88, 1)),
    screen: glowing('screen', new Color3(0.25, 0.65, 0.9), 1.1),
    screenWarm: glowing('screen-warm', new Color3(0.95, 0.6, 0.25), 1.1),
    red: glowing('red', new Color3(1, 0.12, 0.08), 1.6),
    green: glowing('green', new Color3(0.2, 1, 0.4), 1.4),
    glass,
  };

  /** Static pieces, by zone and material, merged when the place is finished. */
  const pieces = new Map<string, { material: PBRMaterial; zone: string; meshes: Mesh[] }>();
  const navigationMeshes: Mesh[] = [];
  const doors: Door[] = [];
  const lights: { light: PointLight; emergency: boolean; base: number; zone: string }[] = [];
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

  /** A box seen but not felt (trim, lights, details). */
  const deco = (size: [number, number, number], at: [number, number, number], look: Surface, rotY = 0): Mesh => {
    const mesh = CreateBox(`deco-${count++}`, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.rotation.y = rotY;
    keep(mesh, look);
    return mesh;
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
      solid(size, at, material, { nav: false });
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
    deco([0.3, 0.12, 0.3], [at[0], at[1] + 0.1, at[2]], surfaces.red);
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
    const lamp = CreateBox(`door-${id}-lamp`, { width: 0.3, height: 0.1, depth: 0.25 }, scene);
    lamp.position.set(at[0], height + 0.15, at[2]);
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
    column,
    room,
    light,
    emergency,
    door,
    lightsOut,
    finish,
    navigationMeshes,
    doors,
  };
}

export type Kit = ReturnType<typeof buildKit>;
