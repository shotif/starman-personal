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
| D-29 | Real sideways walks: buy UAL Pro? | Decided 2026-10-24 | **A, buy UAL Pro** ($9.99, bought by the owner) |
| D-30 | Which skins, hair and faces the character creator offers | Decided 2026-10-24 | **As recommended**: six skin tones, six to eight hair styles and five eye colours per body, with the 19 sliders |
| D-31 | Lip sync for the voiced lines | Decided 2026-10-24 | **As recommended**: MakeHuman's CC0 mouth shapes, timed from each voiced line |
| D-32 | The heroes' new look: uniform, colour, boots, proportions | Decided 2026-10-24 (owner's choice) | **Approved for now** |
| D-33 | The six classes and their powers | Decided 2026-10-24 | **As recommended**: Breacher, Rigger, Fieldwright, Shade, Striker, Warden ([CLASSES_AND_ORIGINS.md](design/CLASSES_AND_ORIGINS.md)) |
| D-34 | Where you are from: the origins | Decided 2026-10-24 | **As recommended**: Ringborn, Steader, Den-raised, Laneborn, Beltborn, Borderer |
| D-35 | The moment that made you | Decided 2026-10-24 | **As recommended**: the survivor, the hero of the line, the hard call, the one who lost someone |
| D-36 | What the Quench is | Decided 2026-10-24 | **As recommended**: the Absent's lifeboat, swarm engines banking the stars' light ([STORY.md](design/STORY.md)) |
| D-37 | The face of the enemy | Decided 2026-10-24 | **As recommended**: Lightkeeper Ansa Varro, and the Banked ([STORY.md](design/STORY.md)) |
| D-38 | The shape of the story | Decided 2026-10-24 | **As recommended**: a prologue at Ross 128, three acts, a finale built from preparation ([STORY.md](design/STORY.md)) |
| D-39 | The eight companions | Decided 2026-10-24 | **As recommended**: Ren Okafor, Jo Rook, Corin Ash, Doctor Mira Achterberg, Low Ember, Fair Weather, Unit Seventy, Wren of the Seventh Ark ([STORY.md](design/STORY.md)) |
| D-40 | The ship's name | Decided 2026-10-24 | **As recommended**: *Lantern* ([STORY.md](design/STORY.md)) |
| D-41 | The rule for side stories | Decided 2026-10-24 | **As recommended**: people with reasons, a choice that costs, a consequence seen later ([STORY.md](design/STORY.md)) |
| D-42 | Defences and health | Decided 2026-10-24 | **As recommended**: shield, plate and health; the hero's shield returns after four seconds, health to the next quarter ([COMBAT.md](design/COMBAT.md)) |
| D-43 | When the hero falls | Decided 2026-10-24 | **As recommended**: down, then a companion's hand once per fight, otherwise a checkpoint just before the fight ([COMBAT.md](design/COMBAT.md)) |
| D-44 | The slice's side story | Decided 2026-10-24 | **As recommended**: the mast and the *Merrow* ([SLICE.md](design/SLICE.md)) |
| D-45 | Where sound and music come from | Decided 2026-10-24 | **As recommended**: CC0 libraries first, ElevenLabs effects where nothing fits, Lyria music (round 6 below) |
| D-46 | Difficulty | Decided 2026-10-24 | **As recommended**: Story, Standard and Hard, changeable at any time ([COMBAT.md](design/COMBAT.md)) |
| D-47 | The next milestone | Decided 2026-10-25 | **As recommended**: *Lantern* as home, the star map, and the first lead built whole ([ACT1.md](design/ACT1.md)) |
| D-48 | Which lead first | Decided 2026-10-25 | **As recommended**: Pyre Remnant, the Cooperative's observatory |
| D-49 | How the hero grows | Decided 2026-10-25 | **As recommended**: experience from missions and choices; ranks for powers, new powers, talents |
| D-50 | Weapons | Decided 2026-10-25 | **As recommended**: pistol, rifle, shotgun, marksman rifle by class; two carried; mods found and bought |
| D-51 | The Banked, and Pyre Remnant's outline | Decided 2026-10-25 | **As recommended**: three kinds of Banked fighter, and the outline in ACT1.md §6 |
| D-52 | Labelling fiction | Decided 2026-10-25 (owner's direction) | **Not labelled**: a game is plainly fiction; real astronomy stays accurate |
| D-53 | Powers in hand | Decided 2026-10-25 | **As recommended**: three at a time, chosen aboard or from the growth screen |
| D-54 | The new powers at levels 3 and 6 | Decided 2026-10-25 | **As recommended**: the table in [ACT1.md](design/ACT1.md), increment 3 |
| D-55 | Talents | Decided 2026-10-25 | **As recommended**: the backstory's talents work in play, and a class training with three ranks |
| D-56 | How the four weapons differ | Decided 2026-10-25 | **As recommended**: no ammunition; rate, reach, spread and weight; two carried; five mods |
| D-57 | Pyre Remnant as designed | Decided 2026-10-25 | **As recommended**: as in [PYRE.md](design/PYRE.md) |
| D-58 | Where the unlisted come from | Decided 2026-10-25 | **As recommended**: Fomalhaut B Orchard |
| D-59 | When Mira joins, and who goes with the hero | Decided 2026-10-25 | **As recommended**: before the audit; Ren or Jo comes, the other keeps *Lantern* ready |
| D-60 | Who is in the dome | Decided 2026-10-25 | **As recommended**: Mira's brother Joost, broadcasting Fomalhaut B's curve |
| D-61 | The next star | Decided 2026-10-25 | **As recommended**: YZ Ceti, beside Tau Ceti |
| D-62 | Money, and what it buys | Decided 2026-10-25 | **As recommended**: credits from the story; mods and *Lantern*'s parts |
| D-63 | Voices for the new people | Decided 2026-10-25 | **As recommended**: library voices where the stock set falls short |
| D-64 | Whether Varro is heard at Pyre | Decided 2026-10-25 | **As recommended**: one recorded line, twenty years old |
| D-65 | How Pyre's people look in this increment | Decided 2026-10-25 | **As recommended**: tinted uniforms, older faces, Mira's own look |

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
from the real planet's data or, for an unknown world, from generated values (once labelled
*Fiction*; no longer, D-52).
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
  weights. See [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md) §3. **Installed** on the owner's
  go ("You can install trellis"), 24 October 2026, in `~/tools/trellis-cpp`, every weight file
  checked against its published checksum.
- **The style test** ([design/STYLE_TEST.md](design/STYLE_TEST.md)), 24 October 2026: four
  subjects from Gemini concepts (about $0.40), made by both tools: Meshy in 2–3 minutes each for
  30 credits each, trellis.cpp in 7–13 minutes each on the Mac. Both are in the proof's gallery for
  the owner to judge on a phone. **Verdict (the owner, 24 October 2026):** "let's build
  everything with Meshy that we can within the budget that we have, and only once we run out of
  budget, we use the local process on my Mac." Meshy is the first source of hard-surface models,
  props and companions while the subscription's credits (and D-24's allowance for extra credits)
  last; trellis.cpp takes over when they run out. Every Meshy run reports the credits left.

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

## Round 3: the people — open

The art pipeline ([ART_PIPELINE.md](ART_PIPELINE.md)) now makes the hero as a man and a woman
from MPFB 2, with 19 body and face sliders, the lineage presets and 30 animations, all CC0. It
raised three questions.

### D-29 · Real sideways walks: buy UAL Pro? — **Decided**

The free animation libraries have no sideways walk, so `strafe_left` and `strafe_right` are made
from the forward walk with the hips turned. They pass, but they are stand-ins, and cover and aiming
(D-17) use them constantly.

| Option | What it means |
| --- | --- |
| **A. Buy Quaternius's Universal Animation Library Pro** (recommended) | $9.99 on itch.io, inside D-24's allowance, with walks and runs in eight directions and more combat clips, under the same CC0 licence. Claude cannot pay, so the owner buys it and puts the download in `art/cache/` |
| B. Keep the stand-ins | Free; they show when the hero moves sideways in cover |
| C. Ask Meshy for them | Meshy's library has directional walks; licence to be confirmed for the library itself |

**Decided:** A, 24 October 2026: the owner asked how to buy it. The Pro version of Library 1
(<https://quaternius.itch.io/universal-animation-library>, $9.99 or more) has more than 120
animations, eight-direction movement among them, as FBX and GLB, under CC0. The download goes into
`art/cache/` (ignored by git) and is recorded in `art/records.json`. Library 2 has no Pro version;
its Source version ($14.99, about three times the free clips, mostly melee and movement) can follow
when melee is built.

**What it brought (24 October 2026):** the owner bought both Library 1 Pro and Library 1 Source,
which hold the same animations (Source adds the Blender file); it is recorded in
`art/records.json`. It has jogs in eight directions, turns, crouch moves, dodges, a ledge climb,
two-handed powers, a kick and more hits and deaths: the heroes now carry 55 clips. It has **no
sideways or backward walks**, only jogs, so `strafe_left` and `strafe_right` are the side jogs
slowed down and `walk_back` is the walk played backwards. Library 2's changelog mentions
eight-direction steps, so its Source version may hold real side walks; to be checked before buying.

**Posture (the owner's feedback, 24 October 2026):** the heroes leaned forward as if about to fall.
Measured from the side, the man's head stood 25 cm in front of his feet with an 18° lean; the
retargeting had tipped the MPFB pelvis 30–43° forward, and the library's own idle is a slouched,
staggered stance. The retargeting now matches the trunk by its overall line rather than by each
bone's direction; `idle` and `idle_talk` are corrected from the library's calmest idle (head over
the feet within 2 cm, lean under 3°, feet flat under the hips); and a posture check
(`scripts/art/posture.py`) stops the art build if a hero leans again.

### D-30 · Which skins, hair and faces the creator offers — **Decided**

The placeholders are one skin, one hair style and one eye colour for each body (in
`art/hero.json`). Each extra skin or hair style costs about 0.1–0.3 MB.

**Recommendation:** six skin tones across the range of humanity for each body, six to eight hair
styles each (short, cropped, shaved, long, tied back, braided), five eye colours, and the 19
sliders, all from the CC0 MakeHuman assets. The owner may want particular looks for the cover of
the game; say so here.

**Decided:** as recommended, 24 October 2026 ("You can go on with the recommended answers for
D-30 and D-31").

### D-31 · Lip sync for the voiced lines — **Decided**

Every line is voiced (D-23), and the MPFB people have no facial rig yet: no jaw or eye bones and no
mouth shapes. **Recommendation:** add MakeHuman's CC0 mouth shapes (visemes) and face units to
the heroes, and drive them from the timing of each voiced line, which ElevenLabs can provide. It
costs a little size per character and makes every conversation look alive.

**Decided:** as recommended, 24 October 2026.

### D-32 · The heroes' new look — **Decided**

With the posture fix the bodies changed too (pictures in `art/out/previews/`, regenerated by the
art scripts): natural, athletic proportions instead of the exaggerated hips and thin arms, and
instead of the shiny latex suit, TheGreatEngineer's **Galactic Warrior** uniform (CC0, panels,
pads, a belt) in slate grey with a matte finish, and MakeHuman's black boots (CC0). These are
Claude's choices, made to fix what the owner saw. **The owner approves them, or says what to
change** (colour, uniform, build). The look of each power's uniform comes later with the story.

**Decided:** approved for now, 24 October 2026 ("The uniform is fine for now"). It stays until the
powers' own uniforms are designed with the story.

## Round 4: classes and the past — decided 24 October 2026

The creator's appearance is built ([design/CREATOR.md](design/CREATOR.md)). Its class and past
tabs need content only the owner should settle: the proposal, with options and a recommendation
for each, is [design/CLASSES_AND_ORIGINS.md](design/CLASSES_AND_ORIGINS.md).

**Decided:** all three as recommended, 24 October 2026 ("Continue with everything else as
recommended").

- **D-33 · The six classes and their powers — Decided.** Recommended: Breacher (Arms), Rigger
  (Systems), Fieldwright (Field), Shade (Arms + Systems), Striker (Arms + Field), Warden (Systems +
  Field), with the powers and specialisations listed there.
- **D-34 · Where you are from — Decided.** Recommended: Ringborn, Steader, Den-raised, Laneborn,
  Beltborn, Borderer, each a place in the canon with a talent and a personal quest.
- **D-35 · The moment that made you — Decided.** Recommended: the survivor, the hero of the line,
  the hard call, the one who lost someone.

## Round 5: the story — decided 24 October 2026

The proposal, with options and a recommendation for each, is [design/STORY.md](design/STORY.md):
the Quench as the Absent's lifeboat engines waking and banking the stars' light (D-36); Lightkeeper
Ansa Varro, a fallen Authority Lightkeeper, as its face (D-37); a prologue at Ross 128, three acts
and a finale built from preparation (D-38); eight companions (D-39); the ship *Lantern* (D-40); and
the rule for side stories, with three examples (D-41).

**Decided:** all six as recommended, 24 October 2026 ("Everything else is as recommended, so
continue"). The prologue is the playable slice of D-20: [design/SLICE.md](design/SLICE.md).

## Round 6: the slice — decided 24 October 2026

The prologue is the playable slice ([design/SLICE.md](design/SLICE.md)); its fights are in
[design/COMBAT.md](design/COMBAT.md). Its first increment, enemies that shoot back, needed none of
these and was built first.

**Decided:** all five as recommended, 24 October 2026 ("As recommended").

### D-42 · Defences and health — **Decided**

| Option | What it means |
| --- | --- |
| **A. Shield, plate and health** (recommended) | Three coloured layers: a shield that recharges and stops field powers, plate that blunts every hit and breaks to blast, and health beneath. The hero has a shield and health: the shield returns after four seconds untouched, health only to the next quarter unless a *Repair Drone* or a med-patch mends it. Enemies mix the layers, so powers and weapons matter |
| B. Health only, recovering | Simple and readable; the classes' powers matter less |
| C. Health and med-patches only | As in the first *Mass Effect*; slower and more punishing |

**Recommendation: A.**

### D-43 · When the hero falls — **Decided**

| Option | What it means |
| --- | --- |
| **A. Down, then a companion's hand** (recommended) | The hero goes down; for ten seconds a standing companion can bring them up, once per fight. Otherwise the fight starts again from a checkpoint a few seconds before it |
| B. Straight back to the checkpoint | Simpler; companions matter less |
| C. Back to the last save | The old way; loses minutes of play |

**Recommendation: A.**

### D-44 · The slice's side story — **Decided**

| Option | What it means |
| --- | --- |
| **A. The mast and the *Merrow*** (recommended) | Climb the relay mast to warn an inbound hauler, at the cost of a night-shift colleague the hero met an hour before; or leave it and the hauler goes silent. The hauler's call, or its silence, ends the slice ([SLICE.md](design/SLICE.md), beat 6) |
| B. A trapped section | Open a sealed section to save the people in it, letting the swarm deeper into the station |
| C. The chief's files | Steal the sealed Varro files before they are wiped, leaving Ren to hold the control room alone |

**Recommendation: A.** All three keep D-41; A has the clearest cost and the consequence nearest the
end.

### D-45 · Where sound and music come from — **Decided**

The slice needs sound: shots, bolts, the swarm, footsteps, the station's hum, and music for fights
and quiet moments.

| Option | What it means |
| --- | --- |
| **A. CC0 libraries first, made where nothing fits** (recommended) | Sound effects from CC0 libraries (Kenney, OpenGameArt's and Freesound's CC0 parts), each recorded with its source (D-28; royalty-free packs that forbid passing the files on cannot go in the public repository); ElevenLabs' sound effects for what they lack, on the owner's existing account. Music made with Google's Lyria on the Gemini key, as Control does |
| B. All made | Every sound and the music generated; one voice, more cost |
| C. A composer and a sound designer | The best, and outside the budget (D-24) |

**Recommendation: A.**

### D-46 · Difficulty — **Decided**

| Option | What it means |
| --- | --- |
| **A. Story, Standard and Hard** (recommended) | Changeable at any time; *Story* for those who came for the story, *Hard* with enemies that flank. Nothing in the story depends on it |
| B. One level | Simpler to tune; shuts some players out |
| C. Fine sliders | Damage taken, aim assist, enemy numbers, each on its own |

**Recommendation: A.**

## Round 7: Act 1, first part — decided 25 October 2026

The proposal is [design/ACT1.md](design/ACT1.md): after the prologue, *Lantern* becomes home and the
star map opens; the hero grows; the Banked appear; one of Act 1's three leads is built whole.

**Decided:** all five as recommended, 25 October 2026 ("As recommended, except don't force marking
anything as fiction"), and with them D-52.

### D-47 · The next milestone — **Decided**

| Option | What it means |
| --- | --- |
| **A. *Lantern*, the star map and the first lead, whole** (recommended) | The systems every lead needs (the ship's decks, the map, growth, weapons, the Banked) and one lead with its companion and side story: about two hours of new play, and the structure the other two leads then reuse |
| B. All three leads, short | Each lead an hour, so Act 1's shape is there sooner; each thinner, and the systems built in a hurry |
| C. The prologue, deeper first | More side content and polish at Ross 128 before moving on |

**Recommendation: A.** It proves the act's structure on one lead before building three, and each
increment stays playable (D-01).

### D-48 · Which lead first — **Decided**

| Option | What it means |
| --- | --- |
| **A. Pyre Remnant** (recommended) | The Cooperative's observatory: follows straight from the prologue (Ilya's readings), a station full of people, Dr Mira Achterberg (a Warden, a healer) joins |
| B. Maw Roost (Wolf 1061) | The Wake's black market in engine parts: rougher and more combat; Corin Ash (a Breacher) joins; Jo's personal quest begins |
| C. The Duskfolk border | The first meeting with an alien people whose star is dimming; Low Ember (a Fieldwright) joins; the most to design (a people, a language, a place) |

**Recommendation: A.** The other two follow in later parts; until then the map says so honestly.

### D-49 · How the hero grows — **Decided**

| Option | What it means |
| --- | --- |
| **A. Experience and ranks** (recommended) | Missions, side stories and choices give experience (not kills); levels give ranks in powers (three each), a new power at levels 3 and 6, and talents from the hero's past. Companions level alongside |
| B. Finds and ship upgrades only | No levels: the hero grows through gear and *Lantern*'s workshop; simpler, less of an RPG |
| C. Levels and loot | As A, with weapons and armour of many tiers dropped by enemies; more to manage, more filler |

**Recommendation: A**, with weapons and mods as finds (D-50).

### D-50 · Weapons — **Decided**

| Option | What it means |
| --- | --- |
| **A. Four kinds, two carried** (recommended) | Pistol, rifle, shotgun and marksman rifle, each class trained in two or three (D-10); the hero carries two and switches; mods (scope, stabiliser, heavier rounds) found on missions and bought at stations |
| B. The sidearm and one rifle | Fewer models and animations; less to choose |
| C. As A, with heavy weapons | A launcher or a beam for rare moments; more to build now |

**Recommendation: A.**

### D-51 · The Banked, and Pyre Remnant's outline — **Decided**

The Banked, Varro's followers, as the first human enemy: troopers who take cover and flank,
engineers who shield allies and set the engines' motes on the hero, and wardens behind field
barriers. And the outline of the first lead in [ACT1.md](design/ACT1.md) §6: the station whose
archive is "under audit", Mira's recruitment, the choice between the archive and the dome's crew,
the name in the oldest audit, and the side story of the refugees not on the manifest.

**Recommendation: both as written**, the owner changing anything in the outline they like.

### D-52 · Labelling fiction — **Decided** (owner's direction)

Until now everything invented was labelled *Fiction* in the game and the docs (the title's note,
the codex's headings, the map). The owner, 25 October 2026: "don't force marking anything as
fiction, it is clear there is fiction in a game so you don't need to emphasize it." The labels go;
real astronomy stays accurate, and the codex simply gives the real facts and the story together.

## Round 8: growth and weapons — decided 25 October 2026

The proposal is increment 3 in [design/ACT1.md](design/ACT1.md): experience from the story, twelve
levels, ranks, two new powers for each class, talents, and the four weapons. D-49 and D-50 decided
the shape; these four questions decide how it feels in the hand.

**Decided:** all four as recommended, 25 October 2026 ("As recommended").

### D-53 · Powers in hand — **Decided**

| Option | What it means |
| --- | --- |
| **A. Three at a time** (recommended) | Five powers by level 6, three of them in hand, chosen aboard or from the growth screen outside a fight. The phone's arc stays three buttons, the desktop's keys 1, 2 and 3; choosing which three matters |
| B. All of them | An arc of five on a phone, keys 1 to 5 on a desktop; nothing to choose, more to reach for in a fight |
| C. Four | A middle way: four buttons, one power left out |

**Recommendation: A.** The phone's controls are already full; a choice of three is a build to make.

### D-54 · The new powers at levels 3 and 6 — **Decided**

| Option | What it means |
| --- | --- |
| **A. Two for each class, as in the table** (recommended) | Nine new powers (Shrapnel Round, Second Wind, Gun Post, Cascade, Sink, Shear, Blind, Long Shot, Shelter); the two hybrids without a new power of their own borrow from the pure classes (Striker: Brace, Shear; Warden: Lift) |
| B. Chosen from the class's disciplines | At levels 3 and 6 the player picks any power of their disciplines; more freedom, classes less distinct |
| C. One new power, at level 4 | Fewer to build now; less growth to feel in Act 1 |

**Recommendation: A.** Each class keeps its character, and every new power works by technology with
a cost, as D-05 asks.

### D-55 · Talents — **Decided**

| Option | What it means |
| --- | --- |
| **A. The backstory's talents in play, and a class training** (recommended) | The origin's and moment's talents become small steady effects (a fifth more health for the survivor, a tenth more shield for the Beltborn, and so on); each class has one training of three ranks bought with points |
| B. A talent tree | A tree of small bonuses per class; more to choose, more to balance, more screens on a phone |
| C. The backstory only | No training; points go to powers alone |

**Recommendation: A.** The past the player chose does something, and the points have two uses.

### D-56 · How the four weapons differ — **Decided**

| Option | What it means |
| --- | --- |
| **A. No ammunition; rate, reach, spread and weight** (recommended) | The pistol, rifle, shotgun and marksman rifle differ in how fast and far they shoot and how much they weigh; weight slows the powers; two carried; five mods (scope, stabiliser, heavy rounds, long barrel, cooled coil) |
| B. Magazines and reloading | A reload button and its timing; more to manage on a phone |
| C. Heat that vents | Each weapon heats as it fires and must cool; a bar to watch |

**Recommendation: A.** A phone player never fumbles a reload mid-fight; weight keeps the choice a real one.

## Round 9: Pyre Remnant — decided 25 October 2026

The proposal is [design/PYRE.md](design/PYRE.md): ACT1.md §6's outline (D-51) made into a mission
of about an hour and a half to two hours. A station of people with reasons; three ways into the
archive, each won by trusting someone; the unlisted refugees and the hearing; the Banked's first
fights; the archive or the dome; the name in the oldest audit; Mira joining; the first money and the
first trader.

**Decided:** all nine as recommended, 25 October 2026 ("As recommended").

### D-57 · Pyre Remnant as designed — **Decided**

| Option | What it means |
| --- | --- |
| **A. As designed** (recommended) | The people, beats, ways in, choices, fights, experience and canon in PYRE.md: ten speaking people, three ways in, the side story with its hearing, the cost, and Teodor Linde as the archivist (the brief's "possible tie-in") |
| B. Shorter | One way in (Linde's) and no hearing: about an hour, quicker to build, less of the conversation side the station is for |
| C. As designed, with changes | The owner names them: people, names, beats, outcomes |

**Recommendation: A.** It is the first place that shows the game's conversation side at full size,
and each part of it has a reason and a consequence (D-04, D-41).

### D-58 · Where the unlisted come from — **Decided**

ACT1.md has refugees "from a colony whose star has dimmed". Which colony is new canon.

| Option | What it means |
| --- | --- |
| **A. Fomalhaut B Orchard** (recommended) | Reborn's farm station at Fomalhaut B (TW Piscis Austrini, a real K4 dwarf 25 light-years from the Sun, two jumps from Pyre). Its star has been stepping down for eight months, and the trees no longer know the season. They are Cooperative citizens the Cooperative will not list, because listing them would admit that a Cooperative star is going out: the evidence the audit erases is standing in the overflow. A fourth star going dark, after Antares, Ross 128 and the Duskfolk border's |
| B. The Wake's dens at GJ 2005 | Reborn's dens, one lane from GJ 915: raiders' families, whom the committee's refusal is easier to understand and harder to forgive; a Den-raised hero is at home among them |
| C. The unhomed | Control's people without a star, on their arks. Aliens, so a new body to make, and Wren's people met before Wren is |

**Recommendation: A.** The sharpest story, no new body, and Reborn's own place.

### D-59 · When Mira joins, and who goes with the hero — **Decided**

| Option | What it means |
| --- | --- |
| **A. Before the audit** (recommended) | She joins in her clinic and fights the mission. The player chooses Ren or Jo to come; the other keeps *Lantern* ready and calls in on the comms. Each companion's personal quest moves a step by what they see inside (Ren: her own buried report on the audit's list; Jo: the motes' control rings) |
| B. At the end, as the outline has it | Ren and Jo fight the mission; Mira joins after the cost; the first choice of who comes waits for the next lead |
| C. All three, this once | No choice to make, but against D-14 (two at a time) and harder to read on a phone |

**Recommendation: A.** The new Warden is played in her own mission, and the choice of two out of
three (D-14) arrives where the story gives it a reason.

### D-60 · Who is in the dome — **Decided**

The cost (ACT1.md §6, beat 5): save the archive or the dome's crew; the other is lost.

| Option | What it means |
| --- | --- |
| **A. Mira's brother, Joost, broadcasting** (recommended) | The dome's night watch is Joost Achterberg's. He has watched Fomalhaut B step down for eight months and is putting its curve out on every band when the Banked come for the dome. The archive is the proof of a century and the Cooperative's trust; the dome is people's lives and the truth told now. Mira loses something either way |
| B. Observers the hero met | As A, with no tie to Mira |
| C. Lives only | As B, without the broadcast: the dome's crew under fire and nothing more |

**Recommendation: A.** Neither answer is the wrong one, so the choice is a real one; most players
would otherwise save the crew without thinking twice.

### D-61 · The next star — **Decided**

If the archive is saved, and the hearing did not take the time it needed, Mira finds a star "not
yet on anyone's list" that has begun to step (ACT1.md §6, beat 6). Otherwise Joost (if he lives)
finds it in Act 2, later.

| Option | What it means |
| --- | --- |
| **A. YZ Ceti** (recommended) | A real red dwarf 12 light-years from the Sun with three known planets, 1.6 light-years from Tau Ceti, the Cooperative's capital. The Cooperative can no longer stay out of it (Act 2). Nothing in Reborn or Control is set there |
| B. Wolf 359 | One of the Sun's nearest stars, 7.9 light-years away: the engines coming for Earth's own neighbourhood, which raises the stakes to Sol early |
| C. Named later | Mira says there is one more; the name waits for Act 2 |

**Recommendation: A.**

### D-62 · Money, and what it buys — **Decided**

D-50 promised mods "bought at stations"; Pyre Remnant brings the first trader.

| Option | What it means |
| --- | --- |
| **A. Credits from the story, spent on mods and *Lantern*'s parts** (recommended) | Paid for what is done, never for kills, and the same whichever way a choice goes; spare finds sold at half price. The trader sells a copy of any mod for each weapon (so both guns can carry a stabiliser), and *Lantern*'s first part, plating, whose effect comes with the ship's encounters (D-18). *Make do* takes a fifth off |
| B. As A, mods only | *Lantern*'s parts wait for the encounters |
| C. No money | Traders swap finds for finds |

**Recommendation: A.** Money needs something large to save for, and a ship that is prepared is part
of the finale (D-38).

### D-63 · Voices for the new people — **Decided**

The account offers 21 stock voices, and nine of them are cast (Pell's is an older stock voice no
longer listed). Of the twelve left, three are women's, and none is British. Pyre needs about fourteen new voices (Mira, Linde, Ruth, Quaye, Matti, Nell,
Tilly, Joost, Esben, Lenz, two Banked, the Banked ship, and people overheard), and Varro's if D-64
says so. A library voice must be added to the account before it can speak, which takes a voice
slot; the plan allows 30,000 and 321 are used. In Control the owner chose stock voices to save slots.

| Option | What it means |
| --- | --- |
| **A. Library voices where the stock falls short** (recommended) | About eight from ElevenLabs' library (Varro, Mira, Linde, and women's and British voices for the rest), each auditioned as before; stock voices for the others. Jo could then have the northern English voice [VOICES.md](assets/VOICES.md) §10 wanted, if the owner likes |
| B. Stock voices only | Mira, Ruth and Nell take the last three women's voices; Tilly and the women overheard become men, and Varro waits |
| C. Designed voices | Made to a description with ElevenLabs' voice design; also a slot each, and less tried than the library's |

**Recommendation: A.**

The owner, 25 October 2026, with the answer: "not all the voices have to be British." Stock
voices of any accent are cast wherever they suit a part; library voices only where the stock set has
nothing fitting (older voices, more women, Varro).

### D-64 · Whether Varro is heard at Pyre — **Decided**

| Option | What it means |
| --- | --- |
| **A. One recorded line** (recommended) | Her note closing the audit twenty years ago, calm and ordinary: *"Audit of the Pyre Remnant archive, closed. Nothing of note. Lightkeeper A. Varro."* Her voice is chosen now, for the whole game |
| B. Only her signature | Her voice waits until she speaks to the hero (Act 2) |

**Recommendation: A.** A villain with a face (D-07) is better met early, and the ordinariness is the
point.

### D-65 · How Pyre's people look in this increment — **Decided**

Everyone today wears the shared uniform, and nobody looks older than about thirty-five. Pyre has
about twenty people, some of them old. The Banked's own look stays the owner's for increment 6.

| Option | What it means |
| --- | --- |
| **A. Tinted uniforms, older faces, Mira's own look** (recommended) | The uniform tinted by who wears it (the station's blue, the Orchard's earth colours, the Banked's gold, the clinic's white for Mira); MPFB's CC0 age shapes for the old (Linde, and Sorrel and Hale with him), baked as the sliders are; clothes of their own in increment 6 |
| B. Clothes now | MakeHuman's community clothes (only the CC0 ones, D-28) fitted to the two bodies: slower to make, and more to load on a phone |
| C. As A, without age | Everyone looks about thirty-five until increment 6 |

**Recommendation: A.** Readable at a glance on a phone, little to load, and the old look old.

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
| 2026-10-24 | The proof's hero is the **MPFB man** (`?hero=woman` for the woman), and the companion is the other; both at their own heights. The mannequin stays as the fallback | the art pipeline delivered them; the style test needs them |
| 2026-10-24 | Character files use 16- and 8-bit vertex data (`KHR_mesh_quantization`), which Babylon reads without a decoder; meshopt compression, which needs a decoder, waits until we host one ourselves | the decoder would otherwise come from a CDN |
| 2026-10-24 | Dialogue and quests to be written in **ink** (MIT), if the engine is agreed | plain text Claude can write and test, with a JavaScript runtime; see [OPEN_SOURCE.md](research/OPEN_SOURCE.md) §4 |
| 2026-10-24 | The proof's companion is called **Ren**, a placeholder until the companions are designed (D-14) | orders need someone to speak; see [design/ORDERS.md](design/ORDERS.md) |
| 2026-10-24 | In the practice range Ren fires only when ordered | the drones are the player's to shoot; with real enemies she will choose targets herself |
| 2026-10-24 | Where a file's own licence line contradicts its pack's CC0, the stricter one is followed (AGPL items left out; one CC BY bun credited) | D-28; the packs' metadata and the files disagree |
| 2026-10-24 | The game opens on the character creator until a hero is saved; `?play` skips it (the browser journeys use it), `?creator` opens it, *Change hero* in the HUD returns to it | [design/CREATOR.md](design/CREATOR.md) |
| 2026-10-24 | Style test props are shown at about twice life size (sidearm, helmet, terminal) and prepared alike (about 15,000 triangles, 1024 px WebP); trellis.cpp's helmet stops at 28,000 because its many texture seams cannot be simplified across | a fair comparison on a phone; the seams are themselves a finding |
| 2026-10-24 | `?debug` exposes the hero's state and a teleport for testing; nothing else changes | the browser journeys need to place the hero without walking for minutes on a software renderer |
| 2026-10-24 | The body and face sliders are **baked into each mesh on the processor** when looks change; the GPU's morph targets stay at zero, for speech | the owner's Android phone drew black patches wherever a slider moved the body; the same looks draw cleanly on desktop GPUs and with baking; see `src/game/appearance.ts` |
| 2026-10-24 | Sliders that pull against each other are **one two-way slider**: Build (slimmer ↔ heavier), Muscle (less ↔ more), Frame (long and lean ↔ short and dense) | the owner's feedback: "Heavier" and "Slimmer" could both be set |
| 2026-10-24 | The HUD names the graphics chip | so a screenshot of a graphics fault says which chip it came from |
| 2026-10-24 | Conversations: **E** or *Talk* within 3 m; the camera frames the partner over the hero's shoulder; plain replies carry no mark, *mercy*, *resolve* and *ask* do; a tap in the first 0.35 s of a line is ignored | the rules are in [DIALOGUE.md](design/DIALOGUE.md); none changes the story, and each is easy to change |
| 2026-10-24 | The camera stops short of any wall however near (it never comes closer than 0.3 m to its pivot), and the hero fades out as the camera comes within 0.75 m of the head | the owner's phone showed the camera pressed against the hero's face in cover; most third-person games fade the hero the same way; see [COVER_AND_AIM.md](design/COVER_AND_AIM.md) |
| 2026-10-24 | The slice's working names: Calder Station; Chief Hale; Pell; the night shift Dena, Sorrel and Ilya; people call the hero "Officer" and never by name, so every line can be voiced | the owner may rename any of them ([SLICE.md](design/SLICE.md)) |
| 2026-10-24 | A conversation is had once; the story offers another when it has one. A saved game resumes at the last checkpoint, with the scene set up again | simple, and no stale talk |
| 2026-10-24 | After a companion's help the hero has 2.5 seconds' grace from the swarm's shots | getting up straight into fire was a second fall at once |
| 2026-10-24 | Testing runs on the owner's Mac with its GPU (ANGLE on Metal); GitHub's CI keeps SwiftShader | the owner's instruction; the journeys take half the time |
| 2026-10-24 | CI plays one browser journey, the title and the creator (`@ci`); every other journey runs on the Mac's GPU before each push | CI draws in software; with the art in, a frame of the station takes it longer than a test allows, and the journeys failed there by timing, not by fault |
| 2026-10-24 | The story waits while each line is said, and remembers an event that came before it waited | voiced lines cut each other off; talking to Jo before Ren stalled the end |
| 2026-10-24 | Things to look at (`>>> look`), each with a voiced remark by the hero; a codex opened by lines as they are said, real astronomy marked *Observed* and the rest *Fiction*; the survivors in Lantern's hold before the crew at the end | more to the hour without filler: each remark or conversation carries the story or a consequence (D-04); the canon it adds is small and listed in [SLICE.md](design/SLICE.md) |
| 2026-10-24 | The drill has three rounds: the drones, with orders, with powers | the first fight came before the player had tried either |
| 2026-10-24 | Low quality keeps the materials' colour but drops their normal and roughness maps | a third of the texture memory on phones |
| 2026-10-25 | One place in memory at a time: a `travel` saves the story and starts a fresh game in the new place, behind its loading painting; the old one's drawing context is let go at once | a phone holds one place's models and textures, never two; the travel is where a loading screen belongs anyway (the lift-off, a docking) |
| 2026-10-25 | The prologue's end card offers to go on aboard *Lantern*; Act 1's part one ends at "Set a course" with an honest "to be continued" until the star map and Pyre Remnant are built | each increment playable and deployed (D-01), without pretending |
| 2026-10-25 | The star map's sky is copied from Starman Control (Reborn's census and Control's shell, 356 systems out to 33 light-years, with Reborn's old lanes), slimmed to what the map shows | D-27: the canon's own checked data, not a new catalogue; the same stars in all three games |
| 2026-10-25 | Pyre stands where Reborn put it (RA 357.5°, Dec −45.5°, 33 light-years, one lane from GJ 915), held in the game's rules and never in the sky's data | Reborn's and Control's rule for the one invented star |
| 2026-10-25 | A course follows the old lanes, the shortest way; Pyre Remnant is eleven jumps from Ross 128, and the Duskfolk border (GJ 433, in the shell) is past the old lanes | the lanes are the canon's way of travel; the shell was never laned (Control) |
| 2026-10-25 | The Duskfolk border's lead is shown at GJ 433, the Concord's home, until its dimming star is chosen (the owner's, when that lead is designed) | the map needs a place for it now; the choice is a story one |
| 2026-10-25 | The star map is a second scene on the game's engine, drawn instead of the place while open, its code and data loaded when it first opens | a phone keeps one drawing context and one place's memory |
| 2026-10-25 | Setting the course plays the leaving (Jo lays it in, the planet falls away outside the bridge's window, the lane's flash) and saves in the lane (`lane`), where the next part will begin | the travel as a short scene (ACT1.md §2), and a save to start Pyre Remnant from |
| 2026-10-25 | Experience is given once for each key (a story command's reason, a line's id), so growth is saved whenever it changes and a chapter played again from its checkpoint gives nothing twice | spending points is never lost to a reload, and never doubled |
| 2026-10-25 | Ren and Jo use their own powers (Ren: Mark, and Veil when her shield is low; Jo: Overload on shields, Seeker Drone otherwise), half again slower to return than the hero's | D-49's companions who rank their powers need powers to rank |
| 2026-10-25 | Long Shot works with any weapon (made for the marksman rifle) | a Shade without the marksman rifle in hand still has the power |
| 2026-10-25 | The weapons' spreads: pistol 0.4°, rifle 0.6° growing to 3° while held, shotgun 4°, marksman 0.1°; the shotgun's slugs weaken past 12 m to a third at 24 m | the numbers D-56 left open, tested as rules |
| 2026-10-25 | The armoury's rack holds the old captain's weapons, all four kinds, taken the first time it is opened; the class decides which can be carried. Mods are finds: a stabiliser on Calder's range, heavy rounds in its hangar, the old captain's scope, and a cooled coil on Sorrel's bench | D-56: found on missions; traders come with Pyre Remnant |
| 2026-10-25 | Rifle clips made in Blender on the Mac (`rifle_aim`, `rifle_shoot`, `rifle_ready`), to photographs of a rifle held to the shoulder; every gun points along the aim, not where the hand's animation turns it | the owner: "find some open-source rifle animations ... or build them yourself using my Mac"; none open fits (ART_PIPELINE.md); the owner saw the gun 45° off the aim and through the head and shoulder |
| 2026-10-25 | The Banked's numbers and rules as in COMBAT.md (*The Banked*): troopers 8–18 m in cover with bursts of three, engineers 12–24 m with shields every 12 s and motes every 20 s, the warden's 300 barrier over 120° in front; a squad at most five | D-51's three kinds made to fight; numbers tuned in play |
| 2026-10-25 | Until their own armour (increment 6) the Banked wear the shared uniform in the gold of banked light, and carry the hero's weapon models | readable as one side at a glance, with no new art |
| 2026-10-25 | The Banked can be tried on Calder's range with `?banked` until Pyre Remnant brings them into the story | each increment playable (D-01), without a fight the story has no reason for (D-04) |
| 2026-10-25 | Pyre's script is its own file, `story/pyre.ink`, included by `story/slice.ink`: one story and one save; its chapters are the stitches of `pyre`. The build, the tests and the voices all compile it through `scripts/ink.ts` | the prologue's file was already a thousand lines; the story stays one, so every choice made at Ross 128 is known at Pyre |
| 2026-10-25 | Working names at Pyre beyond PYRE.md's: the Banked's ship *Keeping*, the Lane Office's Deputy Director M. Sallow (Ren's reprimand), Arno the researcher who heckles Quaye; the trader is Tilly Brennan, not Marsh (Ilya's surname) | names the script needed; the owner may change any |
| 2026-10-25 | A mod may be had more than once, one of a kind to a weapon; a save's copies are kept, at most four | D-62's "a copy of a mod for each weapon" |
| 2026-10-25 | New story commands and tags: `pay` (credits, once by reason), `leave` (a companion back to the ship), `screen trade`; on lines, `#spend:` (credits a line costs) and `#why:` (what a line's experience is for) | money and the squad, written where the story happens |
| 2026-10-25 | People more than 34 m from the camera are neither drawn nor moved; the crowd of walkers holds 40 | Pyre has twenty-one people besides the squad; a phone draws the dozen near the hero |
| 2026-10-25 | Mira, as a companion, uses a Repair Drone on whoever is most hurt and a Barrier on whoever has lost their shield, half again slower than the hero's; Pull is left to Wardens the player plays | PYRE.md §8; companions have two powers each, as Ren and Jo do |
| 2026-10-25 | A fallen Banked may be called straight back for the next wave | Pyre's waves come faster than the fallen are cleared away |
| 2026-10-25 | Pyre Remnant reached gives 60 experience and getting into the archive 120 (PYRE.md had 50 and 80) | so level 3, and its power, come before the stacks on every path |
| 2026-10-25 | Pyre's halls have pale walls and lamps strong enough for their height (8 m in the commons) | the commons read as a dark cave on the first look |
| 2026-10-25 | A conversation that starts the moment another ends (Jo's question straight after Mira's) stays on screen | it was closed with the one before it |
| 2026-10-25 | Pyre's cast (VOICES.md §2): Mira Sarah, Ruth Bella, Nell Jessica, Quaye Brian, Esben Eric, Joost Will, Matti Charlie, Lenz Roger, the Banked Harry and Adam, the ship River; from the library, Linde (a Northern English older man), Varro (Katherine), Tilly (a Northern Irish voice) and Arno (a Scottish voice) | D-63 and the owner's note; each auditioned, the owner may overrule any |
| 2026-10-25 | Older people are aged by MPFB's own age macro, as a body shape (`age_old`), with MakeHuman's old skins and greyed hair; these are kept out of the creator | D-65's older faces; the hero is about thirty and voiced so |
