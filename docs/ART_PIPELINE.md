# The art pipeline: people and animation

How the game's characters are made, 24 October 2026. Scripts build every character file from
open sources, without anyone clicking in Blender. This page says what to install, how to run each
script, where the files go, and the licence rule. The choice of sources is in
[research/OPEN_SOURCE.md](research/OPEN_SOURCE.md) §1, §2 and §6, and in decisions D-08, D-09,
D-22 and D-28.

## 1. The licence rule (D-28)

- **Only shareable files go into the repository:** CC0, CC BY (credited in
  [../CREDITS.md](../CREDITS.md)), MIT, Apache-2.0 and the like. Mixamo's animations and most
  store assets stay out.
- **Every source is recorded** in [`art/records.json`](../art/records.json): its URL, the date it
  was downloaded, its licence and its SHA-256. Every output is recorded there too.
- **Downloads stay in `art/cache/`**, which git ignores. The scripts fetch them again from the
  record.
- **API keys never reach the repository or the game.** They live in the git-ignored `.env`. No
  script on this page needs a key, and none reads `.env`.
- **A new asset is checked before use.** Read its own licence line (MakeHuman packs mark each
  item), use it only if it is CC0 or CC BY, add it to the record, and credit it if it is CC BY.

## 2. What you need

| Tool | Where | Notes |
| --- | --- | --- |
| Blender 5.2.1 LTS | `~/Applications/Blender.app`, run as `blender` (`~/.local/bin/blender`) | Runs every `.py` script here, headless, with its own Python |
| MPFB 2.0.18 | a Blender extension | Makes the human bodies. Install it once (below) |
| UAL 1 Pro | `art/cache/ual1-pro-source/` | Bought by the owner (CC0). It cannot be downloaded by script: copy the pack there by hand |
| Python 3.9 or newer | `python3` | Only for `fetch_sources.py` and `records.py`, which use the standard library alone |
| glTF-Transform | `node_modules/.bin/gltf-transform` (`npm install`) | Shrinks the `.glb` files. Without it the files are written uncompressed |

No pip packages and no other add-ons are needed. The UAL pack's own Blender add-on
(`root_motion_toggle.py`) is not used.

## 3. Step by step

All commands run from the repository's root folder.

**1. Fetch the sources** (about 540 MB, once). Each file is checked against its SHA-256, and
the bought UAL 1 Pro pack is checked where it lies:

```sh
python3 scripts/art/fetch_sources.py
```

**2. Install MPFB into Blender** (once), from the copy just fetched, with Blender's own command:

```sh
blender -c extension install-file -r user_default -e art/cache/downloads/add-on-mpfb-v2.0.18.zip
```

The scripts turn it on for their own run only.

**3. Build the characters,** the mannequin first, because the heroes' posture is compared
with it:

```sh
blender -b --factory-startup --python scripts/art/mannequin.py   # about 10 seconds
blender -b --factory-startup --python scripts/art/hero.py        # about 30 seconds
```

`hero.py -- man` builds one body; `hero.py -- --no-anim` skips the animation; `hero.py --
--config other.json` tries other settings. Both scripts stop with an error if the standing
idle fails the posture check (§6).

**4. Check the posture again** from the finished files (the step fails if it is not upright):

```sh
blender -b --factory-startup --python scripts/art/posture.py
```

Any clip can be measured: `posture.py -- public/assets/characters/hero-man.glb walk`.

**5. Look at them** (optional). This renders review sheets into `art/out/previews/`, including
`posture-before-after.png`:

```sh
blender -b --factory-startup --python scripts/art/preview.py
```

**6. Update the record:**

```sh
python3 scripts/art/records.py
```

## 4. Where files go

| Path | In git | What it holds |
| --- | --- | --- |
| `scripts/art/*.py` | yes | The scripts. `common.py` holds what they share; `posture.py` measures how a character stands |
| `art/animations.json` | yes | The clips every character carries, their names, their sources and how each is corrected |
| `art/hero.json` | yes | How the two hero bodies are built, their clothes, and the morph targets |
| `art/lineages.json` | yes | The Earthborn, Spacer and Heavyworlder presets |
| `art/records.json` | yes | Every source and output, with licences and checksums |
| `art/cache/` | no | Downloads, unpacked packs and the bought UAL 1 Pro pack |
| `art/out/` | no | Uncompressed copies, textures, posture reports, lineage examples and previews |
| `public/assets/characters/` | yes | What the game loads (below) |

The game loads:

| File | What it is |
| --- | --- |
| `mannequin.glb` | Quaternius's CC0 mannequin with the full clip set. A stand-in for any character |
| `hero-man.glb`, `hero-woman.glb` | The two hero bodies (D-09), complete with their default looks, the clip set and all the morph targets |
| `looks/<body>/hair-<style>.glb` | Each hair style as a part on the hero's skeleton (§8) |
| `looks/<body>/skin-<tone>.webp` | Each skin tone, a 1024 px colour texture |
| `looks/eyes-<colour>.webp` | Each eye colour, a 512 px texture with the cornea cut out in alpha |
| `heroes.json` | For the game: clip names, morph names and groups, lineage presets, heights, and every look with its file, size and what it replaces |

## 5. The skeleton and the clips

- **Skeleton.** The heroes use MPFB's *game_engine* skeleton: 53 bones with Unreal-style names
  (`Root`, `pelvis`, `spine_01`, `thigh_l` …). The mannequin uses UAL's own skeleton with the
  same names (lower-case `root`, `Head`), also 53 bones.
- **Clips.** 55 clips from Quaternius's Universal Animation Library 1 Pro and 2 (CC0), renamed.
  The list, the source of each and any correction are in `art/animations.json`. All are in
  place: the game moves and turns the character, the clips do not (`turn_left` and
  `turn_right` end facing 90° away, so the game turns the character to match).

| Group | Clips |
| --- | --- |
| Standing | `idle`, `idle_talk`, `turn_left`, `turn_right` |
| Moving | `walk`, `walk_back`, `strafe_left`, `strafe_right`, `jog`, `jog_back`, `jog_left`, `jog_right`, `jog_fwd_left`, `jog_fwd_right`, `jog_back_left`, `jog_back_right`, `sprint` |
| Cover and evasion | `crouch_idle`, `crouch_enter`, `crouch_exit`, `crouch_walk`, `crouch_back`, `crouch_left`, `crouch_right`, `dodge_left`, `dodge_right`, `roll`, `jump_start`, `jump_loop`, `jump_land`, `climb_ledge` |
| Guns and powers | `pistol_idle`, `pistol_aim`, `pistol_aim_up`, `pistol_aim_down`, `pistol_shoot`, `pistol_reload`, `power_ready`, `power_cast`, `power_both_ready`, `power_both_cast` |
| Melee | `punch_jab`, `punch_cross`, `kick`, `melee_hook`, `melee_combo` |
| Hits and death | `hit_chest`, `hit_head`, `hit_stomach`, `hit_shoulder_left`, `hit_shoulder_right`, `hit_knockback`, `death`, `death_alt` |
| Other | `interact` |

- **Corrected and made clips.** UAL's standing idles slouch: head forward, knees bent, one foot
  well ahead. `idle` and `idle_talk` are rebuilt upright (`common.make_upright`): the clip's
  breathing, small weight shifts, arms and head are kept; its average lean is taken out; the
  feet stand flat under the hips; the knees stay nearly straight. UAL's walks and jogs lean well
  forward, so half of the spine's average bend is taken out of them (`common.straighten`).
  UAL has no backward or sideways walk: `walk_back` is the walk played backwards, and
  `strafe_left` and `strafe_right` are the real side jogs, slowed and softened towards the idle.
- **Retargeting.** `common.Retargeter` gives each bone the source bone's change of world
  rotation. How the two rest poses are matched depends on the bone. Arms, hands and fingers are
  first turned to point as the source's do, so MPFB's A-pose arms follow UAL's T-pose. Thighs
  and shins match only their sideways spread, so the feet stand under the hips. The pelvis,
  spine, neck, head, collarbones and feet take the rotation change alone, because their bone
  directions are rig conventions (UAL's pelvis bone points forward, MPFB's backward). Then, at
  every frame, the spine is turned so the line from the pelvis to the head points exactly as
  the source's does. So the hero leans and tilts its pelvis exactly as the mannequin does in
  every clip. The hips' movement is scaled by the ratio of hip heights.
- **Channels.** Each clip keys the rotation of every bone, so a clip sets the whole pose.
  Only the hips and the root have position keys, and nothing has scale keys.

## 6. The posture check

`scripts/art/posture.py` measures a clip from the side at every frame: how far the head is ahead
of the ankles, the lean of the line from the pelvis to the head, the pelvis's tilt from rest,
the knee bend, and how far each foot lifts. The standing `idle` passes when, at every frame:

- the head is within 5 cm of the midpoint of the ankles;
- the trunk leans 5° or less;
- each knee bends 10° or less;
- both feet stay flat (they lift 2.5 cm or less);
- for a hero, its average trunk lean and pelvis tilt are within 2° of the mannequin's.

`mannequin.py` and `hero.py` run the check before they export, and stop if it fails. On
24 October 2026 the idle measured:

| File | Head ahead | Trunk lean | Pelvis tilt | Worst knee bend | Feet |
| --- | --- | --- | --- | --- | --- |
| mannequin, before | 7.3 cm | 8.0° | −4.8° | 27° | 36 cm apart, 39 cm staggered |
| man, before | 26.2 cm | 19.2° | 30.7° | 27° | 42 cm apart, 43 cm staggered |
| woman, before | 14.8 cm | 9.5° | 43.2° | 27° | 36 cm apart, 38 cm staggered |
| mannequin, now | 1.4 cm | 2.5° | 0° | 4° | 18 cm apart, level |
| man, now | 1.9 cm | 2.5° | 0° | 6° | 23 cm apart, level |
| woman, now | 2.3 cm | 2.5° | 0° | 7° | 18 cm apart, level |

## 7. The hero: body, face and sliders

`hero.py` builds each body with MPFB from the settings in `art/hero.json`:

- the body from MPFB's base mesh, the phenotype (sex, age, muscle, weight, proportions) and a
  few body targets for an athletic build: firmer arms and shoulders, and slimmer hips and
  seat on the woman. They are applied before the skeleton is fitted, so the joints follow them;
- eyes, eyebrows, eyelashes, teeth and a tongue from MakeHuman's system assets (CC0), and the
  body's default skin, hair and eye colour from the looks (§8);
- the suit: TheGreatEngineer's *Galactic Warrior* uniform (CC0), a soldier's suit with panels,
  pads and a belt, darkened to slate grey and matte (roughness 0.75); and MakeHuman's black
  boots (CC0);
- the skin under the clothes is removed: where the clothes' own lists say so, and wherever a
  ray from the skin meets the clothes, so no skin shows through at bent knees. Hair never
  removes the scalp, because the hair can be swapped;
- plain glTF materials, each named `<body>_<part>`: `skin`, `eyes`, `eyebrows`, `eyelashes`,
  `teeth`, `tongue`, `hair`, `suit` and `boots`. Eyes and hair are cut out with alpha; eyebrows
  and eyelashes are alpha-blended. Textures are WebP (`EXT_texture_webp`).

**Morph targets.** 40 morph targets are baked into each hero, on the body and on everything
fitted to it, so the suit, boots, hair, eyelashes, eyebrows, teeth and tongue follow:

| Group | Morphs |
| --- | --- |
| Body sliders | `body_heavy`, `body_slim`, `body_muscular`, `body_soft`, `body_lean`, `body_stocky`, `body_shoulders_broad`, `body_hips_wide`, `body_chest`, `body_neck_thick` |
| Face sliders | `face_jaw_wide`, `face_chin_strong`, `face_cheekbones`, `face_nose_wide`, `face_nose_long`, `face_lips_full`, `face_eyes_large`, `face_brow_heavy`, `face_round` |
| Speech (§9) | `viseme_sil`, `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U` |
| Eyes (§9) | `blink_left`, `blink_right`, `look_left`, `look_right`, `look_up`, `look_down` |

Each runs from 0 to 1. Opposites (heavy and slim) are separate morphs. Movements under half a
millimetre are dropped, so each morph stores fewer vertices.

**Height.** A morph cannot move the skeleton, and a taller body on the same skeleton bends at
the wrong places. So height is a **uniform scale on the character's root node**, from 0.9 to 1.1.
`body_lean` and `body_stocky` give the proportions of a tall or short build without moving the
joints.

**Joints that move.** The script measures how far each morph would move the joints if the
skeleton were refitted. Most move them by about 1 cm or less. `body_shoulders_broad` moves the
arms by 2.7 cm and `body_hips_wide` the legs by 1.5 cm. `heroes.json` lists these shifts per
bone (`boneOffsets`), so the game can move those bones with the slider if it needs to.

**Lineages.** `art/lineages.json` holds the presets for D-08 as morph weights and a height
scale: Earthborn (the baseline), Spacer (tall and light: 1.07, lean and slim) and Heavyworlder
(short and dense: 0.93, stocky and muscular). `hero.py` also writes an example of each into
`art/out/lineages/` for any glTF viewer.

## 8. The creator's looks (D-30)

Each body offers six skin tones, eight hair styles and five eye colours, listed in
`art/hero.json` (`looks`) and, for the game, in `heroes.json` (`looks`). The complete heroes
carry one default of each; the others are separate small files, so the player can swap them
without downloading a hero for every combination.

| Look | Options | File | What it replaces |
| --- | --- | --- | --- |
| Skin | `tone1` … `tone6`, from very light to deep | `looks/<body>/skin-<tone>.webp`, 1024 px | the base colour texture of `<body>_skin` |
| Hair | `shaved`, `cropped`, `short`, `afro`, `long`, `ponytail` (tied back), `braid`, `bun` | `looks/<body>/hair-<style>.glb` | the hero's own hair, the primitive with material `<body>_hair` |
| Eyes | `brown`, `hazel`, `green`, `blue`, `grey` | `looks/eyes-<colour>.webp`, 512 px, shared by both bodies | the base colour texture of `<body>_eyes` (keep its alpha cut-out) |

- **Skins** are MakeHuman skins (CC0). Where no CC0 skin fills a step between two tones, the
  tone is a blend of two real skins on the same layout (`derived` in the manifest). None has a
  normal map, so `normalFile` is `null`.
- **Eyes** are MakeHuman's iris textures; MakeHuman's own brown is red, so `brown` is its amber
  iris darkened.
- **Shaved** has no file: hide the hero's hair and add nothing.
- **No hairless base hero.** Swapping is clean without one: hide one primitive and add a part.

**How a hair part is made.** `hero.py` fits every style to the body during the build, so each
gets the same morphs as the hero. Each part is then exported on its own with the hero's
skeleton: the same 53 bones, in the same order, with the same inverse bind matrices. To make
that hold after compression, every character file stores its vertex positions on one fixed
16-bit grid (2.5 m either side of the origin, steps of 0.08 mm) and folds that one scale into
the inverse bind matrices (`common.POSITION_RANGE`). A part keeps only the morphs that move it
by 2 mm or more (the face sliders and the body sliders that change the head).

**How the game attaches a hair part (Babylon.js 9).** Tested with the project's own Babylon.js
9.32: a part bound this way lands exactly on the hero's own hair in every pose (0 mm apart),
and within 3 mm with face and body sliders set.

```ts
import { LoadAssetContainerAsync, type AbstractMesh } from '@babylonjs/core';

const base = 'assets/characters/';
const hero = await LoadAssetContainerAsync(`${base}hero-woman.glb`, scene);
hero.addAllToScene();
const skeleton = hero.skeletons[0];
const ownHair = hero.meshes.find((m) => m.material?.name === 'woman_hair')!;

let worn: AbstractMesh[] = [];
async function wearHair(file: string | null) {   // file from heroes.json looks.woman.hair[i].file
  for (const m of worn) m.dispose();
  worn = [];
  ownHair.setEnabled(false);                       // or true again for the default style
  if (!file) return;                               // 'shaved'
  const part = await LoadAssetContainerAsync(base + file, scene);
  part.addAllToScene();
  const hair = part.meshes.filter((m) => m.skeleton);
  for (const m of hair) {
    m.skeleton = skeleton;                         // same bones, order and bind matrices
    m.parent = ownHair.parent;                     // where the loader put the hero's own meshes
  }
  for (const s of part.skeletons) s.dispose();     // the part's own copy of the bones
  for (const n of part.transformNodes) n.dispose();
  part.meshes.find((m) => m.name === '__root__')?.dispose();
  worn = hair;
}

// Morphs: set the same weights by name on the hero and on the worn hair.
function setMorph(name: string, weight: number) {
  for (const m of [...hero.meshes, ...worn]) {
    const target = m.morphTargetManager?.getTargetByName(name);
    if (target) target.influence = weight;
  }
}
```

A part only has the morphs that move it, so a name may be missing there; that is expected. A
skin or an eye colour is a texture swap on the named material, for example
`(scene.getMaterialByName('woman_skin') as PBRMaterial).albedoTexture = new Texture(url, scene)`.

## 9. Speech and eyes (D-31)

- **Visemes.** The 15 Meta/Oculus visemes come from Mika Suominen's *Visemes 02* targets for
  MakeHuman (CC0). They move the lips, the jaw, the teeth and the tongue, which are fitted to
  the mouth's helper geometry, so an open mouth shows teeth and a tongue. A lip-sync library
  that speaks Oculus visemes can drive them by name; `viseme_sil` is the closed rest shape
  (no movement).
- **Teeth and tongue.** MakeHuman's teeth are grey with deep red gums; `hero.py` recolours them
  to a warm off-white with soft pink gums (`teethColours` in `art/hero.json`), roughness 0.35.
  The teeth and the tongue darken towards the back of the mouth, down to 40%, so an open mouth
  sits in shadow instead of glowing. In a mouth shaded by the lips, the teeth still look light
  grey, because only the ambient light reaches them.
- **Blinks.** `blink_left` and `blink_right` close the character's own left and right eye, from
  MPFB's eye-closure targets mixed by the body's ancestry. The eyelashes follow.
- **Eye turns.** `look_left`, `look_right` (22°), `look_up` (15°) and `look_down` (18°) turn
  both eyeballs about their own centres. Being morphs, they are straight-line moves, so
  in-between weights shrink the eye very slightly; keep them small or use them in pairs.
- `visemes.png` in `art/out/previews/` shows every shape close up.

## 10. Phone budgets

| File | Size | Triangles | Textures |
| --- | --- | --- | --- |
| `mannequin.glb` | 2.0 MB | 13,743 | none |
| `hero-man.glb` | 5.1 MB | 40,057 | WebP: 1024 px skin and suit; 512 px eyes, brows, lashes, teeth, tongue, hair and boots |
| `hero-woman.glb` | 5.3 MB | 44,267 | the same |
| a hair part | 0.15–0.46 MB | 1,050–7,622 | one 512 px WebP |
| a skin tone | 0.03–0.06 MB | | 1024 px WebP |
| an eye colour | about 0.01 MB | | 512 px WebP |

The aim is under about 6 MB a character, with textures no larger than 1024 px. Each hero has
about 14,500 triangles of head and hands, 10,200 of suit, 4,100 of boots, 7,100 of teeth,
2,000 of eyes, and 1,000 (man) or 5,400 (woman) of hair. Most of the file is the morph targets
and the 55 clips. The visemes, blinks and eye turns take about 0.66 MB a hero, and the teeth
and tongue 0.16 MB.

**Compression.** With glTF-Transform installed, `common.finish_glb` resamples the clips,
removes unused data, stores normals as 8-bit numbers and texture coordinates and weights in
8 or 16 bits (`KHR_mesh_quantization`, which Babylon.js reads with no decoder), puts the
positions on the shared 16-bit grid, stores the mostly-empty morph targets sparsely, and stores
the clips' rotations as 16-bit numbers (allowed by core glTF 2.0). It does not use meshopt or
Draco, which need a decoder in the game. Check a file with:

```sh
npx gltf-transform inspect public/assets/characters/hero-man.glb
npx gltf-transform validate public/assets/characters/hero-man.glb
```

glTF-Transform 4.5.1's own `sparse` command writes zeros for quantised morph targets, so the
script makes them sparse itself.

## 11. Known limits and next steps

- **Facial expressions** beyond speech and blinks (smiles, frowns) are not made yet. MakeHuman's
  CC0 *Faceunits 01* pack (ARKit-style) could add them in the same way.
- **The eye turns** are morphs, not bones, so the game cannot aim the eyes at an exact point.
- **Teeth** are 7,100 triangles, heavy for what is seen; a lighter set would help crowds.
- **Hair parts** for long styles are over 0.3 MB, because the body sliders move the long hair
  on the shoulders, and each such morph stores every hair vertex.
- **No levels of detail yet.** Companions and crowds will need lighter versions (MPFB's proxy
  meshes or decimation).
- **No captured side or backward walk.** UAL 1 Pro has none; the side and back walks are made
  from other clips (§5). UAL 2 Pro, not bought, may have more.
- **Armour and helmets** come later, from concept pictures (§3 of OPEN_SOURCE.md).

## 12. Materials and models from pictures

- **Materials:** `npm run art:materials` fetches the station's Poly Haven materials (CC0) at 1k,
  checks each file against Poly Haven's MD5, and records them in `art/materials.json`.
- **Models from pictures:** `npm run art:trellis -- <picture.png> <name>` turns a concept picture
  into a 3D candidate with trellis.cpp on the owner's Mac, with network access denied, and writes
  a record beside it in `art/out/`. The install and its licences are in
  [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md) §3. Candidates are dense (around 150,000
  triangles at resolution 512) and are simplified and normal-baked in Blender before they go to
  `public/assets/`.
