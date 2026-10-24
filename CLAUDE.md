# Working agreement for Starman Personal

Starman Personal is a 3D third-person, story-led role-playing game in the universe of
[Starman Reborn](https://github.com/shotif/starman-reborn) and
[Starman Control](https://github.com/shotif/starman-control), inspired most by *Mass Effect*.
The project owner decides; Claude designs, documents, builds and tests.

## How we work (D-01)

1. **Documentation first.** Every feature starts as a written design (in `docs/`) before any code.
   A design names its goals, what is out of scope, and the decisions it needs.
2. **Key decisions are the owner's.** Anything that shapes the game (scope, platform, rules,
   setting, story, tone, art, money) is raised as an open question in
   [docs/DECISIONS.md](docs/DECISIONS.md) with options and a recommendation, and is only built
   once the owner has answered. Record the answer, the date and the reason there. Small, reversible
   engineering choices can be made and noted without waiting.
3. **Ask for tools.** When something would be better with an external tool, service, asset or
   account (3D models, animation, art, voices, music, real devices), ask the owner for it rather
   than working around its absence silently.
4. **Ship in increments.** Each milestone is split into increments that keep the game playable,
   pass CI and deploy to GitHub Pages from `main`.
5. **Tests with every rule.** Game rules get unit tests; player journeys get browser tests once the
   game has screens. The checks must pass before a push.

## Standing requirements from the owner

- **Phone and desktop, both first-class** (D-02). The whole game must be completely playable on a
  phone, and the desktop must have a dedicated experience of its own. Design every screen and
  control scheme for both before building it, and test at phone, tablet and desktop sizes.
- **Deployed to GitHub Pages** from `main` (D-03).
- **Grounded science fiction** (D-05). Bold technology (quantum, warp, gravity engineering) is
  welcome; magic is not. Every power, weapon and device works by technology with rules and costs.
- **Rich stories, never filler** (D-04). Every quest, main or side, has people, a reason and a
  consequence. No fetch quests, no empty errands.

## Writing style (shared with Starman Reborn and Starman Control)

- British English (*armour*, *colonise*, *neighbourhood*), plain words, short sentences.
- Real astronomy is real; everything invented is **labelled as fiction** in the game and the docs.
  Never present an invented planet, species or event as an observed fact.
- No names, text, art, music or data from *Mass Effect* or any other game. Inspiration is about
  structure and mechanics only; every character, species, faction, technology and story is
  original. [docs/research/MASS_EFFECT.md](docs/research/MASS_EFFECT.md) §6 lists the terms to
  avoid.
- Starman Reborn and Starman Control are canon. Starman Personal adds canon and must not
  contradict them unless the owner decides otherwise.

## Stack

Not decided yet (D-21). No code is written until it is.
