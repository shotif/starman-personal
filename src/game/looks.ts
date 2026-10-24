import { CLASSES, MOMENTS, ORIGINS } from './hero.ts';

/**
 * What a hero looks like, as data (CREATOR.md): the choices the creator offers come from the art
 * pipeline's manifest, public/assets/characters/heroes.json. Pure, so every rule is tested.
 */
export type Body = 'man' | 'woman';
export const BODIES: readonly Body[] = ['man', 'woman'];

export interface MorphInfo {
  name: string;
  group: string;
  label: string;
}

export interface LookOption {
  id: string;
  label: string;
  default: boolean;
  file: string | null;
}

export interface Lineage {
  label: string;
  summary: string;
  heightScale: Record<Body, number>;
  morphs: Record<string, number>;
}

/** The parts of heroes.json the creator reads. */
export interface Manifest {
  heightScale: { range: [number, number] };
  lineages: Record<string, Lineage>;
  bodies: Record<
    Body,
    { file: string; morphs: MorphInfo[]; defaultLooks: { skin: string; hair: string; eyes: string } }
  >;
  looks: Record<Body, { skins: LookOption[]; hair: LookOption[]; eyes: LookOption[] }>;
}

export interface Looks {
  body: Body;
  name: string;
  /** Class, origin and moment (hero.ts; D-33 to D-35). */
  heroClass: string;
  origin: string;
  moment: string;
  lineage: string;
  /** Slider values, 0 to 1, by morph name. */
  sliders: Record<string, number>;
  /** A uniform scale on the hero, within the manifest's range. */
  height: number;
  skin: string;
  hair: string;
  eyes: string;
}

/** The sliders a player moves: the body and face groups, not speech or the eyes. */
export function sliderMorphs(manifest: Manifest, body: Body): MorphInfo[] {
  return manifest.bodies[body].morphs.filter((m) => m.group === 'body' || m.group === 'face');
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Sliders that pull against each other become one slider each way from the middle (the owner's
 * feedback, 24 October 2026: "Heavier" and "Slimmer" could both be set at once).
 */
export interface Pair {
  label: string;
  less: string;
  more: string;
  lessLabel: string;
  moreLabel: string;
}

export const PAIRS: readonly Pair[] = [
  { label: 'Build', less: 'body_slim', more: 'body_heavy', lessLabel: 'slimmer', moreLabel: 'heavier' },
  { label: 'Muscle', less: 'body_soft', more: 'body_muscular', lessLabel: 'less', moreLabel: 'more' },
  { label: 'Frame', less: 'body_lean', more: 'body_stocky', lessLabel: 'long and lean', moreLabel: 'short and dense' },
];

/** A pair's value, -1 (all `less`) to 1 (all `more`). */
export function pairValue(sliders: Record<string, number>, pair: Pair): number {
  return clamp((sliders[pair.more] ?? 0) - (sliders[pair.less] ?? 0), -1, 1);
}

/** Sets a pair: only one side is ever above zero. */
export function setPair(sliders: Record<string, number>, pair: Pair, value: number): Record<string, number> {
  const v = clamp(value, -1, 1);
  return { ...sliders, [pair.less]: Math.max(0, -v), [pair.more]: Math.max(0, v) };
}

/** Removes any pair set both ways at once, keeping the difference. */
export function settlePairs(sliders: Record<string, number>): Record<string, number> {
  let settled = sliders;
  for (const pair of PAIRS) {
    if (pair.less in settled || pair.more in settled) settled = setPair(settled, pair, pairValue(settled, pair));
  }
  return settled;
}

/** The creator's controls for a group of sliders: the pairs first, then the sliders on their own. */
export type Control = { kind: 'pair'; pair: Pair } | { kind: 'single'; morph: MorphInfo };

export function controls(manifest: Manifest, body: Body, group: string): Control[] {
  const morphs = sliderMorphs(manifest, body).filter((m) => m.group === group);
  const names = new Set(morphs.map((m) => m.name));
  const pairs = PAIRS.filter((p) => names.has(p.less) && names.has(p.more));
  const paired = new Set(pairs.flatMap((p) => [p.less, p.more]));
  return [
    ...pairs.map((pair): Control => ({ kind: 'pair', pair })),
    ...morphs.filter((m) => !paired.has(m.name)).map((morph): Control => ({ kind: 'single', morph })),
  ];
}

/** A lineage's preset: its sliders (the rest at zero) and its height. */
export function applyLineage(manifest: Manifest, looks: Looks, lineage: string): Looks {
  const preset = manifest.lineages[lineage];
  if (!preset) return looks;
  const sliders: Record<string, number> = {};
  for (const m of sliderMorphs(manifest, looks.body)) sliders[m.name] = preset.morphs[m.name] ?? 0;
  const [min, max] = manifest.heightScale.range;
  return {
    ...looks,
    lineage,
    sliders: settlePairs(sliders),
    height: clamp(preset.heightScale[looks.body] ?? 1, min, max),
  };
}

export function defaultLooks(manifest: Manifest, body: Body): Looks {
  const d = manifest.bodies[body].defaultLooks;
  const base: Looks = {
    body,
    name: '',
    heroClass: CLASSES[0]?.id ?? '',
    origin: ORIGINS[0]?.id ?? '',
    moment: MOMENTS[0]?.id ?? '',
    lineage: 'earthborn',
    sliders: {},
    height: 1,
    skin: d.skin,
    hair: d.hair,
    eyes: d.eyes,
  };
  return applyLineage(manifest, base, 'earthborn');
}

/** A random hero: a body, a lineage, its preset nudged a little, and random looks. */
export function randomLooks(manifest: Manifest, random: () => number): Looks {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length) % items.length] as T;
  const body = pick(BODIES);
  const lineage = pick(Object.keys(manifest.lineages));
  const looks = applyLineage(manifest, defaultLooks(manifest, body), lineage);
  const sliders = { ...looks.sliders };
  for (const m of sliderMorphs(manifest, body)) {
    sliders[m.name] = clamp((sliders[m.name] ?? 0) + (random() - 0.5) * 0.6, 0, 1);
  }
  const options = manifest.looks[body];
  return {
    ...looks,
    heroClass: pick(CLASSES).id,
    origin: pick(ORIGINS).id,
    moment: pick(MOMENTS).id,
    sliders: settlePairs(sliders),
    skin: pick(options.skins).id,
    hair: pick(options.hair).id,
    eyes: pick(options.eyes).id,
  };
}

/** A saved hero, checked against the manifest; anything unknown falls back to the defaults. */
export function checkLooks(manifest: Manifest, raw: unknown): Looks | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Looks>;
  if (r.body !== 'man' && r.body !== 'woman') return null;
  const base = defaultLooks(manifest, r.body);
  const options = manifest.looks[r.body];
  const known = (list: LookOption[], id: unknown, fallback: string) =>
    typeof id === 'string' && list.some((o) => o.id === id) ? id : fallback;
  const sliders: Record<string, number> = {};
  for (const m of sliderMorphs(manifest, r.body)) {
    const v = r.sliders?.[m.name];
    sliders[m.name] = typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : (base.sliders[m.name] ?? 0);
  }
  const [min, max] = manifest.heightScale.range;
  return {
    body: r.body,
    name: typeof r.name === 'string' ? r.name.slice(0, 40) : '',
    heroClass: CLASSES.some((c) => c.id === r.heroClass) ? (r.heroClass as string) : base.heroClass,
    origin: ORIGINS.some((o) => o.id === r.origin) ? (r.origin as string) : base.origin,
    moment: MOMENTS.some((m) => m.id === r.moment) ? (r.moment as string) : base.moment,
    lineage: typeof r.lineage === 'string' && r.lineage in manifest.lineages ? r.lineage : base.lineage,
    sliders: settlePairs(sliders),
    height: typeof r.height === 'number' && Number.isFinite(r.height) ? clamp(r.height, min, max) : base.height,
    skin: known(options.skins, r.skin, base.skin),
    hair: known(options.hair, r.hair, base.hair),
    eyes: known(options.eyes, r.eyes, base.eyes),
  };
}
