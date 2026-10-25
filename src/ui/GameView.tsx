import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameAudio, SoundStatus } from '../game/audio.ts';
import { CODEX } from '../game/codex.ts';
import type { Conversation } from '../game/conversation.ts';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../game/defences.ts';
import type { Renderer } from '../game/engine.ts';
import type { Ending, Game, GameStats, OrderKind, Prompt, SaveData, Vitals } from '../game/game.ts';
import type { Looks, Manifest } from '../game/looks.ts';
import { nextTier, type QualityTier } from '../game/quality.ts';
import { Codex, keepCodex, readCodex } from './Codex.tsx';
import { Dialogue } from './Dialogue.tsx';
import { GrowthScreen } from './Growth.tsx';
import { StarMap } from './StarMap.tsx';
import { DIFFICULTY_KEY, isTouch, LOADING_PICTURE, PICTURES, QUALITY_KEY, SAVE_KEY, save } from './settings.ts';
import { TouchControls } from './TouchControls.tsx';

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export interface GameViewProps {
  looks: Looks;
  manifest: Manifest;
  tier: QualityTier;
  renderer: Renderer;
  difficulty: Difficulty;
  audio: GameAudio;
  /** A saved game to resume, or null for a new one. */
  saved: SaveData | null;
  /** Back to the title. */
  onQuit(): void;
  /** The story moves the hero to another place: start a new game from this save. */
  onTravel(save: SaveData): void;
}

/** Tutorial hints, in the words of the device in hand (D-02). */
const HINTS: Record<string, { touch: string; desk: string }> = {
  move: {
    touch: 'Left thumb moves · right thumb looks · Run toggles running · double-tap the left side to dodge',
    desk: 'WASD to move · click the scene, then the mouse looks · Shift runs · E talks · Space dodges · F strikes',
  },
  cover: {
    touch: 'Walk into a low crate to take cover · walk away to leave it',
    desk: 'Walk into a low crate to take cover · walk away to leave it',
  },
  aim: {
    touch: 'Aim, then hold Fire · shots turn to the nearest target',
    desk: 'Right mouse aims · left mouse fires',
  },
  powers: {
    touch:
      'Your powers sit above Fire: tap one for the machine you aim at, or the nearest ahead · Field powers prime, others set them off',
    desk: '1, 2 and 3 use your powers on what the crosshair points at, or the nearest machine ahead · Field powers prime; others set off',
  },
  orders: {
    touch: 'Orders slows time: point the crosshair, then send your people there, at a target, or back to you',
    desk: 'Q opens Orders and slows time: point, then 1 go there · 2 attack · 3 follow',
  },
};

const LEADS: Record<string, string> = {
  pyre: 'Pyre Remnant, and the Cooperative’s observatory',
  maw: 'Maw Roost, and the Wake’s black market',
  dusk: 'the Duskfolk border, where their star is dimming too',
};

/** The slice: Calder Station on Ross 128 b, run by the story (SLICE.md). */
/** The sound check's report, in a line. */
function soundLine(s: SoundStatus): string {
  const state =
    s.state === 'running'
      ? `Sound is on (${Math.round(s.rate / 100) / 10} kHz, ${Math.round(s.latency * 1000)} ms): ${s.loaded} sounds loaded${s.failed ? `, ${s.failed} failed` : ''}`
      : s.state === 'none'
        ? 'Sound has not started yet'
        : `Sound is ${s.state}`;
  return s.error ? `${state}. Last problem: ${s.error}` : `${state}.`;
}

export function GameView({
  looks,
  manifest,
  tier,
  renderer,
  difficulty: startDifficulty,
  audio,
  saved,
  onQuit,
  onTravel,
}: GameViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [stats, setStats] = useState<GameStats | null>(null);
  const [aiming, setAiming] = useState(false);
  const [commanding, setCommanding] = useState(false);
  const [orderTo, setOrderTo] = useState('all');
  /** The command view's state for the key handler, which may run before the screen re-renders. */
  const commandingNow = useRef(false);
  const [line, setLine] = useState<{ name: string; text: string; id: number } | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [conversation, setConversation] = useState<{ conversation: Conversation; partner: string } | null>(null);
  const talkingNow = useRef(false);
  const [objective, setObjective] = useState<string | null>(null);
  const [caption, setCaption] = useState<{ text: string; id: number } | null>(null);
  const [hint, setHint] = useState<{ id: string; at: number } | null>(null);
  const [hit, setHit] = useState<{ side: string; id: number } | null>(null);
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [black, setBlack] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedNow = useRef(false);
  const [difficulty, setDifficulty] = useState(startDifficulty);
  const [ending, setEnding] = useState<Ending | null>(null);
  /** The prologue's card, shown between the prologue and Act 1. */
  const [card, setCard] = useState<Ending | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [note, setNote] = useState<{ text: string; id: number } | null>(null);
  const [codex, setCodex] = useState<string[]>(readCodex);
  const [sound, setSound] = useState<SoundStatus>(() => audio.status());
  const [plain, setPlain] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  /** The star map, open over the bridge. */
  const [map, setMap] = useState(false);
  const mapNow = useRef(false);
  const [flash, setFlash] = useState<number | null>(null);
  /** A shot to watch (the ship leaving): the controls step aside. */
  const [shot, setShot] = useState(false);
  /** Points the hero and companions have to spend, the growth screen, and a level's news. */
  const [growthPoints, setGrowthPoints] = useState(0);
  const [growing, setGrowing] = useState(false);
  const [levelNews, setLevelNews] = useState<{ level: number; powers: string[]; id: number } | null>(null);
  const touch = isTouch();
  const chapterAtStart = saved?.checkpoint ?? new URLSearchParams(location.search).get('chapter') ?? 'night_shift';
  const debug = new URLSearchParams(location.search).has('debug');

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let started: Game | null = null;
    const params = new URLSearchParams(location.search);
    import('../game/game.ts')
      .then(({ startGame }) =>
        startGame(element, {
          tier,
          renderer,
          looks,
          manifest,
          assist: isTouch(),
          difficulty: startDifficulty,
          audio,
          save: saved,
          chapter: params.get('chapter'),
          onAim: setAiming,
          onSay: (name, text) => {
            setLine({ name, text, id: performance.now() });
            // For the browser journeys: the last thing said.
            document.body.dataset.said = text;
          },
          onNote: (text) => setNote({ text, id: performance.now() }),
          onPrompt: (p) => {
            setPrompt(p);
            document.body.dataset.prompt = p?.label ?? '';
          },
          onConversation: (c, partner) => {
            talkingNow.current = true;
            setLine(null);
            setConversation({ conversation: c, partner });
          },
          onObjective: (text) => {
            if (text) audio.play('objective', { volume: 0.6 });
            setObjective(text);
            document.body.dataset.objective = text ?? '';
          },
          onCaption: (text) => setCaption({ text, id: performance.now() }),
          onHint: (id) => setHint({ id, at: performance.now() }),
          onHit: (side) => {
            setHit({ side, id: performance.now() });
            document.body.dataset.hits = String(Number(document.body.dataset.hits ?? 0) + 1);
          },
          onVitals: (v) => {
            setVitals(v);
            // For the browser journeys: the hero's state.
            document.body.dataset.condition = v.condition.kind;
            document.body.dataset.shield = v.shield.toFixed(2);
            document.body.dataset.health = v.health.toFixed(2);
          },
          onFade: setBlack,
          onSave: (data, quiet) => {
            save(SAVE_KEY, JSON.stringify(data));
            if (quiet) return;
            audio.play('saved', { volume: 0.4 });
            setSavedAt(performance.now());
            document.body.dataset.checkpoint = data.checkpoint;
          },
          onCodex: (id) => {
            setCodex((open) => {
              if (open.includes(id)) return open;
              const next = [...open, id];
              keepCodex(next);
              const title = CODEX.find((e) => e.id === id)?.title ?? id;
              setNote({ text: `Codex: ${title}`, id: performance.now() });
              return next;
            });
          },
          onTravel: (s) => onTravel(s),
          onMap: () => {
            mapNow.current = true;
            setMap(true);
          },
          onFlash: () => setFlash(performance.now()),
          onShot: setShot,
          onLevel: (level, powers) => {
            setLevelNews({ level, powers, id: performance.now() });
            document.body.dataset.level = String(level);
          },
          onGrowth: (points) => {
            setGrowthPoints(points);
            document.body.dataset.growthPoints = String(points);
          },
          onCard: (_card, e) => {
            setCard(e);
            document.body.dataset.card = 'prologue';
          },
          onEnd: (e) => {
            setEnding(e);
            document.body.dataset.ended = 'true';
          },
          onStats: (s) => setStats(s),
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
  }, [tier, renderer, looks, manifest]);

  // A line said in the world stays for a few seconds, longer for longer lines.
  useEffect(() => {
    if (!line) return;
    const timer = setTimeout(() => setLine(null), 2200 + line.text.length * 45);
    return () => clearTimeout(timer);
  }, [line]);
  useEffect(() => {
    if (!caption) return;
    const timer = setTimeout(() => setCaption(null), 5200);
    return () => clearTimeout(timer);
  }, [caption]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 9000);
    return () => clearTimeout(timer);
  }, [hint]);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 1400);
    return () => clearTimeout(timer);
  }, [note]);
  useEffect(() => {
    if (!levelNews) return;
    const timer = setTimeout(() => setLevelNews(null), 6000);
    return () => clearTimeout(timer);
  }, [levelNews]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const openCommand = (open: boolean) => {
    if (open && (talkingNow.current || pausedNow.current)) return;
    game?.setCommandView(open);
    commandingNow.current = open;
    setCommanding(open);
  };
  const give = (kind: OrderKind) => {
    game?.order(kind, orderTo);
    commandingNow.current = false;
    setCommanding(false);
  };
  const endTalk = () => {
    game?.endConversation();
    talkingNow.current = false;
    setConversation(null);
  };
  const pause = (on: boolean) => {
    if (!on) {
      setReading(false);
      setGrowing(false);
    }
    if (on) setSound(audio.status());
    pausedNow.current = on;
    setPaused(on);
    game?.setPaused(on);
  };
  /**
   * The sound check: from this tap, Ren's first line played the plain way (a page audio element, as
   * any web page plays sound), then the game's own chime; what the sound reports, a moment later.
   * Which of the two is heard says where a silent phone loses the sound.
   */
  const checkSound = () => {
    // A new sound system, from this tap.
    audio.restart();
    const plain = new Audio(`${import.meta.env.BASE_URL}assets/voices/ren_night_01.mp3`);
    setPlain('playing');
    plain.play().then(
      () => undefined,
      (e: unknown) => setPlain(`blocked (${e instanceof Error ? e.message : String(e)})`),
    );
    window.setTimeout(() => audio.play('objective'), 3600);
    window.setTimeout(() => setSound(audio.status()), 4000);
  };

  const changeDifficulty = () => {
    const next = DIFFICULTIES[(DIFFICULTIES.indexOf(difficulty) + 1) % DIFFICULTIES.length] ?? 'standard';
    setDifficulty(next);
    game?.setDifficulty(next);
    save(DIFFICULTY_KEY, next);
  };
  const changeQuality = () => {
    save(QUALITY_KEY, nextTier(tier));
    location.reload();
  };

  // On a desktop: E talks or uses; Q (or Tab) opens Orders, 1, 2 and 3 give them; Escape pauses.
  useEffect(() => {
    if (!game) return;
    const keys = (e: KeyboardEvent) => {
      // The star map has keys of its own.
      if (mapNow.current) return;
      if (talkingNow.current) {
        if (e.code === 'Tab') e.preventDefault();
        return;
      }
      if (e.code === 'Escape' && !commandingNow.current) {
        pause(!pausedNow.current);
        return;
      }
      if (pausedNow.current) return;
      if (e.code === 'KeyE' && !commandingNow.current) game.interact();
      else if (!commandingNow.current && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        game.usePower(Number(e.code.slice(5)) - 1);
      } else if (e.code === 'KeyQ' || e.code === 'Tab') {
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

  const team = game?.companions() ?? [];
  const down = vitals?.condition.kind === 'down' ? vitals.condition : null;
  const hintText = hint ? HINTS[hint.id] : null;

  return (
    <main class="stage">
      <canvas ref={canvas} class="scene" aria-label="Calder Station" />
      {status.kind === 'ready' && !ending && !card && !map && !shot && (
        <header class="hud">
          {objective && !conversation && (
            <p class="objective" key={objective}>
              <span class="objective__mark" aria-hidden="true">
                ◆
              </span>{' '}
              {objective}
            </p>
          )}
          {vitals && (
            <section class="vitals" aria-label="Shield and health">
              <div class="bar bar--shield">
                <span style={{ width: `${Math.round(vitals.shield * 100)}%` }} />
              </div>
              <div class="bar bar--health">
                <span style={{ width: `${Math.round(vitals.health * 100)}%` }} />
                <i style={{ left: '25%' }} />
                <i style={{ left: '50%' }} />
                <i style={{ left: '75%' }} />
              </div>
              {vitals.companions.map((c) => (
                <p class={`vitals__companion${c.down ? ' vitals__companion--down' : ''}`} key={c.name}>
                  {c.name}
                  {c.down ? ' · down' : ''}
                  <span class="mini">
                    <span class="mini__shield" style={{ width: `${Math.round(c.shield * 100)}%` }} />
                    <span class="mini__health" style={{ width: `${Math.round(c.health * 100)}%` }} />
                  </span>
                </p>
              ))}
            </section>
          )}
          {debug && stats && (
            <p class="hud__stats">
              {stats.fps} fps · {stats.renderer} · {stats.activeMeshes} meshes · {stats.gpu}
            </p>
          )}
        </header>
      )}
      {status.kind === 'ready' && !ending && !card && !map && !shot && (
        <button type="button" class="pause-button" aria-label="Pause" onClick={() => pause(true)}>
          ❚❚
        </button>
      )}
      {status.kind === 'loading' && (
        <div
          class="loading"
          style={{
            backgroundImage: `url(${PICTURES}${saved?.place === 'lantern' ? 'loading-lantern' : (LOADING_PICTURE[chapterAtStart] ?? 'loading-lounge')}.webp)`,
          }}
        >
          <p class="loading__text">Loading Calder Station…</p>
        </div>
      )}
      {status.kind === 'error' && (
        <div class="notice notice--error" role="alert">
          <p>The game could not start.</p>
          <p class="notice__detail">{status.message}</p>
        </div>
      )}
      {caption && !map && (
        <p class="caption" key={caption.id}>
          {caption.text}
        </p>
      )}
      {hintText && !conversation && !commanding && (
        <p class="hint" key={hint?.at}>
          {touch ? hintText.touch : hintText.desk}
        </p>
      )}
      {savedAt && <p class="saved">Saved</p>}
      {note && (
        <p class="note" key={note.id}>
          {note.text}
        </p>
      )}
      {vitals && !touch && !conversation && !ending && !card && !map && !shot && status.kind === 'ready' && (
        <section class="powers" aria-label="Powers">
          {vitals.powers.map((p, i) => (
            <button
              type="button"
              key={p.id}
              class={`power${p.waiting > 0 ? ' power--waiting' : ''}`}
              onClick={() => game?.usePower(i)}
            >
              <span class="power__fill" style={{ height: `${Math.round(p.waiting * 100)}%` }} />
              <kbd>{i + 1}</kbd>
              <span class="power__name">{p.name}</span>
            </button>
          ))}
          {vitals.effects.length > 0 && <p class="powers__effects">{vitals.effects.join(' · ')}</p>}
        </section>
      )}
      {(aiming || commanding) && !conversation && <div class="crosshair" aria-hidden="true" />}
      {hit && <div class={`hit hit--${hit.side}`} key={hit.id} aria-hidden="true" />}
      {vitals && vitals.health < 0.35 && vitals.condition.kind === 'up' && <div class="wounded" aria-hidden="true" />}
      {prompt && !conversation && !commanding && !touch && !map && (
        <p class="talk-prompt">
          <kbd>E</kbd>
          {prompt.label}
        </p>
      )}
      {down && (
        <div class="down" role="alert">
          <p class="down__title">You’re down</p>
          <p class="down__detail">
            {vitals?.helpComing ? 'Hold on. Help is coming.' : 'Back to just before the fight in a moment.'}{' '}
            {Math.ceil(down.left)}
          </p>
        </div>
      )}
      {line && !conversation && (
        <p class="said" key={line.id} role="status">
          <span class="said__name">{line.name}</span> {line.text}
        </p>
      )}
      {conversation && (
        <Dialogue
          conversation={conversation.conversation}
          heroName={looks.name || 'You'}
          touch={touch}
          onSpeaker={(who) => game?.setSpeaker(who)}
          onLine={(line) => game?.speak(line) ?? null}
          onSkip={() => game?.hush()}
          onChoose={() => audio.play('ui_choice', { volume: 0.5 })}
          onEnd={endTalk}
        />
      )}
      {commanding && !paused && (
        <div class="orders" role="dialog" aria-label="Orders">
          <p class="orders__title">Orders · point the crosshair, then choose</p>
          {team.length > 1 && (
            <div class="orders__who" role="radiogroup" aria-label="Who">
              {['all', ...team].map((who) => (
                <label key={who} class={`orders__pick${orderTo === who ? ' orders__pick--on' : ''}`}>
                  <input type="radio" name="order-to" checked={orderTo === who} onChange={() => setOrderTo(who)} />
                  {who === 'all' ? 'Both' : who}
                </label>
              ))}
            </div>
          )}
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
      {touch && game && !ending && !card && !map && !shot && (
        <TouchControls
          input={game.input}
          commanding={commanding}
          talking={conversation !== null || paused || !!down}
          prompt={prompt}
          powers={vitals?.powers ?? []}
          onPower={(i) => game.usePower(i)}
          onOrders={() => openCommand(true)}
          onInteract={() => game.interact()}
        />
      )}
      {paused && (
        <div class="pause" role="dialog" aria-label="Paused">
          <p class="pause__title">Paused</p>
          <button type="button" onClick={() => pause(false)}>
            Resume
          </button>
          <button type="button" onClick={() => setGrowing(true)}>
            Growth{growthPoints > 0 && <span class="pause__badge"> · {growthPoints} to spend</span>}
          </button>
          <button type="button" onClick={() => setReading(true)}>
            Codex ({codex.length})
          </button>
          <button type="button" onClick={changeDifficulty}>
            Difficulty: {DIFFICULTY[difficulty].name}
          </button>
          <button type="button" onClick={checkSound}>
            Sound check
          </button>
          <p class="pause__note" data-testid="sound-status">
            {plain && `You should hear Ren, then a chime. Ren's line: ${plain}. `}
            {soundLine(sound)}
          </p>

          <button type="button" onClick={changeQuality}>
            Quality: {tier}
          </button>
          <button type="button" onClick={onQuit}>
            Save and quit to title
          </button>
          <p class="pause__note">The game saves at every checkpoint.</p>
        </div>
      )}
      {paused && reading && <Codex open={codex} onClose={() => setReading(false)} />}
      {paused && growing && game && <GrowthScreen game={game} looks={looks} onClose={() => setGrowing(false)} />}
      {levelNews && !paused && (
        <div class="levelup" role="status" key={levelNews.id}>
          <p class="levelup__title">Level {levelNews.level}</p>
          {levelNews.powers.length > 0 && (
            <p class="levelup__line">
              {levelNews.powers.length > 1 ? 'New powers' : 'A new power'}: {levelNews.powers.join(', ')}
            </p>
          )}
          <p class="levelup__line">Spend your points in Growth, from the pause menu.</p>
        </div>
      )}
      {black && <div class="fade" aria-hidden="true" />}
      {flash && <div key={flash} class="flash" aria-hidden="true" />}
      {map && game && (
        <StarMap
          game={game}
          onClose={() => {
            mapNow.current = false;
            setMap(false);
          }}
        />
      )}
      {card && (
        <div class="ending" role="dialog" aria-label="The end of the prologue">
          <p class="ending__kicker">End of the prologue</p>
          <h1 class="ending__title">Last light at Ross 128</h1>
          <PrologueSummary ending={card} />
          <button
            type="button"
            class="ending__go"
            onClick={() => {
              setCard(null);
              document.body.dataset.card = '';
              game?.continueStory();
            }}
          >
            Continue aboard Lantern
          </button>
          <button type="button" onClick={onQuit}>
            Back to the title
          </button>
        </div>
      )}
      {ending && (
        <div class="ending" role="dialog" aria-label="To be continued">
          <p class="ending__kicker">Act 1 · The dimming</p>
          <h1 class="ending__title">To be continued</h1>
          <p class="ending__next">
            Lantern is in the lanes, bound for Pyre Remnant. What waits there is being built, and comes in a later
            update.
          </p>
          <button type="button" onClick={onQuit}>
            Back to the title
          </button>
        </div>
      )}
    </main>
  );
}

/** What the prologue's choices came to, in a list. */
function PrologueSummary({ ending }: { ending: Ending }) {
  return (
    <ul class="ending__list">
      <li>
        {ending.tookMast
          ? 'You turned the relay by hand. The Merrow heard, and turned back.'
          : 'You brought the night shift through. The Merrow never heard the warning.'}
      </li>
      <li>
        {ending.ilyaLost
          ? 'Ilya Marsh stood in front of Dena when the machines came. He did not leave Ross 128 b.'
          : 'Everyone from the night shift came aboard.'}
      </li>
      {ending.haveCurve && <li>Ilya's readings came with you: thirty-one nights of a star going dark in steps.</li>}
      <li>Chief Hale stayed behind to keep the doors working.</li>
      <li>The surveyor is yours now, and her name is Lantern.</li>
      <li>
        {ending.renApproval >= 3
          ? 'Ren Okafor would follow you anywhere now.'
          : ending.renApproval >= 2
            ? 'Ren Okafor trusts you.'
            : ending.renApproval >= 1
              ? 'Ren Okafor is still making up her mind about you.'
              : 'Ren Okafor has doubts, and keeps them to herself.'}{' '}
        {ending.joApproval >= 2
          ? 'Jo Rook likes the way you give orders.'
          : ending.joApproval >= 1
            ? 'Jo Rook has stopped calling you the cavalry.'
            : 'Jo Rook is reserving judgement.'}
      </li>
      {ending.firstLead && <li>Your first course: {LEADS[ending.firstLead] ?? ending.firstLead}.</li>}
    </ul>
  );
}
