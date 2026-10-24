import { useEffect, useState } from 'preact/hooks';
import { loadManifest } from '../game/appearance.ts';
import type { Renderer } from '../game/engine.ts';
import { checkLooks, defaultLooks, type Looks, type Manifest } from '../game/looks.ts';
import { Creator } from './Creator.tsx';
import { GameView } from './GameView.tsx';
import { HERO_KEY, load, save, startingTier } from './settings.ts';

type Screen = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'creator' } | { kind: 'game' };

/**
 * The screens: the character creator first if no hero is saved (CREATOR.md), then the game.
 * `?creator` opens the creator; `?play` goes straight to the game with the saved hero or the
 * defaults (the browser journeys use it); `?hero=woman` picks the default woman.
 */
export function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [looks, setLooks] = useState<Looks | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [tier] = useState(startingTier);
  const params = new URLSearchParams(location.search);
  const renderer: Renderer = params.get('renderer') === 'webgpu' ? 'webgpu' : 'webgl2';

  useEffect(() => {
    loadManifest()
      .then((m) => {
        setManifest(m);
        let saved: Looks | null = null;
        try {
          saved = checkLooks(m, JSON.parse(load(HERO_KEY) ?? 'null'));
        } catch {
          saved = null;
        }
        const body = params.get('hero') === 'woman' ? 'woman' : 'man';
        setLooks(saved ?? defaultLooks(m, body));
        const play = params.has('play') || (saved !== null && !params.has('creator'));
        setScreen({ kind: play ? 'game' : 'creator' });
      })
      .catch((error: unknown) =>
        setScreen({ kind: 'error', message: error instanceof Error ? error.message : String(error) }),
      );
  }, []);

  if (screen.kind === 'error') {
    return (
      <div class="notice notice--error" role="alert">
        <p>The game could not start.</p>
        <p class="notice__detail">{screen.message}</p>
      </div>
    );
  }
  if (screen.kind === 'loading' || !manifest || !looks) return <p class="notice">Loading…</p>;
  if (screen.kind === 'creator') {
    return (
      <Creator
        manifest={manifest}
        initial={looks}
        tier={tier}
        renderer={renderer}
        onStart={(made) => {
          save(HERO_KEY, JSON.stringify(made));
          setLooks(made);
          setScreen({ kind: 'game' });
        }}
      />
    );
  }
  return (
    <GameView
      looks={looks}
      manifest={manifest}
      tier={tier}
      renderer={renderer}
      onChangeHero={() => setScreen({ kind: 'creator' })}
    />
  );
}
