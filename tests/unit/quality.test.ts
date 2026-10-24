import { describe, expect, it } from 'vitest';
import { chooseQuality, isQualityTier, nextTier, QUALITY, QUALITY_TIERS } from '../../src/game/quality.ts';

describe('quality tiers', () => {
  it('starts phones low unless they are strong', () => {
    expect(chooseQuality({ touch: true })).toBe('low');
    expect(chooseQuality({ touch: true, memoryGb: 8, cores: 8 })).toBe('medium');
  });
  it('starts desktops at medium or high', () => {
    expect(chooseQuality({ touch: false, cores: 4 })).toBe('medium');
    expect(chooseQuality({ touch: false, cores: 12 })).toBe('high');
  });
  it('cycles through every tier', () => {
    expect(QUALITY_TIERS.map(nextTier)).toEqual(['medium', 'high', 'low']);
  });
  it('rises in cost from low to high', () => {
    expect(QUALITY.low.shadowMapSize).toBe(0);
    expect(QUALITY.high.shadowMapSize).toBeGreaterThan(QUALITY.medium.shadowMapSize);
    expect(QUALITY.high.maxPixelRatio).toBeGreaterThan(QUALITY.low.maxPixelRatio);
  });
  it('recognises stored values', () => {
    expect(isQualityTier('low')).toBe(true);
    expect(isQualityTier('ultra')).toBe(false);
    expect(isQualityTier(null)).toBe(false);
  });
});
