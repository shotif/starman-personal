import { KINDS, type Kit, MOD_COPIES, MODS, type ModId } from './weapons.ts';

/**
 * Money (D-62; PYRE.md §7): *Lantern*'s credits, as in Reborn and Control. Earned from the story,
 * never from kills, and the same whichever way a choice goes; spent at traders on mods (a copy of a
 * mod for each weapon) and on *Lantern*'s parts, whose effect comes with the ship's encounters (D-18).
 * Finds sell for half what they cost. Pure, so every rule is tested.
 */

/** What a trader asks for each mod, before *Make do*. */
export const PRICES: Record<ModId, number> = {
  stabiliser: 250,
  scope: 300,
  barrel: 300,
  heavy: 350,
  coil: 450,
};

export type PartId = 'plating';

export interface PartSpec {
  id: PartId;
  name: string;
  says: string;
  price: number;
}

/** *Lantern*'s parts a trader may sell. */
export const PARTS: Record<PartId, PartSpec> = {
  plating: {
    id: 'plating',
    name: "Lantern's plating",
    says: 'Armour bolted over the hull, for when the ship has to take a hit. Jo will fit it.',
    price: 1500,
  },
};

/** A find sells for this share of what a trader asks for it. */
export const SELL_SHARE = 0.5;
/** *Make do* (the Steader's talent, D-55): mods cost a fifth less. */
export const MAKE_DO = 0.8;

const tens = (n: number) => Math.round(n / 10) * 10;

/** What a mod costs this hero. */
export const modPrice = (mod: ModId, makeDo: boolean): number => tens(PRICES[mod] * (makeDo ? MAKE_DO : 1));

/** What a mod sells for: half what a trader asks, *Make do* or not. */
export const modValue = (mod: ModId): number => tens(PRICES[mod] * SELL_SHARE);

/** Credits the story gives (`>>> pay`), once for each key. */
export function pay(kit: Kit, key: string, amount: number): Kit {
  if (!Number.isFinite(amount) || amount <= 0 || kit.paid.includes(key)) return kit;
  return { ...kit, credits: kit.credits + Math.floor(amount), paid: [...kit.paid, key] };
}

/** Credits the story takes (a line's `#spend:`), once for each key, and never more than there are. */
export function spend(kit: Kit, key: string, amount: number): Kit {
  if (!Number.isFinite(amount) || amount <= 0 || kit.paid.includes(key) || kit.credits < amount) return kit;
  return { ...kit, credits: kit.credits - Math.floor(amount), paid: [...kit.paid, key] };
}

/** How many copies of a mod are worth having: one for each weapon the hero has that it fits. */
export const modUse = (kit: Kit, mod: ModId): number =>
  Math.min(MOD_COPIES, KINDS.filter((k) => kit.weapons.includes(k) && MODS[mod].fits.includes(k)).length);

/** Why a mod cannot be bought now, or null if it can. */
export function cannotBuy(kit: Kit, mod: ModId, makeDo: boolean): string | null {
  const have = kit.mods.filter((m) => m.id === mod).length;
  if (have >= modUse(kit, mod)) return have > 0 ? 'One for each weapon it fits' : 'Fits none of your weapons';
  if (kit.credits < modPrice(mod, makeDo)) return 'Not enough credits';
  return null;
}

/** Buys a copy of a mod, not fitted. */
export function buyMod(kit: Kit, mod: ModId, makeDo: boolean): Kit {
  if (cannotBuy(kit, mod, makeDo)) return kit;
  return { ...kit, credits: kit.credits - modPrice(mod, makeDo), mods: [...kit.mods, { id: mod, on: null }] };
}

/** Sells the mod at this place in the list (taking it off its weapon first). */
export function sellMod(kit: Kit, index: number): Kit {
  const m = kit.mods[index];
  if (!m) return kit;
  return { ...kit, credits: kit.credits + modValue(m.id), mods: kit.mods.filter((_, j) => j !== index) };
}

/** Why a part cannot be bought now, or null if it can. */
export function cannotBuyPart(kit: Kit, part: PartId): string | null {
  if (kit.parts.includes(part)) return 'Fitted';
  if (kit.credits < PARTS[part].price) return 'Not enough credits';
  return null;
}

export function buyPart(kit: Kit, part: PartId): Kit {
  if (cannotBuyPart(kit, part)) return kit;
  return { ...kit, credits: kit.credits - PARTS[part].price, parts: [...kit.parts, part] };
}
