import { useEffect, useRef, useState } from 'preact/hooks';
import type { Beat, Conversation, Manner } from '../game/conversation.ts';

/** How long a new line or a new set of choices ignores taps and clicks. */
const TAP_SETTLE_MS = 350;

/** The marks on the hero's choices (D-12); a plain line has none. */
const MANNER_MARKS: Partial<Record<Manner, string>> = { mercy: 'mercy', resolve: 'resolve', ask: 'ask' };

export interface DialogueProps {
  conversation: Conversation;
  /** What the hero's lines are signed with. */
  heroName: string;
  touch: boolean;
  /** Who is speaking now, for the game's staging. */
  onSpeaker(who: 'hero' | 'partner' | null): void;
  /** A line is on screen: its voice plays; how long it lasts, or null if it has no voice. */
  onLine(line: { speaker: string; id: string | null; codex?: string; xp?: number }): number | null;
  /** A voiced line was skipped. */
  onSkip(): void;
  onChoose(): void;
  onEnd(): void;
}

/**
 * A conversation on screen (DIALOGUE.md): subtitles with the speaker's name, moved on by a tap, a
 * click, Space or Return; and the hero's choices as the full lines, chosen by a tap or 1 to 4.
 */
export function Dialogue({ conversation, heroName, touch, onSpeaker, onLine, onSkip, onChoose, onEnd }: DialogueProps) {
  /** A voiced line moves on by itself when it has been spoken. */
  const autoNext = useRef<number | null>(null);
  const [beat, setBeat] = useState<Beat | null>(null);
  /** The beat on screen for the key handler, which may run before the screen re-renders. */
  const now = useRef<Beat | null>(null);
  /** When the beat came on screen: a tap in the first moments is the tail of the one before. */
  const shownAt = useRef(0);
  const settled = () => performance.now() - shownAt.current > TAP_SETTLE_MS;

  const show = (next: Beat) => {
    now.current = next;
    shownAt.current = performance.now();
    // For the browser journeys: the line on screen, or that the hero is choosing.
    document.body.dataset.line = next.kind === 'line' ? (next.id ?? '') : next.kind;
    if (next.kind === 'end') {
      onSpeaker(null);
      onEnd();
      return;
    }
    setBeat(next);
    onSpeaker(next.kind === 'line' ? (next.speaker === 'hero' ? 'hero' : 'partner') : null);
    if (autoNext.current) window.clearTimeout(autoNext.current);
    autoNext.current = null;
    if (next.kind === 'line') {
      const seconds = onLine({ speaker: next.speaker, id: next.id, codex: next.codex, xp: next.xp });
      if (seconds !== null) autoNext.current = window.setTimeout(() => advance(true), (seconds + 0.55) * 1000);
    }
  };
  /** The next line; by the player's hand it also cuts short the voice still speaking. */
  const advance = (byItself = false) => {
    if (now.current?.kind !== 'line') return;
    if (!byItself) onSkip();
    show(conversation.next());
  };
  const choose = (index: number) => {
    if (now.current?.kind !== 'choices') return;
    onChoose();
    conversation.choose(index);
    show(conversation.next());
  };

  // A conversation starts once, when it opens.
  useEffect(() => {
    document.body.dataset.talking = 'true';
    show(conversation.next());
    return () => {
      document.body.dataset.talking = 'false';
      if (autoNext.current) window.clearTimeout(autoNext.current);
    };
  }, [conversation]);

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        advance();
        return;
      }
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
      const current = now.current;
      if (digit && current?.kind === 'choices') {
        const choice = current.choices[Number(digit) - 1];
        if (choice) choose(choice.index);
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });

  if (!beat || beat.kind === 'end') return null;
  if (beat.kind === 'choices') {
    return (
      <div class="dialogue dialogue--choosing" role="dialog" aria-label="Your reply">
        <ol class="dialogue__choices">
          {beat.choices.map((choice, n) => (
            <li key={choice.index}>
              <button type="button" class="dialogue__choice" onClick={() => settled() && choose(choice.index)}>
                {!touch && <kbd>{n + 1}</kbd>}
                {choice.manner && MANNER_MARKS[choice.manner] && (
                  <span class={`dialogue__manner dialogue__manner--${choice.manner}`}>
                    {MANNER_MARKS[choice.manner]}
                  </span>
                )}
                <span>{choice.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const name = beat.speaker === 'hero' ? heroName : beat.speaker;
  return (
    <button
      type="button"
      class="dialogue dialogue--line"
      onClick={() => settled() && advance()}
      aria-label={`${name}: ${beat.text}. Next`}
    >
      <p class="dialogue__subtitle" aria-live="polite">
        <span class={`dialogue__name${beat.speaker === 'hero' ? ' dialogue__name--hero' : ''}`}>{name}</span>
        {beat.text}
      </p>
      <span class="dialogue__next" aria-hidden="true">
        {touch ? 'Tap to go on' : 'Space'}
      </span>
    </button>
  );
}
