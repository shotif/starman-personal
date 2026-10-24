# The playable slice: Last light at Ross 128

*Written 24 October 2026, after the story was decided (D-36 to D-41, [STORY.md](STORY.md)). D-20
asks for a playable slice before Act 1: a hero you make, the opening mission with two companions,
fights and a side story, on a phone and a desktop. D-38 makes the prologue that slice. This is its
plan; the decisions it needs are D-42 to D-46. Everything in it is fiction except the star and the
planet.*

## Goals

1. **One whole hour, start to end.** From the character creator to the bridge of *Lantern*, with
   the hero in command and Act 1's three leads on the table.
2. **The hard things, together.** 3D on a phone, fights that fight back, orders, conversations
   with choices that are remembered, and every line voiced (D-23).
3. **Two companions** (D-14): Ren Okafor from the start, Jo Rook from the hangar.
4. **One side story** that keeps D-41: people with reasons, a choice that costs, and a consequence
   the hero sees before the slice ends.
5. **It saves.** Leave at any time, come back at the last checkpoint.

## Out of scope

The star map and travel, the ship's encounters (D-18), the other places of Act 1,
specialisations, ship upgrades, romance, and more than the slice's own weapons and powers.

## The place

**Ross 128 b** is real: a world a little heavier than Earth, circling a quiet red dwarf eleven
light-years from the Sun every 9.9 days. Its air, its ground and everything on it here are fiction.
**Calder Station** (a working name) is a joint posting on the planet's dayside edge: an Authority
lane beacon and a Cooperative survey of the star, so a hero from any origin has a reason to be
there. It is hand-made (D-19), in six parts joined by one route:

| Part | What happens there |
| --- | --- |
| **Quarters and the practice range** | The night shift. Talk, train, see the star through the window, dimmer than the charts say. The proof's range lives on here |
| **The control room** | The station chief, the evacuation order, the first sight of the swarm on the sensors |
| **The concourse** | The first real fight, through the station's heart, with civilians to get moving |
| **The relay mast** | The side story, up a ladder and along the outside of the station |
| **The hangar** | Jo Rook, the surveyor, and the last stand while the evacuees board |
| **Lantern's bridge** | The end: the hero in the captain's chair |

## The story, beat by beat

| # | Beat | What the player does | Systems |
| --- | --- | --- | --- |
| 1 | **Night shift** | Wakes in quarters as the hero they made. Ren is on the same shift. A conversation that knows the hero's origin and class (the proof's, grown). The star is 6% dimmer than the charts: the station chief wants a second opinion | Creator, dialogue |
| 2 | **The range** | Ren's drills: move, cover, aim, orders, the hero's first power | Everything the proofs built |
| 3 | **The lights go** | Power fails across the station. The chief calls for everyone to the control room. Through the window, the star is ringed with points of light | A scripted moment |
| 4 | **Control** | The chief has seen it before, on old Authority files that were sealed: a swarm. One ship can fly, the long-haul surveyor in the hangar, its captain on leave in town and not answering. "Get them out." | Dialogue, the first choice the game remembers |
| 5 | **The concourse** | The first motes come through the vents. A fight, then civilians to move, then a bigger fight | Combat ([COMBAT.md](COMBAT.md)), orders |
| 6 | **The mast** (side story) | The comms officer, Pell, says a supply hauler, the *Merrow*, is three hours out and will fly straight into the swarm. The relay is dead; someone could climb the mast and turn it by hand. It costs time, and the motes reach the quarters before the hero does: one of the night shift (someone the player met in beat 1) is lost. Or leave the mast, save the shift, and the *Merrow* goes silent | The side-story rule (D-41) |
| 7 | **The hangar** | Jo Rook, the surveyor's engineer, is holding the hangar with a cutting torch and an opinion. She joins. The last stand: hold the floor while the evacuees board; a Tender, the swarm's large machine, comes last | Two companions, orders to each |
| 8 | **Taking command** | The captain is dead in town. The crew look at the hero. Jo: "She needs a captain and a name." The hero names the surveyor ***Lantern***. Lift-off past the swarm; a last look at Ross 128, dimmer than it should be | Dialogue |
| 9 | **The bridge** | The *Merrow* calls with thanks, or does not call at all. Ren has the sealed files' header: Lightkeeper A. Varro. Three leads for Act 1 (Pyre Remnant, Maw Roost, the Duskfolk border). End of the slice | The consequence (D-41), the hook |

About an hour: twenty minutes before the first fight, forty of fights, choices and the end.

## People

| Who | What they are in the slice |
| --- | --- |
| **Ren Okafor** | Companion from the start (D-39). Authority lane officer; reported the star's dimming a year ago and was told to drop it |
| **Jo Rook** | Companion from the hangar (D-39). Belt-crew engineer on the surveyor |
| **Station Chief Hale** | Old Authority; knows more than the chief of an outpost should. Gives the order to leave |
| **Pell** | Comms officer; the side story's voice |
| **The night shift** | Three people met in beat 1, one of whom may be lost in beat 6 |
| **The *Merrow*'s pilot** | A voice on the comms, heard or not heard |

All names are working names the owner may change.

## What the slice needs, and what exists

| System | Now | For the slice |
| --- | --- | --- |
| Creator, movement, cover, aim | Built (the proofs) | Kept |
| Orders | Built, one companion | Two companions, orders to each or both |
| Dialogue | Built, Ren only | Anyone, started by walking up or by the story; the line ids voiced |
| Enemies | Drones that do not shoot | The swarm: motes, lattices, a Tender ([COMBAT.md](COMBAT.md)) |
| Defences, health, falling | None | D-42, D-43 |
| Powers | None | Each class's starting powers (D-33) |
| Melee | None | A strike and a dodge; the full system after the slice (D-17) |
| Story state and saving | None | Ink variables and checkpoints, saved on the device |
| The place | A corridor and a range | Calder Station, the route through its six parts |
| Voices and mouths | None | ElevenLabs voices (D-23), mouths baked on the processor (D-31) |
| Sound and music | None | D-45 |
| Difficulty | None | D-46 |

## How it is built: increments

Each keeps the game playable, passes CI and deploys (D-01).

1. **Enemies that shoot back**: motes in the range, their shots stopped by cover. Needs no
   decision; the hits are only shown until D-42 is answered. *Built 24 October 2026
   ([COMBAT.md](COMBAT.md)).*
2. **Defences, health, falling and trying again** (D-42, D-43, D-46). *Built: shield, plate and
   health for everyone (`src/game/defences.ts`); down, a companion's hand once a fight, a moment's
   grace after it, otherwise back to just before the fight (`src/game/falling.ts`); difficulty in
   the title and the pause menu.*
3. **Powers**: one signature power per class first, then the rest of the starting powers, on
   buttons and keys.
4. **Calder Station, blocked out**: the six parts in simple shapes, the route, the doors and the
   triggers that start beats. *Built: `src/game/kit.ts` (rooms, doors, windows, lights by zone,
   merged by material), `src/game/station.ts`, `src/game/places.ts` (the named places the script
   uses), `src/game/sky.ts` (Ross 128 at its real 2.1°, and the swarm's ring).*
5. **The story in ink**: every conversation of the slice, story state, checkpoints and saving.
   *Built: `story/slice.ink` runs the whole slice through the director (`src/game/director.ts`):
   `>>>` commands, waits on events, checkpoints that save; conversations in a flow of their own.
   The title offers Continue. A browser journey plays it from the night shift to the bridge.*
6. **Jo Rook** and two companions at once. *Built: orders to either or both.*
7. **Voices and mouths.**
8. **The art pass**: Meshy for the station's pieces, the swarm and the bridge (the owner's
   style decision: Meshy first, the local pipeline when the budget runs out).
9. **A strike and a dodge.**
10. **Sound and music** (D-45).

## The decisions it needs

In [DECISIONS.md](../DECISIONS.md), round 6:

- **D-42** Defences and health, for the hero and the enemies ([COMBAT.md](COMBAT.md)).
- **D-43** When the hero falls.
- **D-44** The side story at the mast, as above, or another.
- **D-45** Where sound and music come from.
- **D-46** Difficulty.

All five were decided as recommended on 24 October 2026.
