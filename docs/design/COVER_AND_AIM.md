# Cover and aim: the second proof

*Written 24 October 2026, before building it, after the owner said to move on with development.
It builds the first part of D-17 on the corridor proof ([PROOF.md](PROOF.md)) and leads to the
playable slice of D-20.*

## Goals

1. **Cover by moving into it** (D-17: no sticky button). Walk into a crate lower than about
   1.3 m and the hero drops into cover behind it, facing it. Moving along it slides along it;
   pushing away from it, or sprinting, leaves it.
2. **Aim.** On a desktop, hold the right mouse button; on a phone, tap *Aim*. The camera comes
   in over the shoulder, a crosshair appears, the hero faces where the camera looks and raises the
   pistol, and walks in any direction (eight-way blending of the new clips) while the arms keep
   aiming. Aiming from cover stands the hero up over it.
3. **Shoot.** Left mouse, or the phone's *Fire* button (hold to keep firing). The shot goes where
   the crosshair points. On a phone, **aim assist** turns the shot towards the nearest target inside
   a small cone around the crosshair (D-17's "assisted aim"). A muzzle flash and a tracer show it.
4. **Something to shoot.** Three practice drones hover in the room. Each takes three hits,
   flashes when hit, drops to the floor when destroyed, and comes back after a while.
5. Phone and desktop both first-class, as before; nothing in this proof slows the phone below the
   first proof's frame rates.

## Out of scope

Enemies that shoot back, damage to the hero, shields and armour layers, powers, melee, ammunition
and heat, companions taking cover or orders (D-16), and sound. They follow, in that rough order.

## How it works

| Part | Rule | Where |
| --- | --- | --- |
| Poses | Which clips play, and at what weight, for moving, aiming and cover, as pure functions: idle, walk, run and sprint by speed; while aiming, walk forwards, backwards and sideways blended by the direction of the stick; in cover, crouch, moving left or right | `src/game/pose.ts` |
| Cover | Two short rays in the direction of movement, at knee and chest height: knee blocked and chest clear means low cover. Entering, sliding and leaving are a small pure state machine | `src/game/cover.ts` |
| Aim assist | The nearest live target within 6° of the crosshair, if any | `src/game/aim.ts` |
| Upper body | While aiming, the walking clips are masked off the spine, arms and head, and the aim clip plays there alone | `src/game/characters.ts` |
| Drones and shots | Static physics spheres the shot's ray can hit; a destroyed drone becomes a falling body | `src/game/combat.ts` |
| Controls | Right mouse and left mouse on a desktop (with the pointer captured); *Aim* and *Fire* buttons on a phone, above *Run* | `src/game/input.ts`, `src/ui/TouchControls.tsx` |

The pure rules have unit tests; a browser journey aims and fires on a phone and a desktop.

## Since it was built

The owner's phone showed two faults on 24 October 2026; both are fixed, and the cover journey now
checks them.

- **Feet on air.** The hero and Ren stood about 10 cm above the floor. The hero stood on the bottom
  of Havok's character capsule, which the controller keeps a few centimetres clear of every surface;
  Ren stood on the navigation mesh, which lies up to a voxel (10 cm) above the floor. Both now stand
  on the floor found by a short ray straight down (`groundUnder` in `src/game/game.ts`).
- **A face without hair or eyes.** Crouched in cover, with the camera close, the hair, eyes, brows
  and lashes vanished. A skinned mesh is culled by the box of its bind pose, which the animation
  does not move; crouched, the head drops half a metre below those boxes. Every part of a character
  now has the box of the whole figure in any pose (`fitFigureBounds` in `src/game/characters.ts`).
- **Cover that would not hold.** Cover could be taken with the crate up to 1.15 m ahead (its reach
  and the capsule's radius), but the ray that checks it is still there was only 1.1 m long, so
  taking cover from just that far ended it the next frame. Both now agree, and the hero settles
  against the cover after dropping into it (found while building the swarm, [COMBAT.md](COMBAT.md)).
- **The camera at the face.** The camera could not come nearer than 0.9 m to its pivot, so with a
  wall closer than that it sat inside the wall, against the hero's face. It now stops just short of
  any wall, however near, and the hero fades out as it comes within 0.75 m of the head, and is gone
  within 0.35 m (`closeFade` in `src/game/motion.ts`).
