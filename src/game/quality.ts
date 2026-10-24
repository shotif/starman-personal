/**
 * Quality tiers (D-22): the same art on every device, at the settings each device can carry.
 * A phone starts low; the player can change the tier, and the choice is remembered.
 */
export type QualityTier = 'low' | 'medium' | 'high';

export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high'];

export interface QualitySettings {
  /** The highest device pixel ratio drawn; sharper screens are drawn at this and scaled up. */
  maxPixelRatio: number;
  /** Shadow map size in pixels; 0 turns shadows off. */
  shadowMapSize: number;
  /** Multisample anti-aliasing (fixed when the engine starts, so a change reloads the page). */
  antialias: boolean;
  /** How many lights each material takes into account. */
  maxLights: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { maxPixelRatio: 1, shadowMapSize: 0, antialias: false, maxLights: 4 },
  medium: { maxPixelRatio: 1.5, shadowMapSize: 1024, antialias: true, maxLights: 6 },
  high: { maxPixelRatio: 2, shadowMapSize: 2048, antialias: true, maxLights: 8 },
};

export interface DeviceHints {
  /** A touch screen is the main input. */
  touch: boolean;
  /** `navigator.deviceMemory`, in GB, where the browser reports it. */
  memoryGb?: number;
  /** `navigator.hardwareConcurrency`. */
  cores?: number;
}

/** The tier a device starts at, before the player chooses. */
export function chooseQuality(device: DeviceHints): QualityTier {
  const cores = device.cores ?? 4;
  if (device.touch) return (device.memoryGb ?? 4) >= 8 && cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}

export function nextTier(tier: QualityTier): QualityTier {
  return QUALITY_TIERS[(QUALITY_TIERS.indexOf(tier) + 1) % QUALITY_TIERS.length] ?? 'low';
}

export function isQualityTier(value: unknown): value is QualityTier {
  return typeof value === 'string' && (QUALITY_TIERS as readonly string[]).includes(value);
}
