/**
 * Calder Station's named places, as plain data (SLICE.md): the areas that tell the story where the
 * hero is, the marks where people stand and markers point, the vents fights come from, the doors,
 * and the cast. The station (src/game/station.ts) builds round them; the story's tests check every
 * name the script uses against them. x runs east, z north, y up, in metres; a mark's yaw is radians
 * about y, 0 facing north.
 */
export interface AreaData {
  id: string;
  x: [number, number];
  z: [number, number];
  /** Floor and ceiling, when the area is not at ground level. */
  y?: [number, number];
}

export interface MarkData {
  x: number;
  z: number;
  y?: number;
  yaw?: number;
}

/** The bridge's offset from the station: far enough that neither sees the other. */
export const BRIDGE_Z = -2000;

const DEG = Math.PI / 180;

/** Listed from the outside in: the last that holds a point is the one it is in. */
export const AREAS: AreaData[] = [
  { id: 'bunks', x: [-12, -4], z: [0, 8] },
  { id: 'lounge', x: [-4, 12], z: [0, 14] },
  { id: 'range', x: [-6, 8], z: [14, 34] },
  { id: 'spine', x: [12, 22], z: [5, 9] },
  { id: 'control', x: [22, 36], z: [0, 16] },
  { id: 'concourse', x: [16, 44], z: [16, 48] },
  { id: 'clinic', x: [8, 16], z: [34, 44] },
  { id: 'service', x: [44, 54], z: [29, 33] },
  { id: 'catwalk', x: [54, 92], z: [26, 36] },
  { id: 'mast', x: [92, 100], z: [26, 36], y: [2, 8] },
  { id: 'hangar', x: [10, 50], z: [48, 92] },
  { id: 'ramp', x: [27.5, 32.5], z: [66.5, 70.6] },
  { id: 'bridge', x: [-6, 6], z: [BRIDGE_Z - 6, BRIDGE_Z + 5] },
  { id: 'hold', x: [-6, 6], z: [BRIDGE_Z + 5, BRIDGE_Z + 15] },
];

export const MARKS: Record<string, MarkData> = {
  hero_start: { x: -7.2, z: 3.4, yaw: 60 * DEG },
  ren: { x: -2.6, z: 11, yaw: -90 * DEG },
  dena: { x: 8, z: 12.2, yaw: 0 },
  sorrel: { x: 5.2, z: 5.4, yaw: -90 * DEG },
  ilya: { x: 1.2, z: 3.2, yaw: 180 * DEG },
  drill: { x: 1, z: 24, yaw: 0 },
  hale: { x: 31.2, z: 9.5, yaw: -90 * DEG },
  pell: { x: 33.4, z: 3.7, yaw: 180 * DEG },
  control: { x: 25, z: 7, yaw: 90 * DEG },
  concourse: { x: 29, z: 24, yaw: 0 },
  booth: { x: 40.5, z: 44.2, yaw: 120 * DEG },
  clinic: { x: 12, z: 39, yaw: 90 * DEG },
  clinic_dena: { x: 10.4, z: 41.6, yaw: 90 * DEG },
  clinic_sorrel: { x: 11, z: 36.2, yaw: 0 },
  clinic_ilya: { x: 13.6, z: 42.4, yaw: 180 * DEG },
  clinic_pell: { x: 14, z: 37.6, yaw: 90 * DEG },
  catwalk: { x: 60, z: 31, yaw: 90 * DEG },
  relay: { x: 94.6, z: 31, y: 3, yaw: 90 * DEG },
  hangar_gate: { x: 30, z: 46, yaw: 0 },
  // The night shift behind the hero at the gate and in the hangar, each on a spot of their own.
  gate_dena: { x: 28.6, z: 43.6 },
  gate_sorrel: { x: 31.4, z: 43.6 },
  gate_pell: { x: 29.2, z: 42.2 },
  gate_ilya: { x: 30.8, z: 42.2 },
  hangar_dena: { x: 28.4, z: 55.2 },
  hangar_sorrel: { x: 31.6, z: 55.2 },
  hangar_pell: { x: 29, z: 53.8 },
  hangar_ilya: { x: 31, z: 53.8 },
  hangar: { x: 30, z: 57, yaw: 0 },
  jo: { x: 24, z: 66, yaw: 90 * DEG },
  ramp: { x: 30, z: 67.6, yaw: 0 },
  boarding: { x: 30, z: 70.6, y: 1.4, yaw: 0 },
  bridge_hero: { x: 1.5, z: BRIDGE_Z + 0.5, yaw: -90 * DEG },
  bridge_ren: { x: -2.5, z: BRIDGE_Z + 3, yaw: -90 * DEG },
  bridge_jo: { x: -2.5, z: BRIDGE_Z - 2.5, yaw: -90 * DEG },
  hold_dena: { x: -1.8, z: BRIDGE_Z + 12.8, yaw: 160 * DEG },
  hold_sorrel: { x: 2.4, z: BRIDGE_Z + 11.4, yaw: -90 * DEG },
  hold_pell: { x: 3.2, z: BRIDGE_Z + 8.6, yaw: -120 * DEG },
  hold_ilya: { x: -3.4, z: BRIDGE_Z + 9, yaw: 90 * DEG },
  // Things to look at: where each stands, for the prompt.
  window: { x: -3.3, z: 11, yaw: -90 * DEG },
  curve: { x: 4.4, z: 7.15 },
  board: { x: 4.5, z: 13.3 },
  locker: { x: -10.9, z: 4.1 },
  screen: { x: 29, z: 14.6 },
};

/** Where each fight's machines come in. */
export const VENTS: Record<string, [number, number, number][]> = {
  concourse_1: [
    [43, 5.5, 26],
    [43, 5.5, 44],
    [30, 6.4, 47.4],
  ],
  concourse_2: [
    [17, 5.5, 30],
    [43, 5.5, 26],
    [17, 5.5, 46],
    [43, 5.5, 44],
    [30, 6.4, 47.4],
    [36, 6.4, 23],
  ],
  catwalk: [
    [66, 8, 42],
    [74, 9, 20],
    [86, 10, 42],
    [60, 7, 20],
    [95, 12, 22],
  ],
  clinic: [
    [9, 2.6, 43],
    [15, 2.6, 35],
    [9, 2.6, 35],
  ],
  escort: [
    [43, 5.5, 26],
    [17, 5.5, 46],
    [30, 6.4, 47.4],
    [43, 5.5, 44],
  ],
  hangar_1: [
    [20, 14, 60],
    [40, 14, 60],
    [20, 14, 86],
    [40, 14, 86],
    [30, 15, 64],
  ],
  hangar_2: [
    [12, 8, 70],
    [48, 8, 70],
    [20, 14, 86],
    [40, 14, 86],
    [30, 15, 88],
    [40, 14, 60],
  ],
};

export const DOORS = [
  'range_door',
  'east_door',
  'concourse_door',
  'service_door',
  'airlock',
  'hangar_gate',
  'clinic_door',
];

/** The people of the slice; `hero` is the player. */
export const CAST = ['hero', 'ren', 'jo', 'hale', 'pell', 'dena', 'sorrel', 'ilya'];

/** The range's drones. */
export const DRONES: [number, number, number][] = [
  [-3, 1.7, 32.4],
  [1.5, 1.9, 32.8],
  [6, 1.4, 31],
];

/** The area a point is in, or null. */
export function areaAt(p: { x: number; y: number; z: number }): string | null {
  for (let i = AREAS.length - 1; i >= 0; i--) {
    const a = AREAS[i];
    if (!a) continue;
    const inY = !a.y || (p.y >= a.y[0] && p.y <= a.y[1]);
    if (inY && p.x >= a.x[0] && p.x <= a.x[1] && p.z >= a.z[0] && p.z <= a.z[1]) return a.id;
  }
  return null;
}
