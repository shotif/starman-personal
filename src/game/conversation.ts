import { Story } from 'inkjs';

/**
 * The story in ink (DIALOGUE.md): one story for the whole slice. Its main flow is run by the
 * director (src/game/director.ts); conversations run in a flow of their own, so the main flow waits
 * where it is while people talk, and both share the story's variables (what was said is remembered).
 */
export type Manner = 'mercy' | 'resolve' | 'ask' | 'plain';

export interface Line {
  speaker: string;
  text: string;
  /** The line's id, for its voice (D-23). */
  id: string | null;
  /** A codex entry the line opens when it is said (src/game/codex.ts). */
  codex?: string;
}

export type Beat =
  | ({ kind: 'line' } & Line)
  /** A choice's manner is null when the writer gave it none; the screen shows it as plain. */
  | { kind: 'choices'; choices: { index: number; text: string; manner: Manner | null }[] }
  | { kind: 'end' };

/** What the game tells the story about the hero (CREATOR.md). */
export interface HeroFacts {
  name: string;
  heroClass: string;
  origin: string;
  moment: string;
}

/** Ink tags of the form "key: value" as a record. */
export function parseTags(tags: readonly string[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of tags ?? []) {
    const colon = tag.indexOf(':');
    if (colon > 0) out[tag.slice(0, colon).trim()] = tag.slice(colon + 1).trim();
  }
  return out;
}

const MANNERS: readonly Manner[] = ['mercy', 'resolve', 'ask', 'plain'];
const manner = (value: string | undefined): Manner | null =>
  MANNERS.includes(value as Manner) ? (value as Manner) : null;

const TALK = 'talk';

export class StoryRunner {
  readonly story: Story;

  /** A compiled ink story, with the hero's facts set where the ink declares them. */
  constructor(json: string, facts: HeroFacts) {
    this.story = new Story(json);
    this.set('hero_name', facts.name);
    this.set('hero_class', facts.heroClass);
    this.set('hero_origin', facts.origin);
    this.set('hero_moment', facts.moment);
  }

  /** Sets a story variable, if the ink declares it. */
  set(name: string, value: string | number | boolean): void {
    try {
      this.story.variablesState.$(name, value);
    } catch {
      // The ink does not declare it; it does not need it.
    }
  }

  /** A story variable, for what the story has changed (approval, choices). */
  variable(name: string): unknown {
    return this.story.variablesState.$(name);
  }

  /** Starts a conversation at `knot`, in its own flow. */
  converse(knot: string): Conversation {
    return new Conversation(this, knot);
  }

  /** The whole story's state, every flow, for a save. */
  save(): string {
    return this.story.state.ToJson();
  }

  load(json: string): void {
    this.story.state.LoadJson(json);
    this.story.SwitchToDefaultFlow();
  }
}

export class Conversation {
  private readonly story: Story;
  private readonly runner: StoryRunner;
  readonly knot: string;
  private done = false;

  constructor(runner: StoryRunner, knot: string) {
    this.runner = runner;
    this.knot = knot;
    this.story = runner.story;
    this.story.SwitchFlow(TALK);
    this.story.ChoosePathString(knot);
  }

  next(): Beat {
    if (this.done) return { kind: 'end' };
    this.story.SwitchFlow(TALK);
    while (this.story.canContinue) {
      const text = (this.story.Continue() ?? '').trim();
      if (!text) continue;
      const tags = parseTags(this.story.currentTags);
      return { kind: 'line', speaker: tags.speaker ?? 'narrator', text, id: tags.line ?? null, codex: tags.codex };
    }
    const choices = this.story.currentChoices;
    if (choices.length > 0) {
      return {
        kind: 'choices',
        choices: choices.map((c) => ({
          index: c.index,
          text: c.text.trim(),
          manner: manner(parseTags(c.tags).manner),
        })),
      };
    }
    // Over: back to the main flow, and the talk flow is cleared for the next conversation.
    this.done = true;
    this.story.SwitchToDefaultFlow();
    this.story.RemoveFlow(TALK);
    return { kind: 'end' };
  }

  choose(index: number): void {
    this.story.SwitchFlow(TALK);
    this.story.ChooseChoiceIndex(index);
  }

  /** A story variable, for what the conversation changed (approval, flags). */
  variable(name: string): unknown {
    return this.runner.variable(name);
  }
}
