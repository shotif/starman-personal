# The character creator: appearance

*Written 24 October 2026, before building it, once the art pipeline delivered the looks (D-30) and
the sliders. It is the first screen of the playable slice (D-20).*

## Goals

1. **Make your hero before you play** (D-04, D-08, D-09): a man or a woman; a lineage (Earthborn,
   Spacer or Heavyworlder, each a preset of the sliders and a height); 10 body sliders and 9 face
   sliders, with labels from the art pipeline; height within the lineage's range; six skin tones;
   eight hair styles; five eye colours; and a name.
2. **A live 3D preview** of the hero, breathing in their idle, on a lit stand: drag to turn them;
   the camera comes in close for the face and the eyes, and stands back for the body.
3. **Phone and desktop first-class:** on a phone the preview fills the top of the screen and the
   choices sit in a sheet below, in tabs; on a desktop the choices are a panel at the side.
4. **Randomise**, for players who want to start at once.
5. **Remembered:** the hero is saved in the browser; the game starts with them, and *Change hero*
   in the HUD goes back to the creator. Without a saved hero, the creator comes first.

## Out of scope

Voice (two voices, D-23) comes with the voices.
Scars, tattoos, make-up and cosmetic armour come later, as the art allows.

## How it works

| Part | Rule | Where |
| --- | --- | --- |
| Looks | What a hero looks like, as data: defaults from the manifest, a lineage preset, a random hero, and checking a saved one (pure, tested) | `src/game/looks.ts` |
| Wearing looks | Sliders become morph weights on every mesh that has them (hair parts too); height scales the root; skins and eyes swap textures; a hair part binds to the hero's skeleton as `docs/ART_PIPELINE.md` §8 explains | `src/game/appearance.ts` |
| The creator scene | Its own small scene with a stand, studio light and an orbiting camera | `src/game/creator.ts` |
| Screens | The panel, its tabs and swatches (skin and eye swatches are crops of their own textures) | `src/ui/Creator.tsx` |
| Saving | The browser's storage, read through the checker so an old or broken save falls back to defaults | `src/ui/App.tsx` |

## Since it was built

- **Class and past** (D-33 to D-35, decided as recommended): two more tabs, *Class* (the six
  classes with what each plays as and its first powers) and *Past* (where you are from and the
  moment that made you), from `src/game/hero.ts`. The powers themselves come with combat.
- **Sliders that pulled against each other** (the owner's feedback) are now one two-way slider
  each: Build, Muscle and Frame (`PAIRS` in `src/game/looks.ts`).
- **Sliders are baked on the processor** (`src/game/appearance.ts`): the owner's Android phone drew
  black patches where the GPU's morph targets moved the body. The GPU now gets plain geometry.

