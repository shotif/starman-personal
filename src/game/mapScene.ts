import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Constants } from '@babylonjs/core/Engines/constants';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Sprite } from '@babylonjs/core/Sprites/sprite';
import { SpriteManager } from '@babylonjs/core/Sprites/spriteManager';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Sprites/spriteSceneComponent';
import { type MapSky, mapLanes, mapSystems, PYRE, type ScreenPoint, starSize, type Vec3 } from './starmap.ts';

/**
 * The star map's scene (ACT1.md, increment 2): the real neighbourhood in 3D, on the game's own
 * engine, drawn instead of the place while the map is open. Stars are sprites at their real places;
 * a faint plane through the Sun (the celestial equator) with rings every 10 light-years and a line
 * from each star down to it give depth; the old lanes are faint; a course is drawn bright. The
 * screen over it (src/ui/StarMap.tsx) turns, zooms and chooses through this.
 */
export interface MapView {
  render(): void;
  /** Turns the map by pixels dragged. */
  turn(dx: number, dy: number): void;
  /** Zooms by a factor (below 1 nearer). */
  zoom(factor: number): void;
  /** Marks a system chosen and moves the view to it (unless `stay`), or clears the choice. */
  select(id: string | null, stay?: boolean): void;
  /** The screen's edges the panels cover (CSS pixels): the view centres in what is left. */
  inset(edges: { top: number; right: number; bottom: number; left: number }): void;
  /** Draws a course through these systems, or none. */
  course(through: string[] | null): void;
  /** Where these systems (or all) are on the screen, in CSS pixels. */
  project(ids?: string[]): ScreenPoint[];
  /** For the browser journeys: the camera's angles and distance. */
  view(): { alpha: number; beta: number; radius: number; target: Vec3 };
  dispose(): void;
}

/** The map's frame to Babylon's: equatorial x, y, z (right-handed, z north) to x, z, y (left-handed, y up). */
const place = (p: Vec3) => new Vector3(p[0], p[2], p[1]);

/** A soft round glow, white, for every star (tinted by each sprite's colour). */
function glow(size = 64): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  const r = size / 2;
  const fill = g.createRadialGradient(r, r, 0, r, r, r);
  fill.addColorStop(0, 'rgba(255,255,255,1)');
  fill.addColorStop(0.18, 'rgba(255,255,255,0.95)');
  fill.addColorStop(0.4, 'rgba(255,255,255,0.32)');
  fill.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, size, size);
  return c.toDataURL();
}

/** A thin ring, for what is chosen, where *Lantern* is, and the leads. */
function ring(size = 64): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  g.strokeStyle = 'white';
  g.lineWidth = size * 0.06;
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  g.stroke();
  return c.toDataURL();
}

const colour = (hex: string, scale = 1) => {
  const c = Color3.FromHexString(hex.length === 7 ? hex : '#ffffff');
  return new Color4(c.r * scale, c.g * scale, c.b * scale, 1);
};

/** Dimmer for the faint kinds: white dwarfs and brown dwarfs. */
const brightness = (type: string) => (/^(D|WD|L|T|Y)/.test(type) ? 0.55 : 1);

export function buildMapScene(
  engine: AbstractEngine,
  sky: MapSky,
  here: string,
  leads: { system: string; open: boolean }[],
): MapView {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.012, 0.016, 0.035, 1);
  scene.skipPointerMovePicking = true;
  const systems = mapSystems(sky);
  const byId = new Map(systems.map((s) => [s.id, s]));
  const at = (id: string) => {
    const s = byId.get(id);
    return s ? place(s.at) : Vector3.Zero();
  };

  // It opens on the Sun, the middle of the neighbourhood, from above and to one side, the whole of it in view.
  const start = Vector3.Zero();
  const camera = new ArcRotateCamera('map', -Math.PI / 2 + 0.6, 0.82, 82, start.clone(), scene);
  camera.minZ = 0.1;
  camera.maxZ = 1000;
  camera.fov = 0.8;
  const fitView = () => {
    // A phone held upright keeps the width, so the map is not cut at the sides.
    camera.fovMode =
      engine.getAspectRatio(camera) < 1 ? Camera.FOVMODE_HORIZONTAL_FIXED : Camera.FOVMODE_VERTICAL_FIXED;
  };
  fitView();
  const target = start.clone();
  const edges = { top: 0, right: 0, bottom: 0, left: 0 };
  /** Until the player zooms, the whole neighbourhood is kept in the free part of the screen. */
  let fitted = true;
  /** Shifts the view so its middle is the middle of the screen the panels leave free. */
  const centreInFree = () => {
    const canvas = engine.getRenderingCanvas();
    const w = canvas?.clientWidth ?? 1;
    const h = canvas?.clientHeight ?? 1;
    const aspect = w / h;
    const horizontal = camera.fovMode === Camera.FOVMODE_HORIZONTAL_FIXED;
    const tanH = horizontal ? Math.tan(camera.fov / 2) : Math.tan(camera.fov / 2) * aspect;
    const tanV = tanH / aspect;
    // Where the free area's middle is, from −1 to 1 (up and right positive), as the camera sees it.
    const x = (edges.left + (w - edges.right) - w) / w;
    const y = (h - (edges.top + (h - edges.bottom))) / h;
    if (fitted) {
      // Far enough that a sphere of 36 light-years round the Sun fits the free width and height.
      const freeW = Math.max(80, w - edges.left - edges.right) / w;
      const freeH = Math.max(80, h - edges.top - edges.bottom) / h;
      camera.radius = Math.min(160, Math.max(36 / (freeW * tanH), 36 / (freeH * tanV)));
    }
    camera.targetScreenOffset.set(x * camera.radius * tanH, y * camera.radius * tanV);
  };

  // The stars, one sprite each, added together so they glow where they crowd.
  const stars = new SpriteManager('map-stars', glow(), systems.length, 64, scene);
  stars.blendMode = Constants.ALPHA_ADD;
  stars.disableDepthWrite = true;
  for (const s of systems) {
    const primary = s.stars[0];
    const type = primary?.type ?? 'M';
    const sprite = new Sprite(s.id, stars);
    sprite.position = place(s.at);
    const size = Math.max(...s.stars.map((t) => starSize(t.type)));
    sprite.width = sprite.height = s.id === PYRE.id ? 3 : size * (s.stars.length > 1 ? 1.15 : 1) * 2.1;
    sprite.color = colour(primary?.colour ?? '#ffffff', brightness(type));
  }
  // Rings: the chosen star (cyan), *Lantern* (amber), and the leads (gold for the open one, grey for the later).
  const rings = new SpriteManager('map-rings', ring(), 8, 64, scene);
  rings.disableDepthWrite = true;
  const marker = (id: string, size: number, tint: Color4) => {
    const r = new Sprite(`ring-${id}`, rings);
    r.position = at(id);
    r.width = r.height = size;
    r.color = tint;
    return r;
  };
  const lantern = marker(here, 2.2, new Color4(1, 0.72, 0.3, 0.95));
  const open = leads
    .filter((l) => l.system !== here)
    .map((l) => {
      const r = marker(l.system, 3.2, l.open ? new Color4(1, 0.85, 0.4, 0.9) : new Color4(0.6, 0.65, 0.75, 0.55));
      return l.open ? r : null;
    })
    .filter((r): r is Sprite => r !== null);
  const chosen = marker('chosen', 2.8, new Color4(0.45, 0.9, 1, 1));
  chosen.isVisible = false;

  // Lines draw opaque: a faint one is a dark colour over the dark sky, not a see-through one.
  const lines = (name: string, paths: Vector3[][], tint: Color3, strength: number): LinesMesh => {
    const m = CreateLineSystem(name, { lines: paths, useVertexAlpha: false }, scene);
    m.color = tint.scale(strength);
    m.isPickable = false;
    return m;
  };
  // The plane: rings round the Sun at 10, 20 and 30 light-years, and spokes every two hours of right ascension.
  const circles: Vector3[][] = [10, 20, 30].map((r) =>
    Array.from(
      { length: 97 },
      (_, i) => new Vector3(Math.cos((i / 96) * Math.PI * 2) * r, 0, Math.sin((i / 96) * Math.PI * 2) * r),
    ),
  );
  const spokes: Vector3[][] = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [new Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3), new Vector3(Math.cos(a) * 33, 0, Math.sin(a) * 33)];
  });
  lines('map-plane', [...circles, ...spokes], new Color3(0.35, 0.55, 0.85), 0.3);
  lines(
    'map-drops',
    systems.map((s) => {
      const p = place(s.at);
      return [p, new Vector3(p.x, 0, p.z)];
    }),
    new Color3(0.4, 0.6, 0.9),
    0.18,
  );
  lines(
    'map-lanes',
    mapLanes(sky).map(([a, b]) => [at(a), at(b)]),
    new Color3(0.45, 0.7, 1),
    0.32,
  );
  // A course is a tube, not a line: a line is one pixel on every screen.
  let route: Mesh | null = null;
  const gold = new StandardMaterial('map-course', scene);
  gold.disableLighting = true;
  gold.emissiveColor = new Color3(1, 0.78, 0.35);

  let clock = 0;
  const viewport = new Viewport(0, 0, 1, 1);
  return {
    render() {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
      clock += dt;
      fitView();
      centreInFree();
      // The view glides to what is chosen.
      if (route) route.visibility = 0.75 + 0.25 * Math.sin(clock * 3);
      Vector3.LerpToRef(camera.target, target, 1 - Math.exp(-dt * 6), camera.target);
      lantern.width = lantern.height = 2.2 + 0.25 * Math.sin(clock * 2.4);
      for (const r of open) r.width = r.height = 3.2 + 0.4 * Math.sin(clock * 1.7);
      scene.render();
    },
    turn(dx, dy) {
      camera.alpha -= dx * 0.008;
      camera.beta = Math.min(Math.PI - 0.12, Math.max(0.12, camera.beta - dy * 0.008));
    },
    zoom(factor) {
      fitted = false;
      camera.radius = Math.min(160, Math.max(6, camera.radius * factor));
    },
    select(id, stay) {
      chosen.isVisible = id !== null;
      if (id === null) return;
      const p = at(id);
      chosen.position = p;
      if (!stay) target.copyFrom(p);
    },
    inset(next) {
      Object.assign(edges, next);
    },
    course(through) {
      route?.dispose();
      route = null;
      if (!through || through.length < 2) return;
      route = CreateTube('map-course', { path: through.map(at), radius: 0.16, tessellation: 6 }, scene);
      route.material = gold;
      route.isPickable = false;
    },
    project(ids) {
      const width = engine.getRenderWidth();
      const height = engine.getRenderHeight();
      viewport.width = width;
      viewport.height = height;
      const canvas = engine.getRenderingCanvas();
      const toCss = canvas ? canvas.clientWidth / width : 1;
      const transform = scene.getTransformMatrix();
      const view = camera.getViewMatrix();
      const out: ScreenPoint[] = [];
      for (const id of ids ?? systems.map((s) => s.id)) {
        if (!byId.has(id)) continue;
        const p = at(id);
        const s = Vector3.Project(p, Matrix.IdentityReadOnly, transform, viewport);
        out.push({ id, x: s.x * toCss, y: s.y * toCss, depth: Vector3.TransformCoordinates(p, view).z });
      }
      return out;
    },
    view: () => ({
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [camera.target.x, camera.target.z, camera.target.y],
    }),
    dispose() {
      scene.dispose();
    },
  };
}
