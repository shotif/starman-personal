import { describe, expect, it } from 'vitest';
import { CLASSES } from '../../src/game/hero.ts';
import {
  carriedWeight,
  carry,
  damageAt,
  fitMod,
  fitted,
  KINDS,
  MODS,
  modsOn,
  newKit,
  soundKit,
  spreadAfter,
  swap,
  TRAINED,
  take,
  WEAPONS,
  weightScale,
} from '../../src/game/weapons.ts';

describe('the four weapons (D-56)', () => {
  it('differ as the design says: rate, damage, reach, spread and weight', () => {
    expect(1 / WEAPONS.pistol.interval).toBeCloseTo(4.5, 0);
    expect(1 / WEAPONS.rifle.interval).toBeCloseTo(9, 0);
    expect(WEAPONS.shotgun.pellets * WEAPONS.shotgun.damage).toBe(112);
    expect(WEAPONS.marksman.damage).toBe(120);
    expect(WEAPONS.marksman.reach).toBe(120);
    expect(KINDS.map((k) => WEAPONS[k].weight)).toEqual([1, 2, 2, 3]);
    // The marksman rifle narrows the view; the rifle strays the longer it fires.
    expect(WEAPONS.marksman.zoom).toBeLessThan(WEAPONS.pistol.zoom);
    expect(spreadAfter(WEAPONS.rifle, 0)).toBe(WEAPONS.rifle.spread);
    expect(spreadAfter(WEAPONS.rifle, 0.5)).toBeGreaterThan(WEAPONS.rifle.spread);
    expect(spreadAfter(WEAPONS.rifle, 10)).toBe(WEAPONS.rifle.spreadMax);
  });

  it('trains every class in the pistol and in two or three kinds in all (D-10)', () => {
    for (const c of CLASSES) {
      const kinds = TRAINED[c.id] ?? [];
      expect(kinds, c.id).toContain('pistol');
      expect(kinds.length, c.id).toBeGreaterThanOrEqual(2);
    }
    expect(TRAINED.breacher).toHaveLength(4);
    expect(TRAINED.shade).toContain('marksman');
    expect(TRAINED.fieldwright).not.toContain('rifle');
  });

  it('weakens the shotgun’s slugs past twelve metres, to a third at twice that', () => {
    expect(damageAt(WEAPONS.shotgun, 5)).toBe(14);
    expect(damageAt(WEAPONS.shotgun, 18)).toBeCloseTo(14 * (1 - 0.5 * (2 / 3)));
    expect(damageAt(WEAPONS.shotgun, 40)).toBeCloseTo(14 / 3);
    expect(damageAt(WEAPONS.pistol, 59)).toBe(34);
  });

  it('makes weight slow the powers above three', () => {
    expect(weightScale(3)).toBe(1);
    expect(weightScale(5)).toBeCloseTo(1.2);
    expect(weightScale(1)).toBe(1);
  });
});

describe('mods', () => {
  it('change a weapon as each says, two at most, each where it fits', () => {
    expect(fitted('marksman', ['scope']).zoom).toBeCloseTo(WEAPONS.marksman.zoom * 0.75);
    expect(fitted('pistol', ['scope']).mods).toEqual([]);
    expect(fitted('rifle', ['stabiliser']).spreadMax).toBeCloseTo(WEAPONS.rifle.spreadMax * (2 / 3));
    const heavy = fitted('pistol', ['heavy']);
    expect(heavy.plateBonus).toBe(0.25);
    expect(heavy.weight).toBe(1.5);
    expect(fitted('shotgun', ['barrel']).falloff).toBeCloseTo(16);
    expect(fitted('rifle', ['coil']).interval).toBeCloseTo(0.11 * (6 / 7));
    expect(fitted('rifle', ['coil', 'heavy', 'barrel']).mods).toEqual(['coil', 'heavy']);
    for (const m of Object.values(MODS)) expect(m.fits.length).toBeGreaterThan(0);
  });
});

describe('the kit', () => {
  it('starts with the pistol, carries two trained ones, swaps, and weighs what it carries', () => {
    let kit = newKit();
    expect(kit.carried).toEqual(['pistol', null]);
    kit = take(kit, 'armoury:rifle', 'rifle');
    kit = take(kit, 'armoury:shotgun', 'shotgun');
    expect(kit.weapons).toEqual(['pistol', 'rifle', 'shotgun']);
    // A Rigger is not trained in the shotgun.
    expect(carry(kit, 'rigger', 'shotgun', 'pistol')).toBe(kit);
    kit = carry(kit, 'rigger', 'rifle', 'shotgun');
    expect(kit.carried).toEqual(['rifle', null]);
    kit = carry(kit, 'striker', 'rifle', 'shotgun');
    expect(kit.carried).toEqual(['rifle', 'shotgun']);
    expect(carriedWeight(kit)).toBe(4);
    expect(swap(kit).carried).toEqual(['shotgun', 'rifle']);
    expect(swap(newKit())).toEqual(newKit());
  });

  it('gives each find once, and fits mods only where they fit, two to a weapon', () => {
    let kit = take(newKit(), 'find:range_stabiliser', 'stabiliser');
    expect(take(kit, 'find:range_stabiliser', 'stabiliser')).toBe(kit);
    kit = take(kit, 'find:captain_scope', 'scope');
    kit = take(kit, 'find:hangar_heavy', 'heavy');
    expect(fitMod(kit, 'scope', 'pistol')).toBe(kit);
    kit = fitMod(kit, 'stabiliser', 'pistol');
    kit = fitMod(kit, 'heavy', 'pistol');
    expect(modsOn(kit, 'pistol')).toEqual(['stabiliser', 'heavy']);
    // A third will not go on.
    kit = take(kit, 'find:engineering_coil', 'coil');
    expect(fitMod(kit, 'coil', 'pistol')).toBe(kit);
    kit = fitMod(kit, 'heavy', null);
    expect(modsOn(kit, 'pistol')).toEqual(['stabiliser']);
  });

  it('makes a save’s kit sound', () => {
    const kit = soundKit(
      {
        weapons: ['rifle', 'laser' as never],
        carried: ['rifle', 'rifle'],
        mods: [
          { id: 'scope', on: 'rifle' },
          { id: 'scope', on: null },
          { id: 'stabiliser', on: 'shotgun' },
        ],
        found: ['x'],
      },
      'shade',
    );
    expect(kit.weapons).toEqual(['pistol', 'rifle']);
    expect(kit.carried).toEqual(['rifle', null]);
    expect(kit.mods).toEqual([
      { id: 'scope', on: 'rifle' },
      { id: 'stabiliser', on: null },
    ]);
    expect(soundKit(undefined, 'warden')).toEqual(newKit());
  });
});
