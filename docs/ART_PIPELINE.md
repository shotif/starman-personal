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
| Python 3.9 or newer | `python3` | Only for `fetch_sources.py` and `records.py`, which use the standard library alone |
| glTF-Transform | `node_modules/.bin/gltf-transform` (`npm install`) | Shrinks the `.glb` files. Without it the files are written uncompressed |

No pip packages and no other add-ons are needed.

## 3. Step by step

All commands run from the repository's root folder.

**1. Fetch the sources** (about 540 MB, once). Each file is checked against its SHA-256:

```sh
python3 scripts/art/fetch_sources.py
```

**2. Install MPFB into Blender** (once), from the copy just fetched, with Blender's own command:

```sh
blender -c extension install-file -r user_default -e art/cache/downloads/add-on-mpfb-v2.0.18.zip
```

The scripts turn it on for their own run only.

**3. Build the characters:**

```sh
blender -b --factory-startup --python scripts/art/mannequin.py   # about 10 seconds
blender -b --factory-startup --python scripts/art/hero.py        # about 20 seconds
```

`hero.py -- man` builds one body; `hero.py -- --no-anim` skips the animation.

**4. Look at them** (optional). This renders review sheets into `art/out/previews/`:

```sh
blender -b --factory-startup --python scripts/art/preview.py
```

**5. Update the record:**

```sh
python3 scripts/art/records.py
```

## 4. Where files go

| Path | In git | What it holds |
| --- | --- | --- |
| `scripts/art/*.py` | yes | The scripts. `common.py` holds what they share |
| `art/animations.json` | yes | The clips every character carries, their names and their sources |
| `art/hero.json` | yes | How the two hero bodies are built, and the morph targets |
| `art/lineages.json` | yes | The Earthborn, Spacer and Heavyworlder presets |
| `art/records.json` | yes | Every source and output, with licences and checksums |
| `art/cache/` | no | Downloads and unpacked packs |
| `art/out/` | no | Uncompressed copies, textures, lineage examples and previews, for review |
| `public/assets/characters/` | yes | What the game loads (below) |

The game loads:

| File | What it is |
| --- | --- |
| `mannequin.glb` | Quaternius's CC0 mannequin with the full clip set. A stand-in for any character |
| `hero-man.glb`, `hero-woman.glb` | The two hero bodies (D-09), with the clip set and the morph targets |
| `heroes.json` | For the game: clip names, morph names and groups, lineage presets, heights |

## 5. The skeleton and the clips

- **Skeleton.** The heroes use MPFB's *game_engine* skeleton: 53 bones with
  Unreal-style names (`Root`, `pelvis`, `spine_01`, `thigh_l` …). The mannequin uses UAL's own
  skeleton with the same names (lower-case `root`, `Head`), also 53 bones.
- **Clips.** 30 clips from Quaternius's Universal Animation Library 1 and 2 (CC0), renamed. The
  list and the source of each is in `art/animations.json`. All are in place: the game moves the
  character, the clips do not.
- **Retargeting.** `common.py` copies each source bone's change of world rotation onto the
  matching bone. It first turns the target's rest pose to match UAL's T-pose, so MPFB's A-pose
  arms come out right. The hips' movement is scaled by the ratio of hip heights.
- **Strafing.** The free libraries have no sideways walk. `strafe_left` and `strafe_right` are
  made from `walk`: the hips and legs turn 80° towards the side, and the spine turns back so the
  chest and arms face forward. They are stand-ins. The paid versions of UAL have real ones.
- **Channels.** Each clip keys the rotation of every bone, so a clip sets the whole pose.
  Only the hips and the root have position keys, and nothing has scale keys.

## 6. The hero: body, face and sliders

`hero.py` builds each body with MPFB from the settings in `art/hero.json`:

- the body from MPFB's base mesh and the phenotype (sex, age, muscle, weight, proportions);
- a skin, eyes, eyebrows, eyelashes and hair from MakeHuman's system assets (CC0);
- a close-fitting suit, MatCreator's *MC-SkinSuit 2022* (CC0), which hides the skin under it;
- plain glTF materials: colour, a normal map on the suit, alpha cut-out on eyes and hair, alpha
  blending on eyebrows and eyelashes.

**Morph targets.** 19 sliders are baked as glTF morph targets, on the body and on everything
fitted to it, so the suit and hair follow:

| Group | Morphs |
| --- | --- |
| Body | `body_heavy`, `body_slim`, `body_muscular`, `body_soft`, `body_lean`, `body_stocky`, `body_shoulders_broad`, `body_hips_wide`, `body_chest`, `body_neck_thick` |
| Face | `face_jaw_wide`, `face_chin_strong`, `face_cheekbones`, `face_nose_wide`, `face_nose_long`, `face_lips_full`, `face_eyes_large`, `face_brow_heavy`, `face_round` |

Each runs from 0 to 1. Opposites (heavy and slim) are separate morphs.

**Height.** A morph cannot move the skeleton, and a taller body on the same skeleton bends at
the wrong places. So height is a **uniform scale on the character's root node**, from 0.9 to 1.1.
`body_lean` and `body_stocky` give the proportions of a tall or short build without moving the
joints.

**Joints that move.** The script measures how far each morph would move the joints if the
skeleton were refitted. Most move them by under 1 cm. `body_shoulders_broad` moves the arms by
2.7 cm and `body_hips_wide` the legs by 1.5 cm. `heroes.json` lists these shifts per bone
(`boneOffsets`), so the game can move those bones with the slider if it needs to.

**Lineages.** `art/lineages.json` holds the presets for D-08 as morph weights and a height
scale: Earthborn (the baseline), Spacer (tall and light: 1.07, lean and slim) and Heavyworlder
(short and dense: 0.93, stocky and muscular). `hero.py` also writes an example of each into
`art/out/lineages/` for any glTF viewer.

## 7. Phone budgets

| File | Size | Triangles | Textures |
| --- | --- | --- | --- |
| `mannequin.glb` | 1.1 MB | 13,743 | none |
| `hero-man.glb` | 4.6 MB | 38,262 | 1024 px skin and suit, 512 px eyes, brows, lashes, hair |
| `hero-woman.glb` | 5.1 MB | 42,564 | the same |

The aim is under about 6 MB a character, with textures no larger than 1024 px. The triangles in
a hero are about 15,000 for the head and hands, 19,600 for the suit, 2,000 for the eyes, and
1,000 (man) or 5,400 (woman) for the hair.

**Compression.** With glTF-Transform installed, `common.py` resamples the clips, removes unused
data, stores vertices as 16- and 8-bit numbers (`KHR_mesh_quantization`, which Babylon.js reads
with no decoder), and stores the mostly-empty morph targets sparsely. It does not use meshopt or
Draco, which need a decoder in the game. Meshopt would bring a hero to about 3 MB; that is the
next step if downloads matter more than a decoder. Check a file with:

```sh
npx gltf-transform inspect public/assets/characters/hero-man.glb
npx gltf-transform validate public/assets/characters/hero-man.glb
```

glTF-Transform 4.5.1's own `sparse` command writes zeros for quantised morph targets, so the
script makes them sparse itself.

## 8. Known limits and next steps

- **No facial rig yet.** The *game_engine* skeleton has no jaw or eye bones, and the heroes
  have no teeth or tongue. Speech (D-23) will need MPFB's CC0 viseme or face-unit packs, or a
  skeleton with a jaw.
- **One look per body.** One skin, one hair style and one eye colour each. More skins and hair
  are a texture each (about 0.1–0.3 MB) and a choice for the owner.
- **No levels of detail yet.** Companions and crowds will need lighter versions (MPFB's proxy
  meshes or decimation).
- **Stand-in strafes** until real ones exist.
- **Armour and helmets** come later, from concept pictures (§3 of OPEN_SOURCE.md).

## 9. Materials and models from pictures

- **Materials:** `npm run art:materials` fetches the station's Poly Haven materials (CC0) at 1k,
  checks each file against Poly Haven's MD5, and records them in `art/materials.json`.
- **Models from pictures:** `npm run art:trellis -- <picture.png> <name>` turns a concept picture
  into a 3D candidate with trellis.cpp on the owner's Mac, with network access denied, and writes
  a record beside it in `art/out/`. The install and its licences are in
  [research/OPEN_SOURCE.md](research/OPEN_SOURCE.md) §3. Candidates are dense (around 150,000
  triangles at resolution 512) and are simplified and normal-baked in Blender before they go to
  `public/assets/`.
