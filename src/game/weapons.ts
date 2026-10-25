/**
 * The four kinds of weapon (D-50, D-56; ACT1.md, increment 3): no ammunition to count, each kind
 * balanced by how fast and how far it shoots, how much it spreads and what it weighs; two carried;
 * two mods each. Every round is a kinetic slug, fired by a coil (blunted by plate, D-42). Pure, so
 * every rule is tested; the game (src/game/game.ts) fires them and the armoury fits them.
 */

export type WeaponKind = 'pistol' | 'rifle' | 'shotgun' | 'marksman';
export type ModId = 'scope' | 'stabiliser' | 'heavy' | 'barrel' | 'coil';

export interface WeaponSpec {
  kind: WeaponKind;
  name: string;
  /** Seconds between shots; the rifle fires while the trigger is held. */
  interval: number;
  /** Each slug's damage, and how many slugs a shot throws. */
  damage: number;
  pellets: number;
  /** How far a shot reaches, and (the shotgun) where its slugs begin to weaken. */
  reach: number;
  falloff?: number;
  /** The cone a shot may stray within, in degrees: at first, and at worst while held. */
  spread: number;
  spreadMax: number;
  /** How the view narrows when aiming (the field of view's share). */
  zoom: number;
  weight: number;
  says: string;
}

export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  pistol: {
    kind: 'pistol',
    name: 'Pistol',
    interval: 0.22,
    damage: 34,
    pellets: 1,
    reach: 60,
    spread: 0.4,
    spreadMax: 0.4,
    zoom: 1,
    weight: 1,
    says: 'The sidearm every officer carries: steady, light, enough.',
  },
  rifle: {
    kind: 'rifle',
    name: 'Rifle',
    interval: 0.11,
    damage: 20,
    pellets: 1,
    reach: 70,
    spread: 0.6,
    spreadMax: 3,
    zoom: 0.92,
    weight: 2,
    says: 'Fires while the trigger is held; it strays the longer it fires.',
  },
  shotgun: {
    kind: 'shotgun',
    name: 'Shotgun',
    interval: 0.83,
    damage: 14,
    pellets: 8,
    reach: 30,
    falloff: 12,
    spread: 4,
    spreadMax: 4,
    zoom: 1,
    weight: 2,
    says: 'Eight slugs at once: brutal close, weak past twelve metres.',
  },
  marksman: {
    kind: 'marksman',
    name: 'Marksman rifle',
    interval: 1.1,
    damage: 120,
    pellets: 1,
    reach: 120,
    spread: 0.1,
    spreadMax: 0.1,
    zoom: 0.5,
    weight: 3,
    says: 'One heavy slug, far and true; the view narrows when you aim.',
  },
};

export const KINDS: readonly WeaponKind[] = ['pistol', 'rifle', 'shotgun', 'marksman'];

/** The kinds each class is trained in (D-50, D-56). */
export const TRAINED: Record<string, readonly WeaponKind[]> = {
  breacher: ['pistol', 'rifle', 'shotgun', 'marksman'],
  rigger: ['pistol', 'rifle'],
  fieldwright: ['pistol', 'shotgun'],
  shade: ['pistol', 'rifle', 'marksman'],
  striker: ['pistol', 'rifle', 'shotgun'],
  warden: ['pistol', 'rifle'],
};

export interface ModSpec {
  id: ModId;
  name: string;
  says: string;
  /** The kinds it fits. */
  fits: readonly WeaponKind[];
  /** The weight it adds. */
  weight: number;
}

export const MODS: Record<ModId, ModSpec> = {
  scope: {
    id: 'scope',
    name: 'Scope',
    says: 'The view narrows further when you aim.',
    fits: ['rifle', 'marksman'],
    weight: 0,
  },
  stabiliser: { id: 'stabiliser', name: 'Stabiliser', says: 'A third less spread.', fits: KINDS, weight: 0 },
  heavy: {
    id: 'heavy',
    name: 'Heavy rounds',
    says: 'A quarter more against plate; heavier.',
    fits: KINDS,
    weight: 0.5,
  },
  barrel: { id: 'barrel', name: 'Long barrel', says: 'A third more reach.', fits: KINDS, weight: 0 },
  coil: { id: 'coil', name: 'Cooled coil', says: 'Fires a seventh faster.', fits: KINDS, weight: 0 },
};

/** How many mods a weapon takes. */
export const MOD_SLOTS = 2;

/** A weapon with its mods fitted, as it fires. */
export interface Fitted extends WeaponSpec {
  mods: ModId[];
  /** Against plate, a share more (Heavy rounds). */
  plateBonus: number;
}

/** A weapon's numbers with its mods (D-56): a scope, a stabiliser, heavy rounds, a long barrel, a cooled coil. */
export function fitted(kind: WeaponKind, mods: readonly ModId[] = []): Fitted {
  const base = WEAPONS[kind];
  const out: Fitted = { ...base, mods: [], plateBonus: 0 };
  for (const id of mods) {
    const mod = MODS[id];
    if (!mod?.fits.includes(kind) || out.mods.includes(id) || out.mods.length >= MOD_SLOTS) continue;
    out.mods.push(id);
    out.weight += mod.weight;
    if (id === 'scope') out.zoom *= 0.75;
    if (id === 'stabiliser') {
      out.spread *= 2 / 3;
      out.spreadMax *= 2 / 3;
    }
    if (id === 'heavy') out.plateBonus += 0.25;
    if (id === 'barrel') {
      out.reach *= 4 / 3;
      if (out.falloff) out.falloff *= 4 / 3;
    }
    if (id === 'coil') out.interval *= 6 / 7;
  }
  return out;
}

/** What is carried weighs on the powers (COMBAT.md): above 3, each point a tenth slower to return. */
export function weightScale(weight: number): number {
  return 1 + Math.max(0, weight - 3) * 0.1;
}

/** A slug's damage at a distance: the shotgun's weaken past their falloff, to a third at twice it. */
export function damageAt(w: WeaponSpec, distance: number): number {
  if (!w.falloff || distance <= w.falloff) return w.damage;
  const k = Math.min(1, (distance - w.falloff) / w.falloff);
  return w.damage * (1 - k * (2 / 3));
}

/** The rifle strays the longer it fires: its spread after `held` seconds of firing, and back at rest. */
export function spreadAfter(w: WeaponSpec, held: number): number {
  return Math.min(w.spreadMax, w.spread + Math.max(0, held) * (w.spreadMax - w.spread) * 1.2);
}

// ─── What the hero carries (the armoury) ───────────────────────────────────────────────────────────

export interface Kit {
  /** The weapons the hero has: the pistol from the start, the rest from the armoury. */
  weapons: WeaponKind[];
  /** The two carried; the first in hand. */
  carried: [WeaponKind, WeaponKind | null];
  /**
   * The mods the hero has, and which weapon each is fitted to (or none). A mod may be had more than
   * once (bought, D-62), one of a kind to a weapon.
   */
  mods: { id: ModId; on: WeaponKind | null }[];
  /** The finds already taken, by key, so a chapter played again gives nothing twice. */
  found: string[];
  /** *Lantern*'s credits (D-62), and the payments and spending already made, by key. */
  credits: number;
  paid: string[];
  /** *Lantern*'s parts bought (D-62): their effect comes with the ship's encounters (D-18). */
  parts: string[];
}

/** The most copies of one mod: one for each of the four kinds. */
export const MOD_COPIES = KINDS.length;

export const newKit = (): Kit => ({
  weapons: ['pistol'],
  carried: ['pistol', null],
  mods: [],
  found: [],
  credits: 0,
  paid: [],
  parts: [],
});

/** The mods fitted to a weapon. */
export const modsOn = (kit: Kit, kind: WeaponKind): ModId[] => kit.mods.filter((m) => m.on === kind).map((m) => m.id);

/** What the hero carries weighs this much. */
export function carriedWeight(kit: Kit): number {
  return kit.carried.reduce((n, k) => n + (k ? fitted(k, modsOn(kit, k)).weight : 0), 0);
}

/** Two weapons the class is trained in and has, the first in hand; never the same one twice. */
export function carry(kit: Kit, heroClass: string, first: WeaponKind, second: WeaponKind | null): Kit {
  const ok = (k: WeaponKind | null) => !!k && kit.weapons.includes(k) && (TRAINED[heroClass] ?? []).includes(k);
  if (!ok(first)) return kit;
  return { ...kit, carried: [first, ok(second) && second !== first ? second : null] };
}

/** Swaps the weapon in hand for the other carried. */
export function swap(kit: Kit): Kit {
  const [a, b] = kit.carried;
  return b ? { ...kit, carried: [b, a] } : kit;
}

/**
 * Fits a mod the hero has to a weapon (or takes it off with null), if it fits, a slot is free and the
 * weapon has no other of its kind. `which` is the mod's place in the list, or its kind: then the copy
 * already on `on`, else the first not fitted, else the first.
 */
export function fitMod(kit: Kit, which: number | ModId, on: WeaponKind | null): Kit {
  const i =
    typeof which === 'number'
      ? which
      : [
          kit.mods.findIndex((m) => m.id === which && m.on === on),
          kit.mods.findIndex((m) => m.id === which && m.on === null),
          kit.mods.findIndex((m) => m.id === which),
        ].find((x) => x >= 0);
  const mod = i === undefined ? undefined : kit.mods[i];
  if (i === undefined || !mod) return kit;
  if (on !== null) {
    if (!MODS[mod.id].fits.includes(on) || !kit.weapons.includes(on)) return kit;
    const others = kit.mods.filter((m, j) => m.on === on && j !== i);
    if (others.length >= MOD_SLOTS || others.some((m) => m.id === mod.id)) return kit;
  }
  const mods = kit.mods.map((m, j) => (j === i ? { ...m, on } : m));
  return { ...kit, mods };
}

/** A find taken: a weapon or a mod, once only by its key. */
export function take(kit: Kit, key: string, what: WeaponKind | ModId): Kit {
  if (kit.found.includes(key)) return kit;
  const found = [...kit.found, key];
  if (what in WEAPONS) {
    const kind = what as WeaponKind;
    return { ...kit, found, weapons: kit.weapons.includes(kind) ? kit.weapons : [...kit.weapons, kind] };
  }
  const mod = what as ModId;
  if (kit.mods.filter((m) => m.id === mod).length >= MOD_COPIES) return { ...kit, found };
  return { ...kit, found, mods: [...kit.mods, { id: mod, on: null }] };
}

/** A save's kit made sound: what is unknown dropped, the carried pair within the rules. */
export function soundKit(k: Partial<Kit> | undefined, heroClass: string): Kit {
  const base = newKit();
  if (!k) return base;
  const weapons = [...new Set(['pistol', ...(k.weapons ?? [])].filter((w): w is WeaponKind => w in WEAPONS))];
  const mods: Kit['mods'] = [];
  for (const m of k.mods ?? []) {
    if (!m || !((m.id as string) in MODS)) continue;
    if (mods.filter((x) => x.id === m.id).length >= MOD_COPIES) continue;
    const on = m.on && weapons.includes(m.on) && MODS[m.id].fits.includes(m.on) ? m.on : null;
    const taken = on !== null && mods.filter((x) => x.on === on);
    const full = !!taken && (taken.length >= MOD_SLOTS || taken.some((x) => x.id === m.id));
    mods.push({ id: m.id, on: full ? null : on });
  }
  const strings = (list: unknown) =>
    Array.isArray(list) ? list.filter((f): f is string => typeof f === 'string') : [];
  const kit: Kit = {
    weapons,
    carried: ['pistol', null],
    mods,
    found: strings(k.found),
    credits: Number.isFinite(k.credits) ? Math.max(0, Math.floor(k.credits ?? 0)) : 0,
    paid: strings(k.paid),
    parts: strings(k.parts),
  };
  const [a, b] = k.carried ?? ['pistol', null];
  return carry(kit, heroClass, a, b ?? null);
}
