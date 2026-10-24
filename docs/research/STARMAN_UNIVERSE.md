# The Starman universe: what Starman Lightkeeper inherits

A digest of what [Starman Reborn](https://github.com/shotif/starman-reborn) and
[Starman Control](https://github.com/shotif/starman-control) establish, read on 24 October 2026.
Control's own digest of Reborn,
[`docs/research/STARMAN_REBORN_UNIVERSE.md`](https://github.com/shotif/starman-control/blob/main/docs/research/STARMAN_REBORN_UNIVERSE.md),
has the detail and the source paths. This page is the summary for the decisions in
[../DECISIONS.md](../DECISIONS.md). Both games are canon (see [../../CLAUDE.md](../../CLAUDE.md)).

## 1. Starman Reborn: the old neighbourhood

- **207 real star systems out to about 27 light-years**, checked against the astronomical archives
  (252 stars, 99 planets, 9 debris belts). Humanity lives across all of it: 322 stations of twelve
  kinds, linked by fixed **jump lanes** between real stars. No year is stated. It reads as an
  alternative present.
- **Three powers.** The **Sol Transit Authority** (civil, lawful, bureaucratic; green), the
  **Frontier Cooperative** (settlers and researchers, ranks voted in; blue) and the **Hollow Wake**
  (raider crews in lawless space; red), plus independents.
- **No aliens, precursors or artefacts.** But there are hooks. **Old derelicts** with charts "older
  than any in your computer". **Betelgeuse explodes and Antares quietly goes dark** (both stars are
  real; their deaths are fiction). **Pyre**, the one invented star, dies and leaves a black hole.
- **Hand-made places:** Halcyon Ring (Earth orbit), Deimos Depot (Mars), Meridian Outpost
  (Proxima b), Barnard Transit Relay, Horizon Platform (Sirius B), Eridani Mining Hub.
- **People:** Rhea Castell, Sabine Kettering, Salt, Amara Quist, Ines Halloway, Tamsin Rook,
  Dr Selene Achterberg, and six rival pilots.
- **Weapons and damage types:** energy beats deflectors, kinetic beats hulls, plasma beats
  diffusers, ion strips shields. Six shipmakers with characters of their own.
- **Tone:** plain, short, wry and understated. *"The lanes are safer than they were. Not safe.
  Safer."*

## 2. Starman Control: some 150 years later

- **Starts in 2176**, about 150 years after Reborn. The three powers have grown into states:
  the Authority at **Earth**, the Cooperative at **Tau Ceti**, the Wake at **Wolf 1061**. The map
  reaches **33 light-years** (about 340 systems). Reborn's sphere is humanity's heartland, and the
  aliens live in the shell beyond.
- **The lanes:** only a part of Reborn's network survived. The rest went dark in **the Lapse**, and
  the powers build and relight lanes.
- **Aliens (all fiction):**
  - **The Duskfolk** and their power, **the Dusk Concord** (amber), are from a tidally locked world
    of a red dwarf and live in the twilight band. Patient, communal, governed by consensus, slow to
    trust and slow to forget. **Their bodies are not human:** they walk on four legs with two arms
    free and have a long tail, a crest of bone and amber-red eyes.
  - **The Drifters** and their power, **the Drift Moot** (violet), are vast, long-lived floaters in
    a gas giant's air. Brokers who trade fusion fuel and pay for peace. Not humanoid at all.
  - **The machine heirs** are self-copying machines left running by the Absent. They are cold,
    logical and know more than they say.
  - **The unhomed** are survivors of a dying star beyond the map, travelling in ark fleets.
  - Planned later: the under-ice thinkers and the chorus.
- **The Absent** are a people who lived among the nearby stars long ago and left, leaving things
  behind at the white dwarfs: tidy and switched off, as if they meant to come back. Their charts are
  the old derelicts' charts. Under the old beacons' tones is **a second, slower tone** that no one
  built, and since Pyre died it comes from Pyre's direction. The relics are pieces of an instrument
  for answering it. **Control never says what answers, or who listens.**
- **War and peace:** first contact as a process (signal, words, talk), treaties, borders, fleets
  and wars between powers.

## 3. What this means for Lightkeeper

| Inheritance | Use in Lightkeeper |
| --- | --- |
| The real stars and their data (Reborn's census, Control's 33 ly map) | The star map you command the ship across; real planets as places to land |
| The three human powers | Origins for the hero, factions with standing, and politics to cross |
| The Duskfolk and the Drifters | Peoples to meet, companions with bodies of their own. Not easily playable: neither has a human body plan (D-08) |
| The machine heirs | An ally, a rival or an enemy; a possible companion |
| The Absent, their relics and the second tone | A mystery that can feed the main story without settling what Control leaves open (D-06, D-07) |
| Antares gone dark, Pyre's black hole | Hooks for the threat (D-07) |
| Reborn's places and people | Places to visit, now 150 years older; descendants and legends |
| Control's leaders (First Voice, Still Water and others) | People the hero can meet |
| The damage types | A starting point for weapons and defences |
| Control's art, music and voice pipelines (Gemini images, Lyria music, ElevenLabs voices) | The same pipelines, extended to 3D (D-22, D-23) |

**Code:** Control's decision D-10 ("copy and adapt, noting the source") is the likely rule for
sharing code here as well: the sky data, the star map, saves, and the art scripts.
