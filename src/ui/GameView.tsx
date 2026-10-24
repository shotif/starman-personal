import { useEffect, useRef, useState } from 'preact/hooks';
import proof from '../../story/proof.ink';
import { Conversation } from '../game/conversation.ts';
import type { Renderer } from '../game/engine.ts';
import type { Game, GameStats, OrderKind } from '../game/game.ts';
import { classOf } from '../game/hero.ts';
import type { Looks, Manifest } from '../game/looks.ts';
import { nextTier, type QualityTier } from '../game/quality.ts';
import { Dialogue } from './Dialogue.tsx';
import { isTouch, QUALITY_KEY, save } from './settings.ts';
import { TouchControls } from './TouchControls.tsx';

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export interface GameViewProps {
  looks: Looks;
  manifest: Manifest;
  tier: QualityTier;
  renderer: Renderer;
  /** Back to the character creator. */
  onChangeHero(): void;
}

/** The proof: the corridor, the hero the player made, Ren and the drones. */
export function GameView({ looks, manifest, tier, renderer, onChangeHero }: GameViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [stats, setStats] = useState<GameStats | null>(null);
  const [aiming, setAiming] = useState(false);
  const [commanding, setCommanding] = useState(false);
  /** The command view's state for the key handler, which may run before the screen re-renders. */
  const commandingNow = useRef(false);
  const [line, setLine] = useState<{ name: string; text: string; id: number } | null>(null);
  const [canTalk, setCanTalk] = useState(false);
  /** The last hit the hero took, for the red flash at the edge it came from (COMBAT.md). */
  const [hit, setHit] = useState<{ side: string; id: number } | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  /** Whether a conversation is open, for the key handler, as `commandingNow` is for the command view. */
  const talkingNow = useRef(false);
  const touch = isTouch();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let started: Game | null = null;
    import('../game/game.ts')
      .then(({ startGame }) =>
        startGame(element, {
          tier,
          renderer,
          looks,
          manifest,
          assist: isTouch(),
          onAim: setAiming,
          onCanTalk: setCanTalk,
          onHit: (side) => setHit({ side, id: performance.now() }),
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
            document.body.dataset.motesLive = String(s.motesLive);
            document.body.dataset.motesDown = String(s.motesDown);
            document.body.dataset.hits = String(s.hitsTaken);
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
  }, [tier, renderer, looks, manifest]);

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

  const talk = () => {
    if (talkingNow.current || !game?.startConversation()) return;
    talkingNow.current = true;
    setLine(null);
    setConversation(
      new Conversation(proof, 'ren_range', {
        name: looks.name,
        heroClass: looks.heroClass,
        origin: looks.origin,
        moment: looks.moment,
      }),
    );
  };
  const endTalk = () => {
    game?.endConversation();
    talkingNow.current = false;
    setConversation(null);
  };

  // On a desktop: E talks; Q (or Tab) opens and closes the command view; 1, 2 and 3 give the orders.
  useEffect(() => {
    if (!game) return;
    const keys = (e: KeyboardEvent) => {
      if (talkingNow.current) {
        // The conversation reads its own keys; Tab must not leave the page mid-line.
        if (e.code === 'Tab') e.preventDefault();
        return;
      }
      if (e.code === 'KeyE' && !commandingNow.current) talk();
      else if (e.code === 'KeyQ' || e.code === 'Tab') {
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
    save(QUALITY_KEY, nextTier(tier));
    const url = new URL(location.href);
    url.searchParams.set('quality', nextTier(tier));
    location.replace(url);
  };

  return (
    <main class="stage">
      <canvas ref={canvas} class="scene" aria-label="The station corridor" />
      <header class="hud">
        <p class="hud__title">Starman Lightkeeper · proof</p>
        <p class="hud__stats">
          {looks.name || 'Your hero'} · {classOf(looks.heroClass)?.name}
        </p>
        {stats && (
          <p class="hud__stats">
            {stats.fps} fps · {stats.renderer} · {stats.activeMeshes} meshes · {stats.speed.toFixed(1)} m/s
            {stats.companionNavigation ? '' : ' · companion without navigation'}
          </p>
        )}
        {stats?.gpu && <p class="hud__stats hud__gpu">{stats.gpu}</p>}
        {stats && (
          <p class="hud__stats">
            {stats.inCover ? 'In cover · ' : ''}Drones down: {stats.dronesDown} of 3
          </p>
        )}
        {stats && (stats.motesLive > 0 || stats.motesDown > 0) && (
          <p class="hud__stats hud__swarm">
            Swarm: {stats.motesLive} flying · {stats.motesDown} down · hits taken {stats.hitsTaken}
          </p>
        )}
        <div class="hud__row">
          <button type="button" class="hud__button" onClick={changeQuality}>
            Quality: {tier}
          </button>
          <button type="button" class="hud__button" onClick={onChangeHero}>
            Change hero
          </button>
        </div>
      </header>
      {status.kind === 'loading' && <p class="notice">Loading the station…</p>}
      {status.kind === 'error' && (
        <div class="notice notice--error" role="alert">
          <p>The scene could not start.</p>
          <p class="notice__detail">{status.message}</p>
        </div>
      )}
      {status.kind === 'ready' && !conversation && (
        <p class="hint">
          {touch
            ? 'Left thumb moves · right thumb looks · walk into a crate for cover · Aim, then Fire · Orders for Ren'
            : 'Click to look · WASD to move · Shift to run · walk into a crate for cover · right mouse aims, left fires · Q gives Ren orders'}
        </p>
      )}
      {(aiming || commanding) && !conversation && <div class="crosshair" aria-hidden="true" />}
      {hit && <div class={`hit hit--${hit.side}`} key={hit.id} aria-hidden="true" />}
      {canTalk && !conversation && !commanding && !touch && (
        <p class="talk-prompt">
          <kbd>E</kbd>Talk to Ren
        </p>
      )}
      {conversation && (
        <Dialogue
          conversation={conversation}
          heroName={looks.name || 'You'}
          touch={touch}
          onSpeaker={(who) => game?.setSpeaker(who)}
          onEnd={endTalk}
        />
      )}
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
      {touch && game && (
        <TouchControls
          input={game.input}
          commanding={commanding}
          talking={conversation !== null}
          canTalk={canTalk}
          onOrders={() => openCommand(true)}
          onTalk={talk}
        />
      )}
    </main>
  );
}
