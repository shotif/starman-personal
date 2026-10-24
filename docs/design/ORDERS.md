# Orders: the third proof

*Written 24 October 2026, before building it, as the next step after cover and aim
([COVER_AND_AIM.md](COVER_AND_AIM.md)). It builds the first part of D-16 on the proof.*

## Goals

1. **A command view, one tap away** (D-16). On a phone, *Orders*; on a desktop, **Q**. Time nearly
   stops (to a twentieth): the hero, the companion, the animations and the drones all slow, while
   the camera still turns. The crosshair shows what an order will point at.
2. **Objectives, not remote control.** Three orders to start, each pointing at what is under the
   crosshair:
   - **Go there** — to a point on the floor, and hold it. At a crate, take the near side of it.
   - **Attack** — a drone near the crosshair: she finds a place to shoot from, shoots until it is
     down, then goes back to what she was doing.
   - **Follow me** — the standing objective she starts with.
3. **She carries them out herself, and says how it goes**: "Moving." / "In position." / "On it." /
   "Target down." / "I can't reach that." / "No target there." A short line in the HUD, with her
   name.
4. **She falls back on her own sense** when an objective ends: an attack returns to holding or
   following, whichever came before.
5. Phone and desktop first-class: big buttons on a phone; on a desktop, **1**, **2** and **3**
   for the orders and **Q** or **Esc** to close, the buttons also clickable.

## Out of scope

Her picking targets herself (the practice drones are the player's to shoot; with real enemies she
will choose her own), powers, flanking and protecting, orders outside combat (search, scout, hack,
watch, question), a second companion, voiced replies. They follow with the enemies and the slice.

## How it works

| Part | Rule | Where |
| --- | --- | --- |
| Deciding | Pure: from her objective and the facts the game measures (where she is, where the hero is, whether the target is alive, seen and in range, whether a point is reachable), what she does next: move to a point, stop, shoot at a target, and what she says | `src/game/orders.ts` |
| Carrying out | Walking the navigation mesh, aiming with the upper body, shooting with a lower rate and accuracy than the hero's | `src/game/companion.ts` |
| Time | One factor slows the game's own rules, the animations and the navigation crowd together | `src/game/game.ts` |
| Screens | The *Orders* button, the command panel, her lines in the HUD | `src/ui/` |

## The companion's name

The companions are designed with the story (D-14). Until then the proof's companion is called
**Ren**, a placeholder.
