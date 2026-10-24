# The technology stack: which 3D engine

Research for decision D-21, 24 October 2026. The owner decided on the browser first and asked which
engine Claude thinks works best. This page compares the engines and gives a recommendation. The
open-source models, assets and tools that sit around the engine are in
[OPEN_SOURCE.md](OPEN_SOURCE.md).

## 1. What the engine has to do

1. **Semi-realistic 3D** (D-22): physically based materials, image-based lighting, soft shadows,
   and skinned characters with morph targets (the face and body sliders of the character creator).
2. **On phones and desktops, in the browser** (D-02), served as static files from GitHub Pages
   (D-03), which cannot send the special headers that multi-threaded WebAssembly needs.
3. **Third-person action** (D-17): a character controller, physics, cover detection, hit
   detection, animation blending in layers (aiming while running), and root motion for melee.
4. **Companions who pursue objectives** (D-16): navigation meshes, pathfinding, crowd avoidance,
   line of sight.
5. **Many places** (D-19): areas loaded and unloaded as you move, levels of detail, compressed
   textures (KTX2) and meshes (meshopt or Draco), instancing.
6. **Every line voiced** (D-23): spatial audio, streamed voice files, mouths that move with speech.
7. **Built mostly by Claude**: everything as text and code, testable without a screen,
   screenshots in CI, no work that only an editor's mouse can do.
8. **Reuse from the series**: Control's Preact screens, saves, the sky data and the star map.

## 2. The options

| Engine | Licence | For | Against |
| --- | --- | --- | --- |
| **Babylon.js** (9.27, September 2026 [1]) | Apache-2.0 | A full game engine in TypeScript. Physically based rendering and image-based lighting; animation groups with blending and weights; morph targets; **Havok physics** (official plugin, free); a **character controller** with collisions, platforms and lifts [2]; **navigation meshes and crowds** built on recast-navigation-js [3]; asset containers for loading and unloading areas; levels of detail; KTX2; glTF with its extensions; spatial audio; an inspector for debugging; WebGPU with WebGL2 as the fallback. Microsoft-backed, with a long record of not breaking old code | Larger than three.js (a few hundred KB more, small beside the art). Reborn's and Control's three.js shaders (the stars, the system view) would be ported by hand |
| **three.js** | MIT | The series' engine: our star map, shaders and know-how carry over. A mature renderer with an animation mixer, a WebGPU renderer and the largest set of examples on the web | A renderer, not a game engine. Physics (Rapier), navigation (recast-navigation-js), the character controller, area streaming, audio and debugging tools are separate libraries to choose, join and keep working together |
| **PlayCanvas** | MIT (engine) | Lean and fast, with a strong record on phones | Most of its workflow and examples assume its hosted editor, a commercial product; code-only use is the less travelled road |
| **Godot 4.6** | MIT | A fine editor; native exports for Steam, iPhone and Android; text scene files; open-source third-person demos to learn from | On the web it runs only its *Compatibility* renderer over WebGL2, with no WebGPU; on GitHub Pages it must run single-threaded, which its own manual calls less performant; the manual warns that phones are "at a premium" for web exports [4]. A semi-realistic look in a phone browser is where it is weakest |
| **Unity 6** | proprietary | The largest asset store | Heavy web builds, weak in phone browsers, licence terms, and an editor-centred workflow Claude cannot drive |
| **Unreal 5** | proprietary | The best realistic rendering | No web export at all |

## 3. Recommendation: Babylon.js

**Babylon.js, with the rest of the series' stack around it.** It is the only option that is both
a real game engine and at home in a phone browser. The pieces this game needs most are built in
and maintained together: physics, the character controller, companions' pathfinding, animation
blending, morph targets and area streaming. Building those on three.js would be months of joining
libraries before any story is played. Everything is written in code and TypeScript, which suits how
the game is built, and it is open source (Apache-2.0), in line with the owner's wish to reuse what
others have built.

| Part | Choice |
| --- | --- |
| 3D engine | **Babylon.js**, WebGPU where the device has it, WebGL2 otherwise |
| Physics and character controller | Havok, through Babylon's plugin |
| Companions' movement | Babylon's navigation plugin (recast-navigation-js) |
| Screens (menus, dialogue, the character creator's panels, inventory) | Preact + Signals in HTML over the 3D canvas, as in Control |
| Dialogue and quests | **ink** (see [OPEN_SOURCE.md](OPEN_SOURCE.md) §4) |
| Language, build, tests | TypeScript, Vite, Vitest, Playwright, Biome, as in Control |
| Asset pipeline | Blender 5.2 (installed) and glTF-Transform, from build-time scripts |
| Hosting | GitHub Pages |
| Later: Steam and app stores | Wrap the same build (Tauri or Electron; Capacitor), if wanted |

**Nothing to install system-wide:** Babylon.js and the tools above are npm packages that live in
the repository. Node.js 24 is already on the Mac.

**What would make us change our minds:** if the first proof (a hero running, aiming and taking
cover, a companion following, a lit station corridor) cannot hold 30 frames a second on a
mid-range phone at a low quality setting, we look again, starting with lower phone settings and
then PlayCanvas. If the owner later wants native apps first, Godot becomes the better choice.

## 4. Sources

1. Babylon.js on Wikipedia (stable release 9.27.1, 18 September 2026):
   <https://en.wikipedia.org/wiki/Babylon.js>; release notes on GameDev.net:
   <https://gamedev.net/news/5796-babylonjs-9270-released/>
2. Babylon.js documentation, the character controller:
   <https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController>
3. Babylon.js forum, "Navigation plugin V2 is here":
   <https://forum.babylonjs.com/t/navigation-plugin-v2-is-here/60751>
4. Godot 4.6 manual, "Exporting for the Web":
   <https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html>
