import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game, GameStats, OrderKind } from '../game/game.ts';
import { chooseQuality, isQualityTier, nextTier, type QualityTier } from '../game/quality.ts';
import { TouchControls } from './TouchControls.tsx';

const QUALITY_KEY = 'lightkeeper.quality';

function isTouch(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

function savedTier(): QualityTier | null {
  try {
    const value = localStorage.getItem(QUALITY_KEY);
    return isQualityTier(value) ? value : null;
  } catch {
    return null;
  }
}

function startingTier(): QualityTier {
  const fromAddress = new URLSearchParams(location.search).get('quality');
  if (isQualityTier(fromAddress)) return fromAddress;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return savedTier() ?? chooseQuality({ touch: isTouch(), memoryGb: nav.deviceMemory, cores: nav.hardwareConcurrency });
}

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [stats, setStats] = useState<GameStats | null>(null);
  const [tier] = useState(startingTier);
  const [aiming, setAiming] = useState(false);
  const [commanding, setCommanding] = useState(false);
  /** The command view's state for the key handler, which may run before the screen re-renders. */
  const commandingNow = useRef(false);
  const [line, setLine] = useState<{ name: string; text: string; id: number } | null>(null);
  const touch = isTouch();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let started: Game | null = null;
    const params = new URLSearchParams(location.search);
    const renderer = params.get('renderer') === 'webgpu' ? 'webgpu' : 'webgl2';
    const hero = params.get('hero') === 'woman' ? 'woman' : 'man';
    import('../game/game.ts')
      .then(({ startGame }) =>
        startGame(element, {
          tier,
          renderer,
          hero,
          assist: isTouch(),
          onAim: setAiming,
          onSay: (name, text) => {
            setLine({ name, text, id: performance.now() });
            // For the browser journeys: the last thing the companion said.
            document.body.dataset.said = text;
          },
          onStats: (s) => {
            setStats(s);
            // For the browser journeys: how many shots, and how many drones are down.
            document.body.dataset.shots = String(s.shots);
            document.body.dataset.dronesDown = String(s.dronesDown);
          },
          onReady: () => {
            setStatus({ kind: 'ready' });
            document.body.dataset.ready = 'true';
          },
        }),
      )
      .then((g) => {
        if (disposed) g.dispose();
        else {
          started = g;
          setGame(g);
        }
      })
      .catch((error: unknown) => {
        console.error(error);
        setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      disposed = true;
      started?.dispose();
    };
  }, [tier]);

  // A companion's line stays for a few seconds.
  useEffect(() => {
    if (!line) return;
    const timer = setTimeout(() => setLine(null), 2800);
    return () => clearTimeout(timer);
  }, [line]);

  const openCommand = (open: boolean) => {
    game?.setCommandView(open);
    commandingNow.current = open;
    setCommanding(open);
  };
  const give = (kind: OrderKind) => {
    game?.order(kind);
    commandingNow.current = false;
    setCommanding(false);
  };

  // On a desktop: Q (or Tab) opens and closes the command view; 1, 2 and 3 give the orders.
  useEffect(() => {
    if (!game) return;
    const keys = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ' || e.code === 'Tab') {
        e.preventDefault();
        openCommand(!commandingNow.current);
      } else if (commandingNow.current) {
        if (e.code === 'Digit1') give('go');
        else if (e.code === 'Digit2') give('attack');
        else if (e.code === 'Digit3') give('follow');
        else if (e.code === 'Escape') openCommand(false);
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });

  const changeQuality = () => {
    try {
      localStorage.setItem(QUALITY_KEY, nextTier(tier));
    } catch {
      // Storage may be blocked; the change then lasts only for this load.
    }
    const url = new URL(location.href);
    url.searchParams.set('quality', nextTier(tier));
    location.replace(url);
  };

  return (
    <main class="stage">
      <canvas ref={canvas} class="scene" aria-label="The station corridor" />
      <header class="hud">
        <p class="hud__title">Starman Lightkeeper · proof</p>
        {stats && (
          <p class="hud__stats">
            {stats.fps} fps · {stats.renderer} · {stats.activeMeshes} meshes · {stats.speed.toFixed(1)} m/s
            {stats.companionNavigation ? '' : ' · companion without navigation'}
          </p>
        )}
        {stats && (
          <p class="hud__stats">
            {stats.inCover ? 'In cover · ' : ''}Drones down: {stats.dronesDown} of 3
          </p>
        )}
        <button type="button" class="hud__button" onClick={changeQuality}>
          Quality: {tier}
        </button>
      </header>
      {status.kind === 'loading' && <p class="notice">Loading the station…</p>}
      {status.kind === 'error' && (
        <div class="notice notice--error" role="alert">
          <p>The scene could not start.</p>
          <p class="notice__detail">{status.message}</p>
        </div>
      )}
      {status.kind === 'ready' && (
        <p class="hint">
          {touch
            ? 'Left thumb moves · right thumb looks · walk into a crate for cover · Aim, then Fire · Orders for Ren'
            : 'Click to look · WASD to move · Shift to run · walk into a crate for cover · right mouse aims, left fires · Q gives Ren orders'}
        </p>
      )}
      {(aiming || commanding) && <div class="crosshair" aria-hidden="true" />}
      {line && (
        <p class="said" key={line.id} role="status">
          <span class="said__name">{line.name}:</span> {line.text}
        </p>
      )}
      {commanding && (
        <div class="orders" role="dialog" aria-label="Orders for Ren">
          <p class="orders__title">Orders for Ren · point the crosshair, then choose</p>
          <div class="orders__buttons">
            <button type="button" onClick={() => give('go')}>
              Go there {!touch && <kbd>1</kbd>}
            </button>
            <button type="button" onClick={() => give('attack')}>
              Attack {!touch && <kbd>2</kbd>}
            </button>
            <button type="button" onClick={() => give('follow')}>
              Follow me {!touch && <kbd>3</kbd>}
            </button>
            <button type="button" class="orders__back" onClick={() => openCommand(false)}>
              Back {!touch && <kbd>Q</kbd>}
            </button>
          </div>
        </div>
      )}
      {touch && game && <TouchControls input={game.input} commanding={commanding} onOrders={() => openCommand(true)} />}
    </main>
  );
}
