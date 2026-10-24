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
| `hero-man.glb`, `hero-woman.glb` | The two hero bodies (D-09), with the clip set and the morph targets |
| `heroes.json` | For the game: clip names, morph names and groups, lineage presets, heights |

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
- a skin, eyes, eyebrows, eyelashes and hair from MakeHuman's system assets (CC0);
- the suit: TheGreatEngineer's *Galactic Warrior* uniform (CC0), a soldier's suit with panels,
  pads and a belt, darkened to slate grey and matte (roughness 0.75); and MakeHuman's black
  boots (CC0);
- the skin under the clothes is removed: where the clothes' own lists say so, and wherever a
  ray from the skin meets the clothes, so no skin shows through at bent knees;
- plain glTF materials: colour, alpha cut-out on eyes and hair, alpha blending on eyebrows and
  eyelashes.

**Morph targets.** 19 sliders are baked as glTF morph targets, on the body and on everything
fitted to it, so the suit, boots and hair follow:

| Group | Morphs |
| --- | --- |
| Body | `body_heavy`, `body_slim`, `body_muscular`, `body_soft`, `body_lean`, `body_stocky`, `body_shoulders_broad`, `body_hips_wide`, `body_chest`, `body_neck_thick` |
| Face | `face_jaw_wide`, `face_chin_strong`, `face_cheekbones`, `face_nose_wide`, `face_nose_long`, `face_lips_full`, `face_eyes_large`, `face_brow_heavy`, `face_round` |

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

## 8. Phone budgets

| File | Size | Triangles | Textures |
| --- | --- | --- | --- |
| `mannequin.glb` | 2.0 MB | 13,743 | none |
| `hero-man.glb` | 4.6 MB | 32,489 | 1024 px skin and suit; 512 px eyes, brows, lashes, hair and boots |
| `hero-woman.glb` | 4.9 MB | 36,699 | the same |

The aim is under about 6 MB a character, with textures no larger than 1024 px. Each hero has
about 14,500 triangles of head and hands, 10,200 of suit, 4,100 of boots and 2,000 of eyes,
and 1,000 (man) or 5,400 (woman) of hair. Most of the file is the morph targets and the 55
clips.

**Compression.** With glTF-Transform installed, `common.finish_glb` resamples the clips,
removes unused data, stores vertices as 16-bit numbers and normals as 8-bit ones
(`KHR_mesh_quantization`, which Babylon.js reads with no decoder), stores the mostly-empty
morph targets sparsely, and stores the clips' rotations as 16-bit numbers (allowed by core
glTF 2.0). It does not use meshopt or Draco, which need a decoder in the game. Check a file
with:

```sh
npx gltf-transform inspect public/assets/characters/hero-man.glb
npx gltf-transform validate public/assets/characters/hero-man.glb
```

glTF-Transform 4.5.1's own `sparse` command writes zeros for quantised morph targets, so the
script makes them sparse itself.

## 9. Known limits and next steps

- **No facial rig yet.** The *game_engine* skeleton has no jaw or eye bones, and the heroes
  have no teeth or tongue. Speech (D-23) will need MPFB's CC0 viseme or face-unit packs, or a
  skeleton with a jaw.
- **One look per body.** One skin, one hair style and one eye colour each. More skins and hair
  are a texture each (about 0.1–0.3 MB) and a choice for the owner.
- **No levels of detail yet.** Companions and crowds will need lighter versions (MPFB's proxy
  meshes or decimation).
- **No captured side or backward walk.** UAL 1 Pro has none; the side and back walks are made
  from other clips (§5). UAL 2 Pro, not bought, may have more.
- **Armour and helmets** come later, from concept pictures (§3 of OPEN_SOURCE.md).

## 10. Materials and models from pictures

- **Materials:** `npm run art:materials` fetches the station's Poly Haven materials (CC0) at 1k,
  checks each file against Poly Haven's MD5, and records them in `art/materials.json`.
- **Models from pictures:** `npm run art:trellis -- <picture.png> <name>` turns a concept picture
  into a 3D candidate with trellis.cpp on the owner's Mac, with network access denied, and writes
  a record beside it in `art/out/`. The install and its licences are in
  [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md) §3. Candidates are dense (around 150,000
  triangles at resolution 512) and are simplified and normal-baked in Blender before they go to
  `public/assets/`.
