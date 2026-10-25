import { chooseQuality, isQualityTier, type QualityTier } from '../game/quality.ts';

export const QUALITY_KEY = 'lightkeeper.quality';
export const HERO_KEY = 'lightkeeper.hero';
/** The saved game: the story's state at its last checkpoint (src/game/game.ts, SaveData). */
export const SAVE_KEY = 'lightkeeper.save';
export const DIFFICULTY_KEY = 'lightkeeper.difficulty';

/** The 2D pictures (docs/assets/IMAGES.md). */
export const PICTURES = `${import.meta.env.BASE_URL}assets/textures/`;

/** The painting shown while a chapter loads, by its checkpoint. */
export const LOADING_PICTURE: Record<string, string> = {
  night_shift: 'loading-lounge',
  range: 'loading-lounge',
  to_control: 'loading-lounge',
  control: 'loading-concourse',
  concourse: 'loading-concourse',
  escort: 'loading-concourse',
  gate: 'loading-concourse',
  mast: 'loading-mast',
  hangar: 'loading-hangar',
  bridge: 'loading-lantern',
  aboard: 'loading-lantern',
  lane: 'loading-lantern',
  pyre_dock: 'loading-pyre',
  pyre_commons: 'loading-pyre',
  pyre_clinic: 'loading-pyre',
  pyre_way: 'loading-pyre',
  pyre_stacks: 'loading-pyre',
  pyre_archive: 'loading-pyre',
  pyre_dome: 'loading-pyre',
  pyre_after: 'loading-pyre',
  pyre_dock_end: 'loading-pyre',
  pyre_aboard: 'loading-lantern',
};

/** A touch screen is the main input. */
export function isTouch(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

/** Reads the browser's storage, which may be blocked (private windows, some settings). */
export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the choice then lasts only for this visit.
  }
}

/** The quality tier: from the address, then the player's choice, then the device. */
export function startingTier(): QualityTier {
  const fromAddress = new URLSearchParams(location.search).get('quality');
  if (isQualityTier(fromAddress)) return fromAddress;
  const saved = load(QUALITY_KEY);
  if (isQualityTier(saved)) return saved;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return chooseQuality({ touch: isTouch(), memoryGb: nav.deviceMemory, cores: nav.hardwareConcurrency });
}
