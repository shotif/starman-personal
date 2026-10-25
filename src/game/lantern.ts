import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { buildKit, type Kit } from './kit.ts';
import { areaAt, LANTERN_AREAS, LANTERN_MARKS } from './places.ts';
import type { QualitySettings } from './quality.ts';
import { buildSky } from './sky.ts';
import type { Mark, Place } from './station.ts';

/**
 * *Lantern*, the surveyor the hero commands (ACT1.md): a place of her own, loaded on its own. The
 * bridge at her nose with a window on space, the hold behind it where the survivors of Ross 128
 * live, and a corridor aft: the crew deck's cabins to the south, the mess and the med bay to the
 * north, engineering at the stern round the reactor. Built from the kit (src/game/kit.ts) and the
 * models already made; the places' names are in src/game/places.ts.
 */
/** Seconds from breaking orbit to the lane's flash (the game waits a little longer, DEPART_SECONDS). */
const LANE_AT = 5.2;

export function buildLantern(scene: Scene, q: QualitySettings): Place {
  const kit = buildKit(scene, q);
  const sky = buildSky(scene);
  // In orbit and in flight: no air, so no dusk; the stars and the star stay.
  sky.space(true);

  bridge(kit);
  hold(kit);
  decks(kit);
  engineering(kit);
  kit.finish();
  void kit.furnish();

  // Inside a ship: a soft fill, and the lamps of each room (the kit's lights).
  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
  fill.intensity = 0.35;
  fill.diffuse = new Color3(0.8, 0.85, 0.95);
  fill.groundColor = new Color3(0.12, 0.11, 0.12);
  const planet = ross128b(kit);
  const planetAt = planet.position.clone();
  /** Seconds since leaving began, or null; the flash and the lane come at LANE_AT. */
  let leaving: { t: number; flash: () => void; flashed: boolean } | null = null;
  const lane = (on: boolean) => {
    sky.lane(on);
    planet.setEnabled(!on);
    if (!on) {
      planet.position.copyFrom(planetAt);
      planet.scaling.setAll(1);
    }
  };

  const marks: Record<string, Mark> = {};
  for (const [id, m] of Object.entries(LANTERN_MARKS)) {
    marks[id] = { at: new Vector3(m.x, m.y ?? 0, m.z), yaw: m.yaw ?? 0 };
  }
  const start = marks.bridge_hero ?? { at: Vector3.Zero(), yaw: 0 };
  return {
    heroStart: start,
    companionStart: marks.bridge_ren ?? start,
    navigationMeshes: kit.navigationMeshes,
    doors: {},
    marks,
    vents: {},
    areas: LANTERN_AREAS,
    drones: [],
    sky,
    lightsOut(out) {
      kit.lightsOut(out);
    },
    // Nothing here lifts off.
    ship: new TransformNode('no-ship', scene),
    freeShip() {},
    depart(flash) {
      leaving = { t: 0, flash, flashed: false };
      // Just outside the bridge's window (the glass would grey the view), looking out and down, so
      // the planet is seen to fall away.
      return { from: new Vector3(-6.4, 2, 0.2), to: new Vector3(-40, -4, 11) };
    },
    lane,
    castShadow() {},
    areaAt: (p) => areaAt(p, LANTERN_AREAS),
    props: kit.placed(),
    update(dt) {
      sky.update(dt);
      if (!leaving) return;
      // Breaking orbit: Ross 128 b falls away below and behind, faster and faster, then the lane.
      leaving.t += dt;
      const k = Math.min(1, leaving.t / LANE_AT) ** 2;
      // Within the camera's reach (5 km): nearer and smaller rather than farther than it can see.
      planet.position.copyFrom(planetAt.scale(1 + k * 1.1));
      planet.scaling.setAll(1 - k * 0.55);
      if (leaving.t >= LANE_AT && !leaving.flashed) {
        leaving.flashed = true;
        leaving.flash();
        lane(true);
        leaving = null;
      }
    },
  };
}

/** The bridge: a window on the star to the west, the chair, the stations. */
function bridge(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('bridge');
  kit.room({
    name: 'bridge',
    x: [-6, 6],
    z: [-5, 5],
    height: 3.4,
    floor: s.deck,
    wall: s.hullDark,
    gaps: [
      { side: 'w', from: -4, to: 4, bottom: 0.7, top: 3, glass: true },
      { side: 'n', from: -1, to: 1 },
      { side: 'e', from: -1, to: 1 },
    ],
  });
  // The captain's chair faces the window; the stations face their screens.
  kit.prop('chair', [0.6, 0, 0.5], -Math.PI / 2, [0.9, 1.3, 0.9], (box) => {
    box([0.9, 0.6, 0.9], [0, 0.3, 0], s.hullDark);
    box([0.9, 1, 0.15], [0, 1.1, -0.4], s.fabric);
  });
  // A console's front is its operator's side. The two by the window face into the room, so their
  // operators look past the screens and out; the two by the side walls turn their backs to the walls.
  for (const [x, z, look, yaw] of [
    [-3.6, 3, s.screen, Math.PI / 2],
    [-3.6, -2.5, s.screenWarm, Math.PI / 2],
    [2.5, 4, s.screen, Math.PI],
    [2.5, -4, s.screen, 0],
  ] as const) {
    kit.prop('bridgeconsole', [x, 0, z], yaw, [1.6, 1.3, 0.9], (box) => {
      box([1.6, 0.95, 0.9], [0, 0.475, 0], s.hull);
      box([1.4, 0.04, 0.7], [0, 0.97, 0], look);
    });
  }
  // The navigation screen on the east wall, either side of the door aft.
  kit.deco([0.06, 1.4, 2.6], [5.85, 1.8, -2.9], s.dark);
  kit.picture('screen-navigation', [2.4, 1.2], [5.79, 1.8, -2.9], -Math.PI / 2);
  kit.picture('screen-sensor-sweep', [2.4, 1.2], [5.79, 1.8, 2.9], -Math.PI / 2);
  kit.light([0, 3.25, -2], new Color3(0.8, 0.88, 1), 5, 9);
  kit.light([0, 3.25, 2], new Color3(0.8, 0.88, 1), 5, 9);
}

/** The hold behind the bridge, through the door in its north wall: where the survivors live. */
function hold(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('hold');
  kit.room({ name: 'hold', x: [-6, 6], z: [5, 15], height: 3, floor: s.deck, wall: s.hull, open: ['s'] });
  for (const [x, z, yaw] of [
    [-5.2, 9, Math.PI / 2],
    [-5.2, 12.4, Math.PI / 2],
    [5.2, 13.6, -Math.PI / 2],
  ] as const) {
    bunk(kit, x, z, yaw);
  }
  kit.prop('table', [0, 0, 11], 0, [2.8, 0.8, 2.6], (box) => {
    box([2.8, 0.75, 1.2], [0, 0.375, 0], s.wood);
    box([2.8, 0.45, 0.5], [0, 0.225, -1.1], s.hullDark);
    box([2.8, 0.45, 0.5], [0, 0.225, 1.1], s.hullDark);
  });
  for (const [x, z] of [
    [4.6, 7],
    [4.6, 8.4],
    [3.4, 7],
  ] as const) {
    crate(kit, x, z, 1.1);
  }
  kit.light([0, 2.85, 8], new Color3(1, 0.85, 0.7), 5, 8);
  kit.light([0, 2.85, 13], new Color3(1, 0.85, 0.7), 5, 8);
}

/** The corridor aft, the crew deck's cabins and store to the south, the mess and med bay to the north. */
function decks(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('decks');
  kit.room({
    name: 'corridor',
    x: [6, 30],
    z: [-1.5, 1.5],
    height: 2.8,
    floor: s.deck,
    wall: s.panel,
    open: ['w', 'e'],
    gaps: [
      { side: 'n', from: 11, to: 13 },
      { side: 'n', from: 20, to: 22 },
      { side: 's', from: 9.5, to: 11 },
      { side: 's', from: 14.5, to: 16 },
      { side: 's', from: 19.5, to: 21 },
      { side: 's', from: 24.5, to: 26 },
    ],
  });
  for (const x of [9, 15, 21, 27]) kit.light([x, 2.65, 0], new Color3(0.85, 0.9, 1), 4, 6);

  // Cabins: a bunk under the south wall, a locker, a terminal. The captain's, Ren's and Jo's.
  kit.room({
    name: 'cabin-captain',
    x: [8, 13],
    z: [-7, -1.5],
    height: 2.8,
    floor: s.floor,
    wall: s.warm,
    open: ['n'],
  });
  kit.room({
    name: 'cabin-ren',
    x: [13, 18],
    z: [-7, -1.5],
    height: 2.8,
    floor: s.floor,
    wall: s.warm,
    open: ['n', 'w'],
  });
  kit.room({
    name: 'cabin-jo',
    x: [18, 23],
    z: [-7, -1.5],
    height: 2.8,
    floor: s.floor,
    wall: s.warm,
    open: ['n', 'w'],
  });
  kit.room({ name: 'store', x: [23, 28], z: [-7, -1.5], height: 2.8, floor: s.deck, wall: s.panel, open: ['n', 'w'] });
  for (const x of [10.5, 15.5, 20.5]) {
    bunk(kit, x, -6.4, 0);
    kit.light([x, 2.65, -4.2], new Color3(1, 0.86, 0.72), 4, 6);
  }
  locker(kit, 12.5, -4.4, -Math.PI / 2);
  locker(kit, 17.5, -4.4, -Math.PI / 2);
  kit.prop('terminal', [8.12, 0.75, -4], Math.PI / 2, [0.47, 0.8, 0.35], () => {}, { solid: false });
  kit.prop('terminal', [13.12, 0.75, -4], Math.PI / 2, [0.47, 0.8, 0.35], () => {}, { solid: false });
  kit.prop('helmet', [12.5, 1.25, -4.4], -Math.PI / 2 + 0.4, [0.32, 0.32, 0.32], () => {}, { solid: false });
  // Jo's cabin is half a workshop.
  kit.prop('cylinders', [22.5, 0, -4.2], -Math.PI / 2, [1.8, 1.9, 0.7], (box) =>
    box([1.8, 1.8, 0.6], [0, 0.9, 0], s.stripe),
  );
  crate(kit, 18.9, -3.2, 1);
  // The store: lockers for what the crew carries, and crates.
  for (const x of [24.2, 25.4, 26.6]) locker(kit, x, -6.5, 0);
  crate(kit, 27.2, -3, 1.1);
  kit.light([25.5, 2.65, -4.2], new Color3(0.85, 0.9, 1), 4, 6);

  // The mess: Dena's galley and a window on the stars over the table.
  kit.room({
    name: 'mess',
    x: [8, 18],
    z: [1.5, 9],
    height: 2.8,
    floor: s.floor,
    wall: s.panel,
    open: ['s'],
    gaps: [{ side: 'n', from: 13, to: 17, bottom: 1, top: 2.3, glass: true }],
  });
  kit.prop(
    'galley',
    [10.2, 0, 8.5],
    Math.PI,
    [4, 1.1, 0.8],
    (box) => {
      box([4, 1, 0.8], [0, 0.5, 0], s.hull);
      box([4, 0.06, 0.85], [0, 1.03, 0], s.dark);
    },
    { fit: 'box' },
  );
  kit.prop('table', [13, 0, 4.6], 0, [2.8, 0.8, 2.6], (box) => {
    box([2.8, 0.75, 1.2], [0, 0.375, 0], s.wood);
    box([2.8, 0.45, 0.5], [0, 0.225, -1.1], s.hullDark);
    box([2.8, 0.45, 0.5], [0, 0.225, 1.1], s.hullDark);
  });
  kit.prop('vending', [17.4, 0, 6.2], -Math.PI / 2, [1.1, 2, 0.8], (box) => {
    box([1.1, 2, 0.8], [0, 1, 0], s.panel);
    box([0.8, 1.2, 0.05], [0, 1.2, 0.42], s.screenWarm);
  });
  kit.light([10.5, 2.65, 5], new Color3(1, 0.88, 0.74), 5, 8);
  kit.light([15.5, 2.65, 5], new Color3(1, 0.88, 0.74), 5, 8);

  // The med bay, for the doctor the crew does not have yet.
  kit.room({
    name: 'medbay',
    x: [18, 24],
    z: [1.5, 7],
    height: 2.8,
    floor: s.tiles,
    wall: s.wall,
    open: ['s', 'w'],
  });
  kit.prop('medbed', [21, 0, 6.3], Math.PI, [2, 1.1, 0.9], (box) => {
    box([2, 0.6, 0.9], [0, 0.3, 0], s.hull);
    box([1.9, 0.12, 0.85], [0, 0.66, 0], s.fabric);
  });
  kit.prop('cylinders', [23.4, 0, 3.4], -Math.PI / 2, [1.8, 1.9, 0.7], (box) =>
    box([1.8, 1.8, 0.6], [0, 0.9, 0], s.stripe),
  );
  kit.light([21, 2.65, 4.2], new Color3(0.9, 0.95, 1), 5, 7);
}

/** Engineering at the stern: the reactor in its cage, Jo's consoles, Sorrel's bench. */
function engineering(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('engineering');
  kit.room({
    name: 'engineering',
    x: [30, 40],
    z: [-6, 6],
    height: 4,
    floor: s.grate,
    wall: s.rust,
    gaps: [{ side: 'w', from: -1.5, to: 1.5 }],
  });
  // The reactor: a column in a cage of light, its rings turning slowly (they are drawn, not felt).
  kit.column(1.1, 4, [37, 0, 0], s.hullDark);
  for (const y of [0.9, 2, 3.1]) {
    const ring = CreateTorus(`reactor-ring-${y}`, { diameter: 2.7, thickness: 0.12, tessellation: 40 }, kit.scene);
    ring.position.set(37, y, 0);
    ring.material = s.glow.material;
    ring.isPickable = false;
  }
  kit.prop('console', [33.6, 0, 4.9], Math.PI, [1.9, 1.4, 0.9], (box) => {
    box([1.9, 0.95, 0.9], [0, 0.475, 0], s.hull);
    box([1.5, 0.6, 0.05], [0, 1.3, -0.2], s.screen);
  });
  // Sorrel's bench: a long crate, and the spares on it.
  crate(kit, 33, -5.2, 2);
  kit.prop('cylinders', [39.3, 0, -3.8], -Math.PI / 2, [1.8, 1.9, 0.7], (box) =>
    box([1.8, 1.8, 0.6], [0, 0.9, 0], s.stripe),
  );
  crate(kit, 38.6, 4.6, 1.2);
  kit.light([33, 3.85, 0], new Color3(1, 0.8, 0.6), 7, 10);
  kit.light([37, 3.85, -4], new Color3(0.7, 0.85, 1), 5, 8);
  kit.light([37, 3.85, 4], new Color3(0.7, 0.85, 1), 5, 8);
}

function bunk(kit: Kit, x: number, z: number, yaw: number) {
  const s = kit.surfaces;
  kit.prop('bunk', [x, 0, z], yaw, [2.1, 2.1, 1], (box) => {
    box([2.1, 0.5, 1], [0, 0.25, 0], s.hullDark);
    box([2, 0.15, 0.9], [0, 0.58, 0], s.fabric);
    box([2.1, 0.08, 1], [0, 1.7, 0], s.hullDark);
    box([2, 0.15, 0.9], [0, 1.82, 0], s.fabric);
  });
}

function locker(kit: Kit, x: number, z: number, yaw: number) {
  kit.prop('locker', [x, 0, z], yaw, [0.97, 1.25, 0.78], (box) =>
    box([0.97, 1.25, 0.78], [0, 0.625, 0], kit.surfaces.panel),
  );
}

function crate(kit: Kit, x: number, z: number, w: number) {
  kit.prop('crate', [x, 0, z], 0, [w, 1, 1.1], (box) => box([w, 1, 1.1], [0, 0.5, 0], kit.surfaces.crate), {
    fit: 'box',
  });
}

/** Ross 128 b below, its night side turning under the ship: the painted ground, unfogged. */
function ross128b(kit: Kit): Mesh {
  const planet = CreateSphere('ross-128-b', { diameter: 3000, segments: 48 }, kit.scene);
  planet.position.set(-1700, -1560, 0);
  const surface = new StandardMaterial('ross-128-b', kit.scene);
  const ground = new Texture(`${import.meta.env.BASE_URL}assets/textures/ground-regolith.webp`, kit.scene);
  ground.uScale = 6;
  ground.vScale = 3;
  surface.diffuseTexture = ground;
  surface.diffuseColor = new Color3(0.8, 0.6, 0.52);
  surface.specularColor = Color3.Black();
  surface.fogEnabled = false;
  planet.material = surface;
  planet.applyFog = false;
  planet.isPickable = false;
  return planet;
}
