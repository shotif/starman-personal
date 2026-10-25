import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from '../game/game.ts';
import type { MapView } from '../game/mapScene.ts';
import {
  distanceBetween,
  HERE,
  LEADS,
  type Lead,
  lightYears,
  type MapSky,
  type MapSystem,
  mapLanes,
  mapSystems,
  nearestTo,
  planetStatus,
  type Route,
  route,
  STORY_PLACES,
} from '../game/starmap.ts';
import { isTouch } from './settings.ts';

/**
 * Named on the map whatever is chosen, first to last in the order they give way to each other when
 * their names would overlap: the story's places, then the nearest and brightest stars.
 */
const NAMED = [
  'pyre',
  'ross-128',
  'wolf-1061',
  'gj-433',
  'sol',
  'tau-ceti',
  'gj-915',
  'alpha-centauri',
  'sirius',
  'vega',
  'altair',
  'fomalhaut',
  'procyon',
  'epsilon-eridani',
  'barnards-star',
];

interface Loaded {
  sky: MapSky;
  systems: MapSystem[];
  lanes: [string, string][];
  view: MapView;
}

/** How far a tap may land from a star and still choose it, in CSS pixels. */
const REACH = { touch: 30, mouse: 16 };

/**
 * The star map over the bridge (ACT1.md, increment 2): the real neighbourhood to turn, zoom and
 * read, the three leads, and the course to the open one. Its scene is drawn on the game's engine
 * instead of the place; its code and data load the first time it opens.
 */
export function StarMap({ game, onClose }: { game: Game; onClose(): void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [chosen, setChosen] = useState<string>('pyre');
  const labels = useRef(new Map<string, HTMLButtonElement>());
  /** The names shown, most wanted first: a name that would overlap one before it waits. */
  const order = useRef<string[]>([]);
  const surface = useRef<HTMLDivElement>(null);
  const leadsBar = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  /** The first choice is shown where it is; later ones bring the view to them. */
  const glide = useRef(false);
  const touch = isTouch();

  useEffect(() => {
    let gone = false;
    let view: MapView | null = null;
    let frame = 0;
    Promise.all([import('../game/mapScene.ts'), import('../data/stars.json')])
      .then(([{ buildMapScene }, data]) => {
        if (gone) return;
        const sky = data.default as unknown as MapSky;
        view = buildMapScene(game.engine, sky, HERE, LEADS);
        game.showMap(view);
        if (new URLSearchParams(location.search).has('debug')) {
          (window as unknown as { lightkeeperMap: MapView }).lightkeeperMap = view;
        }
        document.body.dataset.map = 'open';
        setLoaded({ sky, systems: mapSystems(sky), lanes: mapLanes(sky), view });
        const widths = new Map<string, number>();
        // Each frame: the view centres in what the panels leave free, and the names follow their stars.
        const place = () => {
          if (!view) return;
          const top = leadsBar.current?.getBoundingClientRect().bottom ?? 0;
          const sheet = panel.current?.getBoundingClientRect();
          const foot = bar.current?.getBoundingClientRect().top ?? innerHeight;
          // A sheet across the foot (a phone upright), or a panel down the side.
          const across = !!sheet && sheet.width > innerWidth * 0.6;
          view.inset({
            top,
            right: sheet && !across ? innerWidth - sheet.left : 0,
            bottom: innerHeight - (sheet && across ? sheet.top : foot),
            left: 0,
          });
          const boxes: [number, number, number, number][] = [];
          const points = new Map(view.project(order.current).map((p) => [p.id, p]));
          for (const id of order.current) {
            const label = labels.current.get(id);
            const p = points.get(id);
            if (!label || !p) continue;
            let width = widths.get(id);
            if (!width) {
              width = label.offsetWidth;
              widths.set(id, width);
            }
            const box: [number, number, number, number] = [p.x + 6, p.y - 14, p.x + 6 + width, p.y + 10];
            const onScreen = p.depth > 0 && p.x > -40 && p.y > top + 8 && p.x < innerWidth + 40 && p.y < innerHeight;
            const clear = !boxes.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]);
            const shown = onScreen && clear;
            if (shown) boxes.push(box);
            label.style.visibility = shown ? 'visible' : 'hidden';
            label.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
          }
          frame = requestAnimationFrame(place);
        };
        frame = requestAnimationFrame(place);
      })
      .catch((error: unknown) => {
        // Not loaded (the network gone): back to the bridge rather than a dark screen.
        console.error(error);
        if (!gone) onClose();
      });
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      game.showMap(null);
      view?.dispose();
      delete document.body.dataset.map;
    };
  }, [game]);

  const system = loaded?.systems.find((s) => s.id === chosen) ?? null;
  const lead = LEADS.find((l) => l.system === chosen) ?? null;
  const way: Route | null = loaded && chosen !== HERE ? route(loaded.systems, loaded.lanes, HERE, chosen) : null;

  useEffect(() => {
    if (!loaded) return;
    loaded.view.select(chosen, !glide.current);
    glide.current = true;
    loaded.view.course(way?.through ?? null);
  }, [loaded, chosen]);

  // Keys on a desktop: the arrows turn, + and − zoom, Escape closes.
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const view = loaded?.view;
      if (e.code === 'Escape') onClose();
      else if (!view) return;
      else if (e.code === 'ArrowLeft') view.turn(-40, 0);
      else if (e.code === 'ArrowRight') view.turn(40, 0);
      else if (e.code === 'ArrowUp') view.turn(0, -30);
      else if (e.code === 'ArrowDown') view.turn(0, 30);
      else if (e.key === '+' || e.key === '=') view.zoom(0.85);
      else if (e.key === '-') view.zoom(1 / 0.85);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [loaded, onClose]);

  // One finger (or the mouse) turns it, two pinch to zoom, a tap chooses the nearest star.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const tap = useRef<{ x: number; y: number; at: number } | null>(null);
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const down = (e: PointerEvent) => {
    surface.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap.current = pointers.current.size === 1 ? { x: e.clientX, y: e.clientY, at: performance.now() } : null;
  };
  const move = (e: PointerEvent) => {
    const before = pointers.current.get(e.pointerId);
    const view = loaded?.view;
    if (!before || !view) return;
    const was = spread();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) view.turn(e.clientX - before.x, e.clientY - before.y);
    else if (was > 0) view.zoom(was / Math.max(1, spread()));
    if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 8) tap.current = null;
  };
  const up = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const t = tap.current;
    tap.current = null;
    const view = loaded?.view;
    if (!t || !view || performance.now() - t.at > 500) return;
    const box = game.engine.getRenderingCanvas()?.getBoundingClientRect();
    const reach = e.pointerType === 'touch' ? REACH.touch : REACH.mouse;
    const id = nearestTo(view.project(), e.clientX - (box?.left ?? 0), e.clientY - (box?.top ?? 0), reach);
    if (id) setChosen(id);
  };

  const shown = [...new Set([chosen, HERE, ...NAMED])];
  order.current = shown;
  const here = loaded?.systems.find((s) => s.id === HERE);
  const fromHere = system && here ? distanceBetween(system.at, here.at) : 0;

  return (
    <section class="starmap" aria-label="Star map" data-chosen={chosen}>
      <div
        ref={surface}
        class="starmap__surface"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          tap.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          loaded?.view.zoom(Math.exp(e.deltaY * 0.0012));
        }}
      />
      {loaded &&
        shown.map((id) => {
          const s = loaded.systems.find((x) => x.id === id);
          if (!s) return null;
          const kind =
            id === HERE ? ' starmap__label--here' : LEADS.some((l) => l.system === id) ? ' starmap__label--lead' : '';
          return (
            <button
              type="button"
              key={id}
              ref={(el) => {
                if (el) labels.current.set(id, el);
                else labels.current.delete(id);
              }}
              class={`starmap__label${kind}${id === chosen ? ' starmap__label--on' : ''}`}
              aria-pressed={id === chosen}
              onClick={() => setChosen(id)}
            >
              {id === 'pyre' ? 'Pyre Remnant' : s.name}
            </button>
          );
        })}
      <nav ref={leadsBar} class="starmap__leads" aria-label="Leads">
        {LEADS.map((l) => (
          <button
            type="button"
            key={l.id}
            class={`starmap__lead${l.open ? '' : ' starmap__lead--later'}`}
            aria-pressed={l.system === chosen}
            onClick={() => setChosen(l.system)}
          >
            {l.title}
            {!l.open && <span class="starmap__later"> · later</span>}
          </button>
        ))}
      </nav>
      {system && (
        <aside ref={panel} class="starmap__panel" aria-label={system.name}>
          <h2 class="starmap__name">{system.id === 'pyre' ? 'Pyre' : system.name}</h2>
          <p class="starmap__where">
            {system.id === HERE ? 'Lantern is here' : `${lightYears(fromHere)} from Lantern`}
            {system.id !== 'sol' && ` · ${lightYears(system.distance)} from the Sun`}
          </p>
          {lead && <LeadPanel lead={lead} way={wayText(way, loaded?.systems ?? [])} game={game} onClose={onClose} />}
          {!lead && system.id !== HERE && <p class="starmap__way">{wayText(way, loaded?.systems ?? [])}</p>}
          {STORY_PLACES[system.id] && (
            <p class="starmap__story">
              <strong>{STORY_PLACES[system.id]?.title}.</strong> {STORY_PLACES[system.id]?.text}
            </p>
          )}
          <ul class="starmap__stars">
            {system.stars.map((t) => (
              <li key={t.name}>
                <span class="starmap__dot" style={{ background: t.colour }} /> {t.name}
                {t.type !== 'unknown' && <span class="starmap__type"> · {t.type}</span>}
              </li>
            ))}
          </ul>
          {system.id !== 'pyre' && (
            <p class="starmap__planets">
              {system.planets.length === 0
                ? 'No planets known.'
                : `Planets known: ${system.planets.map((p) => `${p.name} (${planetStatus(p)})`).join(', ')}.`}
            </p>
          )}
          {system.id !== 'pyre' && system.id !== 'sol' && (
            <p class="starmap__source">Its place: {system.source.record ?? system.source.label}</p>
          )}
        </aside>
      )}
      <div ref={bar} class="starmap__bar">
        <p class="starmap__hint">
          {touch
            ? 'Drag to turn · pinch to zoom · tap a star'
            : 'Drag to turn · wheel or + − to zoom · click a star · Esc closes'}
        </p>
        <button type="button" class="starmap__button" onClick={() => setChosen(HERE)}>
          Here
        </button>
        <button type="button" class="starmap__button" onClick={onClose}>
          Close
        </button>
      </div>
      {!loaded && <p class="starmap__loading">Charting the neighbourhood…</p>}
    </section>
  );
}

/** The way there along the old lanes, in words. */
function wayText(way: Route | null, systems: MapSystem[]): string {
  if (!way) return 'No old lane reaches it.';
  const jumps = way.through.length - 1;
  const last = systems.find((s) => s.id === way.through.at(-2))?.name;
  const by = jumps > 1 && last ? `, the last from ${last}` : '';
  return `By the old lanes: ${jumps} ${jumps === 1 ? 'jump' : 'jumps'}, ${lightYears(way.length)}${by}.`;
}

function LeadPanel({ lead, way, game, onClose }: { lead: Lead; way: string; game: Game; onClose(): void }) {
  return (
    <div class="starmap__lead-panel">
      <p class="starmap__lead-text">
        <strong>{lead.title}.</strong> {lead.text}
      </p>
      <p class="starmap__way">{way}</p>
      {lead.open ? (
        <button
          type="button"
          class="starmap__course"
          onClick={() => {
            game.setCourse(lead.id);
            onClose();
          }}
        >
          Set course
        </button>
      ) : (
        <p class="starmap__wait">Later in Act 1.</p>
      )}
    </div>
  );
}
