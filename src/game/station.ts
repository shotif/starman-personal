import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';
import { buildKit, type Door, type Kit } from './kit.ts';
import { AREAS, type AreaData, areaAt, DRONES, MARKS, VENTS } from './places.ts';
import type { QualitySettings } from './quality.ts';
import { buildSky, type Sky } from './sky.ts';

/**
 * Calder Station on Ross 128 b, and the bridge of the surveyor that becomes *Lantern* (SLICE.md).
 * Ross 128 b is real; the station is fiction. Hand-made (D-19) from the kit (src/game/kit.ts), in
 * the slice's parts joined by one route: quarters, the range, the spine, control, the concourse and
 * clinic, the service way and the catwalk to the relay mast, the hangar, and the bridge.
 *
 * Coordinates: x runs east, z north, y up, in metres; every floor is at y = 0 but the mast's
 * platform. The bridge stands far to the south, out of sight of the station.
 */
/** A named place: where people stand, where markers point, where fights come from. */
export interface Mark {
  at: Vector3;
  /** Facing, radians about y; 0 faces north (+z). */
  yaw: number;
}

export interface Place {
  heroStart: Mark;
  companionStart: Mark;
  navigationMeshes: Mesh[];
  doors: Record<string, Door>;
  marks: Record<string, Mark>;
  /** Where a fight's machines come in, by fight. */
  vents: Record<string, Vector3[]>;
  areas: AreaData[];
  /** The range's drones. */
  drones: Vector3[];
  sky: Sky;
  /** The station's power fails: the white lamps fall to a glimmer and the red ones come on. */
  lightsOut(out: boolean): void;
  /** The surveyor in the hangar, for the lift-off. */
  ship: TransformNode;
  /** Takes the ship's bodies away so it can rise. */
  freeShip(): void;
  /**
   * *Lantern* leaves orbit: the world outside falls behind, and the lane takes her with a flash.
   * Returns the shot that watches it, if the place has a window for it.
   */
  depart(flash: () => void): { from: Vector3; to: Vector3 } | null;
  /** In a lane, or not (a resumed game). */
  lane(on: boolean): void;
  /** Docked at Pyre Remnant (aboard *Lantern*): the world outside is Pyre's, not Ross 128's. */
  atPyre?(on: boolean): void;
  castShadow(mesh: AbstractMesh): void;
  /** The area a point is in, or null. */
  areaAt(p: Vector3): string | null;
  /** Every prop placed, for checking that each faces a sensible way. */
  props: ReturnType<Kit['placed']>;
  update(dt: number): void;
}

export function buildStation(scene: Scene, q: QualitySettings): Place {
  const kit = buildKit(scene, q);
  const sky = buildSky(scene);
  const doors: Record<string, Door> = {};
  const addDoor = (d: Door) => {
    doors[d.id] = d;
  };

  outside(kit);
  quarters(kit, addDoor);
  range(kit);
  spine(kit);
  control(kit, addDoor);
  concourse(kit, addDoor);
  serviceAndMast(kit, addDoor);
  const ship = hangar(kit, scene);
  kit.finish();
  // The models take the place of their stand-ins as they arrive; the game does not wait for them.
  void kit.furnish();

  // Light: the star's low red light from the west, a cool fill, and the station's own lamps.
  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
  fill.intensity = 0.32;
  fill.diffuse = new Color3(0.75, 0.8, 0.95);
  fill.groundColor = new Color3(0.1, 0.09, 0.1);
  const starLight = new DirectionalLight('ross-128-light', sky.sun.scale(-1), scene);
  starLight.diffuse = new Color3(1, 0.55, 0.32);
  starLight.intensity = 1.1;
  starLight.position = sky.sun.scale(80);
  let shadows: ShadowGenerator | null = null;
  if (q.shadowMapSize > 0) {
    shadows = new ShadowGenerator(q.shadowMapSize, starLight);
    shadows.usePercentageCloserFiltering = true;
    shadows.bias = 0.002;
  }

  const marks: Record<string, Mark> = {};
  for (const [id, m] of Object.entries(MARKS)) marks[id] = { at: new Vector3(m.x, m.y ?? 0, m.z), yaw: m.yaw ?? 0 };
  const vents: Record<string, Vector3[]> = {};
  for (const [id, list] of Object.entries(VENTS)) vents[id] = list.map(([x, y, z]) => new Vector3(x, y, z));
  const drones = DRONES.map(([x, y, z]) => new Vector3(x, y, z));

  const shipBodies = ship.getChildMeshes(false).filter((m) => m.physicsBody);

  return {
    heroStart: marks.hero_start ?? { at: Vector3.Zero(), yaw: 0 },
    companionStart: marks.ren ?? { at: Vector3.Zero(), yaw: 0 },
    navigationMeshes: kit.navigationMeshes,
    doors,
    marks,
    vents,
    areas: AREAS,
    drones,
    sky,
    lightsOut(out) {
      kit.lightsOut(out);
      fill.intensity = out ? 0.18 : 0.32;
    },
    ship,
    // Nothing here flies but the ship at the lift-off.
    depart: () => null,
    lane() {},
    freeShip() {
      for (const m of shipBodies) m.physicsBody?.dispose();
    },
    castShadow(mesh) {
      shadows?.addShadowCaster(mesh, true);
    },
    areaAt: (p) => areaAt(p),
    props: kit.placed(),
    update(dt) {
      for (const d of Object.values(doors)) d.update(dt);
      sky.update(dt);
    },
  };
}

/** The ground of Ross 128 b round the station, low hills, and far ridges against the sky. */
function outside(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('outside');
  // The ground stands a little below the station's floors, which sit on footings.
  kit.solid([700, 1, 700], [30, -0.75, 20], s.ground, { nav: false });
  let seed = 3;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Rocks scattered near, ridges far: a horizon to see through the windows.
  for (let i = 0; i < 40; i++) {
    const angle = random() * Math.PI * 2;
    const distance = 70 + random() * 120;
    const size = 2 + random() * 6;
    const x = 30 + Math.cos(angle) * distance;
    const z = 30 + Math.sin(angle) * distance;
    // Tipped and half sunk, so no two read as boxes.
    const rock = kit.deco([size * 1.6, size, size * 1.2], [x, -0.4 + size * 0.3 - 0.5, z], s.rock, random() * Math.PI);
    rock.rotation.x = (random() - 0.5) * 0.9;
    rock.rotation.z = (random() - 0.5) * 0.9;
  }
  // The far ridges: the painted skyline (IMAGES.md) on a ring round the station, past the haze, dark
  // as the night side of hills. Unlit and unfogged; its alpha cuts the skyline.
  const ridge = CreateCylinder(
    'ridge',
    { diameter: 760, height: 70, tessellation: 64, cap: Mesh.NO_CAP, sideOrientation: Mesh.BACKSIDE },
    kit.scene,
  );
  ridge.position.set(30, 22, 30);
  const skyline = new StandardMaterial('ridge', kit.scene);
  const painted = new Texture(`${import.meta.env.BASE_URL}assets/textures/ridge-horizon.webp`, kit.scene);
  painted.hasAlpha = true;
  painted.uScale = 4;
  painted.wrapU = Texture.WRAP_ADDRESSMODE;
  skyline.diffuseTexture = painted;
  skyline.useAlphaFromDiffuseTexture = true;
  skyline.disableLighting = true;
  skyline.emissiveColor = new Color3(0.32, 0.22, 0.2);
  skyline.fogEnabled = false;
  skyline.backFaceCulling = false;
  ridge.material = skyline;
  ridge.isPickable = false;
  ridge.applyFog = false;
  // Landing-field lamps east of control, dim and orange.
  for (let i = 0; i < 6; i++) kit.deco([0.3, 0.3, 0.3], [42 + i * 6, -0.1, 4], s.screenWarm);
}

function quarters(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('quarters');
  // The bunk room: the hero wakes here.
  kit.room({
    name: 'bunks',
    x: [-12, -4],
    z: [0, 8],
    height: 3,
    floor: s.floor,
    wall: s.warm,
    gaps: [{ side: 'e', from: 5, to: 6.8 }],
  });
  // Two-tier bunks along the walls, their open sides to the room.
  for (const [x, z, yaw] of [
    [-10.8, 1.1, 0],
    [-7.6, 1.1, 0],
    [-10.8, 6.9, Math.PI],
  ] as const) {
    kit.prop('bunk', [x, 0, z], yaw, [2.1, 2.1, 1], (box) => {
      box([2.1, 0.5, 1], [0, 0.25, 0], s.hullDark);
      box([2, 0.15, 0.9], [0, 0.58, 0], s.fabric);
      box([2.1, 0.08, 1], [0, 1.7, 0], s.hullDark);
      box([2, 0.15, 0.9], [0, 1.82, 0], s.fabric);
      box([0.08, 2.2, 1], [-1.05, 1.1, 0], s.trim);
    });
  }
  // Lockers against the west wall, the hero's in the middle; a helmet on the one by the door.
  for (const z of [2.9, 4.1, 5.3]) {
    kit.prop('locker', [-11.45, 0, z], Math.PI / 2, [0.97, 1.25, 0.78], (box) =>
      box([0.97, 1.25, 0.78], [0, 0.625, 0], s.panel),
    );
  }
  kit.prop('helmet', [-11.45, 1.25, 5.3], Math.PI / 2 + 0.4, [0.32, 0.32, 0.32], () => {}, { solid: false });
  // Night lighting, warm and low: enough to see the room the hero wakes in.
  kit.light([-9.5, 2.85, 3.2], new Color3(1, 0.86, 0.72), 14, 10);
  kit.light([-9.5, 2.85, 6.2], new Color3(1, 0.82, 0.66), 11, 9);
  kit.light([-5.6, 2.85, 4.6], new Color3(1, 0.86, 0.72), 12, 9);
  kit.emergency([-6, 2.85, 6.5]);

  // The lounge: the night shift, the galley, and a window on the star.
  kit.room({
    name: 'lounge',
    x: [-4, 12],
    z: [0, 14],
    height: 3.4,
    floor: s.floor,
    wall: s.panel,
    gaps: [
      { side: 'w', from: 0, to: 8, top: 3.4 },
      { side: 'w', from: 8.8, to: 13.2, bottom: 0.8, top: 2.9, glass: true },
      { side: 'n', from: 0, to: 2 },
      { side: 'e', from: 6, to: 8 },
      { side: 's', from: 1, to: 9, bottom: 1, top: 2.6, glass: true },
    ],
  });
  addDoor(kit.door('range_door', [1, 0, 14], 2, true));
  addDoor(kit.door('east_door', [12, 0, 7], 2, false));
  // The galley along the north wall, a mess table and benches, a sofa facing the room.
  kit.prop(
    'galley',
    [8.4, 0, 13.4],
    Math.PI,
    [5.5, 1.1, 0.8],
    (box) => {
      box([5.5, 1, 0.8], [0, 0.5, 0], s.hull);
      box([5.5, 0.06, 0.85], [0, 1.03, 0], s.dark);
    },
    { fit: 'box' },
  );
  kit.solid([0.8, 1, 3.2], [11.4, 0.5, 11.8], s.hull);
  kit.prop('table', [5.2, 0, 7], 0, [2.8, 0.8, 2.6], (box) => {
    box([2.8, 0.75, 1.2], [0, 0.375, 0], s.wood);
    box([2.8, 0.45, 0.5], [0, 0.225, -1.1], s.hullDark);
    box([2.8, 0.45, 0.5], [0, 0.225, 1.1], s.hullDark);
  });
  kit.prop('sofa', [1.2, 0, 2.1], 0, [3, 0.95, 1.2], (box) => {
    box([3, 0.5, 1], [0, 0.25, 0.1], s.fabric);
    box([3, 0.7, 0.25], [0, 0.6, -0.5], s.fabric);
  });
  kit.solid([1.2, 0.4, 0.8], [1.2, 0.2, 4.4], s.wood);
  // Ilya's readings on the mess table, the supply board on the north wall, the station's map by the
  // east door, and a Cooperative poster: the station is a joint posting.
  kit.deco([0.56, 0.02, 0.32], [4.4, 0.895, 7.15], s.dark);
  kit.picture('screen-light-curve', [0.5, 0.25], [4.4, 0.91, 7.15], Math.PI, Math.PI / 2);
  kit.deco([1.6, 1, 0.04], [4.5, 1.6, 13.88], s.dark);
  for (const [x, y, w, h] of [
    [3.95, 1.82, 0.36, 0.46],
    [4.4, 1.86, 0.3, 0.3],
    [4.85, 1.78, 0.4, 0.5],
    [4.2, 1.38, 0.5, 0.34],
    [4.95, 1.34, 0.32, 0.4],
  ] as const) {
    kit.deco([w, h, 0.01], [x, y, 13.855], s.paper);
  }
  kit.picture('screen-station-map', [1.8, 0.9], [11.88, 1.7, 10.6], -Math.PI / 2);
  kit.picture('poster-cooperative', [0.8, 1.2], [-2.2, 1.6, 13.88], Math.PI);
  // A vending machine by the galley, and a rack of cylinders by the bunk room's door.
  kit.prop('vending', [11.4, 0, 2], -Math.PI / 2, [1.1, 2, 0.8], (box) => {
    box([1.1, 2, 0.8], [0, 1, 0], s.panel);
    box([0.8, 1.2, 0.05], [0, 1.2, 0.42], s.screenWarm);
  });
  // A planter along the west window.
  kit.prop('planter', [-3.5, 0, 11], Math.PI / 2, [2.6, 0.97, 0.75], (box) => {
    box([2.6, 0.6, 0.75], [0, 0.3, 0], s.hullDark);
    box([2.4, 0.3, 0.6], [0, 0.75, 0], s.plant);
  });
  for (const [x, z] of [
    [0, 4],
    [6, 4],
    [0, 10],
    [6, 10],
  ] as const) {
    kit.light([x, 3.25, z], new Color3(1, 0.9, 0.78), 7, 10);
  }
  kit.emergency([-2, 3.25, 7]);
  kit.emergency([9, 3.25, 7]);
}

function range(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('range');
  kit.room({
    name: 'range-way',
    x: [-0.5, 2.5],
    z: [14, 20],
    height: 3,
    floor: s.deck,
    wall: s.wall,
    open: ['s', 'n'],
  });
  kit.light([1, 2.85, 17]);
  kit.room({
    name: 'range',
    x: [-6, 8],
    z: [20, 34],
    height: 4.2,
    floor: s.floor,
    wall: s.wall,
    gaps: [{ side: 's', from: 0, to: 2 }],
  });
  // The range's panel, by the door, where Ren runs the drill from.
  kit.prop('terminal', [3.2, 0.75, 20.28], 0, [0.47, 0.8, 0.35], () => {}, { solid: false });
  // Low cover (1 m) and high cover (1.6 m).
  const crates: [number, number, number, number][] = [
    [-3, 22.8, 1.6, 1],
    [-2.5, 26, 1.6, 1],
    [3.5, 25.4, 2.4, 1],
    [0, 29.2, 1.2, 1.6],
    [5, 29.8, 1.2, 1.6],
  ];
  for (const [x, z, w, h] of crates) {
    kit.prop(
      'crate',
      [x, 0, z],
      0,
      [w, h, 1.2],
      (box) => box([w, h, 1.2], [0, h / 2, 0], h > 1.2 ? s.crateBlue : s.crate),
      {
        fit: 'box',
      },
    );
  }
  // Range markings on the far wall.
  for (const x of [-3, 1.5, 6]) kit.deco([1.2, 1.2, 0.04], [x, 2, 33.85], s.screen);
  for (const [x, z] of [
    [-2, 24],
    [4, 24],
    [-2, 30],
    [4, 30],
  ] as const) {
    kit.light([x, 4.05, z]);
  }
  kit.emergency([1, 4.05, 27]);
}

function spine(kit: Kit) {
  const s = kit.surfaces;
  kit.enter('spine');
  kit.room({
    name: 'spine',
    x: [12, 22],
    z: [5, 9],
    height: 3,
    floor: s.deck,
    wall: s.wall,
    open: ['w', 'e'],
    gaps: [{ side: 's', from: 13, to: 21, bottom: 0.9, top: 2.6, glass: true }],
  });
  kit.picture('sign-calder-station', [0.9, 0.9], [17, 1.7, 8.88], Math.PI);
  kit.light([15, 2.85, 7]);
  kit.light([19.5, 2.85, 7]);
  kit.emergency([17, 2.85, 8.4]);
}

function control(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('control');
  kit.room({
    name: 'control',
    x: [22, 36],
    z: [0, 16],
    height: 4,
    floor: s.floor,
    wall: s.panel,
    gaps: [
      { side: 'w', from: 5, to: 9 },
      { side: 'e', from: 3, to: 13, bottom: 1, top: 3.4, glass: true },
      { side: 'n', from: 28, to: 30 },
    ],
  });
  addDoor(kit.door('concourse_door', [29, 0, 16], 2, true));
  // The ring of desks facing the window, the chief's table, the comms console, the big screen.
  // Operators stand west of the desks, facing them and the window beyond.
  for (let i = 0; i < 5; i++) {
    const z = 3.6 + i * 2.2;
    kit.prop('console', [33.8, 0, z], -Math.PI / 2, [1.9, 1.4, 0.9], (box) => {
      box([1.9, 0.95, 0.9], [0, 0.475, 0], s.hull);
      box([1.5, 0.6, 0.05], [0, 1.3, -0.2], i % 2 ? s.screen : s.screenWarm);
    });
  }
  kit.solid([3.4, 0.95, 2], [28.4, 0.475, 9.5], s.hullDark);
  kit.deco([3, 0.04, 1.6], [28.4, 0.97, 9.5], s.dark);
  kit.picture('screen-light-curve', [2.8, 1.4], [28.4, 1.002, 9.5], Math.PI / 2, Math.PI / 2);
  kit.prop('console', [33.4, 0, 2.4], 0, [2.2, 1.4, 0.8], (box) => {
    box([2.2, 1, 0.8], [0, 0.5, 0], s.hull);
    box([2.2, 0.8, 0.05], [0, 1.5, -0.35], s.screenWarm);
  });
  // The main screen: the sweep round the star. Beside the door, the power and the doors after the failure.
  kit.deco([6, 2.6, 0.06], [29, 2.3, 15.85], s.dark);
  kit.picture('screen-sensor-sweep', [5.2, 2.6], [29, 2.3, 15.8], Math.PI);
  kit.picture('screen-power-doors', [1.6, 0.8], [26, 1.7, 0.12], 0);
  kit.picture('poster-authority', [0.8, 1.2], [22.12, 1.6, 12.4], Math.PI / 2);
  for (const [x, z] of [
    [25, 4],
    [31, 4],
    [25, 12],
    [31, 12],
  ] as const) {
    kit.light([x, 3.85, z], new Color3(0.78, 0.88, 1), 8, 10);
  }
  kit.emergency([26, 3.85, 8]);
  kit.emergency([33, 3.85, 14]);
}

function concourse(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('concourse');
  kit.room({
    name: 'concourse-way',
    x: [27.5, 30.5],
    z: [16, 22],
    height: 3.2,
    floor: s.deck,
    wall: s.wall,
    open: ['s', 'n'],
  });
  kit.light([29, 3, 19]);
  kit.room({
    name: 'concourse',
    x: [16, 44],
    z: [22, 48],
    height: 7,
    floor: s.floor,
    wall: s.panel,
    gaps: [
      { side: 's', from: 28, to: 30 },
      { side: 'w', from: 37, to: 39 },
      { side: 'w', from: 24, to: 34, bottom: 4.4, top: 6.4, glass: true },
      { side: 'w', from: 40, to: 46, bottom: 4.4, top: 6.4, glass: true },
      { side: 'e', from: 30, to: 32 },
      { side: 'n', from: 28, to: 32, top: 3.6 },
    ],
  });
  addDoor(kit.door('service_door', [44, 0, 31], 2, false));
  // The hangar gate: two leaves of a wide door, as one.
  addDoor(kit.door('hangar_gate', [30, 0, 48], 4, true));
  // Pillars, planters (low cover), benches, kiosks.
  for (const [x, z] of [
    [22, 28],
    [38, 28],
    [22, 42],
    [38, 42],
  ] as const) {
    kit.column(0.55, 7, [x, 0, z], s.hull);
  }
  for (const [x, z, w] of [
    [26, 30.5, 2.6],
    [34, 30.5, 2.6],
    [30, 36, 3.2],
    [24.5, 42.5, 2.6],
    [35.5, 42.5, 2.6],
  ] as const) {
    kit.prop(
      'planter',
      [x, 0, z],
      0,
      [w, 1.45, 1.2],
      (box) => {
        box([w, 0.95, 1.2], [0, 0.475, 0], s.hullDark);
        box([w - 0.3, 0.5, 0.9], [0, 1.2, 0], s.plant);
      },
      { fit: 'box' },
    );
  }
  // Benches along the side walls, their seats to the hall.
  for (const [x, z, yaw] of [
    [20.5, 34, Math.PI / 2],
    [40, 36.5, -Math.PI / 2],
    [20.5, 26, Math.PI / 2],
  ] as const) {
    kit.prop('bench', [x, 0, z], yaw, [2.4, 0.55, 0.6], (box) => box([2.4, 0.5, 0.6], [0, 0.25, 0], s.wood));
  }
  // Vending machines against the side walls.
  for (const [x, z, yaw] of [
    [16.55, 24.4, Math.PI / 2],
    [43.45, 39.6, -Math.PI / 2],
  ] as const) {
    kit.prop('vending', [x, 0, z], yaw, [1.1, 2, 0.8], (box) => {
      box([1.1, 2, 0.8], [0, 1, 0], s.panel);
      box([0.8, 1.2, 0.05], [0, 1.2, 0.42], s.screenWarm);
    });
  }
  // The café counter (north-west), and the comms booth (north-east), which is Pell's later.
  kit.prop(
    'galley',
    [21, 0, 45.6],
    Math.PI,
    [5, 1.1, 1],
    (box) => {
      box([5, 1.05, 1], [0, 0.525, 0], s.warm);
      box([5, 0.06, 1.05], [0, 1.08, 0], s.dark);
    },
    { fit: 'box' },
  );
  // The booth's walls, with its doorway at the east end of the south wall, clear of the hall's
  // pillar (it had none: the owner found Pell walled in, 25 October 2026).
  kit.solid([0.2, 2.6, 4.6], [38.2, 1.3, 45.3], s.hull);
  kit.solid([3.6, 2.6, 0.2], [40, 1.3, 43], s.hull, { nav: true });
  kit.prop('console', [41.8, 0, 46.9], Math.PI, [2, 1.4, 0.7], (box) => {
    box([2, 1, 0.7], [0, 0.5, 0], s.hullDark);
    box([2, 0.7, 0.05], [0, 1.4, -0.4], s.screen);
  });
  // Pell's booth: the comms, searching for a carrier that is not there.
  kit.picture('screen-comms-static', [1.6, 0.8], [41.8, 2.2, 47.88], Math.PI);
  // A gallery round the hall's upper level, seen, not walked.
  kit.deco([28, 0.3, 2], [30, 4, 47], s.hullDark);
  kit.deco([2, 0.3, 26], [17, 4, 35], s.hullDark);
  kit.deco([2, 0.3, 26], [43, 4, 35], s.hullDark);
  kit.deco([28, 0.05, 0.05], [30, 5, 46], s.stripe);
  // Signs, and the Authority's poster.
  kit.picture('sign-concourse-hangar', [2.4, 0.6], [30, 3.2, 47.88], Math.PI);
  kit.picture('sign-airlock', [2.4, 0.6], [43.88, 3, 31], -Math.PI / 2);
  kit.picture('sign-clinic', [1.6, 0.4], [16.12, 2.85, 38], Math.PI / 2);
  kit.picture('poster-authority', [0.9, 1.35], [16.12, 1.7, 27], Math.PI / 2);
  for (const [x, z] of [
    [22, 25],
    [30, 25],
    [38, 25],
    [22, 35],
    [38, 35],
    [30, 44],
  ] as const) {
    kit.light([x, 6.85, z], new Color3(0.85, 0.9, 1), 12, 14);
  }
  kit.emergency([22, 6.85, 32]);
  kit.emergency([38, 6.85, 32]);
  kit.emergency([30, 6.85, 46]);

  // The clinic, off the hall's west side: the shelter.
  kit.enter('clinic');
  kit.room({ name: 'clinic', x: [8, 16], z: [34, 44], height: 3.2, floor: s.tiles, wall: s.warm, open: ['e'] });
  addDoor(kit.door('clinic_door', [16, 0, 38], 2, false, true));
  for (const z of [35.4, 38, 40.6]) {
    kit.prop('medbed', [9.4, 0, z], 0, [2, 1.1, 0.9], (box) => {
      box([2, 0.6, 0.9], [0, 0.3, 0], s.hull);
      box([1.9, 0.12, 0.85], [0, 0.66, 0], s.fabric);
    });
  }
  kit.solid([0.6, 2, 2.4], [15.4, 1, 42.4], s.panel);
  kit.deco([0.05, 0.6, 1], [8.15, 1.8, 38], s.screen);
  kit.light([12, 3.05, 37], new Color3(0.9, 1, 0.95), 7, 9);
  kit.light([12, 3.05, 41.5], new Color3(0.9, 1, 0.95), 7, 9);
  kit.emergency([12, 3.05, 39.5]);
}

function serviceAndMast(kit: Kit, addDoor: (d: Door) => void) {
  const s = kit.surfaces;
  kit.enter('service');
  kit.room({
    name: 'service',
    x: [44, 54],
    z: [29, 33],
    height: 3,
    floor: s.deck,
    wall: s.rust,
    open: ['w'],
    gaps: [{ side: 'e', from: 30, to: 32 }],
  });
  addDoor(kit.door('airlock', [54, 0, 31], 2, false));
  for (let i = 0; i < 3; i++) kit.deco([0.15, 0.15, 3.6], [45.5 + i * 3, 2.7, 31], s.trim);
  // The airlock's panel on the wall beside it.
  kit.prop('terminal', [52.6, 0.75, 32.72], Math.PI, [0.47, 0.8, 0.35], () => {}, { solid: false });
  kit.light([47, 2.85, 31], new Color3(1, 0.8, 0.6), 6, 8);
  kit.light([51.5, 2.85, 31], new Color3(1, 0.8, 0.6), 6, 8);
  kit.emergency([49, 2.85, 32.6]);

  // Outside: the catwalk on its footings, a ramp, and the relay mast's platform.
  kit.enter('catwalk');
  kit.solid([28, 0.3, 4], [68, -0.15, 31], s.grate, { name: 'catwalk-floor' });
  for (const z of [29.05, 32.95]) {
    kit.solid([28, 1.05, 0.1], [68, 0.525, z], s.trim);
    kit.deco([28, 0.08, 0.14], [68, 1.08, z], s.stripe);
  }
  for (let x = 56; x <= 80; x += 4) {
    kit.deco([0.4, 1.4, 0.4], [x, -0.7, 29.2], s.hullDark);
    kit.deco([0.4, 1.4, 0.4], [x, -0.7, 32.8], s.hullDark);
  }
  // Crates left on the walk: cover in the open.
  kit.solid([1.4, 1, 1.2], [63, 0.5, 30.2], s.crateOrange);
  kit.solid([1.4, 1, 1.2], [73.5, 0.5, 31.8], s.crateOrange);
  // The ramp up to the platform: 10 m long, 3 m up (about 17°), its walking surface running from the
  // catwalk's floor at x 81 to the platform's edge at x 91, flush with both. (Its top once ended a
  // metre inside the platform, leaving a 30 cm step at the edge: the hero, who has no jump, could
  // not get up, nor could Ren; the owner's phone, 25 October 2026.)
  const rise = 3;
  const run = 10;
  const slope = Math.atan2(rise, run);
  const thick = 0.3;
  const length = Math.hypot(run, rise);
  // The box's centre, so that the middle of its top face is at (86, 1.5).
  const rampX = 91 - run / 2 + (thick / 2) * Math.sin(slope);
  const rampY = rise / 2 - (thick / 2) * Math.cos(slope);
  // Rolled about z so that its east end, towards the platform, is the high one.
  kit.solid([length, thick, 4], [rampX, rampY, 31], s.grate, {
    name: 'mast-ramp',
    rot: [0, 0, slope],
  });
  for (const z of [29.05, 32.95]) {
    kit.solid([length, 1.05, 0.1], [rampX, rise / 2 + 0.525, z], s.trim, { rot: [0, 0, slope] });
  }
  kit.solid([10, 0.3, 10], [96, rise - 0.15, 31], s.grate, { name: 'mast-platform' });
  for (const [x, z, w, d] of [
    [96, 26.05, 10, 0.1],
    [96, 35.95, 10, 0.1],
    [100.95, 31, 0.1, 10],
    [91.05, 27.5, 0.1, 3],
    [91.05, 34.5, 0.1, 3],
  ] as const) {
    kit.solid([w, 1.05, d], [x, rise + 0.525, z], s.trim);
  }
  // The mast: four legs, braced, rising thirty metres, a dish at the top.
  const legs: [number, number][] = [
    [96.5, 30.5],
    [98.5, 30.5],
    [96.5, 32.5],
    [98.5, 32.5],
  ];
  for (const [x, z] of legs) kit.solid([0.3, 30, 0.3], [x, rise + 15, z], s.hullDark);
  for (let y = rise + 2; y < rise + 30; y += 3) {
    kit.deco([2.3, 0.12, 0.12], [97.5, y, 30.5], s.trim);
    kit.deco([2.3, 0.12, 0.12], [97.5, y, 32.5], s.trim);
    kit.deco([0.12, 0.12, 2.3], [96.5, y + 1.5, 31.5], s.trim);
    kit.deco([0.12, 0.12, 2.3], [98.5, y + 1.5, 31.5], s.trim);
  }
  kit.prop(
    'dish',
    [97.5, rise + 30, 31.5],
    -Math.PI / 2,
    [3.2, 2.6, 3.2],
    (box) => box([3.2, 0.3, 3.2], [0, 0.15, 0], s.hull),
    {
      solid: false,
    },
  );
  kit.deco([0.4, 0.4, 0.4], [97.5, rise + 30.6, 31.5], s.red);
  // The relay console, its wheel to the west, where the ramp comes up.
  kit.prop('relay', [93.8, rise, 31], -Math.PI / 2, [1.6, 1.6, 1], (box) => {
    box([1.6, 1.1, 1], [0, 0.55, 0], s.hull);
    box([1.2, 0.6, 0.05], [0, 1.3, 0.52], s.screenWarm);
  });
  kit.light([94, rise + 2.6, 31], new Color3(1, 0.7, 0.45), 6, 8);
}

/** The hangar, and the long-haul surveyor that stands in it. Returns the ship's node, for the lift-off. */
function hangar(kit: Kit, scene: Scene): TransformNode {
  const s = kit.surfaces;
  kit.enter('hangar');
  kit.room({
    name: 'hangar-way',
    x: [28, 32],
    z: [48, 52],
    height: 3.6,
    floor: s.deck,
    wall: s.wall,
    open: ['s', 'n'],
  });
  kit.room({
    name: 'hangar',
    x: [10, 50],
    z: [52, 92],
    height: 16,
    floor: s.concrete,
    wall: s.rust,
    ceiling: null,
    gaps: [{ side: 's', from: 28, to: 32, top: 3.6 }],
  });
  // The roof: open in the middle, where the roof doors stand open on the sky.
  kit.solid([40, 0.4, 10], [30, 16.2, 57], s.hullDark, { nav: false });
  kit.solid([40, 0.4, 10], [30, 16.2, 87], s.hullDark, { nav: false });
  kit.solid([8, 0.4, 20], [14, 16.2, 72], s.hullDark, { nav: false });
  kit.solid([8, 0.4, 20], [46, 16.2, 72], s.hullDark, { nav: false });
  // Containers and crates: cover for the last stand.
  // Containers lie with their length north to south.
  for (const [x, z, look] of [
    [16, 60, s.crate],
    [44, 62, s.crateBlue],
    [15, 82, s.crateOrange],
    [45, 84, s.crate],
  ] as const) {
    kit.prop('container', [x, 0, z], Math.PI / 2, [6, 2.6, 2.4], (box) => box([6, 2.6, 2.4], [0, 1.3, 0], look), {
      fit: 'box',
    });
  }
  for (const [x, z, w] of [
    [22, 58, 2.4],
    [37, 57, 1.6],
    [19, 72, 1.6],
    [41, 73, 2.4],
    [24, 82, 1.6],
    [36, 84, 2.4],
    [30, 60, 1.6],
  ] as const) {
    kit.prop('crate', [x, 0, z], 0, [w, 1, 1.2], (box) => box([w, 1, 1.2], [0, 0.5, 0], s.crate), { fit: 'box' });
  }
  // The gate's panel, on the hangar's side.
  kit.prop('terminal', [34, 0.75, 52.28], 0, [0.47, 0.8, 0.35], () => {}, { solid: false });
  // Carts and gas cylinders by the walls.
  for (const [x, z, yaw] of [
    [35, 66, 0.3],
    [21, 79, -0.4],
  ] as const) {
    // The cart's model runs along its own z, its driver's end to the front.
    kit.prop('cart', [x, 0, z], yaw + Math.PI / 2, [1.3, 1.1, 2.4], (box) => {
      box([1.3, 0.5, 2.4], [0, 0.55, 0], s.hullDark);
      box([1.1, 0.3, 2.2], [0, 0.95, 0], s.crateOrange);
    });
  }
  for (const [x, z, yaw] of [
    [11, 66, Math.PI / 2],
    [49, 78, -Math.PI / 2],
  ] as const) {
    kit.prop('cylinders', [x, 0, z], yaw, [1.8, 1.9, 0.7], (box) => box([1.8, 1.8, 0.6], [0, 0.9, 0], s.stripe));
  }
  // Gantries along the walls, and floor markings round the pad.
  for (const x of [11, 49]) kit.deco([1.5, 0.3, 38], [x, 8, 72], s.hullDark);
  kit.deco([18, 0.02, 0.3], [30, 0.01, 66], s.stripe);
  kit.deco([18, 0.02, 0.3], [30, 0.01, 82], s.stripe);
  for (const [x, z] of [
    [16, 58],
    [30, 58],
    [44, 58],
    [16, 86],
    [30, 90],
    [44, 86],
  ] as const) {
    kit.light([x, 13, z], new Color3(0.9, 0.92, 1), 22, 22);
  }
  kit.emergency([12, 10, 72]);
  kit.emergency([48, 10, 72]);
  kit.emergency([30, 10, 54]);

  // The surveyor: a Halden long-hauler, nose to the east, armed after the fact (STORY.md).
  const ship = new TransformNode('surveyor', scene);
  ship.position.set(30, 0, 75);
  // What is seen until the model is there; the bodies people bump into stay either way.
  const look = new TransformNode('surveyor-stand-in', scene);
  look.parent = ship;
  const part = (
    size: [number, number, number],
    at: [number, number, number],
    surface: typeof s.hull,
    isSolid = false,
  ) => {
    const mesh = CreateBox('surveyor-part', { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.material = surface.material;
    mesh.parent = look;
    if (isSolid) {
      const body = CreateBox('surveyor-body', { width: size[0], height: size[1], depth: size[2] }, scene);
      body.position.set(at[0], at[1], at[2]);
      body.parent = ship;
      body.isVisible = false;
      body.computeWorldMatrix(true);
      new PhysicsAggregate(body, PhysicsShapeType.BOX, { mass: 0 }, scene);
      // The hull stands in the navigation mesh, so a companion walks round it.
      kit.navigationMeshes.push(body);
    }
    return mesh;
  };
  part([22, 4.6, 7], [0, 3.6, 0], s.hull, true);
  part([6, 3.4, 5.4], [13.6, 3.4, 0], s.hull, true);
  part([3, 1.2, 4], [14.2, 4.6, 0], s.glass);
  part([22.2, 0.5, 7.2], [0, 1.6, 0], s.hullDark);
  part([22.4, 0.3, 0.2], [0, 4.4, -3.6], s.stripe);
  part([22.4, 0.3, 0.2], [0, 4.4, 3.6], s.stripe);
  for (const z of [-2.4, 2.4]) {
    const engine = CreateCylinder('surveyor-engine', { diameter: 2.4, height: 4, tessellation: 16 }, scene);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-12.4, 3.6, z);
    engine.material = s.hullDark.material;
    engine.parent = look;
    const glow = CreateCylinder('surveyor-glow', { diameter: 1.8, height: 0.2, tessellation: 16 }, scene);
    glow.rotation.z = Math.PI / 2;
    glow.position.set(-14.45, 3.6, z);
    glow.material = s.screenWarm.material;
    glow.parent = look;
  }
  // A turret on the back, the "armed after the fact".
  const turret = CreateSphere('surveyor-turret', { diameter: 1.8, segments: 12 }, scene);
  turret.position.set(-3, 6.1, 0);
  turret.material = s.hullDark.material;
  turret.parent = look;
  part([3.2, 0.3, 0.3], [-1.4, 6.3, 0], s.hullDark);
  // Landing legs.
  for (const [x, z] of [
    [-8, -2.8],
    [-8, 2.8],
    [8, -2.8],
    [8, 2.8],
  ] as const) {
    part([0.5, 1.6, 0.5], [x, 0.8, z], s.hullDark, true);
  }
  // The open hatch and its ramp, on the ship's south side.
  part([3, 2.4, 0.1], [0, 2.9, -3.56], s.dark);
  const rampLength = Math.hypot(4, 1.5);
  const ramp = CreateBox('surveyor-ramp', { width: 3, height: 0.2, depth: rampLength }, scene);
  ramp.material = s.deck.material;
  ramp.parent = ship;
  ramp.position.set(0, 0.75, -5.6);
  // Pitched so that its north end, at the hatch, is the high one.
  ramp.rotation.x = -Math.atan2(1.5, 4);
  ramp.computeWorldMatrix(true);
  new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0 }, scene);
  kit.navigationMeshes.push(ramp);
  // The surveyor's model, nose to the east, takes the place of the boxes and moves with the ship.
  kit.prop('surveyor', [0, 0, 0], Math.PI / 2, [7.2, 6.6, 28.5], () => {}, {
    solid: false,
    parent: ship,
    standIn: look,
  });
  return ship;
}
