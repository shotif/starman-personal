import { describe, expect, it } from 'vitest';
import {
  buyMod,
  buyPart,
  cannotBuy,
  cannotBuyPart,
  modPrice,
  modUse,
  modValue,
  PARTS,
  PRICES,
  pay,
  sellMod,
  spend,
} from '../../src/game/money.ts';
import { fitMod, newKit, soundKit, take } from '../../src/game/weapons.ts';

/** Money (D-62; PYRE.md §7): credits from the story, spent on mods and Lantern's parts. */
describe('money', () => {
  it('gives the story’s payments once each, and takes a line’s spending once, never past nothing', () => {
    let kit = pay(newKit(), 'pay:The old captain’s float', 600);
    expect(kit.credits).toBe(600);
    expect(pay(kit, 'pay:The old captain’s float', 600)).toBe(kit);
    expect(pay(kit, 'pay:nothing', 0)).toBe(kit);
    kit = spend(kit, 'spend:hero_matti_again_06c', 200);
    expect(kit.credits).toBe(400);
    expect(spend(kit, 'spend:hero_matti_again_06c', 200)).toBe(kit);
    expect(spend(kit, 'spend:too much', 500)).toBe(kit);
  });

  it('prices mods as the design says, a fifth off for those who make do, and buys back at half', () => {
    expect(PRICES).toEqual({ stabiliser: 250, scope: 300, barrel: 300, heavy: 350, coil: 450 });
    expect(modPrice('coil', false)).toBe(450);
    expect(modPrice('coil', true)).toBe(360);
    expect(modPrice('stabiliser', true)).toBe(200);
    expect(modValue('coil')).toBe(230);
    expect(modValue('stabiliser')).toBe(130);
    expect(PARTS.plating.price).toBe(1500);
  });

  it('sells a copy of a mod for each weapon it fits, while there are credits for it', () => {
    let kit = soundKit({ weapons: ['pistol', 'rifle', 'marksman'], credits: 1000 }, 'shade');
    // A scope fits the rifle and the marksman rifle: two are worth having.
    expect(modUse(kit, 'scope')).toBe(2);
    kit = buyMod(kit, 'scope', false);
    kit = buyMod(kit, 'scope', false);
    expect(kit.credits).toBe(400);
    expect(kit.mods.filter((m) => m.id === 'scope')).toHaveLength(2);
    expect(cannotBuy(kit, 'scope', false)).toBe('One for each weapon it fits');
    expect(buyMod(kit, 'scope', false)).toBe(kit);
    expect(cannotBuy(kit, 'coil', false)).toBe('Not enough credits');
    expect(cannotBuy(kit, 'coil', true)).toBeNull();
    // Both scoped weapons can carry one.
    kit = fitMod(kit, 0, 'rifle');
    kit = fitMod(kit, 1, 'marksman');
    expect(kit.mods.map((m) => m.on)).toEqual(['rifle', 'marksman']);
  });

  it('buys a find back, fitted or not, and fits Lantern’s plating once', () => {
    let kit = take(soundKit({ weapons: ['pistol'], credits: 0 }, 'warden'), 'find:range_stabiliser', 'stabiliser');
    kit = fitMod(kit, 'stabiliser', 'pistol');
    kit = sellMod(kit, 0);
    expect(kit.mods).toEqual([]);
    expect(kit.credits).toBe(130);
    expect(sellMod(kit, 3)).toBe(kit);
    expect(cannotBuyPart(kit, 'plating')).toBe('Not enough credits');
    kit = pay(kit, 'pay:test', 1400);
    kit = buyPart(kit, 'plating');
    expect(kit.parts).toEqual(['plating']);
    expect(kit.credits).toBe(30);
    expect(cannotBuyPart(kit, 'plating')).toBe('Fitted');
    expect(buyPart(kit, 'plating')).toBe(kit);
  });
});
