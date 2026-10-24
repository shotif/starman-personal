# Credits

This game is built on work that people have shared openly. Thank you. Every file's source,
licence and checksum is recorded in [art/records.json](art/records.json) (characters and
animation) and [art/materials.json](art/materials.json) (materials). How the files are made is
in [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md).

## Assets that must be credited (CC BY)

- **"Reverse French braid bun"** by **Elvaerwyn**, from the MakeHuman
  [Hair 01](https://static.makehumancommunity.org/assets/assetpacks/hair01.html) pack
  ([source](http://www.makehumancommunity.org/node/1337)). The file itself says CC BY,
  without a version, so we credit it under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
  the pack lists it as CC0, and we follow the stricter of the two. Changed: recoloured from dyed purple to dark brown, fitted to the
  heroes and skinned to their skeleton. Used as the bun hair style.

When another CC BY asset is added, it is credited here with its title, its author, a link to
its source, its licence with a link, and what we changed, as the licence asks.

## CC0 assets (no credit required, given gladly)

**Characters and animation**

- **[Quaternius](https://quaternius.com)**: the
  [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)
  (Pro version, bought by the owner, CC0) and
  [Universal Animation Library 2](https://opengameart.org/content/universal-animation-library-2)
  (free Standard version, CC0), for the mannequin and every animation clip.
- **The [MakeHuman Community](http://www.makehumancommunity.org)** (Data Collection AB, Joel
  Palmius, Jonas Hauquier and contributors): MPFB's base mesh, body and face targets, skeleton
  and weights, and the
  [system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)
  used for the heroes' skins, eyes, eyebrows, eyelashes, teeth, tongue, hair and boots (CC0).
- **Mika Suominen**: the Meta-style visemes (mouth shapes) of the MakeHuman
  [Visemes 02](https://static.makehumancommunity.org/assets/assetpacks/visemes02.html) pack (CC0).
- **Skins** from the MakeHuman [Skins 01](https://static.makehumancommunity.org/assets/assetpacks/skins01.html)
  and [Skins 02](https://static.makehumancommunity.org/assets/assetpacks/skins02.html) packs
  (CC0): by **bobby_03**, **CutOff3D** and **MargaretToigo**.
- **TheGreatEngineer**: the *Galactic Warrior* uniform, the heroes' suit (recoloured), from the
  MakeHuman [Suits 02](https://static.makehumancommunity.org/assets/assetpacks/suits02.html)
  pack (CC0).

**Materials**

- **[Poly Haven](https://polyhaven.com)**: *Metal Plate*, *Metal Plate 02* and *Rusty Metal 02*
  by Rob Tuytel, and *Container Side* by Dimitrios Savva (CC0).
- **[Poly Haven](https://polyhaven.com)**: *Blue Metal Plate* and *Fabric Leather 02* by Rob
  Tuytel; *Metal Grate Rusty* by Rob Tuytel and Dimitrios Savva; *Concrete Floor Worn 001* by
  Dimitrios Savva and Rico Cilliers; *Rubber Tiles* and *Cracked Red Ground* by Amal Kumar;
  *Interior Tiles* by Charlotte Baglioni; *Corrugated Iron 02* by Jenelle van Heerden and Sergej
  Majboroda (CC0). How they are used: [docs/assets/IMAGES.md](docs/assets/IMAGES.md).

**Sound**

- **[Kenney](https://kenney.nl)**: *Impact Sounds*, *Interface Sounds* and *UI Audio* (CC0), for
  the footsteps, a hit, and the interface's clicks.
- **bart**: *[Space Ship Shield Sounds](https://opengameart.org/content/space-ship-shield-sounds)*
  on OpenGameArt (CC0), for the shield's hit.

**Lettering in the pictures**

- **Barlow** and **Barlow Condensed** by Jeremy Tribby, and **Share Tech Mono** by Carrois
  Apostrophe, under the [SIL Open Font License 1.1](https://openfontlicense.org). Only pictures
  set with them are shipped, not the fonts.

## Made for this game with generative tools

These are generated from the game's own writing and designs on the owner's paid plans, which allow
commercial use; the records say how each file was made.

- **Voices:** generated with ElevenLabs text to speech (model eleven_v4) from the game's own
  script, in ElevenLabs' premade voices, on a paid plan. Records in
  [art/voices.json](art/voices.json); how in [docs/assets/VOICES.md](docs/assets/VOICES.md).
- **3D models** (the swarm's machines, the surveyor, the station's furniture and props, the
  sidearm, helmet, locker and terminal): generated with Meshy (image-to-3D, multi-image-to-3D and
  remesh) from the game's own concept pictures, made with Google Gemini (gemini-nano-banana-2.1),
  on paid plans. Records in [art/models.json](art/models.json); how in
  [docs/assets/MODELS.md](docs/assets/MODELS.md).
- **Sound effects:** the other 37, generated with ElevenLabs' sound effects; **music:** all five
  pieces, generated with Google's Lyria through the Gemini API (each carries Google's inaudible
  SynthID watermark). Records in [art/audio.json](art/audio.json); how in
  [docs/assets/AUDIO.md](docs/assets/AUDIO.md).
- **Pictures:** the key art, loading pictures, sign plates, poster art, the ground of Ross 128 b
  and its horizon, generated with Google Gemini (gemini-nano-banana-2.1) from the game's own
  prompts; all words on them, and the console screens, drawn by our scripts. Records in
  [art/images.json](art/images.json); how in [docs/assets/IMAGES.md](docs/assets/IMAGES.md).

## Tools used to make the assets

These are not shipped with the game.

- [Blender](https://www.blender.org) (GPL) runs the art scripts.
- [MPFB](https://extensions.blender.org/add-ons/mpfb/) by Joel Palmius and the MakeHuman
  Community (GPL code; CC0 assets) makes the human bodies.
- [glTF-Transform](https://gltf-transform.dev) by Don McCurdy (MIT) shrinks the model files.
