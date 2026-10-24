import { Story } from 'inkjs';

/**
 * A conversation written in ink (DIALOGUE.md): the next line or the choices, with the speaker,
 * the manner of each choice (D-12) and each line's id for its voice (D-23), read from ink tags.
 */
export type Manner = 'mercy' | 'resolve' | 'ask' | 'plain';

export type Beat =
  | { kind: 'line'; speaker: string; text: string; id: string | null }
  /** A choice's manner is null when the writer gave it none; the screen shows it as plain. */
  | { kind: 'choices'; choices: { index: number; text: string; manner: Manner | null }[] }
  | { kind: 'end' };

/** What the game tells a conversation about the hero (CREATOR.md). */
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

export class Conversation {
  private readonly story: Story;

  /** Starts `knot` in a compiled ink story, with the hero's facts set where the ink declares them. */
  constructor(json: string, knot: string, facts: HeroFacts) {
    this.story = new Story(json);
    const set = (name: string, value: string) => {
      try {
        this.story.variablesState.$(name, value);
      } catch {
        // The ink does not declare it; it does not need it.
      }
    };
    set('hero_name', facts.name);
    set('hero_class', facts.heroClass);
    set('hero_origin', facts.origin);
    set('hero_moment', facts.moment);
    this.story.ChoosePathString(knot);
  }

  next(): Beat {
    while (this.story.canContinue) {
      const text = (this.story.Continue() ?? '').trim();
      if (!text) continue;
      const tags = parseTags(this.story.currentTags);
      return { kind: 'line', speaker: tags.speaker ?? 'narrator', text, id: tags.line ?? null };
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
    return { kind: 'end' };
  }

  choose(index: number): void {
    this.story.ChooseChoiceIndex(index);
  }

  /** A story variable, for what the conversation changed (approval, flags). */
  variable(name: string): unknown {
    return this.story.variablesState.$(name);
  }
}
