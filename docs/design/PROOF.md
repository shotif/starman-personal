# The first proof: a corridor on a phone

*Written 24 October 2026, as the proof was built, after the owner chose Babylon.js (D-21) and asked
for the setup to go ahead. It is the step before the playable slice of D-20.*

## Goals

The proof answers one question before any story is built: **can a semi-realistic third-person
scene run well in a phone's browser, with the controls this game needs?** It must show:

1. Babylon.js starting on a phone and a desktop, from GitHub Pages, with Havok physics.
2. A lit station corridor that opens into a room with crates (the cover of the next step).
3. A hero who walks, runs and sprints with blended animations, moved by the character controller,
   so walls and floors behave.
4. A third-person camera over the right shoulder that is pulled in before walls, and that stands
   further back on a portrait phone.
5. Phone controls (a stick under the left thumb, a look area for the right, a run toggle) and
   desktop controls (mouse look with the pointer captured, WASD, Shift to run).
6. A companion with one standing objective, "stay with me", walking a navigation mesh: the base of
   D-16's objectives.
7. Quality tiers (D-22), chosen per device and changeable, with the frame rate on screen.

## Out of scope

Cover, aiming, shooting and melee; dialogue; real lighting from the art pipeline; sound; saving.
*(The MPFB people and Poly Haven's materials arrived during the proof and are in it.)*

## How it is built

| Part | Where |
| --- | --- |
| Movement rules (stick, keys, camera-relative movement, turning, speeds, animation blending, camera framing), pure and unit-tested | [`src/game/motion.ts`](../../src/game/motion.ts) |
| Quality tiers | [`src/game/quality.ts`](../../src/game/quality.ts) |
| Keyboard and mouse | [`src/game/input.ts`](../../src/game/input.ts) |
| The corridor, its physics bodies and its lights (clustered where supported) | [`src/game/level.ts`](../../src/game/level.ts) |
| Characters: loading a model once, placing it many times, blending idle, walk, run and sprint; a capsule stand-in if the model is missing | [`src/game/characters.ts`](../../src/game/characters.ts) |
| The loop: engine, physics, character controller, camera, the companion on the navigation mesh | [`src/game/game.ts`](../../src/game/game.ts) |
| Screens: the HUD, the quality switch, notices, the touch controls | [`src/ui/`](../../src/ui/) |

The hero and the companion are the MPFB 2 man and woman from the art pipeline
([ART_PIPELINE.md](../ART_PIPELINE.md)), animated with Quaternius's CC0 libraries; `?hero=woman`
swaps them. Quaternius's mannequin stands in if they cannot be loaded.

## How to judge it

- **On the owner's phone:** open <https://shotif.github.io/starman-personal/>, walk the corridor
  into the room and back, and read the frame rate at each quality setting. The target is **30
  frames a second or more at *low*** on a mid-range phone, and a phone that stays cool for a few
  minutes.
- **In CI:** the browser journeys start the scene on a phone and a desktop with no errors, and walk
  the hero forward. They run on a software renderer, so their frame rates mean nothing.

## Next

Cover and aiming, the MPFB hero in place of the mannequin, materials from the art pipeline, and
then the style test (D-22).
