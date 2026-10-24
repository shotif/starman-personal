# Dialogue: the fourth proof

*Written 24 October 2026, before building it, while the story waits for the owner (STORY.md). It
builds the machinery every conversation will use, with one short conversation with Ren to prove
it. The story's own conversations are written once D-36 to D-41 are answered.*

## Goals

1. **Talk to people.** Walk up to someone who has something to say: a *Talk* button appears on a
   phone, and **E** works on a desktop.
2. **A conversation view.** The camera frames the speaker over the hero's shoulder; the two face
   each other; the speaker gestures as they talk. Lines appear as subtitles with the speaker's name;
   tap, click, Space or Return moves on.
3. **Full lines, not paraphrases** (D-13). The player's choices are the lines the hero will say,
   in a list, each with a small mark for its manner (D-12): *mercy*, *resolve* or *ask*; a plain
   line has none. On a desktop, **1** to **4** choose.
4. **Written in ink** (OPEN_SOURCE.md §4). Tags carry the speaker, the manner of a choice and the
   line's id for its voice. Variables carry what the game knows: the hero's name, class, origin and
   moment (CREATOR.md), so a line can answer who the hero is. What is said is remembered (D-12).
5. **Tested:** every ink file compiles, and a test walks every path through every conversation to
   its end, so none can strand the player.

## Out of scope

Voices and lip sync (D-23, D-31: the line ids are there for them; the mouths come with the voices,
baked on the processor as the sliders are, since phones mishandle morph targets), interrupts, a
conversation log, and the story's conversations.

## How it works

| Part | Rule | Where |
| --- | --- | --- |
| Writing | `story/*.ink`, compiled when the game is built by a small Vite plugin; nothing to commit but the ink | `story/`, `vite.config.ts` |
| Playing | A wrapper over inkjs: the next line (speaker, text, line id) or the choices (text, manner), and the hero's facts set as ink variables | `src/game/conversation.ts` |
| Staging | The game's conversation mode: the camera, who faces whom, the talking clip, input paused | `src/game/game.ts` |
| Screens | The *Talk* prompt, the subtitles and the choice list | `src/ui/Dialogue.tsx` |

## As built

| Rule | Value | Why |
| --- | --- | --- |
| Talk reach | 3 m from the hero to the partner | Ren, following, stays within 2.6 m (`ORDERS` in `src/game/orders.ts`), so she can always be spoken to |
| Camera | Swings behind the hero to frame the partner over the shoulder, eased over about half a second; the player's look input waits | both faces readable on a narrow phone |
| Input | Movement, aim and fire wait; the stick and the fire button are let go, and the mouse is freed for the choices | nothing carries on, or fires, behind a conversation |
| Taps | A tap within 0.35 s of a new line or new choices is ignored; keys are not | a double tap cannot skip a line or pick a reply unread |
| Choice tags | Inside the brackets: `* [Do they? #manner: ask]` | ink gives a tag after the `]` to the spoken line, not to the choice; the story test fails any choice without a manner |
| Phone | A *Talk* button beside *Run* while someone is in reach; the other controls hide during the conversation | the conversation takes the screen |

Played on a phone and a desktop by the browser journey *talking to Ren* (`tests/e2e/proof.spec.ts`);
every path through every conversation, for every origin and class, by `tests/unit/story.test.ts`.
