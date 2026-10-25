/**
 * The game's places, as plain data: Calder Station (the prologue, SLICE.md) and *Lantern* (ACT1.md),
 * each built on its own and loaded one at a time. For each, the areas that tell the story where the
 * hero is and the marks where people stand and markers point; for Calder also the vents fights come
 * from, the doors and the range's drones. The builders (src/game/station.ts, src/game/lantern.ts)
 * build round them; the story's tests check every name the script uses against them. x runs east,
 * z north, y up, in metres; a mark's yaw is radians about y, 0 facing north.
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
];

export const MARKS: Record<string, MarkData> = {
  hero_start: { x: -7.2, z: 3.4, yaw: 60 * DEG },
  ren: { x: -2.6, z: 11, yaw: -90 * DEG },
  dena: { x: 8, z: 12.2, yaw: 0 },
  sorrel: { x: 5.2, z: 5.4, yaw: -90 * DEG },
  ilya: { x: 1.2, z: 3.2, yaw: 180 * DEG },
  drill: { x: 1, z: 24, yaw: 0 },
  // Finds (D-56): the range's kit box by the door, a crate in the hangar.
  range_kit: { x: 4.4, z: 21.2 },
  hangar_crate: { x: 22, z: 59.2 },
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
  // Things to look at: where each stands, for the prompt.
  window: { x: -3.3, z: 11, yaw: -90 * DEG },
  curve: { x: 4.4, z: 7.15 },
  board: { x: 4.5, z: 13.3 },
  locker: { x: -10.9, z: 4.1 },
  screen: { x: 29, z: 14.6 },
};

/** Where each fight's machines come in. */
export const VENTS: Record<string, [number, number, number][]> = {
  // Where a Banked squad comes in on the range, to try them (ACT1.md increment 4): the far end, on the floor.
  banked_range: [
    [-3, 0, 32.6],
    [0, 0, 33],
    [3, 0, 32.6],
    [-1.5, 0, 31.6],
    [1.5, 0, 31.6],
  ],
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

/**
 * *Lantern*, the surveyor: the bridge at her nose (a window on space to the west), the hold behind it
 * for the survivors of Ross 128, and a corridor aft to the stern: the crew deck's cabins to the south,
 * the mess and the med bay to the north, engineering at the end.
 */
export const LANTERN_AREAS: AreaData[] = [
  { id: 'bridge', x: [-6, 6], z: [-5, 5] },
  { id: 'hold', x: [-6, 6], z: [5, 15] },
  { id: 'corridor', x: [6, 30], z: [-1.5, 1.5] },
  { id: 'cabins', x: [8, 23], z: [-7, -1.5] },
  { id: 'store', x: [23, 28], z: [-7, -1.5] },
  { id: 'mess', x: [8, 18], z: [1.5, 9] },
  { id: 'medbay', x: [18, 24], z: [1.5, 7] },
  { id: 'engineering', x: [30, 40], z: [-6, 6] },
];

export const LANTERN_MARKS: Record<string, MarkData> = {
  bridge_hero: { x: 1.5, z: 0.5, yaw: -90 * DEG },
  bridge_ren: { x: -2.5, z: 3, yaw: -90 * DEG },
  bridge_jo: { x: -2.5, z: -2.5, yaw: -90 * DEG },
  bridge_pell: { x: 2.5, z: 3.1, yaw: 0 },
  hold_dena: { x: -1.8, z: 12.8, yaw: 160 * DEG },
  hold_sorrel: { x: 2.4, z: 11.4, yaw: -90 * DEG },
  hold_pell: { x: 3.2, z: 8.6, yaw: -120 * DEG },
  hold_ilya: { x: -3.4, z: 9, yaw: 90 * DEG },
  // Aboard between missions: each in their place.
  cabin_captain: { x: 10.5, z: -3.2, yaw: 180 * DEG },
  cabin_ren: { x: 15.5, z: -4.4, yaw: 90 * DEG },
  cabin_jo: { x: 20.5, z: -4.4, yaw: -90 * DEG },
  mess_dena: { x: 10.2, z: 7.6, yaw: 0 },
  mess_ilya: { x: 15.4, z: 4.2, yaw: -90 * DEG },
  medbay: { x: 21, z: 4, yaw: 0 },
  engineering_jo: { x: 34.5, z: 2.6, yaw: 90 * DEG },
  engineering_sorrel: { x: 33, z: -3.6, yaw: 180 * DEG },
  // The armoury: the store's lockers (D-56); and two finds aboard.
  armoury: { x: 25.4, z: -5.3, yaw: 180 * DEG },
  captain_desk: { x: 9, z: -4, yaw: -90 * DEG },
  engineering_bench: { x: 31.6, z: -4.4 },
  // The navigation station, where a course is set; and the old captain's locker.
  starmap: { x: 2.5, z: -3.1, yaw: 180 * DEG },
  captain_locker: { x: 12, z: -4.4 },
  // After Pyre Remnant (PYRE.md): the captain back aboard, the doctor in her med bay, the unlisted in the hold.
  aboard_hero: { x: -1.4, z: 6.2, yaw: 0 },
  medbay_mira: { x: 20.6, z: 3.2, yaw: 30 * DEG },
  hold_nell: { x: -3.6, z: 12.6, yaw: 120 * DEG },
  hold_ref1: { x: 3.8, z: 13.4, yaw: -150 * DEG },
  hold_ref2: { x: -0.4, z: 8.4, yaw: 20 * DEG },
  hold_ref3: { x: 1.6, z: 13.8, yaw: 170 * DEG },
};

/**
 * Pyre Remnant Station (PYRE.md), the Cooperative's observatory inside what is left of the star Pyre:
 * the dock to the south, where *Lantern* lies at berth four; the commons over it, its great window to
 * the west; the committee room, the clinic and the overflow round the commons; the spine north to the
 * archive (west) and the dome walk (east) out to the observatory dome; and the freight way, a service
 * tunnel up the west side from the dock to the archive's cargo landing.
 */
export const PYRE_AREAS: AreaData[] = [
  { id: 'dock', x: [-16, 16], z: [-32, -10] },
  { id: 'freight_way', x: [-46, -16], z: [-26, 22] },
  { id: 'commons', x: [-20, 20], z: [-10, 18] },
  { id: 'committee', x: [-20, -8], z: [18, 30] },
  { id: 'pyre_clinic', x: [20, 36], z: [0, 12] },
  { id: 'overflow', x: [20, 36], z: [-10, 0] },
  { id: 'pyre_spine', x: [-3, 3], z: [18, 58] },
  { id: 'front_hall', x: [-20, -3], z: [34, 46] },
  { id: 'reading_room', x: [-20, -3], z: [46, 58] },
  { id: 'stacks', x: [-46, -20], z: [34, 58] },
  { id: 'landing', x: [-46, -34], z: [22, 34] },
  { id: 'core', x: [-46, -30], z: [58, 70] },
  { id: 'dome_walk', x: [3, 60], z: [36, 40] },
  { id: 'dome', x: [60, 86], z: [25, 51] },
];

/**
 * How Pyre's areas join, and the door between them where there is one. A doorway is passable only
 * while its door is open: the story opens and closes them. The story's tests use this to check that
 * every place it sends the hero to can be reached from where the hero is, on every route.
 */
export const PYRE_LINKS: readonly [string, string, string | null][] = [
  ['dock', 'commons', 'customs_gate'],
  ['dock', 'freight_way', 'freight_door'],
  ['commons', 'committee', 'committee_door'],
  ['commons', 'pyre_clinic', 'mira_door'],
  ['pyre_clinic', 'overflow', null],
  ['commons', 'pyre_spine', null],
  ['pyre_spine', 'front_hall', 'archive_front'],
  ['pyre_spine', 'reading_room', 'reading_door'],
  ['pyre_spine', 'dome_walk', null],
  ['dome_walk', 'dome', 'dome_door'],
  ['front_hall', 'stacks', null],
  ['reading_room', 'stacks', 'stacks_door'],
  ['stacks', 'core', 'core_door'],
  ['stacks', 'landing', null],
  ['landing', 'freight_way', 'landing_door'],
];

export const PYRE_MARKS: Record<string, MarkData> = {
  // The dock: in through berth four, Matti at the gate, the auditors' crates by the freight way.
  pyre_dock_hero: { x: 12, z: -28.8, yaw: 0 },
  matti_gate: { x: 1.8, z: -11.8, yaw: 180 * DEG },
  matti_booth: { x: 9.4, z: -12.6, yaw: 180 * DEG },
  dock_crates: { x: -10.6, z: -19.4 },
  freight_head: { x: -14.4, z: -24 },
  berth: { x: 12, z: -30.6, yaw: 180 * DEG },
  dock_window: { x: -4, z: -30.6, yaw: 180 * DEG },
  // The dock at the end: the Banked's ship at berth two, everyone watching.
  dock_end_hero: { x: 2, z: -20, yaw: -90 * DEG },
  dock_quaye: { x: -7, z: -24, yaw: 90 * DEG },
  dock_ruth: { x: 3.4, z: -14.6, yaw: 180 * DEG },
  dock_mira: { x: 5.6, z: -21.6, yaw: -90 * DEG },
  dock_linde: { x: -0.6, z: -15.4, yaw: 180 * DEG },
  dock_sorrel: { x: 11.6, z: -27.6, yaw: -40 * DEG },
  dock_esben: { x: -9.6, z: -27, yaw: 180 * DEG },
  banked_berth: { x: -12, z: -31 },
  dock_nell: { x: -8.4, z: -19, yaw: 180 * DEG },
  dock_ref1: { x: -6.6, z: -18.2, yaw: 180 * DEG },
  dock_ref2: { x: -10, z: -18.4, yaw: 180 * DEG },
  dock_ref3: { x: -7.4, z: -19.8, yaw: 180 * DEG },
  // The commons: Quaye at his lectern by the great window, his listeners, Tilly's stall, the board.
  commons_entry: { x: 0, z: -5.2, yaw: 0 },
  quaye_lectern: { x: -18.5, z: 4, yaw: 90 * DEG },
  crowd1: { x: -11.2, z: 1, yaw: -95 * DEG },
  crowd2: { x: -10.4, z: 4.6, yaw: -100 * DEG },
  crowd3: { x: -11.6, z: 7.6, yaw: -75 * DEG },
  crowd4: { x: -8.8, z: 2.4, yaw: -90 * DEG },
  tilly: { x: 17.6, z: -3, yaw: -90 * DEG },
  tilly_stall: { x: 15.4, z: -3 },
  notice: { x: 6, z: 17.2 },
  remnant_window: { x: -18.6, z: 10.4 },
  fomalhaut_window: { x: -18.6, z: -4.6 },
  // The committee room, Ruth's desk, and the hearing at the round table.
  ruth_office: { x: -11, z: 27, yaw: 180 * DEG },
  ruth_desk: { x: -9.8, z: 28.6 },
  hearing_hero: { x: -14, z: 20.8, yaw: 0 },
  hearing_ruth: { x: -14, z: 27.2, yaw: 180 * DEG },
  hearing_nell: { x: -17.2, z: 20.6, yaw: 30 * DEG },
  // The clinic: Lenz at its door in the commons, Mira inside, her patients' charts.
  lenz: { x: 18.2, z: 4.2, yaw: -90 * DEG },
  mira_clinic: { x: 27.6, z: 8, yaw: -90 * DEG },
  clinic_hero: { x: 23.4, z: 6.6, yaw: 90 * DEG },
  clinic_nell: { x: 23.6, z: 1.6, yaw: 10 * DEG },
  charts: { x: 33.6, z: 10.6 },
  // The overflow: Nell, her people, their sapling and the children's drawing.
  nell: { x: 26, z: -4.6, yaw: 0 },
  ref1: { x: 23.2, z: -7, yaw: 50 * DEG },
  ref2: { x: 30.4, z: -2.6, yaw: -100 * DEG },
  ref3: { x: 33, z: -7.6, yaw: -40 * DEG },
  drawing: { x: 35, z: -4.4 },
  // The spine and the archive's doors: the auditors at the front, Linde by the reading room's.
  spine_mid: { x: 0, z: 27, yaw: 0 },
  aud1: { x: -1.6, z: 36.4, yaw: 90 * DEG },
  aud2: { x: -1.6, z: 39.6, yaw: 90 * DEG },
  linde_door: { x: -1.6, z: 48.4, yaw: 90 * DEG },
  way_front: { x: -2.2, z: 38 },
  way_stacks: { x: -2.2, z: 51 },
  // Inside the archive.
  front_hall_hero: { x: -5, z: 38.2, yaw: -90 * DEG },
  reading_hero: { x: -6, z: 51, yaw: -90 * DEG },
  reading_linde: { x: -8.4, z: 53.4, yaw: -90 * DEG },
  stacks_quiet: { x: -21.4, z: 52.6, yaw: -90 * DEG },
  landing_hero: { x: -44, z: 23.6, yaw: 0 },
  audit_list: { x: -7.8, z: 41 },
  esben: { x: -38, z: 56, yaw: 180 * DEG },
  core_hero: { x: -38, z: 60.6, yaw: 0 },
  core_linde: { x: -34.4, z: 66, yaw: 180 * DEG },
  core_mira: { x: -41.6, z: 66, yaw: 180 * DEG },
  core_esben: { x: -44.4, z: 68.4, yaw: 90 * DEG },
  // Afterwards, in the reading room.
  after_hero: { x: -7.6, z: 50, yaw: -90 * DEG },
  after_mira: { x: -13.4, z: 52.4, yaw: 90 * DEG },
  after_linde: { x: -12, z: 48.6, yaw: 90 * DEG },
  // The dome walk and the dome: Joost and his crew under the great mirror.
  walk_start: { x: 1.6, z: 38, yaw: 90 * DEG },
  walk_mid: { x: 30, z: 38, yaw: 90 * DEG },
  dome_hero: { x: 63, z: 38, yaw: 90 * DEG },
  joost: { x: 77.6, z: 44.6, yaw: -120 * DEG },
  dome1: { x: 81, z: 33, yaw: -60 * DEG },
  dome2: { x: 68.4, z: 47.6, yaw: 180 * DEG },
};

/** Where Pyre's fights come in: the Banked on foot (floor points), the engines' motes in the air. */
export const PYRE_VENTS: Record<string, [number, number, number][]> = {
  pyre_front: [
    [-17, 0, 37.4],
    [-17.4, 0, 41.6],
    [-13.6, 0, 44.4],
    [-12, 0, 35.6],
    [-18.4, 0, 39.4],
  ],
  pyre_quiet: [
    [-31, 0, 48.6],
    [-34, 0, 53.6],
    [-28, 0, 40.6],
    [-37, 0, 44.6],
  ],
  pyre_cargo: [
    [-38, 0, 30],
    [-36, 0, 26],
    [-40.6, 0, 32.4],
    [-36.6, 0, 33],
  ],
  pyre_stacks: [
    [-40, 0, 52.6],
    [-30, 0, 55.4],
    [-44, 0, 48.6],
    [-26, 0, 49.4],
    [-36, 0, 56.6],
  ],
  pyre_core: [
    [-40, 0, 49.2],
    [-36, 0, 48.6],
    [-30, 0, 52.6],
    [-44, 0, 54.6],
    [-34, 0, 56.6],
  ],
  pyre_walk: [
    [44, 2.4, 38],
    [52, 2.6, 37.4],
    [57, 2.4, 38.6],
  ],
  pyre_dome: [
    [82, 0, 30],
    [84, 0, 40],
    [80, 0, 48],
    [75, 0, 27],
    [85, 0, 35],
    [70, 6, 34],
    [79, 6, 31],
  ],
};

/** Pyre Remnant's doors. */
export const PYRE_DOORS = [
  'customs_gate',
  'freight_door',
  'berth_door',
  'berth_two',
  'committee_door',
  'mira_door',
  'archive_front',
  'reading_door',
  'stacks_door',
  'landing_door',
  'core_door',
  'dome_door',
];

/** Pyre Remnant's people; the extras (`crowd`, `ref`, `aud`, `dome`) do not speak but the heckler. */
export const PYRE_CAST = [
  'mira',
  'linde',
  'ruth',
  'quaye',
  'matti',
  'nell',
  'tilly',
  'joost',
  'esben',
  'lenz',
  'crowd1',
  'crowd2',
  'crowd3',
  'crowd4',
  'ref1',
  'ref2',
  'ref3',
  'aud1',
  'aud2',
  'dome1',
  'dome2',
];
/** Every door and every person of every place, for checking the names the story uses. */
export const ALL_DOORS = [...DOORS, ...PYRE_DOORS];
export const ALL_CAST = [...CAST, ...PYRE_CAST];

export type PlaceId = 'calder' | 'lantern' | 'pyre';

/** Each place's areas and marks, and the mark the hero starts at when nothing else places them. */
export const PLACES: Record<PlaceId, { areas: AreaData[]; marks: Record<string, MarkData>; start: string }> = {
  calder: { areas: AREAS, marks: MARKS, start: 'hero_start' },
  lantern: { areas: LANTERN_AREAS, marks: LANTERN_MARKS, start: 'bridge_hero' },
  pyre: { areas: PYRE_AREAS, marks: PYRE_MARKS, start: 'pyre_dock_hero' },
};

/** Every mark of every place, for checking the names the story uses. */
export const ALL_MARKS: Record<string, MarkData> = { ...MARKS, ...LANTERN_MARKS, ...PYRE_MARKS };

/**
 * Who is in each place: the people dressed when it loads (a phone holds no one it does not need).
 * The companions are everywhere.
 */
export const PEOPLE_OF: Record<PlaceId, string[]> = {
  calder: ['hale', 'pell', 'dena', 'sorrel', 'ilya'],
  lantern: ['pell', 'dena', 'sorrel', 'ilya', 'nell', 'ref1', 'ref2', 'ref3'],
  pyre: ['sorrel', ...PYRE_CAST.filter((id) => id !== 'mira')],
};

/** Where a chapter (its checkpoint) is played: the prologue at Calder, from its end aboard *Lantern*. */
const CHAPTER_PLACE: Record<string, PlaceId> = {
  bridge: 'lantern',
  aboard: 'lantern',
  lane: 'lantern',
  pyre_aboard: 'lantern',
};
export const placeOf = (checkpoint: string | null | undefined): PlaceId =>
  (checkpoint && CHAPTER_PLACE[checkpoint]) || (checkpoint?.startsWith('pyre_') ? 'pyre' : 'calder');

/** The knot of the story a chapter is a stitch of: the prologue's `slice`, or Pyre Remnant's `pyre`. */
export const knotOf = (checkpoint: string): string => (checkpoint.startsWith('pyre_') ? 'pyre' : 'slice');

/** The area a point is in, or null. */
export function areaAt(p: { x: number; y: number; z: number }, areas: readonly AreaData[] = AREAS): string | null {
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i];
    if (!a) continue;
    const inY = !a.y || (p.y >= a.y[0] && p.y <= a.y[1]);
    if (inY && p.x >= a.x[0] && p.x <= a.x[1] && p.z >= a.z[0] && p.z <= a.z[1]) return a.id;
  }
  return null;
}
