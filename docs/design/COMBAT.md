# Combat: the slice's fights

*Written 24 October 2026 for the playable slice ([SLICE.md](SLICE.md)). It fills in D-17 (cover,
guns, full melee and combinable powers; assisted aim on phones) for the swarm, the slice's enemies.
The rules that shape the game (D-42, D-43, D-46) were decided as recommended on 24 October 2026.
Everything here is fiction.*

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

## Growth and weapons (Act 1, increment 3)

The design is in [ACT1.md](ACT1.md), increment 3 (D-53 to D-56); the rules, each tested:

| Part | Rule | Where |
| --- | --- | --- |
| Experience | From the story only (`>>> xp`, and `#xp` on two hard choices), each grant once by its key; twelve levels, two points a level | `src/game/growth.ts` |
| Ranks | Rank 2 a third stronger; rank 3 a quarter quicker and a third wider; one point, then two | `atRank` in `src/game/powers.ts` |
| New powers | Two a class at levels 3 and 6; three in hand | `CLASS_GAINS`, `src/game/abilities.ts` |
| Training and talents | The backstory's talents and the class's training change health, shield, plate, cooldowns, damage, healing, the shield's return and speed aboard | `modifiers` in `src/game/growth.ts` |
| Companions' powers | Ren: Mark, Veil; Jo: Overload, Seeker Drone; their own ranks, half again slower than the hero's | `companionPower` in `src/game/game.ts` |
| Weapons | Pistol, rifle, shotgun, marksman rifle: rate, damage, slugs, reach, falloff, spread, zoom, weight; no ammunition | `src/game/weapons.ts` |
| Weight | Above 3 carried, each point makes powers return a tenth more slowly | `weightScale` |
| Mods | Scope, stabiliser, heavy rounds (a quarter more to plate), long barrel, cooled coil; two a weapon | `fitted`, `takeHit`'s plate bonus |

## The Banked (Act 1, increment 4)

The design is in [ACT1.md](ACT1.md), increment 4 (D-51). The rules, in `src/game/banked-rules.ts`,
each tested:

| Rule | What it says |
| --- | --- |
| Cover points | Low furniture (0.8 to 1.35 m high) gives points 0.55 m out from each side, about a metre apart; a point hides from a target when the furniture lies between them (the target is within 60° of straight across it) |
| Choosing cover | Of the points that hide from the target and are not taken: the nearer to the kind's distance from the target the better (trooper 8–18 m, engineer 12–24 m), the shorter the run the better, at least 3 m from an ally; a squad's flanker prefers points at least 60° round from the rest |
| A turn in cover | Hide (crouched, 1.2–2 s), come up and fire (a trooper two bursts of three, an engineer four shots), hide again; if the target is no longer hidden from by the cover, or cannot be seen from it for 6 s, find another |
| Falling back | Once, below 35% health: the point farthest back that still hides |
| Going round | When the hero has stayed hidden for 6 s, the trooper best placed goes for a point round the side |
| Shots | Each shot hits by chance: 70% at 5 m to 30% at 30 m, less if the target moves, scaled by difficulty; a shot whose line meets cover or a wall stops there |
| Engineer | A shield of 60 on the ally with the least, within 18 m, every 12 s; two motes every 20 s, at most three of its own alive |
| Warden | Barrier 300 over a 120° arc in front; hits from outside the arc go past it; it returns 8 s after breaking, at 60 a second; walks to 7 m from its target, facing it |

## The first increment, as built

| Part | Rule | Where |
| --- | --- | --- |
| Motes | Pure rules: where a mote goes (a place 6–14 m from its target, 1.2–2.6 m up, that it can reach and that sees its target, swung round from where it is so it flanks; it moves on after 2.5–4 s, when it loses sight, and when shot), when it fires (rests 1.6–2.4 s, glows 0.6 s, fires; gives up the shot if its target ducks), and what a bolt meets. It turns on whoever shot it last. Three hits bring it down | `src/game/swarm.ts` |
| The scene | Motes as moving physics bodies the hero's and Ren's shots and aim assist find like the drones (they join the range); bolts at 18 m/s with a spread that grows with distance; walls and cover stop them. The hero's capsule has a collision group of its own, so the swarm's rays look past it to the hero. Simple shapes until the art pass | `src/game/motes.ts` |
| Hits | Shown, not yet counted against anything: the screen's edge flashes red on the side the bolt came from, and the HUD counts hits taken until D-42 is answered. Crouched in cover, the hero is a smaller mark | `src/ui/GameView.tsx`, `src/game/game.ts` |
| Ren | Between orders she shoots the nearest machine of the swarm she can see, from where she is, more slowly than under an order; the practice drones she leaves alone | `src/game/orders.ts`, `src/game/companion.ts` |
| Where | The range: once all three drones are down, Ren calls the drill done and the motes come from the vents, three, then five. `?swarm` starts the fight at once | `src/game/swarm.ts` (`drillStep`) |

Measured on the software renderer over fifteen seconds against three motes: standing in the open,
3 of 10 bolts hit; crouched behind a low crate, none of 6. No conversation starts while the swarm is
fighting.
