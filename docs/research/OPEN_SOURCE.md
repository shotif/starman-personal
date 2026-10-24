# Open source: what we can reuse instead of building

Research for decisions D-22 and D-27, 24 October 2026. The owner asked to "explore using
open-source models" and to reuse what others have built, where it looks good, so we do not build
everything from scratch. This page covers ready-made 3D models and animations, open-source
generators that make models on the owner's Mac, and open-source code.

**The licence rule (D-28):** the repository is public, so only files whose licence lets us share
them go into it: CC0, CC BY (with a credit), MIT, Apache-2.0 and similar. Files that may be used
in a game but not shared as files (Mixamo's animations, most store assets) stay out. Every asset
gets a record of where it came from and its licence, as Control's art records do.

## 1. People: the hero and everyone else

**MPFB 2** (the MakeHuman plugin for Blender) is the best fit for the character creator. It makes
semi-realistic human bodies inside Blender. Its bundled assets are **CC0**, and its code is GPL,
which does not touch what we make with it [1][2].

- Its body and face settings are **shape keys**, which export as glTF morph targets, so the game's
  sliders can drive them directly. The lineages (D-08) can be presets on the same body: a tall,
  light Spacer, a short, dense Heavyworlder.
- It rigs the body automatically, with a choice of skeletons, and ships clothes and skins (core
  ones CC0; third-party ones CC0 or CC BY, to be checked one by one) [2].
- It is a Blender extension, so it runs from our build-time scripts in the Blender already on the
  Mac (5.2.1 LTS; MPFB needs 4.2 or newer [1]).

Armour, helmets and the Remade's made bodies are modelled on top, by hand or by the generators in
§3.

## 2. Animation

| Source | Licence | What it gives |
| --- | --- | --- |
| **Quaternius Universal Animation Library** 1 and 2 [3][4] | CC0 | Hundreds of animations on one universal humanoid skeleton, made to be retargeted to other rigs. Library 2 (January 2026) has more than 130, including melee and armed combos and parkour movement. Library 1's free version has 45, with paid Pro and Source versions |
| **CMU Graphics Lab motion capture** | free for any use, including commercial, but not for resale as data | Thousands of real captured motions, raw, to clean and retarget |
| **Meshy's animation library** (with a paid plan) | ours on a paid plan (to be confirmed for the library itself) | More than 500 motions, fitted to a model when Meshy rigs it |
| **Mixamo** | may not be shared as files | Out, because the repository is public |

## 3. Generators that run on the owner's Mac

The Mac is an Apple M4 Pro with 24 GB of memory. Open-source image-to-3D models now run on Apple
Silicon, with no account and no credits.

| Generator | Licence | On this Mac | Notes |
| --- | --- | --- | --- |
| **TRELLIS.2** (Microsoft) | MIT; its image encoder is under Meta's DINOv3 licence | Through a community Metal port: about 3.5 minutes for a detailed mesh on an M4 Pro, with a peak of about 18 GB [5] | The strongest permissive open model. One port uses a background remover (RMBG-2.0) that is not for commercial use; we would use an MIT one |
| **Pixal3D** | MIT (code and weights); DINOv3 licence for the encoder | Yes, about 6 minutes on a 32 GB Mac [6] | Recommended as the place to start by AssetFurnace (below) |
| **Hunyuan3D** (Tencent) | Tencent community licence | Yes, through MLX ports | **Not licensed for use in the EU, the UK or South Korea** [6]. Usable only if the owner is outside those |
| **Stable Fast 3D** (Stability AI) | Stability AI community licence (free below $1M a year in revenue) | Yes | Fast, simpler models |

**AssetFurnace** [6] (Apache-2.0, October 2026, about 940 stars) puts several of these behind one
command line. It handles background removal with an MIT model, a clean-up and compression step,
and automatic rigging with 21 movement presets. It is young and recommends 32 GB on a Mac, against
our 24, and it does not state the licence of its rigging method or its presets. **Worth a trial
for props and armour, not to be relied on yet.**

**Which route, on this Mac (research of 24 October 2026, nothing installed yet):** the Mac has
the Command Line Tools but not the full Xcode, and no Homebrew. The safest route is
**trellis.cpp** (<https://github.com/pwilkin/trellis.cpp>, MIT, by a maintainer of llama.cpp): a
C++ build of TRELLIS.2 with Metal and no Python at run time, which also runs Pixal3D. It is
compiled locally (CMake and Ninja in a private Python environment, version v0.8.1) into an
isolated folder outside the repository, and reads about **15 GB of weights** in GGUF files, which
hold no code. Mac support is new: one report gives about 9 minutes and 5.6 GB at resolution 512 on
an M5 with 24 GB. The others were set aside: the PyTorch port (trellis-mac) needs about 18 GB at
its peak and clones five small repositories; AssetFurnace installs by `curl | bash`, needs the full
Xcode for one backend and recommends 32 GB; Stable Fast 3D is barely maintained.

Licence notes from that research:

- TRELLIS.2 and Pixal3D are MIT. **DINOv3**'s licence is royalty-free with no commercial ban, but
  ends if one sues Meta, asks that a copy goes with any weights shared, and forbids end uses
  barred by trade controls (its wording on weapons is export-control language; a game with guns
  is not that, but it is worth knowing). We commit the models it makes, never the weights.
- The upstream TRELLIS.2 texturing uses **nvdiffrast, licensed for non-commercial use only**;
  trellis.cpp bakes its textures with its own code instead.
- Background removal: RMBG-2.0 is non-commercial and BiRefNet is MIT. We avoid both by feeding
  the generator concept pictures that already have transparent backgrounds.

What it makes: 150,000–300,000 triangles, UV charts, base colour, metal and roughness, no normal
map yet, and no quad retopology on a Mac. So its models need decimating and normal baking in
Blender before they go into the game. Good for hard-surface props and armour; Meshy (rigging,
quads, target triangle counts) is the better tool for rigged companions.

**Against a paid service:** Meshy's paid plans produce cleaner topology and textures faster, with
an API, a private commercial licence and rigging (§5). The style test (D-22) runs the same concept
pictures through both and keeps whichever looks better on a phone.

## 4. Code

| Library | Licence | For |
| --- | --- | --- |
| **Babylon.js**, its **Havok** plugin and its navigation plugin | Apache-2.0; Havok's plugin MIT | The engine, physics, the character controller, companions' pathfinding ([TECH_STACK.md](TECH_STACK.md)) |
| **ink** and **inkjs** (Inkle) | MIT | Writing the dialogue and quests: a plain-text language for branching stories, made by the studio behind *80 Days* and *Heaven's Vault*, with a JavaScript runtime. Our writing stays text Claude can write, test and review, and choices and their consequences live in one place |
| **glTF-Transform** | MIT | Compressing and checking every model at build time (meshopt, KTX2 textures, sizes) |
| **Preact + Signals** | MIT | The screens, as in Control |
| Open-source Babylon character controllers (for example *BJS Character Controller V2* [7]) | to be checked | To learn from for movement and the animation state machine |

## 5. Places and materials

| Source | Licence | For |
| --- | --- | --- |
| **Poly Haven** | CC0 | Photographed materials (metal, concrete, rock, fabric), sky lighting (HDRIs) and models |
| **ambientCG** | CC0 | Physically based materials |
| **NASA 3D Resources** and NASA/USGS terrain | public domain, with NASA's rules on its insignia | Real spacecraft for museums and history; real elevation of the Moon and Mars for landing sites in Sol (D-19) |
| **Quaternius sci-fi kits** | CC0 | Stylised, so not for the final look; useful to block out levels before the real art exists |
| **Sketchfab** models marked CC0 or CC BY | per model | Case by case, with credits; many "free" models carry other licences |

## 6. What this means

- **The hero and the people** come from MPFB, CC0, made semi-realistic and shaped by sliders. No
  generator does this better or more cheaply.
- **Animation** starts from the CC0 libraries; capture or Meshy fills the gaps.
- **Armour, weapons, props and aliens** come from concept pictures (Gemini, as in Control) turned
  into 3D, by an open-source generator on the Mac or by Meshy, whichever wins the style test.
- **Places** are built from modular pieces in Blender with CC0 materials.
- **Dialogue and quests** are written in ink.

## 7. Sources

1. CG Channel on MPFB 2, March 2025:
   <https://www.cgchannel.com/2025/03/check-out-open-source-blender-character-generation-plugin-mpfb-2>
2. MPFB's FAQ: <https://static.makehumancommunity.org/mpfb/faq.html>
3. Quaternius, Universal Animation Library:
   <https://quaternius.com/packs/universalanimationlibrary.html>,
   <https://quaternius.itch.io/universal-animation-library>
4. OpenGameArt, Universal Animation Library 2:
   <https://opengameart.org/content/universal-animation-library-2>
5. TRELLIS.2 on Apple Silicon:
   <https://news.lavx.hu/article/trellis-2-now-runs-natively-on-apple-silicon-microsoft-s-state-of-the-art-image-to-3d-model-ported-to-mac>
6. AssetFurnace (licences, hardware, times): <https://github.com/Bingeljell/image-to-3dlab>
7. Babylon.js forum, BJS Character Controller V2:
   <https://forum.babylonjs.com/t/bjs-character-controller-v2/63560>
8. Meshy pricing: <https://meshy.ai/pricing>; Meshy's licences: <https://docs.meshy.ai/pricing>
