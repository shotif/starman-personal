/**
 * The star map's rules (ACT1.md, increment 2): the real neighbourhood's shape as the map reads it
 * (src/data/stars.json, copied from Starman Control by `npm run data:sky`), the story's places on it,
 * the leads, the way along the old lanes, and choosing a star by a tap. No Babylon here: the map's
 * scene is src/game/mapScene.ts, its screen src/ui/StarMap.tsx.
 */

export type Vec3 = [number, number, number];

export interface MapPlanet {
  name: string;
  status: 'confirmed' | 'contested' | 'candidate';
  /** The archive that lists it. */
  source: string;
}

export interface MapStar {
  name: string;
  /** Its spectral type as the archives give it. */
  type: string;
  /** Display colour from the type (Reborn's). */
  colour: string;
}

export interface MapSystem {
  id: string;
  name: string;
  /** The primary star's catalogue identifier. */
  catalogId: string;
  /** Sol-centred equatorial Cartesian light-years (x towards RA 0°, z towards the north pole). */
  at: Vec3;
  /** From the Sun, in light-years, and its one-sigma uncertainty when known. */
  distance: number;
  error?: number;
  /** Beyond Reborn's census of 27 ly, in Control's shell. */
  shell?: boolean;
  stars: MapStar[];
  planets: MapPlanet[];
  /** Where its place comes from. */
  source: { label: string; url: string; record?: string };
}

export interface MapSky {
  format: 'starman-lightkeeper-stars';
  importedFrom: { repository: string; commit: string };
  description: string;
  systems: MapSystem[];
  /** Reborn's old lanes, as pairs of systems. */
  lanes: [string, string][];
}

/** A place from right ascension, declination (degrees) and distance, in the map's frame. */
export function fromSky(raDegrees: number, decDegrees: number, distance: number): Vec3 {
  const ra = (raDegrees * Math.PI) / 180;
  const dec = (decDegrees * Math.PI) / 180;
  return [distance * Math.cos(dec) * Math.cos(ra), distance * Math.cos(dec) * Math.sin(ra), distance * Math.sin(dec)];
}

/**
 * Pyre, the one invented star (Starman Reborn's `src/content/stellar/doomed.ts`): a red supergiant
 * just beyond the census, toward Phoenix, reached by one lane from GJ 915. It died in Reborn and
 * left a black hole; Pyre Remnant Station watches what is left. Held here, never in the sky's data.
 */
export const PYRE: MapSystem = {
  id: 'pyre',
  name: 'Pyre',
  catalogId: 'Pyre',
  at: fromSky(357.5, -45.5, 33),
  distance: 33,
  stars: [{ name: 'Pyre', type: 'black hole', colour: '#ff8a5c' }],
  planets: [],
  source: { label: 'Starman Reborn', url: 'https://github.com/shotif/starman-reborn' },
};
/** The real system Pyre's one lane joins. */
export const PYRE_ANCHOR = 'gj-915';

/** Where *Lantern* is now. */
export const HERE = 'ross-128';

/** What the story has at a system, shown in its panel. */
export const STORY_PLACES: Record<string, { title: string; text: string }> = {
  'ross-128': {
    title: 'Calder Station',
    text: 'The outpost on Ross 128 b, gone dark. Ross 128 is dimming in steps, as Antares did.',
  },
  sol: { title: 'The Authority', text: 'Earth, the seat of the Sol Transit Authority.' },
  'tau-ceti': { title: 'The Cooperative', text: 'Tau Ceti e, the seat of the Frontier Cooperative.' },
  'wolf-1061': {
    title: 'Maw Roost',
    text: "The Hollow Wake's seat, and its market. Someone there is selling parts of the engines' machines.",
  },
  'gj-433': {
    title: 'The Dusk Concord',
    text: 'The Duskfolk live in the ring of dusk on GJ 433 d, a world locked to its red sun.',
  },
  'gj-915': { title: 'The edge', text: "A white dwarf at the census's edge, where Pyre's one lane begins." },
  pyre: {
    title: 'Pyre Remnant Station',
    text:
      'Pyre was a red supergiant. It exploded and left a black hole in the glow of its remnant. The ' +
      "Cooperative's observatory station watches what is left, and keeps a century of light curves.",
  },
};

export interface Lead {
  id: 'pyre' | 'maw' | 'dusk';
  system: string;
  title: string;
  /** Why the hero might go, in a line. */
  text: string;
  /** Built and open to travel; the others say so honestly. */
  open: boolean;
}

/** The three leads of Act 1 (STORY.md §4). The Duskfolk border's star is not chosen yet: GJ 433 until it is. */
export const LEADS: Lead[] = [
  {
    id: 'pyre',
    system: 'pyre',
    title: 'Pyre Remnant',
    text: "The Cooperative's observatory and its century of curves. Its open band stopped mid-sentence.",
    open: true,
  },
  {
    id: 'maw',
    system: 'wolf-1061',
    title: 'Maw Roost',
    text: "Someone is selling parts of the engines' machines on the Wake's black market.",
    open: false,
  },
  {
    id: 'dusk',
    system: 'gj-433',
    title: 'The Duskfolk border',
    text: "A star on the Concord's border is dimming too.",
    open: false,
  },
];

/** The systems the map draws: the sky's, and Pyre. */
export function mapSystems(sky: MapSky): MapSystem[] {
  return [...sky.systems, PYRE];
}

/** The lanes the map draws: the old ones, and Pyre's. */
export function mapLanes(sky: MapSky): [string, string][] {
  return [...sky.lanes, [PYRE_ANCHOR, PYRE.id]];
}

export const distanceBetween = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface Route {
  /** The systems passed through, from the first to the last. */
  through: string[];
  /** The light-years flown along the lanes. */
  length: number;
}

/** The shortest way along the lanes from one system to another, by distance (Dijkstra), or null. */
export function route(systems: MapSystem[], lanes: [string, string][], from: string, to: string): Route | null {
  const at = new Map(systems.map((s) => [s.id, s.at]));
  const next = new Map<string, string[]>();
  for (const [a, b] of lanes) {
    next.set(a, [...(next.get(a) ?? []), b]);
    next.set(b, [...(next.get(b) ?? []), a]);
  }
  const best = new Map<string, number>([[from, 0]]);
  const before = new Map<string, string>();
  const done = new Set<string>();
  while (true) {
    let here: string | null = null;
    for (const [id, d] of best) if (!done.has(id) && (here === null || d < (best.get(here) ?? Infinity))) here = id;
    if (here === null) return null;
    if (here === to) break;
    done.add(here);
    const p = at.get(here);
    if (!p) continue;
    for (const n of next.get(here) ?? []) {
      const q = at.get(n);
      if (!q || done.has(n)) continue;
      const d = (best.get(here) ?? 0) + distanceBetween(p, q);
      if (d < (best.get(n) ?? Infinity)) {
        best.set(n, d);
        before.set(n, here);
      }
    }
  }
  const through = [to];
  while (through[0] !== from) through.unshift(before.get(through[0] ?? '') ?? from);
  return { through, length: best.get(to) ?? 0 };
}

/** How a star is drawn: its size on the map (light-years) by its kind, from its spectral type. */
export function starSize(type: string): number {
  if (type === 'black hole') return 1.1;
  const t = type.replace(/^(sd|d|esd|usd)(?=[OBAFGKM])/, '');
  const kind = t[0] ?? 'M';
  if (kind === 'D' || t.startsWith('WD')) return 0.32;
  if ('LTY'.includes(kind)) return 0.26;
  return { O: 1, B: 0.95, A: 0.85, F: 0.72, G: 0.66, K: 0.56, M: 0.44 }[kind] ?? 0.44;
}

/** A point on the screen, with its depth (≤ 0 behind the camera). */
export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
  depth: number;
}

/** The star nearest a tap within reach of the finger, ignoring those behind the camera; nearer ones win a tie. */
export function nearestTo(points: ScreenPoint[], x: number, y: number, reach: number): string | null {
  let best: ScreenPoint | null = null;
  let bestD = reach;
  for (const p of points) {
    if (p.depth <= 0) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD - 0.5 || (best && Math.abs(d - bestD) <= 0.5 && p.depth < best.depth)) {
      best = p;
      bestD = Math.min(d, bestD);
    }
  }
  return best?.id ?? null;
}

/** "11.0 light-years", "4.4", "0.1": one decimal is all a map needs. */
export function lightYears(n: number): string {
  return `${n.toFixed(1)} light-years`;
}

/** What the archives say of a planet's standing, in words. */
export function planetStatus(p: MapPlanet): string {
  return p.status === 'confirmed' ? 'confirmed' : p.status === 'contested' ? 'contested' : 'a candidate';
}
