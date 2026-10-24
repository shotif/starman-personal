# The style test: where the hard-surface art comes from

*Written 24 October 2026, before building it. It settles the open half of D-22: whether armour,
weapons and props come from Meshy (paid, the owner's month of Premium) or from trellis.cpp (open
source, on the owner's Mac), and whether either holds the semi-realistic look on a phone.*

## Goals

1. Make the same four subjects with both tools, from the same concept pictures.
2. Prepare both the same way for phones (the same triangle budget and texture size), so the
   comparison is fair.
3. Show them side by side in the proof's room, labelled, for the owner to judge on a phone.
4. Record time, cost and size for each, so the choice is informed by more than looks.

## Out of scope

Rigged characters and companions (Meshy's rigging is a later test), armour fitted to the hero's
body, and final art. These four objects are for judging only and leave the proof once the choice is
made.

## The subjects

Grounded, near-future and worn, in the series' tone. Each concept picture is a semi-realistic
product shot on a plain white background, three-quarter view, the whole object in frame, no text
or logos.

| Id | Subject | Why |
| --- | --- | --- |
| `sidearm` | A station-security sidearm: matte gunmetal and worn olive polymer, a small charge light | Weapons are the hero's most-seen objects |
| `helmet` | An EVA helmet: scuffed off-white shell, hazard stripes, a wide tinted visor | Armour, curved surfaces, glass |
| `locker` | A rugged supply locker: dented panels, latches, stencilled panel lines | Props that fill every place |
| `terminal` | A wall maintenance terminal: a small screen, a keypad, conduits | Interactive objects in stations |

## The pipeline

| Step | Tool | Where |
| --- | --- | --- |
| Concept pictures | Gemini (`gemini-nano-banana-2.1`, as Control's D-23), 2K JPEG | `npm run art:concepts` → `art/out/concepts/` |
| Model A | trellis.cpp, resolution 512, seed 42 | `npm run art:trellis` → `art/out/` |
| Model B | Meshy image-to-3D: latest model, remeshed to triangles, PBR, 2K textures | `npm run art:meshy` → `art/out/meshy/` |
| Fair preparation | glTF-Transform: simplified to about 15,000 triangles, textures to 1024 px, WebP | `npm run art:props` → `public/assets/props/` |
| Display | Pedestals in the proof's room, A and B side by side, each named | `src/game/gallery.ts` |

Every candidate keeps a record beside it (picture, prompt, settings, time, credits or cost); the
props that reach `public/` are listed with their sources in `art/props.json` (D-28).

## Cost

Four Gemini pictures at about $0.10 each come out of D-24's $50. Meshy's credits come from the
owner's subscription. trellis.cpp costs nothing but about 9 minutes of the Mac's time per model.

## How the owner judges

On the phone, in the room: which of each pair looks more like the game you want, and whether the
better of them is good enough. The answer becomes D-22's source of hard-surface art, and decides
whether to keep Meshy after the month.
