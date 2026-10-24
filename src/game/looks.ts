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

/** A lineage's preset: its sliders (the rest at zero) and its height. */
export function applyLineage(manifest: Manifest, looks: Looks, lineage: string): Looks {
  const preset = manifest.lineages[lineage];
  if (!preset) return looks;
  const sliders: Record<string, number> = {};
  for (const m of sliderMorphs(manifest, looks.body)) sliders[m.name] = preset.morphs[m.name] ?? 0;
  const [min, max] = manifest.heightScale.range;
  return { ...looks, lineage, sliders, height: clamp(preset.heightScale[looks.body] ?? 1, min, max) };
}

export function defaultLooks(manifest: Manifest, body: Body): Looks {
  const d = manifest.bodies[body].defaultLooks;
  const base: Looks = {
    body,
    name: '',
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
    sliders,
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
    lineage: typeof r.lineage === 'string' && r.lineage in manifest.lineages ? r.lineage : base.lineage,
    sliders,
    height: typeof r.height === 'number' && Number.isFinite(r.height) ? clamp(r.height, min, max) : base.height,
    skin: known(options.skins, r.skin, base.skin),
    hair: known(options.hair, r.hair, base.hair),
    eyes: known(options.eyes, r.eyes, base.eyes),
  };
}
