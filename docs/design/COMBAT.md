# Combat: the slice's fights

*Written 24 October 2026 for the playable slice ([SLICE.md](SLICE.md)). It fills in D-17 (cover,
guns, full melee and combinable powers; assisted aim on phones) for the swarm, the slice's enemies.
The rules that shape the game wait for the owner (D-42, D-43, D-46); the first increment, enemies
that shoot back, does not need them. Everything here is fiction.*

## Goals

1. **Enemies that fight back, readably.** Every enemy shot can be seen coming: a glow before it
   fires and a bright, slow bolt. Cover stops it; moving can dodge it. Nothing hits from off screen
   without warning, which matters most on a small phone screen.
2. **Defences in layers** (D-17, research/MASS_EFFECT.md §2.2): few, coloured and named, so a
   phone player can read a fight at a glance and the squad's mix of powers matters.
3. **The classes play differently.** Each class's starting powers (D-33), on buttons on a phone and
   keys on a desktop, with one combination to learn in the slice.
4. **Falling is not a punishment.** A short way back into the fight, never a long replay.

## Out of scope

Weapons beyond the pistol and one long gun, heavy weapons, ship combat, specialisations, the full
melee system (parries and weapon combos come after the slice; the slice has a strike and a dodge),
and enemies other than the swarm.

## The swarm

The Quench's engines (D-36) are served by machines the engines make. People at Ross 128 name them
on the night; the names stick.

| Machine | What it is | How it fights | Its defences |
| --- | --- | --- | --- |
| **Mote** | A flier the size of a football, plated, with a single emitter | In loose groups of three to five. Darts between places that see the hero, 6–14 m away, never still for long. Glows, then fires a slow bolt (about 18 m/s). Goes for whoever shot it last | Plate, light |
| **Lattice** | Six or more motes locked together into a frame | Hangs back and charges a beam for two seconds, with a line drawn where it will fire: break line of sight or be hit hard. Comes apart into motes when broken | Plate, heavy |
| **Tender** | A slow machine the size of a van that makes motes | Releases motes in threes, mends damaged ones, and carries a field shield over everything near it. The hangar's last stand | Shield, then plate |

Their look comes from the art pass (SLICE.md, increment 8): hard surfaces made with Meshy, glowing
the dim red of the star they are eating.

## Defences and damage (D-42)

Reborn's rules for ships (energy beats deflectors, kinetic beats hulls, ion strips shields) scaled
down to people and machines:

| Layer | Colour | What it is | Weak to | Strong against |
| --- | --- | --- | --- | --- |
| **Shield** | Blue | A field screen from a suit or a machine; recharges after a few seconds untouched | Arc (*Overload*), sustained fire | Field powers: a shielded body cannot be lifted or pulled |
| **Plate** | Amber | Armour; takes a fixed part off every hit; never recharges in a fight | Blast (*Breach Charge*), heavy rounds, *Slam* | Light, fast rounds |
| **Health** | Red | The body, or a machine's frame | Everything | — |

**Recommended for the hero:** a shield that recharges after four seconds without being hit, and
health beneath it that recovers by itself only to the next quarter, and fully with a Warden's
*Repair Drone* or a med-patch found in the world. The red edge of the screen and a short sound say
when the shield is gone.

## When the hero falls (D-43)

**Recommended:** the hero goes down rather than dying at once. For ten seconds a companion can
bring them back up (once per fight), as long as one is standing and not under orders elsewhere.
Otherwise the fight starts again from a checkpoint a few seconds before it, with what was found
kept.

## Powers

Each class has three starting powers (D-33). They run on cooldowns of their own, so a player can
use all three in a fight; carrying a heavier gun makes them slower to return, as in the third
*Mass Effect*. **One combination in the slice:** a *field* power primes a body (it glows violet for
a few seconds), and *Overload*, *Breach Charge* or *Slam* sets it off, hurting everything near it.

**Phone:** the powers sit in an arc above *Fire*, one tap to use on what the crosshair (with aim
assist) points at. **Desktop:** keys **1**, **2** and **3** (the orders move to the command view's
own keys, where they already are), and the mouse aims.

## The strike and the dodge

A **strike** (two blows in a row with the class's melee weapon, a fist for those without) for a
mote that comes close, and a **dodge** (a quick step in the direction of the stick) that leaves
cover and avoids one shot. Phone: a *Strike* button beside *Run*, and a flick of the stick to
dodge. Desktop: **F** to strike, **Space** to dodge.

## Difficulty (D-46)

**Recommended:** three levels, changeable at any time in the settings: *Story* (enemies hit less
and fall faster, aim assist stronger, for those who came for the story), *Standard*, and *Hard*
(enemies flank and use cover, less aim assist). Nothing in the story depends on the level.

## How the first increment works

| Part | Rule | Where |
| --- | --- | --- |
| Motes | Pure rules for where a mote goes (a place 6–14 m from its target that sees it, changed every few seconds and when shot) and when it fires (a glow of 0.6 s, then a bolt; a pause between shots) | `src/game/swarm.ts` |
| Bolts | Slow, bright projectiles stepped each frame; a ray between each step finds the first thing they meet: cover and walls stop them | `src/game/bolts.ts` |
| Hits | Shown, not yet counted against anything: the screen's edge flashes red on the side the bolt came from, and the HUD counts hits taken until D-42 is answered | `src/ui/GameView.tsx` |
| Where | The range: after the three drones are down, Ren calls the drill done and the motes come (the slice's beat 5 in miniature) | `src/game/game.ts` |
