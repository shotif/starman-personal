import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { buildKit, type Door, type Kit } from './kit.ts';
import { areaAt, PYRE_AREAS, PYRE_MARKS, PYRE_VENTS } from './places.ts';
import type { QualitySettings } from './quality.ts';
import { buildSky } from './sky.ts';
import type { Mark, Place } from './station.ts';

/**
 * Pyre Remnant Station (PYRE.md): the Cooperative's observatory, two hundred people inside what is
 * left of the star Pyre. Hand-made (D-19) from the kit, as Calder and *Lantern* are: the dock where
 * *Lantern* lies at berth four, the commons with its great window on the remnant, the committee room,
 * the clinic and the overflow, the spine north to the archive and out along the dome walk to the
 * observatory dome, and the freight way up the west side. The names are in src/game/places.ts.
 *
 * Coordinates: x runs east, z north, y up, in metres; every floor at y = 0. Pale walls, blue doors.
 */
export function buildPyre(scene: Scene, q: QualitySettings): Place {
  const kit = buildKit(scene, q);
  const sky = buildSky(scene);
  sky.pyre(true);
  const doors: Record<string, Door> = {};
  const addDoor = (d: Door) => {
    doors[d.id] = d;
  };

  dock(kit, addDoor);
  freightWay(kit);
  commons(kit, addDoor);
  committee(kit);
  clinic(kit);
  overflow(kit);
  spine(kit, addDoor);
  archive(kit, addDoor);
  dome(kit, addDoor);
  kit.finish();
  void kit.furnish();

  // No sun here: the black hole gives no light. A soft fill, and the station's own lamps.
  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
  fill.intensity = 0.62;
  fill.diffuse = new Color3(0.86, 0.9, 0.98);
  fill.groundColor = new Color3(0.12, 0.1, 0.11);

  const marks: Record<string, Mark> = {};
  for (const [id, m] of Object.entries(PYRE_MARKS))
    marks[id] = { at: new Vector3(m.x, m.y ?? 0, m.z), yaw: m.yaw ?? 0 };
  const vents: Record<string, Vector3[]> = {};
  for (const [id, list] of Object.entries(PYRE_VENTS)) vents[id] = list.map(([x, y, z]) => new Vector3(x, y, z));
  const start = marks.pyre_dock_hero ?? { at: Vector3.Zero(), yaw: 0 };

  return {
    heroStart: start,
    companionStart: start,
    navigationMeshes: kit.navigationMeshes,
    doors,
    marks,
    vents,
    areas: PYRE_AREAS,
    drones: [],
    sky,
    lightsOut(out) {
      kit.lightsOut(out);
      fill.intensity = out ? 0.2 : 0.62;
    },
    ship: new TransformNode('no-ship', scene),
    freeShip() {},
    depart: () => null,
    lane() {},
    castShadow() {},
    areaAt: (p) => areaAt(p, PYRE_AREAS),
    props: kit.placed(),
    update(dt) {
      for (const d of Object.values(doors)) d.update(dt);
      sky.update(dt);
    },
  };
}

const COOP_LIGHT = new Color3(0.86, 0.92, 1);
const WARM_LIGHT = new Color3(1, 0.88, 0.74);

/** A crate of low cover. */
function crate(kit: Kit, x: number, z: number, w = 1.2, h = 1, look = kit.surfaces.crate, yaw = 0) {
  kit.prop('crate', [x, 0, z], yaw, [w, h, 1.1], (box) => box([w, h, 1.1], [0, h / 2, 0], look), { fit: 'box' });
}

function bench(kit: Kit, x: number, z: number, yaw: number) {
  kit.prop('bench', [x, 0, z], yaw, [2.4, 1.05, 0.73], (box) => {
    box([2.4, 0.45, 0.6], [0, 0.22, 0], kit.surfaces.wood);
    box([2.4, 0.5, 0.1], [0, 0.75, -0.3], kit.surfaces.wood);
  });
}

function planter(kit: Kit, x: number, z: number, yaw: number) {
  kit.prop('planter', [x, 0, z], yaw, [2.6, 0.97, 0.75], (box) => {
    box([2.6, 0.6, 0.75], [0, 0.3, 0], kit.surfaces.hullDark);
    box([2.4, 0.3, 0.6], [0, 0.75, 0], kit.surfaces.plant);
  });
}

function consoleAt(kit: Kit, x: number, z: number, yaw: number, warm = false) {
  kit.prop('console', [x, 0, z], yaw, [1.9, 1.4, 0.9], (box) => {
    box([1.9, 0.95, 0.9], [0, 0.475, 0], kit.surfaces.hull);
    box([1.5, 0.6, 0.05], [0, 1.3, -0.2], warm ? kit.surfaces.screenWarm : kit.surfaces.screen);
  });
}

function table(kit: Kit, x: number, z: number, yaw = 0) {
  kit.prop('table', [x, 0, z], yaw, [2.8, 0.8, 2.6], (box) => {
    box([2.8, 0.75, 1.2], [0, 0.375, 0], kit.surfaces.wood);
    box([2.8, 0.45, 0.5], [0, 0.225, -1.1], kit.surfaces.hullDark);
    box([2.8, 0.45, 0.5], [0, 0.225, 1.1], kit.surfaces.hullDark);
  });
}

/** The dock: berth four (Lantern's) and berth two at the south, the customs gate north, the freight way west. */
function dock(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('dock');
  kit.room({
    name: 'dock',
    x: [-16, 16],
    z: [-32, -10],
    height: 7,
    floor: s.concrete,
    wall: s.wall,
    gaps: [
      // The window on the berths, Lantern's hull beyond it.
      { side: 's', from: -9, to: 9, bottom: 1, top: 5.6, glass: true },
      { side: 's', from: -13.2, to: -10.8 },
      { side: 's', from: 10.8, to: 13.2 },
      { side: 'w', from: -25.2, to: -22.8 },
    ],
    // The commons' south wall, with the customs gate in it, closes the dock to the north.
    open: ['n'],
  });
  addDoor(kit.door('berth_two', [-12, 0, -32], 2.4, true));
  addDoor(kit.door('berth_door', [12, 0, -32], 2.4, true));
  addDoor(kit.door('customs_gate', [0, 0, -10], 3, true));
  addDoor(kit.door('freight_door', [-16, 0, -24], 2.4, false));
  // The berths' clamp rings, yellow-striped round each airlock.
  for (const x of [-12, 12]) {
    kit.deco([3.4, 0.25, 0.3], [x, 2.75, -31.75], s.stripe);
    kit.deco([0.25, 2.8, 0.3], [x - 1.55, 1.4, -31.75], s.stripe);
    kit.deco([0.25, 2.8, 0.3], [x + 1.55, 1.4, -31.75], s.stripe);
  }
  // Lantern at berth four, seen through the window: her flank along the station.
  kit.prop(
    'surveyor',
    [2, -2.5, -46],
    Math.PI / 2,
    [6.83, 8.98, 24],
    (box) => {
      box([6, 6, 22], [0, 3, 0], s.hull);
      box([4, 3, 4], [0, 4.5, 11], s.hullDark);
    },
    { solid: false },
  );
  // A walkway out to her airlock, under the window.
  kit.deco([2.4, 0.2, 14], [12, -0.1, -39], s.grate);
  // Containers (high cover) and crates; Matti's booth by the gate.
  kit.prop(
    'container',
    [-8.6, 0, -16.4],
    0,
    [6, 2.49, 2.18],
    (box) => box([6, 2.49, 2.18], [0, 1.245, 0], s.crateBlue),
    {
      fit: 'box',
    },
  );
  kit.prop(
    'container',
    [7.4, 0, -25.4],
    0,
    [6, 2.49, 2.18],
    (box) => box([6, 2.49, 2.18], [0, 1.245, 0], s.crateOrange),
    { fit: 'box' },
  );
  crate(kit, -2.6, -21.4, 1.6);
  crate(kit, 2.2, -27, 1.2);
  crate(kit, 6.6, -18.6, 2);
  // The auditors' crates: stacked by the freight way, stencilled for the archive.
  for (const [x, z, y] of [
    [-13.2, -18.4, 0],
    [-11.8, -18.4, 0],
    [-12.5, -18.4, 1],
    [-13.2, -20.4, 0],
  ] as const) {
    kit.prop('crate', [x, y, z], 0, [1.2, 1, 1.1], (box) => box([1.2, 1, 1.1], [0, 0.5, 0], s.crateOrange), {
      fit: 'box',
      solid: y === 0,
    });
  }
  consoleAt(kit, 9.4, -11, Math.PI, true);
  kit.deco([2.6, 1.2, 0.08], [9.4, 1.5, -10.25], s.glass);
  for (const [x, z] of [
    [-8, -16],
    [8, -16],
    [-8, -26],
    [8, -26],
  ] as const) {
    kit.light([x, 6.85, z], COOP_LIGHT, 70, 24);
  }
  kit.emergency([0, 6.85, -21]);
}

/** The freight way: a service tunnel west from the dock, then north to the archive's cargo landing. */
function freightWay(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('freight');
  kit.room({
    name: 'freight-east',
    x: [-42, -16],
    z: [-26, -22],
    height: 3,
    floor: s.grate,
    wall: s.rust,
    open: ['w', 'e'],
  });
  kit.room({
    name: 'freight-north',
    x: [-46, -42],
    z: [-26, 22],
    height: 3,
    floor: s.grate,
    wall: s.rust,
    open: ['n'],
    gaps: [{ side: 'e', from: -26, to: -22 }],
  });
  // Pipes along the walls, and a dim lamp every so often.
  kit.deco([26, 0.2, 0.2], [-29, 2.6, -25.7], s.trim);
  kit.deco([0.2, 0.2, 48], [-45.7, 2.6, -2], s.trim);
  for (const x of [-36, -24]) kit.light([x, 2.85, -24], new Color3(1, 0.72, 0.5), 4, 7);
  for (const z of [-16, -4, 8, 18]) kit.light([-44, 2.85, z], new Color3(1, 0.72, 0.5), 4, 7);
  // A few stacked crates the hero can duck behind.
  crate(kit, -44.8, -8, 1.1);
  crate(kit, -43.2, 6, 1.1);
}

/** The commons: the station's heart. A great window to the west onto the remnant. */
function commons(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('commons');
  kit.room({
    name: 'commons',
    x: [-20, 20],
    z: [-10, 18],
    height: 8,
    floor: s.floor,
    wall: s.wall,
    gaps: [
      { side: 's', from: -1.5, to: 1.5 },
      { side: 'w', from: -7, to: 15, bottom: 0.9, top: 7.2, glass: true },
      { side: 'n', from: -15, to: -13 },
      { side: 'n', from: -2, to: 2, top: 3.4 },
      { side: 'e', from: 5, to: 7 },
    ],
  });
  addDoor(kit.door('committee_door', [-14, 0, 18], 2, true));
  addDoor(kit.door('mira_door', [20, 0, 6], 2, false));
  // Quaye's lectern by the window, benches facing it.
  kit.prop('lectern', [-17.4, 0, 4], Math.PI / 2, [0.7, 1.15, 0.5], (box) => {
    box([0.5, 1.05, 0.4], [0, 0.52, 0], s.hullDark);
    box([0.7, 0.06, 0.5], [0, 1.1, 0.05], s.wood);
  });
  bench(kit, -12.6, 0.6, -Math.PI / 2);
  bench(kit, -12.6, 6.4, -Math.PI / 2);
  bench(kit, -7.6, 3.6, -Math.PI / 2);
  planter(kit, -18.4, -8.4, 0);
  planter(kit, -18.4, 16.4, Math.PI);
  planter(kit, 4, 1.6, 0);
  planter(kit, -4, 1.6, 0);
  // The canteen: tables and a vending machine, east.
  table(kit, 8.6, 9.4);
  table(kit, 13.6, 12.6);
  kit.prop('vending', [19.4, 0, 14.4], -Math.PI / 2, [1.1, 2, 0.8], (box) => {
    box([1.1, 2, 0.8], [0, 1, 0], s.panel);
    box([0.8, 1.2, 0.05], [0, 1.2, 0.42], s.screenWarm);
  });
  // Tilly's stall: her hold's crates set out as a counter.
  kit.prop(
    'stall',
    [16.2, 0, -3],
    -Math.PI / 2,
    [3, 1.1, 1.2],
    (box) => {
      box([3, 1, 1.1], [0, 0.5, 0], s.crateOrange);
      box([3.1, 0.06, 1.2], [0, 1.03, 0], s.wood);
    },
    { fit: 'longest' },
  );
  crate(kit, 18.8, -5.6, 1.1, 1.3, s.crate, 0.3);
  crate(kit, 18.6, -0.4, 1, 0.9, s.crateBlue, -0.2);
  // The noticeboard by the spine: notices pinned up; the audit's order in the middle.
  kit.deco([3.4, 1.6, 0.06], [6, 1.8, 17.85], s.wood);
  for (const [x, y, w, h] of [
    [4.8, 2.2, 0.5, 0.6],
    [5.5, 2.25, 0.4, 0.4],
    [6, 1.75, 0.8, 0.9],
    [6.9, 2.2, 0.45, 0.6],
    [7.4, 1.5, 0.4, 0.5],
    [4.9, 1.4, 0.6, 0.4],
  ] as const) {
    kit.deco([w, h, 0.01], [x, y, 17.8], s.paper);
  }
  kit.picture('poster-cooperative', [0.9, 1.35], [-8, 2, 17.88], Math.PI);
  kit.picture('screen-station-map', [2.4, 1.2], [19.88, 2.2, -6], -Math.PI / 2);
  for (const [x, z] of [
    [-12, -4],
    [-12, 10],
    [0, -4],
    [0, 10],
    [12, -4],
    [12, 10],
  ] as const) {
    kit.light([x, 7.85, z], COOP_LIGHT, 120, 30);
  }
  kit.emergency([0, 7.85, 3]);
}

/** The committee room: a round table under a screen; Ruth's desk by the north wall. */
function committee(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('committee');
  kit.room({ name: 'committee', x: [-20, -8], z: [18, 30], height: 4, floor: s.deck, wall: s.warm, open: ['s'] });
  kit.column(2.2, 0.76, [-14, 0, 24], s.wood);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    kit.prop('chair', [-14 + Math.sin(a) * 3, 0, 24 + Math.cos(a) * 3], a + Math.PI, [0.7, 1, 0.7], (box) => {
      box([0.6, 0.5, 0.6], [0, 0.25, 0], s.hullDark);
      box([0.6, 0.6, 0.1], [0, 0.8, -0.25], s.fabric);
    });
  }
  kit.deco([5, 2.4, 0.06], [-14, 2.2, 29.85], s.dark);
  kit.picture('screen-light-curve', [4.4, 2.1], [-14, 2.2, 29.8], Math.PI);
  kit.prop(
    'desk',
    [-9.8, 0, 28.6],
    Math.PI,
    [1.8, 0.8, 0.9],
    (box) => {
      box([1.8, 0.75, 0.8], [0, 0.375, 0], s.wood);
    },
    { fit: 'longest' },
  );
  kit.light([-14, 3.85, 21], WARM_LIGHT, 6, 10);
  kit.light([-14, 3.85, 27], WARM_LIGHT, 6, 10);
}

/** The clinic: three beds, a dispensary, and the way into the overflow behind. */
function clinic(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('clinic');
  kit.room({
    name: 'pyre-clinic',
    x: [20, 36],
    z: [0, 12],
    height: 3.4,
    floor: s.tiles,
    wall: s.wall,
    open: ['w'],
    gaps: [{ side: 's', from: 22, to: 24.4, top: 2.6 }],
  });
  for (const x of [26, 29.4, 32.8]) {
    kit.prop('medbed', [x, 0, 10.8], Math.PI, [2, 1.1, 0.9], (box) => {
      box([2, 0.6, 0.9], [0, 0.3, 0], s.hull);
      box([1.9, 0.12, 0.85], [0, 0.66, 0], s.fabric);
    });
  }
  kit.prop('cylinders', [35.4, 0, 3], -Math.PI / 2, [1.8, 1.9, 0.7], (box) =>
    box([1.8, 1.8, 0.6], [0, 0.9, 0], s.stripe),
  );
  consoleAt(kit, 33.6, 7, -Math.PI / 2);
  kit.deco([1.2, 0.8, 0.04], [33.6, 1.7, 11.88], s.paper);
  kit.light([24, 3.25, 6], new Color3(0.92, 0.96, 1), 6, 9);
  kit.light([31, 3.25, 6], new Color3(0.92, 0.96, 1), 6, 9);
}

/** The overflow: an emptied cargo hold, cots in rows, sheets hung for walls. */
function overflow(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('overflow');
  kit.room({
    name: 'overflow',
    x: [20, 36],
    z: [-10, 0],
    height: 5,
    floor: s.concrete,
    wall: s.rust,
    open: ['n', 'w'],
  });
  for (const [x, z, yaw] of [
    [22.6, -2.4, 0],
    [22.6, -5, 0],
    [22.6, -8.6, 0],
    [28.4, -8.6, 0],
    [31.6, -8.6, 0],
    [34.6, -1.6, Math.PI / 2],
    [34.6, -8, Math.PI / 2],
    [28.4, -4.6, 0],
  ] as const) {
    kit.prop('cot', [x, 0, z], yaw, [2, 0.45, 0.8], (box) => {
      box([2, 0.08, 0.8], [0, 0.4, 0], s.fabric);
      box([2, 0.4, 0.06], [0, 0.2, 0.37], s.trim);
      box([2, 0.4, 0.06], [0, 0.2, -0.37], s.trim);
    });
  }
  // Sheets hung on lines between the cots, for walls.
  for (const [x, z, w] of [
    [25.2, -5.6, 3],
    [30, -6.6, 3.4],
    [33.2, -4.8, 2.4],
  ] as const) {
    kit.deco([0.04, 2, w], [x, 1.2, z], s.paper);
  }
  // The sapling they carried from the Orchard, in its pot.
  kit.prop(
    'sapling',
    [21.2, 0, -9],
    0,
    [0.8, 1.6, 0.8],
    (box) => {
      box([0.6, 0.5, 0.6], [0, 0.25, 0], s.soil);
      box([0.5, 1, 0.5], [0, 1.05, 0], s.plant);
    },
    { solid: false },
  );
  crate(kit, 35, -5, 1.1, 0.9, s.crate);
  kit.deco([0.04, 0.7, 0.9], [35.86, 1.5, -4.4], s.paper);
  kit.light([24, 4.85, -5], WARM_LIGHT, 5, 9);
  kit.light([31, 4.85, -5], WARM_LIGHT, 5, 9);
}

/** The spine: north from the commons to the archive (west) and the dome walk (east). */
function spine(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('spine');
  kit.room({
    name: 'pyre-spine',
    x: [-3, 3],
    z: [18, 58],
    height: 3.4,
    floor: s.deck,
    wall: s.wall,
    open: ['s'],
    gaps: [
      { side: 'w', from: 36.5, to: 39.5 },
      { side: 'w', from: 50, to: 52 },
      { side: 'e', from: 36.5, to: 39.5 },
    ],
  });
  addDoor(kit.door('archive_front', [-3, 0, 38], 3, false));
  addDoor(kit.door('reading_door', [-3, 0, 51], 2, false));
  // Signs: the archive west, the dome east.
  kit.deco([1.6, 0.4, 0.04], [-2.88, 2.9, 38], s.screen, Math.PI / 2);
  kit.deco([1.6, 0.4, 0.04], [2.88, 2.9, 38], s.screenWarm, Math.PI / 2);
  for (const z of [22, 30, 38, 46, 54]) kit.light([0, 3.25, z], COOP_LIGHT, 5, 9);
  kit.emergency([0, 3.25, 42]);
}

/** The archive: the front hall, the reading room, the stacks, the cargo landing and the core. */
function archive(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('archive');
  kit.room({
    name: 'front-hall',
    x: [-20, -3],
    z: [34, 46],
    height: 4.5,
    floor: s.floor,
    wall: s.wall,
    open: ['e'],
    gaps: [{ side: 'w', from: 38, to: 42, top: 3.4 }],
  });
  // The front hall's counters and reading desks: cover for whoever holds it.
  kit.prop('counter', [-9, 0, 40], Math.PI / 2, [5, 1.1, 0.9], (box) => box([5, 1.1, 0.9], [0, 0.55, 0], s.hullDark), {
    fit: 'box',
  });
  for (const [x, z] of [
    [-14, 36.4],
    [-14, 43.6],
    [-17.4, 40],
  ] as const) {
    kit.prop('desk', [x, 0, z], 0, [1.8, 0.8, 0.9], (box) => box([1.8, 0.9, 0.8], [0, 0.45, 0], s.wood), {
      fit: 'longest',
    });
  }
  // The audit's list of records withdrawn, left on the counter.
  kit.deco([0.6, 0.02, 0.8], [-9, 1.11, 41], s.paper);
  for (const [x, z] of [
    [-8, 37],
    [-8, 43],
    [-15, 40],
  ] as const) {
    kit.light([x, 4.35, z], COOP_LIGHT, 6, 10);
  }

  kit.room({
    name: 'reading-room',
    x: [-20, -3],
    z: [46, 58],
    height: 3.6,
    floor: s.deck,
    wall: s.warm,
    open: ['e', 's'],
    gaps: [{ side: 'w', from: 51, to: 53 }],
  });
  addDoor(kit.door('stacks_door', [-20, 0, 52], 2, false));
  table(kit, -11, 54.6, Math.PI / 2);
  consoleAt(kit, -15.6, 48, 0);
  kit.prop('desk', [-6, 0, 56.8], Math.PI, [1.8, 0.8, 0.9], (box) => box([1.8, 0.75, 0.8], [0, 0.375, 0], s.wood), {
    fit: 'longest',
  });
  kit.light([-8, 3.45, 50], WARM_LIGHT, 5, 9);
  kit.light([-15, 3.45, 54], WARM_LIGHT, 5, 9);

  kit.room({
    name: 'stacks',
    x: [-46, -20],
    z: [34, 58],
    height: 4,
    floor: s.floor,
    wall: s.wall,
    open: ['e'],
    gaps: [
      { side: 'n', from: -40, to: -36 },
      { side: 's', from: -45, to: -41, top: 3 },
    ],
  });
  addDoor(kit.door('core_door', [-38, 0, 58], 4, true));
  // Rows of waist-high racks, the data cores glowing along their tops: long lanes, low cover.
  for (const z of [38.4, 42.6, 46.8, 51, 55.2]) {
    for (const x0 of [-43.6, -36.4, -29.2]) {
      const offset = z === 42.6 || z === 51 ? 1.8 : 0;
      // Squashed to waist height, so they stay low cover (COMBAT.md, *The Banked*).
      kit.prop(
        'rack',
        [x0 + offset + 2.5, 0, z],
        0,
        [5, 1.1, 0.8],
        (box) => {
          box([5, 1.05, 0.8], [0, 0.525, 0], s.hullDark);
          box([4.8, 0.06, 0.5], [0, 1.08, 0], s.screen);
        },
        { fit: 'box' },
      );
    }
  }
  for (const [x, z] of [
    [-40, 40],
    [-28, 40],
    [-40, 52],
    [-28, 52],
  ] as const) {
    kit.light([x, 3.85, z], new Color3(0.7, 0.85, 1), 6, 11);
  }
  kit.emergency([-33, 3.85, 46]);

  kit.room({
    name: 'landing',
    x: [-46, -34],
    z: [22, 34],
    height: 4,
    floor: s.concrete,
    wall: s.rust,
    open: ['n'],
    gaps: [{ side: 's', from: -45.4, to: -42.6 }],
  });
  addDoor(kit.door('landing_door', [-44, 0, 22], 2.8, true));
  crate(kit, -38, 26, 1.6, 1);
  crate(kit, -41.2, 29.4, 1.2, 1);
  crate(kit, -36.4, 31, 1.2, 1.2, s.crateOrange);
  kit.prop('cart', [-39.4, 0, 24.6], Math.PI / 2, [1.28, 1.22, 2.4], (box) =>
    box([1.28, 1.1, 2.4], [0, 0.55, 0], s.trim),
  );
  kit.light([-40, 3.85, 28], new Color3(1, 0.78, 0.55), 6, 10);

  kit.room({ name: 'core', x: [-46, -30], z: [58, 70], height: 6, floor: s.grate, wall: s.hullDark, open: ['s'] });
  // The core: a column of drives in rings, each ring a set of cores that can be pulled by hand.
  kit.column(1.4, 5, [-38, 0, 65], s.hullDark);
  for (const y of [1, 2.2, 3.4, 4.6]) {
    const ring = CreateTorus(`core-ring-${y}`, { diameter: 3.4, thickness: 0.22, tessellation: 40 }, kit.scene);
    ring.position.set(-38, y, 65);
    ring.material = kit.surfaces.screen.material;
    ring.isPickable = false;
  }
  consoleAt(kit, -33, 61.6, -Math.PI / 2);
  consoleAt(kit, -43, 61.6, Math.PI / 2);
  for (const [x, z] of [
    [-42, 62],
    [-34, 62],
    [-38, 68],
  ] as const) {
    kit.light([x, 5.85, z], new Color3(0.65, 0.82, 1), 6, 11);
  }
  kit.emergency([-38, 5.85, 60]);
}

/** The dome walk, glass both sides, and the observatory dome with the great mirror. */
function dome(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('dome-walk');
  kit.room({
    name: 'dome-walk',
    x: [3, 60],
    z: [36, 40],
    height: 3.2,
    floor: s.grate,
    wall: s.hullDark,
    open: ['w', 'e'],
    gaps: [
      { side: 'n', from: 4, to: 59, bottom: 0.6, top: 2.9, glass: true },
      { side: 's', from: 4, to: 59, bottom: 0.6, top: 2.9, glass: true },
    ],
  });
  for (const x of [10, 24, 38, 52]) kit.light([x, 3.05, 38], new Color3(0.75, 0.82, 1), 3, 7);

  kit.enter('dome');
  kit.room({
    name: 'dome',
    x: [60, 86],
    z: [25, 51],
    height: 7,
    floor: s.floor,
    wall: s.wall,
    ceiling: null,
    gaps: [{ side: 'w', from: 36.5, to: 39.5 }],
  });
  addDoor(kit.door('dome_door', [60, 0, 38], 3, false));
  // The dome itself, shuttered but for a slit: drawn, not felt.
  const shell = CreateSphere(
    'dome-shell',
    // `arc` leaves a wedge open from the crown to the rim: the shutter's slit, the stars through it.
    { diameter: 37, segments: 24, slice: 0.5, arc: 0.95, sideOrientation: Mesh.DOUBLESIDE },
    kit.scene,
  );
  shell.position.set(73, 7, 38);
  shell.rotation.y = Math.PI / 2;
  shell.material = s.hullDark.material;
  shell.isPickable = false;
  // The great mirror on its mount: a pier, a fork, and the tube pointed out of the slit.
  kit.prop(
    'mirror',
    [73, 0, 38],
    0,
    [6, 9, 6],
    (box) => {
      box([3, 2, 3], [0, 1, 0], s.hullDark);
      box([0.6, 3.4, 0.6], [-1.2, 3.6, 0], s.hull);
      box([0.6, 3.4, 0.6], [1.2, 3.6, 0], s.hull);
    },
    { fit: 'longest' },
  );
  // Consoles round the wall, the band's transmitter by the door.
  for (const [x, z, yaw, warm] of [
    [62.4, 30, Math.PI / 2, false],
    [62.4, 46, Math.PI / 2, false],
    [84, 30, -Math.PI / 2, false],
    [84, 46, -Math.PI / 2, true],
    [73, 49.4, Math.PI, false],
    [73, 26.6, 0, false],
  ] as const) {
    consoleAt(kit, x, z, yaw, warm);
  }
  kit.picture('screen-light-curve', [2.6, 1.3], [85.88, 2.2, 38], -Math.PI / 2);
  kit.picture('screen-sensor-sweep', [2.6, 1.3], [73, 2.6, 50.88], Math.PI);
  crate(kit, 68, 33, 1.6, 1);
  crate(kit, 79, 42, 1.4, 1);
  crate(kit, 66, 43.6, 1.2, 1.2, s.crateBlue);
  for (const [x, z] of [
    [66, 31],
    [80, 31],
    [66, 45],
    [80, 45],
  ] as const) {
    kit.light([x, 6.6, z], new Color3(0.78, 0.84, 1), 60, 22);
  }
  kit.emergency([73, 6.6, 38]);
}
