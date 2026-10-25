import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KINDS } from '../../src/game/weapons.ts';

const manifest = JSON.parse(readFileSync('public/assets/audio/audio.json', 'utf8')) as {
  sfx: Record<string, { file: string }>;
  music: Record<string, { file: string }>;
};

/** Every weapon sounds like itself, and fights with people have their own music (D-68; ACT1_ART.md §3). */
describe('sounds', () => {
  it('has a shot for each of the hero’s weapons, and for each side', () => {
    for (const kind of KINDS) expect(manifest.sfx[kind], kind).toBeDefined();
    for (const id of ['pistol_ally', 'banked_rifle', 'warden_charge', 'warden_fire', 'gunpost_fire'])
      expect(manifest.sfx[id], id).toBeDefined();
  });

  it('has slugs striking metal and snapping past, each in more than one take', () => {
    for (const id of ['round_hit_1', 'round_hit_2', 'round_hit_3', 'round_snap_1', 'round_snap_2'])
      expect(manifest.sfx[id], id).toBeDefined();
  });

  it('has the Banked’s fight music and the lane’s', () => {
    expect(manifest.music.combat_banked).toBeDefined();
    expect(manifest.music.combat).toBeDefined();
    expect(manifest.music.lane).toBeDefined();
  });
});
