import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game, GameStats } from '../game/game.ts';
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
  const touch = isTouch();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let started: Game | null = null;
    const renderer = new URLSearchParams(location.search).get('renderer') === 'webgpu' ? 'webgpu' : 'webgl2';
    import('../game/game.ts')
      .then(({ startGame }) =>
        startGame(element, {
          tier,
          renderer,
          onStats: setStats,
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
            ? 'Left thumb moves · right thumb looks · Run toggles running'
            : 'Click to look around · WASD to move · Shift to run · Esc frees the mouse'}
        </p>
      )}
      {touch && game && <TouchControls input={game.input} />}
    </main>
  );
}
