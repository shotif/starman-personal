import { CLASS_GAINS, CLASS_POWERS, type PowerId } from './powers.ts';

/**
 * How the hero grows (D-49, D-53 to D-55; ACT1.md, increment 3): experience from the story, never
 * from a kill; twelve levels; two points a level for powers' ranks and the class's training; a new
 * power at levels 3 and 6; three powers in hand; the backstory's talents at work. Pure, so every rule
 * is tested; the game (src/game/game.ts) keeps the state and the growth screen shows it.
 */

/** The experience each level needs: level n at THRESHOLDS[n - 1]. */
export const THRESHOLDS = [0, 300, 750, 1300, 2000, 2800, 3700, 4600, 5500, 6400, 7300, 8200] as const;
export const MAX_LEVEL = THRESHOLDS.length;
export const POINTS_PER_LEVEL = 2;
/** What a rank costs: the second one point, the third two. The training the same. */
export const RANK_COST: Record<number, number> = { 2: 1, 3: 2 };
/** How many powers are in hand at a time (D-53). */
export const IN_HAND = 3;
/** The levels that bring each class's two new powers (D-54). */
export const GAIN_LEVELS = [3, 6] as const;

export interface Growth {
  xp: number;
  /** Each power's rank above the first; a power not listed is at its first. */
  ranks: Partial<Record<PowerId, number>>;
  /** The class's training, 1 to 3. */
  training: number;
  /** The three powers in hand, in the order of their keys and buttons. */
  hand: PowerId[];
  /** Points spent so far. */
  spent: number;
  /**
   * The grants already given, by key (a story command's reason, a line's id): a chapter played again
   * from its checkpoint gives nothing twice, so growth can be saved whenever it changes.
   */
  got: string[];
}

export function levelOf(xp: number): number {
  let level = 1;
  for (let i = 1; i < THRESHOLDS.length; i++) if (xp >= (THRESHOLDS[i] ?? Infinity)) level = i + 1;
  return level;
}

/** The experience the next level needs, or null at the last. */
export function nextAt(level: number): number | null {
  return THRESHOLDS[level] ?? null;
}

export function newGrowth(heroClass: string): Growth {
  return { xp: 0, ranks: {}, training: 1, hand: [...startingPowers(heroClass)], spent: 0, got: [] };
}

const startingPowers = (heroClass: string): PowerId[] => [...(CLASS_POWERS[heroClass] ?? CLASS_POWERS.breacher ?? [])];

/** The powers a class has at a level: its three, then one more at level 3 and another at 6. */
export function powersAt(heroClass: string, level: number): PowerId[] {
  const gains = CLASS_GAINS[heroClass] ?? [];
  const out = startingPowers(heroClass);
  GAIN_LEVELS.forEach((at, i) => {
    const p = gains[i];
    if (level >= at && p && !out.includes(p)) out.push(p);
  });
  return out;
}

export const rankOf = (g: Growth, id: PowerId) => g.ranks[id] ?? 1;
export const pointsOf = (g: Growth) => POINTS_PER_LEVEL * (levelOf(g.xp) - 1) - g.spent;

export interface Gained {
  growth: Growth;
  /** The levels reached by this grant, in order. */
  levels: number[];
  /** The powers those levels brought. */
  powers: PowerId[];
}

/** Experience given: the levels it reaches and the powers they bring. A new power goes into a free hand. */
export function gain(g: Growth, heroClass: string, xp: number): Gained {
  const before = levelOf(g.xp);
  const next: Growth = { ...g, xp: g.xp + Math.max(0, Math.round(xp)) };
  const after = levelOf(next.xp);
  const levels: number[] = [];
  for (let l = before + 1; l <= after; l++) levels.push(l);
  const had = powersAt(heroClass, before);
  const powers = powersAt(heroClass, after).filter((p) => !had.includes(p));
  if (next.hand.length < IN_HAND) next.hand = [...next.hand, ...powers].slice(0, IN_HAND);
  return { growth: next, levels, powers };
}

/** A grant given once only, by its key: nothing if it was given before. */
export function gainOnce(g: Growth, heroClass: string, key: string, xp: number): Gained {
  if (g.got.includes(key)) return { growth: g, levels: [], powers: [] };
  const out = gain(g, heroClass, xp);
  return { ...out, growth: { ...out.growth, got: [...g.got, key] } };
}

/** Why a power cannot take its next rank, or null if it can. */
export function cannotRank(g: Growth, heroClass: string, id: PowerId): string | null {
  if (!powersAt(heroClass, levelOf(g.xp)).includes(id)) return 'Not yet learned.';
  const next = rankOf(g, id) + 1;
  if (next > 3) return 'At its last rank.';
  if (pointsOf(g) < (RANK_COST[next] ?? Infinity)) return 'Not enough points.';
  return null;
}

export function rankUp(g: Growth, heroClass: string, id: PowerId): Growth {
  if (cannotRank(g, heroClass, id)) return g;
  const next = rankOf(g, id) + 1;
  return { ...g, ranks: { ...g.ranks, [id]: next }, spent: g.spent + (RANK_COST[next] ?? 0) };
}

export function cannotTrain(g: Growth): string | null {
  const next = g.training + 1;
  if (next > 3) return 'At its last rank.';
  if (pointsOf(g) < (RANK_COST[next] ?? Infinity)) return 'Not enough points.';
  return null;
}

export function train(g: Growth): Growth {
  if (cannotTrain(g)) return g;
  const next = g.training + 1;
  return { ...g, training: next, spent: g.spent + (RANK_COST[next] ?? 0) };
}

/**
 * Puts a power in hand at a slot. A power already in hand trades places with the one there, so the
 * hand always holds three different powers the hero has learned.
 */
export function toHand(g: Growth, heroClass: string, id: PowerId, slot: number): Growth {
  if (slot < 0 || slot >= IN_HAND || !powersAt(heroClass, levelOf(g.xp)).includes(id)) return g;
  const hand = [...g.hand];
  const was = hand.indexOf(id);
  const there = hand[slot];
  if (was === slot) return g;
  if (was >= 0 && there) hand[was] = there;
  hand[slot] = id;
  return { ...g, hand };
}

/** A save's growth made sound: unknown powers dropped, ranks and the hand within the rules. */
export function sound(g: Partial<Growth> | undefined, heroClass: string): Growth {
  const base = newGrowth(heroClass);
  if (!g) return base;
  const xp = Math.max(0, Number(g.xp) || 0);
  const known = powersAt(heroClass, levelOf(xp));
  const ranks: Partial<Record<PowerId, number>> = {};
  for (const [id, r] of Object.entries(g.ranks ?? {}) as [PowerId, number][]) {
    if (known.includes(id)) ranks[id] = Math.max(1, Math.min(3, Math.round(r)));
  }
  const hand = [...new Set((g.hand ?? []).filter((p) => known.includes(p)))].slice(0, IN_HAND);
  for (const p of known) if (hand.length < IN_HAND && !hand.includes(p)) hand.push(p);
  return {
    xp,
    ranks,
    training: Math.max(1, Math.min(3, Math.round(Number(g.training) || 1))),
    hand,
    spent: Math.max(0, Number(g.spent) || 0),
    got: Array.isArray(g.got) ? g.got.filter((k): k is string => typeof k === 'string') : [],
  };
}

// ─── Talents and training (D-55) ───────────────────────────────────────────────────────────────────

/** Everything the past and the training change in play; 1 (or 0) where they change nothing. */
export interface Modifiers {
  healthScale: number;
  shieldScale: number;
  /** Plate on the hero (the Breacher's drill), and what it blunts from each hit. */
  plate: number;
  plateBlock: number;
  /** The hero's powers' cooldowns. */
  cooldownScale: number;
  fieldDamage: number;
  weaponDamage: number;
  spreadScale: number;
  /** Weapon damage for a few seconds after a power (the Striker's momentum), as a share. */
  momentum: number;
  healScale: number;
  /** Seconds off the shield's wait before it returns. */
  shieldSooner: number;
  /** The companions' powers' cooldowns. */
  companionCooldown: number;
  /** Mark's reach, and how far markers show. */
  markReach: number;
  /** How fast the hero walks aboard ships. */
  shipSpeed: number;
  modCost: number;
}

export const NO_MODIFIERS: Modifiers = {
  healthScale: 1,
  shieldScale: 1,
  plate: 0,
  plateBlock: 0,
  cooldownScale: 1,
  fieldDamage: 1,
  weaponDamage: 1,
  spreadScale: 1,
  momentum: 0,
  healScale: 1,
  shieldSooner: 0,
  companionCooldown: 1,
  markReach: 1,
  shipSpeed: 1,
  modCost: 1,
};

/** Each class's training (D-55): its name, what a rank does, and its effect at a rank. */
export const TRAINING: Record<string, { name: string; says: string; at(rank: number, m: Modifiers): Modifiers }> = {
  breacher: {
    name: 'Plate drill',
    says: 'Plate on you: 25 a rank, and more blunted from each hit.',
    at: (r, m) => ({ ...m, plate: m.plate + 25 * r, plateBlock: m.plateBlock + 2 * r }),
  },
  rigger: {
    name: 'Tinkerer',
    says: 'Your powers return 7% sooner a rank.',
    at: (r, m) => ({ ...m, cooldownScale: m.cooldownScale * (1 - 0.07 * r) }),
  },
  fieldwright: {
    name: 'Tuning',
    says: 'Field damage 12% higher a rank.',
    at: (r, m) => ({ ...m, fieldDamage: m.fieldDamage * (1 + 0.12 * r) }),
  },
  shade: {
    name: 'Steady hand',
    says: 'Weapon damage 8% higher and spread 10% less a rank.',
    at: (r, m) => ({ ...m, weaponDamage: m.weaponDamage * (1 + 0.08 * r), spreadScale: m.spreadScale * (1 - 0.1 * r) }),
  },
  striker: {
    name: 'Momentum',
    says: 'For 4 seconds after a power, weapon damage 12% higher a rank.',
    at: (r, m) => ({ ...m, momentum: m.momentum + 0.12 * r }),
  },
  warden: {
    name: 'Field medic',
    says: 'Healing 15% stronger a rank; your shield returns 0.4 s sooner a rank.',
    at: (r, m) => ({ ...m, healScale: m.healScale * (1 + 0.15 * r), shieldSooner: m.shieldSooner + 0.4 * r }),
  },
};

/** What each origin's and moment's talent does in play (D-55); the rest open lines in conversations. */
export const TALENTS: Record<string, { says: string; at(m: Modifiers): Modifiers }> = {
  ringborn: { says: 'Officials open doors: lines in conversations.', at: (m) => m },
  steader: { says: 'Mods cost a fifth less.', at: (m) => ({ ...m, modCost: m.modCost * 0.8 }) },
  'den-raised': { says: "The Wake's traders sell to you.", at: (m) => m },
  laneborn: { says: 'Aboard ships you move a tenth faster.', at: (m) => ({ ...m, shipSpeed: m.shipSpeed * 1.1 }) },
  beltborn: { says: 'A tenth more shield.', at: (m) => ({ ...m, shieldScale: m.shieldScale * 1.1 }) },
  borderer: { says: 'You speak some Duskfolk: lines in conversations.', at: (m) => m },
  survivor: { says: 'A fifth more health.', at: (m) => ({ ...m, healthScale: m.healthScale * 1.2 }) },
  'hero-of-the-line': {
    says: "Your companions' powers return a tenth sooner.",
    at: (m) => ({ ...m, companionCooldown: m.companionCooldown * 0.9 }),
  },
  'hard-call': { says: 'Hard choices open in conversations.', at: (m) => m },
  'lost-someone': {
    says: 'Mark and markers reach half again as far.',
    at: (m) => ({ ...m, markReach: m.markReach * 1.5 }),
  },
};

/** The hero's modifiers: the origin's and moment's talents, and the training at its rank. */
export function modifiers(hero: { heroClass: string; origin: string; moment: string }, training: number): Modifiers {
  let m = { ...NO_MODIFIERS };
  m = TALENTS[hero.origin]?.at(m) ?? m;
  m = TALENTS[hero.moment]?.at(m) ?? m;
  m = TRAINING[hero.heroClass]?.at(Math.max(1, Math.min(3, training)), m) ?? m;
  return m;
}

// ─── Companions ────────────────────────────────────────────────────────────────────────────────────

/** Each companion's two powers (STORY.md: Ren a Shade, Jo a Rigger), used by themselves in a fight. */
export const COMPANION_POWERS: Record<string, [PowerId, PowerId]> = {
  ren: ['mark', 'veil'],
  jo: ['overload', 'seeker'],
};

export interface CompanionGrowth {
  ranks: Partial<Record<PowerId, number>>;
  spent: number;
  /** The companion spends their own points (the default), or the player does. */
  auto: boolean;
}

export const newCompanionGrowth = (): CompanionGrowth => ({ ranks: {}, spent: 0, auto: true });

/** A companion's points at the hero's level: two a level, like the hero's. */
export const companionPoints = (c: CompanionGrowth, level: number) => POINTS_PER_LEVEL * (level - 1) - c.spent;

export function companionRankUp(c: CompanionGrowth, who: string, id: PowerId, level: number): CompanionGrowth {
  if (!COMPANION_POWERS[who]?.includes(id)) return c;
  const next = (c.ranks[id] ?? 1) + 1;
  const cost = RANK_COST[next];
  if (next > 3 || cost === undefined || companionPoints(c, level) < cost) return c;
  return { ...c, ranks: { ...c.ranks, [id]: next }, spent: c.spent + cost };
}

/** A companion left to themselves spends what they can, the cheaper rank first, their first power first. */
export function companionAuto(c: CompanionGrowth, who: string, level: number): CompanionGrowth {
  if (!c.auto) return c;
  let out = c;
  for (;;) {
    const options = (COMPANION_POWERS[who] ?? [])
      .map((id) => ({ id, next: (out.ranks[id] ?? 1) + 1 }))
      .filter((o) => o.next <= 3)
      .sort((a, b) => a.next - b.next);
    const pick = options[0];
    if (!pick) return out;
    const spent = companionRankUp(out, who, pick.id, level);
    if (spent === out) return out;
    out = spent;
  }
}

/**
 * The experience a save from before growth existed is given at its checkpoint: the least any way to
 * that chapter gives (tests/unit/story.test.ts walks the story to check it).
 */
export const XP_BEFORE: Record<string, number> = {
  night_shift: 0,
  range: 0,
  to_control: 40,
  control: 40,
  concourse: 40,
  mast: 150,
  escort: 150,
  gate: 230,
  hangar: 230,
  bridge: 310,
  aboard: 370,
  lane: 470,
};
