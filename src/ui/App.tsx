import { useEffect, useState } from 'preact/hooks';
import { loadManifest } from '../game/appearance.ts';
import { createAudio } from '../game/audio.ts';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../game/defences.ts';
import type { Renderer } from '../game/engine.ts';
import type { SaveData } from '../game/game.ts';
import { checkLooks, defaultLooks, type Looks, type Manifest } from '../game/looks.ts';
import { Creator } from './Creator.tsx';
import { GameView } from './GameView.tsx';
import { DIFFICULTY_KEY, HERO_KEY, load, PICTURES, SAVE_KEY, SOUND_ROUTE_KEY, save, startingTier } from './settings.ts';

/** One sound system for the whole visit: the title's music runs on into the game's. */
const audio = createAudio();

type Screen =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'title' }
  | { kind: 'creator' }
  | { kind: 'game'; saved: SaveData | null };

/** The chapters' names, by checkpoint, for the title's Continue. */
const CHAPTERS: Record<string, string> = {
  night_shift: 'Night shift',
  range: 'The range',
  to_control: 'The lights go',
  control: 'Control',
  concourse: 'The concourse',
  mast: 'The mast',
  escort: 'The night shift',
  gate: 'The gate',
  hangar: 'The hangar',
  bridge: 'Lantern',
};

function readSave(manifest: Manifest): SaveData | null {
  try {
    const data = JSON.parse(load(SAVE_KEY) ?? 'null') as SaveData | null;
    if (data?.version !== 1 || typeof data.story !== 'string') return null;
    const looks = checkLooks(manifest, data.looks);
    return looks ? { ...data, looks } : null;
  } catch {
    return null;
  }
}

function readDifficulty(): Difficulty {
  const value = load(DIFFICULTY_KEY);
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : 'standard';
}

/**
 * The screens: the title (Continue, New game), the character creator (CREATOR.md), and the game.
 * `?play` goes straight into a new game with the saved hero or the defaults (the browser journeys use
 * it); `?chapter=<name>` starts there; `?creator` opens the creator; `?hero=woman` picks the default
 * woman; `?class=<id>` plays as a class.
 */
export function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [looks, setLooks] = useState<Looks | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [saved, setSaved] = useState<SaveData | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(readDifficulty);
  const [tier] = useState(startingTier);
  const params = new URLSearchParams(location.search);
  const renderer: Renderer = params.get('renderer') === 'webgpu' ? 'webgpu' : 'webgl2';

  // Browsers allow sound only after the player touches or presses something. On a touch screen
  // that is the lift of the finger, not the touch: Chrome on Android left the sound suspended when
  // it was started on `pointerdown` (the owner's phone, 25 October 2026). So every one of these
  // tries, until the sound runs.
  useEffect(() => {
    if (load(SOUND_ROUTE_KEY) === 'media') audio.setRoute('media');
    const unlock = () => audio.unlock();
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    for (const e of events) window.addEventListener(e, unlock, { capture: true });
    return () => {
      for (const e of events) window.removeEventListener(e, unlock, { capture: true });
    };
  }, []);
  useEffect(() => {
    if (screen.kind === 'title' || screen.kind === 'creator') audio.music('title');
  }, [screen.kind]);

  useEffect(() => {
    loadManifest()
      .then((m) => {
        setManifest(m);
        let hero: Looks | null = null;
        try {
          hero = checkLooks(m, JSON.parse(load(HERO_KEY) ?? 'null'));
        } catch {
          hero = null;
        }
        const body = params.get('hero') === 'woman' ? 'woman' : 'man';
        const chosen = hero ?? defaultLooks(m, body);
        // For testing: `?class=<id>` plays the hero as that class.
        const heroClass = params.get('class');
        setLooks(heroClass ? { ...chosen, heroClass } : chosen);
        setSaved(readSave(m));
        if (params.has('play') || params.has('chapter')) setScreen({ kind: 'game', saved: null });
        else if (params.has('creator')) setScreen({ kind: 'creator' });
        else setScreen({ kind: 'title' });
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
  if (screen.kind === 'title') {
    const cycle = () => {
      const next = DIFFICULTIES[(DIFFICULTIES.indexOf(difficulty) + 1) % DIFFICULTIES.length] ?? 'standard';
      setDifficulty(next);
      save(DIFFICULTY_KEY, next);
    };
    return (
      <main class="title">
        <picture class="title__art">
          <source media="(orientation: portrait)" srcset={`${PICTURES}keyart-tall.webp`} />
          <img src={`${PICTURES}keyart-wide.webp`} alt="" />
        </picture>
        <div class="title__panel">
          <p class="title__kicker">Starman</p>
          <h1 class="title__name">Lightkeeper</h1>
          <p class="title__tagline">Ross 128 is going dark.</p>
          <div class="title__buttons">
            {saved && (
              <button type="button" class="title__primary" onClick={() => setScreen({ kind: 'game', saved })}>
                Continue
                <span class="title__sub">
                  {saved.looks.name || 'Your hero'} · {CHAPTERS[saved.checkpoint] ?? saved.checkpoint}
                </span>
              </button>
            )}
            <button type="button" class={saved ? '' : 'title__primary'} onClick={() => setScreen({ kind: 'creator' })}>
              New game
            </button>
            <button type="button" onClick={cycle}>
              Difficulty: {DIFFICULTY[difficulty].name}
            </button>
          </div>
          <p class="title__fiction">
            Fiction. Ross 128 and its planet are real; Calder Station and everything that happens there are not.
          </p>
        </div>
      </main>
    );
  }
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
          setScreen({ kind: 'game', saved: null });
        }}
      />
    );
  }
  return (
    <GameView
      key={screen.saved?.at ?? 'new'}
      looks={screen.saved?.looks ?? looks}
      manifest={manifest}
      tier={tier}
      renderer={renderer}
      difficulty={difficulty}
      audio={audio}
      saved={screen.saved}
      onQuit={() => {
        setSaved(readSave(manifest));
        setScreen({ kind: 'title' });
      }}
    />
  );
}
