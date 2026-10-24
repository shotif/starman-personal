# Decisions

Every decision that shapes the game is recorded here: the question, the options, Claude's
recommendation, and the owner's answer with its date. Nothing marked **Open** is built until it is
answered (see [../CLAUDE.md](../CLAUDE.md)). Engineering choices that are small and easy to reverse
are listed under *Made without waiting* so the owner can overrule them.

Status: **Open** · **Decided** · **Assumed** (built as recommended; the owner may overrule) ·
**Deferred** (not needed until a later milestone).

## Summary

| ID | Question | Status | Answer |
| --- | --- | --- | --- |
| D-01 | How we work | Decided 2026-10-24 | As in Reborn and Control: documents and decisions first |
| D-02 | Devices | Decided 2026-10-24 | **Fully playable on phones, and a dedicated desktop experience** |
| D-03 | Hosting | Decided 2026-10-24 | GitHub Pages, deployed from `main` |
| D-04 | What the game is | Decided 2026-10-24 | The owner's brief: a 3D third-person story RPG in the style of *Mass Effect* |
| D-05 | Science fiction, not fantasy | Decided 2026-10-24 | Bold, grounded technology; no magic |
| D-06 | When it is set | Decided 2026-10-24 | Control's era, after first contact (the 2180s) |
| D-07 | The enemy | Decided 2026-10-24 | **The stars are going out** (*the Quench*, a working name), with a villain who has a face |
| D-08 | Who the hero can be | Decided 2026-10-24 | **Human lineages**: Earthborn, Spacers, Heavyworlders, the Remade; aliens as companions |
| D-09 | The hero's body and pronouns | Decided 2026-10-24 (owner's choice) | **Man or woman** |
| D-10 | Classes and loadout | Decided 2026-10-24 | Three disciplines (Arms, Systems, Field), six classes, a loadout, a mid-story specialisation |
| D-11 | The backstory | Decided 2026-10-24 | Where you are from × the moment that made you; each opens a personal quest |
| D-12 | Choices and morality | Decided 2026-10-24 | No meter; choices remembered; mercy or resolve; interrupts |
| D-13 | How dialogue is shown | Decided 2026-10-24 | Full lines in a list |
| D-14 | Companions: how many | Decided 2026-10-24 | Two at a time, about eight in all, at least two aliens |
| D-15 | Romance and rating | Decided 2026-10-24 (owner's choice) | **Mature** |
| D-16 | Commanding companions | Decided 2026-10-24 | Objectives, given in a command view that nearly stops time |
| D-17 | Combat | Decided 2026-10-24 | Cover, guns, full melee and combinable powers; assisted aim on phones |
| D-18 | The ship and travel | Decided 2026-10-24 | A ship you live on and command; encounters after the first milestone |
| D-19 | Where you play | Decided 2026-10-24 (owner's choice) | **Hand-made places plus generated landing sites** |
| D-20 | Size of 1.0, and the first milestone | Decided 2026-10-24 | The whole story planned, built in acts, starting with a playable slice |
| D-21 | Platform and engine | Decided 2026-10-24 | The browser first, on **Babylon.js** ([TECH_STACK.md](research/TECH_STACK.md)) |
| D-22 | The look, and where the 3D models come from | Decided 2026-10-24 (owner's choice) | **Semi-realistic**; open-source people and animation first, Meshy as the paid alternative; see [D-22](#d-22--the-look-and-where-the-3d-models-come-from--decided) |
| D-23 | Voices | Decided 2026-10-24 (owner's choice) | **Every line voiced**, the hero too |
| D-24 | What may be spent without asking | Decided 2026-10-24 (owner's choice) | **Up to $50** |
| D-25 | The title | Decided 2026-10-24 | ***Starman Lightkeeper*** |
| D-26 | How finished work reaches `main` | Assumed 2026-10-24 | Pushed to `main` once the checks pass, as in Reborn and Control |
| D-27 | Reuse open source | Decided 2026-10-24 (owner's direction) | Look for open-source and CC0 work first; see [OPEN_SOURCE.md](research/OPEN_SOURCE.md) |
| D-28 | What may go into the public repository | Assumed 2026-10-24 | Only files whose licence lets us share them, each recorded with its source |

## Decided from the owner's brief, 24 October 2026

### D-01 · How we work — **Decided**

"The same way of working as we used for the last two projects: docs and decision logs first."
Written down in [../CLAUDE.md](../CLAUDE.md).

### D-02 · Devices — **Decided**

Phone and desktop, as in Reborn and Control: the whole game completely playable on a phone, with a
dedicated desktop experience. For a 3D action RPG this shapes the controls (D-17), the look (D-22)
and the engine (D-21) more than anything else.

### D-03 · Hosting — **Decided**

GitHub Pages, deployed from `main` by GitHub Actions, as in Reborn and Control.

### D-04 · What the game is — **Decided**

The owner's brief, summarised in [VISION.md](VISION.md#what-the-owner-asked-for): a rich,
story-based 3D third-person RPG in the Starman universe, in the style of *Mass Effect*. One hero,
customised at the start (people, class, loadout, backstory), on a heroic mission to save the known
galaxy from an enemy that would destroy everything. Many main and side quests, each with meaning.
NPCs, some recruitable as companions who take objectives rather than direct control. Melee and
ranged combat with technological powers. The hero captains a ship rather than flying it, and plays
mostly on worlds and stations: trading, talking, investigating, taking quests.

### D-05 · Science fiction, not fantasy — **Decided**

"Grounded in science fiction, so not a lot of fantasy, no magic... Let's be bold with the
technology, so we could use quantum technology, we could use warp technology." Every power,
weapon and device works by technology, with rules, limits and a cost.

## Round 1: the story and the hero — decided 24 October 2026

### D-06 · When it is set — **Decided**

| Option | What it means |
| --- | --- |
| **A. Control's era, after first contact** (recommended) ✅ | Around the 2180s. Humanity has met the Duskfolk and the Drifters; the Absent's relics are being dug up; the second tone is heard. Reborn is history, 150 years back. Control's endings stay open: Personal does not decide who won Control's game |
| B. A generation after Control | Needs one "true" ending of Control, which every game of Control settles differently |
| C. Reborn's era | An alternative present with no aliens. The hero could only be human, and there would be no aliens to recruit |

**Recommendation: A.** It gives us aliens to meet and recruit, a live mystery, three established
powers to move between, and Reborn's places, 150 years older. It also leaves Control's own story
untouched.

**Decided:** as recommended, 24 October 2026.

### D-07 · The enemy — **Decided**

The owner asked for an enemy "trying to destroy everything in the known galaxy". It must be
grounded (D-05), and it must not resemble *Mass Effect*'s own threat (machines that wipe out
civilisations in cycles).

| Option | What it means |
| --- | --- |
| **A. The stars are going out** (working name *the Quench*) ✅ | In Reborn, Antares quietly went dark. Now nearer stars are dimming, and the worlds around them are freezing. Something is wrapping them in a swarm of machines that takes their light. Shells like this are a real idea (Dyson swarms); this one is fiction. It is spreading towards the neighbourhood. Who made it, why, and how to stop it is the story. Its dimming stars can be shown on the real star map |
| B. What answers the tone | Control's second tone is a call, and something answers it: a mind arriving along the lanes. It ties closely to Control, but it settles what Control leaves unsaid, and it comes closest to *Mass Effect*'s threat |
| C. A broken drive | A warp experiment tore space: a growing region where the lanes fail and matter comes apart, fed by a faction that believes it will remake the universe for the better |

**Recommendation: A, with a face.** The threat is physical and visible in the real sky, it ties to
Reborn's Antares, and it grows from a mystery into the end of everything. On top of it we give the
story **a person**: someone (human or alien) who leads the people who serve the swarm, met early,
with reasons good enough to argue with. That gives us a villain to confront in the middle of the
story, enemies to fight on the ground (the swarm's machines and its followers), and a threat to end.
How it connects to the Absent is a design question for later.

**Decided:** as recommended, 24 October 2026.

### D-08 · Who the hero can be — **Decided**

The owner asked for a choice of "race". Every playable people needs bodies, armour, animation and
cutscenes that work for it, and every scene must react to it. A people with the human body plan
shares one skeleton and its animations. The Duskfolk (four legs and a tail) and the Drifters (gas
giant floaters) do not.

| Option | What it means |
| --- | --- |
| A. Humans only | As in *Mass Effect*. Cheapest, deepest reactivity; no real choice of people |
| **B. Human lineages** (recommended) ✅ | Grounded, distinct peoples on one skeleton: **Earthborn** (baseline), **Spacers** (born in low gravity: tall, light, at home in zero-g), **Heavyworlders** (engineered for strong gravity: short, dense, tough) and **the Remade** (a human mind in a made body). Each has different strengths and is treated differently by others |
| C. B plus a new humanoid alien people | Invented for Personal on the human skeleton. Cheaper than D, but a humanoid alien goes against the series' rule that aliens should be truly other |
| D. Humans plus the Duskfolk | Their own body: a second skeleton, armour set and animation set for everything, and cover and melee designed for a four-legged hero |

**Recommendation: B**, with aliens as **companions** rather than player choices. A Duskfolk
companion can have its own body, and a Drifter can travel with you through a remote body it
controls. Playable Duskfolk can come later if the owner wants.

**Decided:** as recommended, 24 October 2026.

### D-09 · The hero's body and pronouns — **Decided**

The brief says "he". Many players expect to choose.

| Option | What it means |
| --- | --- |
| **A. Free choice** (recommended) | The player shapes the body (presets and sliders) and chooses pronouns (he, she or they), separately; everyone in the game uses them. If the hero is voiced (D-23), at least two hero voices |
| **B. Man or woman** ✅ | As in *Mass Effect*; two bodies and two voices |
| C. A man only | One body and one voice; the cheapest, but less "your" hero |

**Recommendation: A.** It costs a second voice, not a second story.

**Decided:** B, the owner's choice, 24 October 2026. The player chooses a man or a woman, then
shapes the face and body within that. With every line voiced (D-23), the hero has two voices.

### D-10 · Classes and loadout — **Decided**

| Option | What it means |
| --- | --- |
| **A. Three disciplines, six classes** (recommended) ✅ | **Arms** (weapons, melee, armour), **Systems** (drones, hacking, overloads, quantum-linked sensors), **Field** (implanted warp-field emitters: lift, pull, slam, barriers, short jumps). One pure class for each, and three hybrids. The class decides your powers and which weapons and armour you are trained for. You choose a starting loadout within it. Around the middle of the story each class chooses one of two specialisations |
| B. No classes | Build freely from all three trees; change at any time (as in *Andromeda*) |
| C. Three classes only | One per discipline, each with a deeper tree |

**Recommendation: A.** It is a proven structure that players read at once, it makes companions'
skills complement yours, and the third discipline gives us bold technology instead of magic. The
class names will be our own and come with the class design.

**Decided:** as recommended, 24 October 2026.

### D-11 · The backstory — **Decided**

| Option | What it means |
| --- | --- |
| **A. Two choices that matter** (recommended) ✅ | **Where you are from**: five or six origins tied to the setting, such as the Authority's orbital cities, a Cooperative farm world, a Wake den, a long-haul ship, a frontier colony beside the Duskfolk. And **the moment that made you**: about four, such as the survivor, the hero of a battle, the one who made a hard call, the one who lost someone. Each gives a starting talent, changes how certain people speak to you, and **opens a personal quest that runs through the story** |
| B. A playable prologue per origin | As in *Dragon Age: Origins*: memorable, but each is a mission of its own to build |
| C. A fixed backstory | One past, written in full |

**Recommendation: A**, with the best part of B: one scene of the opening mission plays differently
for each origin.

**Decided:** as recommended, 24 October 2026.

### D-12 · Choices and morality — **Decided**

| Option | What it means |
| --- | --- |
| **A. No meter; choices remembered** (recommended) ✅ | People remember what you did. Companions approve or object and say why; powers and peoples change their view of you. The hero is always heroic, but in their own way: mercy or resolve. Quick **interrupts** in scenes stay. Persuasion depends on what you know, who you are and your skills, not on points |
| B. A two-way meter | As in *Mass Effect*: kind and ruthless points that unlock options |
| C. Hidden consequences only | No marks, no meter; the player finds out later |

**Recommendation: A.** The meter in *Mass Effect* rewarded picking one side all game instead of
thinking about each choice.

**Decided:** as recommended, 24 October 2026.

### D-13 · How dialogue is shown — **Decided**

| Option | What it means |
| --- | --- |
| **A. Full lines in a list** (recommended) ✅ | Each choice is the actual line, with a small mark for its tone or intent. Easy to read and tap on a phone; the hero never says something the player did not choose |
| B. A wheel of short paraphrases | As in *Mass Effect*; fast, but the spoken line can surprise |
| C. A wheel of full lines | Hard to fit on a phone |

**Recommendation: A.**

**Decided:** as recommended, 24 October 2026.

### D-14 · Companions: how many — **Decided**

| Option | What it means |
| --- | --- |
| **A. Two at a time, about eight in all** (recommended) ✅ | Enough to command and few enough to follow on a phone. Each has a recruitment story, a personal quest, opinions, scenes on the ship, and talks with the others. At least two are aliens. They can leave or die through your choices, and the finale depends on them |
| B. Three at a time, about six in all | Richer fights, harder to read on a phone, fewer stories |
| C. Two at a time, about twelve in all | As in *Mass Effect 2*: more variety, each one thinner |

**Recommendation: A.**

**Decided:** as recommended, 24 October 2026.

### D-15 · Romance and rating — **Decided**

| Option | What it means |
| --- | --- |
| **A. Romance with some companions, nothing explicit** (recommended) | A few romances, written with care, as part of the companions' stories. Violence without gore, little strong language. Aimed at a teen rating |
| B. No romance | Close friendships and rivalries only |
| **C. Mature** ✅ | Explicit scenes and strong content allowed |

**Recommendation: A**, the level of the *Mass Effect* trilogy.

**Decided:** C, the owner's choice, 24 October 2026. Romances with some companions, violence
that shows its cost, strong language where people would use it, and sexual content. Two practical
notes, made without waiting:

- **Settings for the player:** a short content notice at the start, and switches to soften gore
  and language and to fade intimate scenes to black.
- **The generators have their own rules:** the image, model and voice services we use refuse
  explicit material, so intimate scenes are staged with framing, cuts and implication rather than
  explicit pictures.

## Round 2: how it plays and how it is made — decided 24 October 2026

### D-16 · Commanding companions — **Decided**

The owner's direction: objectives for the current part of the game, not full control.

| Option | What it means |
| --- | --- |
| **A. Objectives, given in a pause** (recommended) ✅ | Open the command view (time nearly stops) and give each companion a goal for this area. In combat: hold this point, take that position, flank, protect someone, focus a target, use a power on something. Outside combat: search this room, scout ahead, hack that system, watch this person, question that witness. They pursue it with their own judgement and skills, say when it is done or cannot be done, and fall back on their own sense when you give nothing. On a phone the command view is one tap away |
| B. The same, in real time | No pause: more tension, much harder on a phone |
| C. Slow motion instead of a pause | A middle way |

**Recommendation: A.**

**Decided:** as recommended, 24 October 2026.

### D-17 · Combat — **Decided**

| Option | What it means |
| --- | --- |
| **A. Cover, guns, blades and powers** (recommended) ✅ | Third person and real time. Cover you take by moving into it and leave by moving out (no sticky button). Guns carrying the series' damage types against layered defences. **Melee as a full system**: blades, batons and fists, combos, a parry and a dodge. Powers on cooldowns that combine. Skill decides hits; your build decides damage and powers. On a phone: assisted aim and target cycling. On a desktop: free aim with mouse and keyboard, and gamepads too |
| B. Action RPG with lock-on | Melee first, guns second, cover optional. Easier on a phone, less like *Mass Effect* |
| C. Stats decide hits | As in the first *Mass Effect*: your skill numbers decide accuracy |

**Recommendation: A.**

**Decided:** as recommended, 24 October 2026.

### D-18 · The ship and travel — **Decided**

| Option | What it means |
| --- | --- |
| **A. A ship you live on and command** (recommended) ✅ | Walk its decks, talk to the crew and companions, upgrade it. Set course on a star map of the real neighbourhood; the crew flies. On the way, encounters you handle from the bridge with orders and choices (a distress call, a toll gate, a boarding), and now and then a ship battle fought by your orders and watched |
| B. A star map only | The ship as a menu |
| C. A without encounters | The ship as home; travel as a short scene |

**Recommendation: A**, with the encounters after the first milestone.

**Decided:** as recommended, 24 October 2026.

### D-19 · Where you play — **Decided**

| Option | What it means |
| --- | --- |
| **A. Hand-made places** (recommended) | A few large hubs (stations and cities) full of people and stories, and many mission sites on real worlds and stations. Nothing generated to fill space |
| **B. A, plus generated landing sites** ✅ | More places for side content; the risk of filler |
| C. Open worlds with a vehicle | As in the first *Mass Effect* and *Andromeda*; costly, and the series' weakest parts |

**Recommendation: A.** A vehicle can come later if a story needs one.

**Decided:** B, the owner's choice, 24 October 2026. To keep the "no filler" rule (D-04), the
generated part is **the ground, never the story**. A landing site's layout is assembled from
hand-made pieces, and its conditions (gravity, light, temperature, the colour of its star) come
from the real planet's data or, for an unknown world, from generated values labelled *Fiction*.
Every site carries a written story or a written part of one. No quest text is generated.

### D-20 · Size of 1.0, and the first milestone — **Decided**

| Option | What it means |
| --- | --- |
| **A. The whole story planned, built in acts** (recommended) ✅ | The full story planned at the start (about 25–30 hours with side quests), then built and released act by act. First a **playable slice**: create a hero, wake on the ship, one station, the opening mission with two companions, fights, a side quest, on phone and desktop. Then Act 1 |
| B. A shorter whole game first | About 10–15 hours, complete, then expanded |
| C. A long game planned and built as one | 40 hours or more, released when finished |

**Recommendation: A.** The slice proves the hardest things (3D on a phone, combat, commands,
dialogue) before the story is built on them.

**Decided:** as recommended, 24 October 2026.

### D-21 · Platform and engine — **Decided**

Control chose the web platform with Preact (D-22 there). A 3D action RPG is far heavier.

| Option | What it means |
| --- | --- |
| **A. The browser first; the 3D engine chosen by a test** (recommended) ✅ | TypeScript, Vite, Vitest, Playwright and Preact for the screens, as in Control. For 3D, build the same small scene (a hero running, shooting and taking cover, a companion following, a station corridor) in **three.js** (the series' engine) and **Babylon.js** (more game features built in). Measure load time, frame rate and heat on a mid-range phone, then choose |
| B. A native engine first | Godot or Unity, with a web build. Better 3D tools and an easier Steam release, but weaker in phone browsers, and none of the series' code carries over |

**Recommendation: A.** Also: is a Steam or app-store release a goal? If so, it can come later by
wrapping the browser build, as planned for Control.

**Decided:** the browser first, as recommended, 24 October 2026. A Steam or app-store release is
not a goal for now and can come later by wrapping the browser build.

**The engine — Open.** The owner then asked which engine Claude thinks works best, to agree on it
before it is installed and used. The comparison is in
[research/TECH_STACK.md](research/TECH_STACK.md). **Recommendation: Babylon.js**, a full game
engine for the browser (physics, a character controller, companions' pathfinding, animation
blending and area streaming built in), open source, written in TypeScript, with the series' Preact
screens over it. The first proof on a phone confirms it instead of a full two-engine bake-off.
three.js stays the fallback, and Godot is the choice only if native apps ever come first.

**Decided:** Babylon.js, 24 October 2026. The owner: "continue setting everything up with Babylon
JS and all of the other open source suggestions". The first proof is
[design/PROOF.md](design/PROOF.md).

### D-22 · The look, and where the 3D models come from — **Decided**

The hardest practical problem. A 3D RPG needs characters (with a creator), armour, weapons,
animations, and many places, all running on a phone.

| Look | What it means |
| --- | --- |
| A. Stylised and painterly (recommended) | Strong shapes, painted textures, light doing the work. Runs well on phones and ages well |
| B. Clean low-poly with strong lighting | The cheapest to make; a familiar indie look |
| **C. Semi-realistic** ✅ | Closest to *Mass Effect*; the heaviest and the hardest on phones |

**Where models come from:** free (CC0) model and animation kits; models generated from our own
concept art by an image-to-3D service; and shapes built in code. **Recommendation: A, chosen by a
style test** (one character and one corridor in two looks), as Control's D-23 was. **Tools to ask
for:** a paid account with an image-to-3D service (for example Meshy or Tripo), and Blender on the
machine that runs the art scripts. A licence note: Mixamo's animations may not be shared as files,
which a public repository does, so we would use CC0 animation libraries instead.

**Decided:** C, semi-realistic, the owner's choice, 24 October 2026. What it means in practice:

- **Quality settings for phones are part of the design from the start:** levels of detail for every
  model, compressed textures, baked light where it does not move, and fewer, closer shadows on a
  phone. The same art serves every device at different settings.
- **Where models come from**, after the owner asked to explore open source (D-27): the hero and
  every person from **MPFB 2** in Blender (CC0, semi-realistic, with sliders); animation from
  **CC0 libraries**; armour, weapons, props and aliens turned from concept pictures into 3D by an
  **open-source generator on the Mac** or by **Meshy**, whichever wins the style test; places
  built from modular pieces with **CC0 materials**. See
  [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md).
- **The style test** is one hero and one station corridor, semi-realistic, judged on the owner's
  phone and on a desktop.
- **Tools:** Blender 5.2.1 LTS is already on the owner's Mac. The owner asked how to set up an
  account that works best. Claude's advice: **Meshy Pro**, monthly (about €19 a month: API access,
  1,000 credits, a private commercial licence, rigging and its animation library [Meshy's
  pricing](https://meshy.ai/pricing)). Take it for the month of the style test, and keep it only
  if it beats the open-source generators. Its API key goes into the repository's git-ignored
  `.env` as `MESHY_API_KEY`, never into a chat or a commit.
- **Taken (24 October 2026):** the owner subscribed to **Meshy Premium for one month** (3,000
  credits). The key is stored with `npm run key:meshy` ([`scripts/set-meshy-key.sh`](../scripts/set-meshy-key.sh)),
  which checks it with Meshy before saving it.
- **The open-source generator:** research on running one on the Mac recommends **trellis.cpp**
  (MIT, a C++ build of TRELLIS.2 with Metal, no Python), compiled locally, with about 15 GB of
  weights. See [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md) §3. Waiting for the owner's go
  before compiling it and downloading the weights.

### D-23 · Voices — **Decided**

| Option | What it means |
| --- | --- |
| **A. Every line voiced** ✅ | With generated voices (ElevenLabs, as in Control's D-91), the hero too |
| B. The story voiced first (recommended) | Main story, companions and the hero voiced; minor characters in text at first, voiced as the budget allows |
| C. Text only | With sounds and music |

**Recommendation: B.** A voiced hero was one of *Mass Effect*'s strengths.

**Decided:** A, the owner's choice, 24 October 2026. Every line is voiced, the hero in two voices
(D-09). Lines are generated at build time from the written script, so a line is re-voiced whenever
its text changes. The voices are paid from the ElevenLabs plan's credits, as in Control.

### D-24 · What may be spent without asking — **Decided**

Control began at $5 for generated art and raised it step by step to $50 (its D-27). A 3D game will
need more: pictures, models, music and voices.

**Recommendation:** **$25 to start**, for the style test and the playable slice, with each step
above that asked for. Voices are paid from the ElevenLabs plan, as in Control.

**Decided:** **up to $50**, the owner's choice, 24 October 2026, for pay-per-use generation
(pictures, music, extra credits). Assumed, as in Control: subscriptions the owner holds
(ElevenLabs, and an image-to-3D plan if one is taken) are paid outside this allowance. Every spend
is recorded with what it bought.

### D-25 · The title — **Decided**

**Recommendation:** keep ***Starman Personal*** as the working title. After the cockpit (Reborn)
and the command table (Control), this is the starman in person. Decide the final title before the
first public release.

The owner is open to suggestions (24 October 2026). The series' titles are one word after
*Starman*: a state (*Reborn*) and a role (*Control*). Suggestions:

| Option | Why |
| --- | --- |
| ***Starman Lightkeeper*** (recommended) | In Reborn, Lightkeeper is the Authority's highest rank; in a game where the stars are going out (D-07), it becomes what people call the one who keeps them lit. A role, like *Control* |
| ***Starman Vigil*** | Keeping watch while the dark comes; short and plain |
| ***Starman Kindred*** | The crew and the bonds between them, the heart of the game (D-14) |
| ***Starman Dark Sky*** | A real astronomers' term (skies kept dark to see the stars), turned around |
| ***Starman Personal*** | The working title, kept |

Before a title is final, Claude checks that no other game uses it.

**Decided:** ***Starman Lightkeeper***, the owner's choice, 24 October 2026 ("You can use Starman
Lightkeeper"). The GitHub repository keeps its first name, `starman-personal`, so its address and
the Pages address (<https://shotif.github.io/starman-personal/>) stay as they are; renaming it is
easy later if the owner wants. A check for other games of the same name is still to be done
before any public release.

### D-27 · Reuse open source — **Decided** (owner's direction)

On 24 October 2026 the owner asked to "explore using open-source models" and to reuse what others
have already built where it looks good, "so we don't have to build everything from scratch". From
now on, before building a system or making an asset, look for an open-source or CC0 one first and
record what was found. The first survey is [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md).

## Made without waiting

### D-26 · How finished work reaches `main` — **Assumed**

As in Reborn and Control (D-21 there): work is pushed to `main`, and so deployed, once the checks
pass. Tell Claude if you would rather review pull requests.

### D-28 · What may go into the public repository — **Assumed**

The repository is public, so only files whose licence lets us share them go into it: CC0, CC BY
(credited), MIT, Apache-2.0 and the like. Files that may be used in a game but not shared as files
(Mixamo's animations, most store assets) stay out. Every asset is recorded with its source and
licence. If the owner ever wants such assets, the choices are a private repository (GitHub Pages
from a private repository needs a paid GitHub plan) or a private store the build reads from.

| Date | Choice | Why |
| --- | --- | --- |
| 2026-10-24 | The repository starts with documents only; no code until D-21 is decided | Documentation first (D-01) |
| 2026-10-24 | The proof renders with **WebGL2** by default; WebGPU with `?renderer=webgpu` | WebGL2 runs on every phone we target; WebGPU is measured before it becomes the default |
| 2026-10-24 | Recast (navigation) is **bundled** with the game | Babylon's navigation plugin loads it from unpkg.com by default; a game that may be installed and played offline cannot depend on a CDN |
| 2026-10-24 | The local servers use ports **5391** (development) and **4391** (preview and tests) | the owner's other projects already use Vite's usual ports |
| 2026-10-24 | Biome formats code but **not Markdown** | Biome's Markdown formatting rewrites the series' documents (italics, tables) |
| 2026-10-24 | Quaternius's CC0 mannequin stands in for the hero and the companion until MPFB people exist | it carries the animations the proof needs; see [ART_PIPELINE.md](ART_PIPELINE.md) |
| 2026-10-24 | Dialogue and quests to be written in **ink** (MIT), if the engine is agreed | plain text Claude can write and test, with a JavaScript runtime; see [OPEN_SOURCE.md](research/OPEN_SOURCE.md) §4 |
