# Starman Lightkeeper

A 3D third-person, story-led role-playing game set among **real nearby stars**, in the universe of
[Starman Reborn](https://github.com/shotif/starman-reborn) and
[Starman Control](https://github.com/shotif/starman-control). In Reborn you fly one ship. In
Control you lead a civilisation. In Lightkeeper you walk the decks yourself. You create one hero, choose
who they were, gather a crew and command a ship across the neighbourhood. The goal is to stop
an enemy that would end everything in the known stars.

The design takes its lead from *Mass Effect*: a hero of your own making, companions with minds of
their own, fights that mix guns, blades and technology, and choices that the story remembers.
No names, text, art or data from *Mass Effect* are used. See
[docs/research/MASS_EFFECT.md](docs/research/MASS_EFFECT.md).

It is made to be **completely playable on a phone, with a dedicated desktop experience**, and is
published on GitHub Pages.

**Status: the first proof.** The decisions so far are in [docs/DECISIONS.md](docs/DECISIONS.md).
The first proof ([docs/design/PROOF.md](docs/design/PROOF.md)) is a station corridor with a
hero you move and a companion who follows. Try it on a phone or a desktop at
<https://shotif.github.io/starman-personal/> (the repository keeps its first name).

## Run it

Requirements: **Node.js 22.18 or newer** and npm.

```bash
npm ci            # install the exact locked dependencies
npm run dev       # development server at http://localhost:5391
npm run check     # typecheck, lint, unit tests and the production build
npm run test:e2e  # browser journeys on a phone and a desktop (Playwright)
```

Every push to `main` is published to GitHub Pages by `.github/workflows/pages.yml`; CI
(`.github/workflows/ci.yml`) runs the checks on every branch.

## Design documents

| Document | What it holds |
| --- | --- |
| [docs/VISION.md](docs/VISION.md) | The pitch, the pillars, and what we take from and fix in *Mass Effect* |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Key decisions: the open questions, the options, a recommendation, and the owner's answers |
| [docs/research/MASS_EFFECT.md](docs/research/MASS_EFFECT.md) | How *Mass Effect* works, what worked, what failed, lessons |
| [docs/research/STARMAN_UNIVERSE.md](docs/research/STARMAN_UNIVERSE.md) | What Starman Reborn and Starman Control already establish, and what we can reuse |
| [docs/research/TECH_STACK.md](docs/research/TECH_STACK.md) | The 3D engines compared, and a recommendation |
| [docs/design/PROOF.md](docs/design/PROOF.md) | The first proof: what it must show on a phone, and how it is built |
| [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md) | How people, animations and models are made, recorded and licensed |
| [docs/research/OPEN_SOURCE.md](docs/research/OPEN_SOURCE.md) | Open-source models, animations, generators and code we can reuse, with their licences |
| [CLAUDE.md](CLAUDE.md) | How we work: documentation first, decisions by the owner, style rules |
