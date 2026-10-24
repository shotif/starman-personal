# Vision

**Status:** draft 2, 24 October 2026, written from the owner's brief, with rounds 1 and 2 of
[the decisions](DECISIONS.md) answered, the engine chosen (Babylon.js, D-21) and the title
settled: ***Starman Lightkeeper*** (D-25).

## Decided so far, in short

- **When:** Control's era, the 2180s, after first contact *(D-06)*.
- **The threat:** the stars are going out, wrapped by a machine swarm that takes their light, with
  a villain who has a face *(D-07)*.
- **The hero:** a man or a woman *(D-09)* of one of four human lineages (Earthborn, Spacer,
  Heavyworlder, Remade) *(D-08)*; one of six classes from three disciplines: Arms, Systems and
  Field *(D-10)*; an origin and a defining moment, each with a personal quest *(D-11)*.
- **Choices:** no meter; people remember; mercy or resolve *(D-12)*; full lines in a list *(D-13)*.
- **Companions:** two at a time, about eight in all, at least two of them aliens *(D-14)*, given
  objectives in a command view that nearly stops time *(D-16)*.
- **Rating:** mature, with content switches for the player *(D-15)*.
- **Combat:** cover, guns, full melee and combinable powers *(D-17)*.
- **Ship and places:** a ship you live on and command *(D-18)*; hand-made places, plus generated
  landing sites that always carry a written story *(D-19)*.
- **Making it:** the whole story planned, built in acts after a playable slice *(D-20)*; the
  browser first, on Babylon.js *(D-21)*; a semi-realistic look *(D-22)*; every line voiced
  *(D-23)*; open source reused wherever it is good enough *(D-27)*.

## The pitch

> **One starman. Every star is real. Everything depends on you.**
>
> Make your hero: who they are, what they were trained for, and the life that made them. Take
> command of a ship and a crew, cross the real stars around the Sun, and find out what is coming
> for the neighbourhood, before it is too late to stop it.

Starman Lightkeeper is a single-player, 3D third-person role-playing game in the browser. It is
completely playable on a phone and has a dedicated desktop experience. It is set in the universe
of [Starman Reborn](https://github.com/shotif/starman-reborn) and
[Starman Control](https://github.com/shotif/starman-control). Reborn is the view from one
cockpit. Control is the view from the command table. **Lightkeeper is the view from your own eyes:**
the stations, the worlds and the people, on foot.

## What the owner asked for

- A **rich, story-based RPG** played from the third person, with **one playable character**.
- The hero is **created at the start**: people, class, loadout and appearance *(D-08 to D-10)*.
- A **backstory** the player chooses or shapes *(D-11)*.
- A **mission**: the hero is heroic and is trying to save the known galaxy from an enemy that
  would destroy everything in it *(D-07)*.
- **Many main and side quests**, each a real story with meaning and purpose, never a fetch quest.
- **NPCs**, some of whom can be **recruited as companions** who fight and explore beside the hero.
- **Companions take objectives, not remote control.** The player gives them goals for the current
  stretch of play (in combat, exploration or investigation) and they carry them out themselves
  *(D-16)*.
- **Rich combat**: melee and ranged, heavily inspired by *Mass Effect*, with technological powers
  *(D-17)*.
- **Grounded science fiction**: bold technology (quantum, warp), no magic.
- **The hero is the captain of a ship, not its pilot.** The ship carries you between systems. The
  main play is on the surfaces of worlds and on stations, where you trade, talk, investigate and
  take on quests *(D-18, D-19)*.

## Pillars

1. **Stories worth playing.** Every quest has people with reasons, a choice that costs something,
   and a consequence you see later. If a quest could be summed up as "go there, bring that back",
   it is not finished.
2. **Your hero, your history.** Who you are, your people, your training and your past, changes
   what you can do, what people say to you, and which stories find you.
3. **A crew, not followers.** Companions have their own minds, skills and loyalties. You give them
   objectives; they choose how. They talk to you and to each other, they remember, and your
   choices can keep them or lose them.
4. **Fights with weight.** Guns, blades and the hardware in your body and your suit. Cover and
   movement, powers that combine, and a squad you direct. Skill decides hits; your build decides
   what you can do.
5. **Bold, but it could be built.** Warp fields, quantum links, gravity engineering: each with
   rules, limits and a price. The real sky stays real, and every invented thing is labelled
   *Fiction*, as in Reborn and Control.
6. **The captain's chair.** You command the ship and you do not fly it. Where you go, what you
   risk and whom you help are your decisions; the crew flies.
7. **Fits a life.** Playable in short sessions on a phone, and in long evenings at a desk. Save
   anywhere.

## What we take from *Mass Effect*, and what we fix

Details and sources: [research/MASS_EFFECT.md](research/MASS_EFFECT.md). Structure and mechanics
only: no names, text, art or data from those games.

| *Mass Effect* had | We keep | We fix |
| --- | --- | --- |
| A hero of your making, with a chosen past (*Mass Effect*'s history and profile choices) | Character creation with a past that matters | The past opens its own quest and changes how people treat you, instead of adding a few lines |
| Six classes from three disciplines | A clear class structure | Our own disciplines, grounded in technology *(D-10)* |
| A morality meter that unlocked persuasion options | Two ways to be heroic | No meter to farm: choices are remembered and persuasion comes from what you know and who you are *(D-12)* |
| A dialogue wheel with short paraphrases | Fast, readable choices | The full line shown, so the hero never says something the player did not expect *(D-13)* |
| Companions with personal missions, scenes on the ship, and a finale they can die in | All of it | Companions given objectives, not just "attack that" *(D-16)* |
| A finale shaped by your preparation (the second game's ending) | An ending built from what you did | Choices that count at the very end, too: the third game's ending was widely felt to ignore them |
| Cover shooting with powers and a pause to command | Cover, powers, combos, the pause | Real melee as an equal to the gun; controls designed for phones *(D-17)* |
| A ship to live on and a star map | Both | The real neighbourhood as the map; the captain gives orders on the way *(D-18)* |
| Open planets with vehicles and repeated bases (the first game), endless errands (*Andromeda*) | — | Hand-made places with authored side stories; nothing generated to fill space *(D-19)* |

## Tone

Reborn's voice: plain, short, wry and understated, in British English. The game is for adults
*(D-15)*: violence has a cost and people speak as people do. The heroism is real but earned, and
quiet rather than loud. People are never just quest givers: they want things, and they
are often right. The threat should feel larger than any one power, which is why it needs one person
who will cross every border.

## Games we learn from

- ***Mass Effect* trilogy** (2007–2012): the model for the hero, the crew, the ship and the shape
  of the story.
- ***Mass Effect: Andromeda*** (2017): the best movement in the series' combat, and a warning
  against filler and open spaces with nothing in them.
- ***Dragon Age: Origins*** (2009): origins that change the opening; companions who approve or
  object, and say why.
- ***The Witcher 3*** (2015): side quests as rich as the main story.
- ***Baldur's Gate 3*** (2023): reactivity: the world notices who you are and what you did.
- ***Star Wars: Knights of the Old Republic*** (2003): the ship as home, a crew with secrets.
- ***Starman Reborn* and *Starman Control***: our own universe, tone, astronomy and people.

## Who it is for

Players who love story-led RPGs and space opera; players of Reborn and Control who want to walk
the stations they flew past and governed; people drawn to the real sky.
