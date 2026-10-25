/**
 * What people say in a fight (D-67; ACT1_ART.md §2), every line voiced (D-23): the companions'
 * answers to orders and their calls, each in their own words, and the Banked's calls and what they
 * say to the hero. Pure data and rules: the game says the lines, and scripts/art/voices.ts voices
 * them with the story's. `how` is the delivery the voice is given (a tag the voice model reads and
 * does not speak).
 */

export interface FightLine {
  id: string;
  /** Who says it: a name in the cast (scripts/art/voices.ts CAST). */
  speaker: string;
  text: string;
  how: string;
}

/** A companion's call: the answers to an order, and what happens to them. */
export type CompanionCall =
  | 'follow'
  | 'hold'
  | 'attack'
  | 'unreachable'
  | 'noTarget'
  | 'arrived'
  | 'targetDown'
  | 'down'
  // What they call out about the Banked.
  | 'engineer'
  | 'barrierDown'
  | 'motes';

export type CompanionName = 'Ren' | 'Jo' | 'Mira';

const HOW: Record<CompanionCall, string> = {
  follow: '[brisk]',
  hold: '[brisk]',
  attack: '[focused]',
  unreachable: '[frustrated]',
  noTarget: '[searching]',
  arrived: '[low, steady]',
  targetDown: '[quick, satisfied]',
  down: '[in pain, urgent]',
  engineer: '[urgent, warning]',
  barrierDown: '[urgent, shouting]',
  motes: '[alarmed, warning]',
};

/** Each companion's words for each call; the first is said first. */
const WORDS: Record<CompanionName, Record<CompanionCall, string[]>> = {
  Ren: {
    follow: ['With you.', 'Right behind you.'],
    hold: ['Moving.', 'Going.'],
    attack: ['On it.', 'I have it.'],
    unreachable: ["I can't reach that."],
    noTarget: ['No target there.'],
    arrived: ['In position.'],
    targetDown: ['Target down.', "That one's done."],
    down: ["I'm down!", "I'm hit. I'm down."],
    engineer: ["Their engineer's shielding them!"],
    barrierDown: ["The barrier's down. Now!"],
    motes: ['Motes, coming in!'],
  },
  Jo: {
    follow: ['Right with you.', 'Coming, coming.'],
    hold: ['Aye, going.', 'Moving up.'],
    attack: ['On it.', 'Leave it to me.'],
    unreachable: ['No way through there.'],
    noTarget: ["There's nothing there."],
    arrived: ["I'm set."],
    targetDown: ["That's one.", 'Got it!'],
    down: ["I'm down! Somebody!", "Ah, I'm hit, I'm down!"],
    engineer: ['That engineer keeps patching them up!'],
    barrierDown: ["His barrier's gone, hit him!"],
    motes: ['Motes! Heads up!'],
  },
  Mira: {
    follow: ['With you.', "I'm here."],
    hold: ["All right, I'm moving.", 'Going.'],
    attack: ['I see it.', 'On it.'],
    unreachable: ["I can't get there from here."],
    noTarget: ["I don't see anything there."],
    arrived: ["I'm in place."],
    targetDown: ["It's down.", 'Down.'],
    down: ["I'm hit. I need a hand!", "I'm down!"],
    engineer: ["The engineer's shielding the others."],
    barrierDown: ["His barrier's down!"],
    motes: ['Motes, above us!'],
  },
};

/** A Banked call: what one does or sees in a fight, and what they say to the hero. */
export type BankedCall =
  | 'spotted'
  | 'cover'
  | 'flank'
  | 'fallBack'
  | 'suppress'
  | 'shield'
  | 'motes'
  | 'exposed'
  | 'barrierDown'
  | 'barrierBack'
  | 'allyDown'
  | 'last'
  | 'lifted'
  | 'blinded'
  | 'heroDown'
  | 'taunt';

/**
 * The squad's five voices, one for each of its members in order (banked.ts's pool: three troopers,
 * the engineer, the warden), of mixed accents: the Banked come from every power (STORY.md §3).
 */
export const BANKED_VOICES = ['Trooper1', 'Trooper2', 'Trooper3', 'Engineer', 'Warden'] as const;
export type BankedVoice = (typeof BANKED_VOICES)[number];
/** How a caption names each. */
export const BANKED_NAMES: Record<BankedVoice, string> = {
  Trooper1: 'Banked trooper',
  Trooper2: 'Banked trooper',
  Trooper3: 'Banked trooper',
  Engineer: 'Banked engineer',
  Warden: 'Banked warden',
};

/** Each call: who may say it, how, and the words (each voice says each wording). */
const BANKED_WORDS: Record<
  BankedCall,
  { who: 'trooper' | 'engineer' | 'warden' | 'any'; how: string; words: string[] }
> = {
  spotted: {
    who: 'trooper',
    how: '[urgent, commanding]',
    words: ["Contact. Lantern's captain.", 'Eyes on them.', 'There they are.'],
  },
  cover: { who: 'trooper', how: '[brisk]', words: ['Moving.', 'In cover.'] },
  flank: { who: 'trooper', how: '[low, urgent]', words: ["I'm going round. Keep them busy.", 'Flanking. Cover me.'] },
  fallBack: { who: 'trooper', how: '[in pain, urgent]', words: ["I'm hit. Pulling back.", 'Falling back!'] },
  suppress: { who: 'trooper', how: '[commanding]', words: ['Keep their heads down.', "They're dug in. Pin them."] },
  shield: { who: 'engineer', how: '[focused, calm]', words: ['Shield on you. Hold still.', "You're covered."] },
  motes: { who: 'engineer', how: '[focused, calm]', words: ['Sending the motes.', 'Motes out.'] },
  exposed: {
    who: 'engineer',
    how: '[urgent, frightened]',
    words: ["They're on me, I need cover!", "My shield's gone!"],
  },
  barrierDown: {
    who: 'warden',
    how: '[gruff, strained]',
    words: ["Barrier's down. Give me eight seconds.", "Barrier's gone!"],
  },
  barrierBack: { who: 'warden', how: '[gruff, determined]', words: ["It's back. Push.", "Barrier's up. Move."] },
  allyDown: {
    who: 'any',
    how: '[shocked, shouting]',
    words: ["We've lost one.", 'No. Get up. Get up.', 'They got one of us!'],
  },
  last: {
    who: 'any',
    how: '[frightened, breathing hard]',
    words: ["It's just me. Somebody answer.", "I'm the last one."],
  },
  lifted: { who: 'any', how: '[panicked]', words: ["I'm off the deck!", 'Put me down!'] },
  blinded: { who: 'any', how: '[panicked]', words: ["I can't see!", "I can't see a thing!"] },
  heroDown: { who: 'any', how: '[quiet, almost kind]', words: ['Stay down. Please.', "They're down. Hold."] },
  taunt: {
    who: 'any',
    how: '[calm, earnest, calling across a room]',
    words: [
      "It's going out anyway, Captain. All of it.",
      "We're keeping it safe. Why won't you let us?",
      "Put it down. There's a place for you with us.",
    ],
  },
};

const KIND_OF: Record<BankedVoice, 'trooper' | 'engineer' | 'warden'> = {
  Trooper1: 'trooper',
  Trooper2: 'trooper',
  Trooper3: 'trooper',
  Engineer: 'engineer',
  Warden: 'warden',
};

/** The lines one of the Banked may say for a call, in order; none if the call is not theirs. */
export function bankedLines(voice: BankedVoice, call: BankedCall): FightLine[] {
  const spec = BANKED_WORDS[call];
  if (spec.who !== 'any' && spec.who !== KIND_OF[voice]) return [];
  return spec.words.map((text, i) => ({
    id: `fight_${voice.toLowerCase()}_${snake(call)}_${i + 1}`,
    speaker: voice,
    text,
    how: spec.how,
  }));
}

/**
 * When the Banked speak (ACT1_ART.md §2): at least `gap` seconds apart; the same line not again
 * within `repeat`; a death, a broken barrier, the last one standing and the hero down go first; a
 * line to the hero once a fight, only after `tauntAfter` seconds of it and `quietFor` of quiet.
 * The companions' calls about them are at most one every `companionGap`.
 */
export const TALK = { gap: 2.5, repeat: 30, tauntAfter: 8, quietFor: 4, companionGap: 6 };
const FIRST: ReadonlySet<BankedCall> = new Set(['allyDown', 'barrierDown', 'last', 'heroDown']);

export interface TalkState {
  /** When the fight began, and when the Banked last spoke (seconds). */
  began: number;
  lastAt: number;
  /** When each line was last said. */
  said: Record<string, number>;
  taunted: boolean;
}

export const newTalk = (now: number): TalkState => ({ began: now, lastAt: -Infinity, said: {}, taunted: false });

/**
 * Whether one of the Banked says something for a call now, and which line: the one said longest
 * ago, or never. `busy` is whether a fight line is being said now (one voice at a time).
 */
export function bankedSays(
  state: TalkState,
  lines: readonly FightLine[],
  call: BankedCall,
  now: number,
  busy: boolean,
): { line: FightLine | null; state: TalkState } {
  const none = { line: null, state };
  if (lines.length === 0) return none;
  const first = FIRST.has(call);
  if (!first && (busy || now - state.lastAt < TALK.gap)) return none;
  if (call === 'taunt' && (state.taunted || now - state.began < TALK.tauntAfter || now - state.lastAt < TALK.quietFor))
    return none;
  const fresh = lines.filter((l) => now - (state.said[l.id] ?? -Infinity) >= TALK.repeat);
  if (fresh.length === 0) return none;
  const line = fresh.reduce((a, b) => ((state.said[a.id] ?? -Infinity) <= (state.said[b.id] ?? -Infinity) ? a : b));
  return {
    line,
    state: {
      ...state,
      lastAt: now,
      said: { ...state.said, [line.id]: now },
      taunted: state.taunted || call === 'taunt',
    },
  };
}

const snake = (call: string) => call.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** The lines for one companion's call, in order. */
export function companionLines(name: CompanionName, call: CompanionCall): FightLine[] {
  return WORDS[name][call].map((text, i) => ({
    id: `fight_${name.toLowerCase()}_${snake(call)}_${i + 1}`,
    speaker: name,
    text,
    how: HOW[call],
  }));
}

/** Every line said in a fight, for the voices. */
export function fightLines(): FightLine[] {
  return [
    ...(Object.keys(WORDS) as CompanionName[]).flatMap((name) =>
      (Object.keys(WORDS[name]) as CompanionCall[]).flatMap((call) => companionLines(name, call)),
    ),
    ...BANKED_VOICES.flatMap((voice) =>
      (Object.keys(BANKED_WORDS) as BankedCall[]).flatMap((call) => bankedLines(voice, call)),
    ),
  ];
}

/**
 * Which of a call's lines to say: the next after the one said last, so a fight does not hear the
 * same words twice running. `said` remembers, by call, how many times each has been said.
 */
export function nextLine(lines: FightLine[], said: Map<string, number>): FightLine | null {
  const first = lines[0];
  if (!first) return null;
  const key = first.id.replace(/_\d+$/, '');
  const n = said.get(key) ?? 0;
  said.set(key, n + 1);
  return lines[n % lines.length] ?? first;
}
