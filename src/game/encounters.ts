/**
 * The slice's fights (COMBAT.md, SLICE.md), as waves: each comes from a set of vents in the place
 * (src/game/station.ts); the next comes a little after the last is down; the fight is cleared when
 * the last wave is. Pure, so the waves are tested; the game wakes the machines.
 */
export interface Wave {
  motes?: number;
  lattices?: number;
  tenders?: number;
  /** The Banked (ACT1.md increment 4), who come in on foot at the vents' points. */
  troopers?: number;
  engineers?: number;
  wardens?: number;
  /** Which vents they come from (the place's `vents`). */
  vents: string;
}

export const ENCOUNTERS: Record<string, Wave[]> = {
  concourse_1: [{ motes: 3, vents: 'concourse_1' }],
  catwalk: [
    { motes: 3, vents: 'catwalk' },
    { motes: 2, lattices: 1, vents: 'catwalk' },
  ],
  // The machines that reached the clinic come back out into the hall as the hero returns.
  clinic: [
    { motes: 3, vents: 'concourse_2' },
    { motes: 3, lattices: 1, vents: 'escort' },
  ],
  escort: [
    { motes: 4, vents: 'escort' },
    { motes: 2, lattices: 1, vents: 'concourse_2' },
  ],
  hangar_1: [
    { motes: 5, vents: 'hangar_1' },
    { motes: 3, lattices: 1, vents: 'hangar_2' },
  ],
  hangar_2: [{ tenders: 1, motes: 2, lattices: 1, vents: 'hangar_2' }],
  // A squad of the Banked on Calder's range, to try them before Pyre Remnant (`?banked`).
  banked_drill: [
    { troopers: 2, engineers: 1, vents: 'banked_range' },
    { troopers: 1, wardens: 1, vents: 'banked_range' },
  ],
  // Pyre Remnant (PYRE.md §6). The way in, by whichever door the hero won; `_warned` when Ren's file
  // told the Lane Office Lantern was coming, and the Banked are one more and ready.
  pyre_front: [
    { troopers: 2, engineers: 1, vents: 'pyre_front' },
    { troopers: 1, wardens: 1, vents: 'pyre_front' },
  ],
  pyre_front_warned: [
    { troopers: 3, engineers: 1, vents: 'pyre_front' },
    { troopers: 1, wardens: 1, vents: 'pyre_front' },
  ],
  pyre_quiet: [
    { troopers: 2, vents: 'pyre_quiet' },
    { troopers: 1, engineers: 1, vents: 'pyre_quiet' },
  ],
  pyre_quiet_warned: [
    { troopers: 3, vents: 'pyre_quiet' },
    { troopers: 1, engineers: 1, vents: 'pyre_quiet' },
  ],
  pyre_cargo: [{ troopers: 3, engineers: 1, vents: 'pyre_cargo' }],
  pyre_cargo_warned: [
    { troopers: 3, engineers: 1, vents: 'pyre_cargo' },
    { troopers: 1, vents: 'pyre_cargo' },
  ],
  // The stacks, to the core: the motes at the Banked's call, then the warden with Esben behind him.
  pyre_stacks_1: [{ troopers: 3, engineers: 1, vents: 'pyre_stacks' }],
  pyre_stacks_2: [{ troopers: 1, wardens: 1, vents: 'pyre_stacks' }],
  // The cost: the core held while the cores are pulled, or the dome walk and the dome.
  pyre_core_1: [{ troopers: 3, engineers: 1, vents: 'pyre_core' }],
  pyre_core_2: [{ troopers: 2, wardens: 1, vents: 'pyre_core' }],
  pyre_walk: [
    { motes: 3, vents: 'pyre_walk' },
    { motes: 2, vents: 'pyre_walk' },
  ],
  pyre_dome: [
    { troopers: 3, engineers: 1, vents: 'pyre_dome' },
    { troopers: 1, wardens: 1, motes: 2, vents: 'pyre_dome' },
  ],
};

/** Seconds between one wave going down and the next coming in. */
export const WAVE_PAUSE = 2.5;

export type Fight = { id: string; wave: number; pause: number; started: boolean };

export function startFight(id: string): Fight {
  return { id, wave: 0, pause: 0.8, started: false };
}

/**
 * One step of a fight: sends the next wave in when the last is down (after a pause), and says when
 * the fight is cleared.
 */
export function fightStep(
  fight: Fight,
  live: number,
  dt: number,
): { fight: Fight; wake: Wave | null; cleared: boolean } {
  const waves = ENCOUNTERS[fight.id] ?? [];
  if (fight.started && live > 0) return { fight, wake: null, cleared: false };
  if (fight.started && fight.wave >= waves.length - 1) return { fight, wake: null, cleared: true };
  const pause = fight.pause - dt;
  if (pause > 0) return { fight: { ...fight, pause }, wake: null, cleared: false };
  const index = fight.started ? fight.wave + 1 : 0;
  const wave = waves[index] ?? null;
  if (!wave) return { fight, wake: null, cleared: true };
  return { fight: { id: fight.id, wave: index, pause: WAVE_PAUSE, started: true }, wake: wave, cleared: false };
}
