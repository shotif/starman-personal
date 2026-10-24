/**
 * The slice's fights (COMBAT.md, SLICE.md), as waves: each comes from a set of vents in the place
 * (src/game/station.ts); the next comes a little after the last is down; the fight is cleared when
 * the last wave is. Pure, so the waves are tested; the game wakes the machines.
 */
export interface Wave {
  motes?: number;
  lattices?: number;
  tenders?: number;
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
