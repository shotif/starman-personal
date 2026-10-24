# 2D pictures and surface materials

What the game's flat pictures are, how they were made, what they may be used for, and how to make
them again. Made on 24 October 2026. The pictures are in `public/assets/textures/` with a manifest,
`textures.json`; the materials are in `public/assets/materials/<id>/`. Every file is recorded with
its source, licence and checksum (D-28): the pictures in [art/images.json](../../art/images.json)
(`records`), the materials in [art/materials.json](../../art/materials.json).

**Fiction.** Calder Station, its signs, its readouts, the Cooperative's and the Authority's posters
and the swarm are all invented. Ross 128 and its planet b are real; everything shown *on* the planet
(its air, its dust, its mountains) is fiction. Two liberties are taken on purpose: the key art and
the loading pictures show the star through a "long lens", so its disc looks bigger than the
2.1 degrees it would cover in the sky of b, and they paint it a deeper red than the orange a
3,200 K red dwarf would look to the eye. Both are mood, not data.

## 1. The pictures

All are WebP at quality 82, 1.3 MB together (the budget was 12 MB).

| Id | Kind | Size | How it was made | KB |
| --- | --- | --- | --- | --- |
| `keyart-wide` | keyart | 1920 × 1080 | Gemini painting; the left third is calm for the title | 73 |
| `keyart-tall` | keyart | 1080 × 1920 | Gemini painting for phones; the top third is calm for the title | 52 |
| `screen-light-curve` | screen | 1024 × 512 | Drawn: Ross 128's light dropping in four steps to −6.1 % | 28 |
| `screen-station-map` | screen | 1024 × 512 | Drawn: the six parts, the route, the outside catwalk, "you are here" | 32 |
| `screen-sensor-sweep` | screen | 1024 × 512 | Drawn: a sweep round the star with some 640 contacts in a ring | 41 |
| `screen-comms-static` | screen | 1024 × 512 | Drawn: a noisy spectrum and waterfall, carriers lost, "NO CARRIER" | 77 |
| `screen-power-doors` | screen | 1024 × 512 | Drawn: power buses after the failure and the state of seven doors | 32 |
| `screen-navigation` | screen | 1024 × 512 | Drawn: the surveyor's climb from b to the lane entry, round the swarm | 30 |
| `sign-calder-station` | sign | 512 × 512 | Gemini plate, emblem and lettering drawn over it | 23 |
| `sign-concourse-hangar` | sign | 1024 × 256 | Gemini plate, "CONCOURSE / HANGAR →" drawn over it | 13 |
| `sign-clinic` | sign | 1024 × 256 | Gemini plate, first-aid cross, "CLINIC", "FIRST AID" | 9 |
| `sign-airlock` | sign | 1024 × 256 | Gemini plate, hazard stripes, "AIRLOCK", "CHECK YOUR SUIT SEAL BEFORE YOU CYCLE" | 34 |
| `poster-cooperative` | poster | 512 × 768 | Gemini print-style art in a drawn layout: "THE STARS NEED COUNTING" | 69 |
| `poster-authority` | poster | 512 × 768 | Gemini print-style art in a drawn layout: "MIND THE LANES" | 71 |
| `ground-regolith` | ground | 1024 × 1024 | Gemini, made to tile by the script; rust-brown dust and stones | 419 |
| `ridge-horizon` | ridge | 2048 × 256 | Gemini on a green backdrop, cut out with alpha, wraps round | 43 |
| `loading-lounge` | loading | 1280 × 720 | Gemini painting: the crew lounge on the night shift | 61 |
| `loading-concourse` | loading | 1280 × 720 | Gemini painting: the concourse in red emergency light | 81 |
| `loading-mast` | loading | 1280 × 720 | Gemini painting: the catwalk and the mast under the ringed star | 61 |
| `loading-hangar` | loading | 1280 × 720 | Gemini painting: the hangar, the surveyor and the evacuees boarding | 84 |

`textures.json` maps each id to `{ "file", "width", "height", "kind" }`, with `file` relative to the
manifest's folder.

### Using them

- **Ground:** tiles in both directions; it is an albedo only (no normal map), and its lighting has
  been evened out. For lit close-up ground, use the `cracked_red_ground` material below, or mix
  both.
- **Ridge:** wraps round horizontally (the two ends join), alpha above the ridge line, opaque below.
  Colours under the transparent part are kept (no dark fringe when filtered).
- **Screens** are emissive pictures: show them unlit. They share one interface (cyan `#7fd4ff`, the
  game's own accent; amber for warnings; red for alarms).
- **Signs** are paint on worn metal; the lettering wears with the plate.

### Words are drawn, never generated

The image model is never trusted with letters. Signs, posters and screens get their words from
[scripts/art/drawings.ts](../../scripts/art/drawings.ts), set as outlines straight from open fonts by
[scripts/art/glyphs.ts](../../scripts/art/glyphs.ts) (a small TrueType reader with kerning; sharp's
own text on macOS ignores font files). Every prompt to Gemini asks for no text, and every picture was
looked at for stray letters or logos. One was thrown out for a small copyright-like symbol on a
machine (`poster-authority`, first try).

The fonts, all under the [SIL Open Font License 1.1](https://openfontlicense.org), are fetched from
the Google Fonts API into the git-ignored `art/cache/fonts/`; only pictures made with them are
shared, which the licence allows:

- **Barlow Condensed** and **Barlow** by Jeremy Tribby: signs, posters, screen headings.
- **Share Tech Mono** by Carrois Apostrophe: screen readouts.

The words, all checked: *CALDER STATION, ROSS 128 b, CONCOURSE, HANGAR, CLINIC, FIRST AID, AIRLOCK,
CHECK YOUR SUIT SEAL BEFORE YOU CYCLE*; *FRONTIER COOPERATIVE · SURVEY SERVICE, THE STARS NEED
COUNTING, SURVEY CREWS WANTED, Ranks voted in. Shares paid out. Skies no one has charted. Ask at
any Cooperative office.*; *SOL TRANSIT AUTHORITY · SAFETY NOTICE 14, MIND THE LANES, Walk between
the yellow lines. Loaders cannot stop quickly.* The Authority poster's small print, *The lanes are
safer than they were. Not safe. Safer.*, is Starman Reborn's line (canon).

The emblem is our own: a beacon mast before a low red sun, inside a ring that is half Authority
green and half Cooperative blue, because the station is a joint posting. The clinic's mark is the
generic first-aid sign (a white cross on green), not the protected red cross.

The screens tie into the slice ([SLICE.md](../design/SLICE.md)): the star 6 % dimmer, the six
parts, the swarm on the sensors, the dead relay and the *Merrow* with no link, the power failure,
and the surveyor's departure. Their numbers are set dressing, not canon.

## 2. How the generated pictures were made

Model `gemini-nano-banana-2.1` (Google Gemini, Interactions API, as in
[scripts/art/concepts.ts](../../scripts/art/concepts.ts)), at "2K", JPEG. Nineteen pictures were
generated (fourteen first tries, five redone), about $0.10 each, so about $1.90 of D-24's allowance.

Each prompt is the picture's own subject, then shared parts, then a style, all in
[art/images.json](../../art/images.json); the full prompt actually sent is recorded with every
picture. The shared parts:

- **station:** Calder Station, a small, remote research-and-beacon outpost of weathered industrial
  modules on Ross 128 b, a rocky planet with thin, dusty air and a rust-brown, stony ground.
- **star:** the red dwarf low on the horizon, a dim, deep red-orange disc that glows softly from
  within, faint enough to look at; a dusky sky, blue-grey above, rust-orange at the horizon.
- **swarm:** a thin ring of countless tiny points of light round the star, a swarm of machines seen
  only as points of light.

The styles: **painting** (painterly-realistic matte painting, 2180s, worn and lived-in, muted greys
and steel blues with orange hazard accents, no text or logos), **plate** (a flat, evenly lit, blank
surface), **poster** (a mid-century screen print, limited palette, no text), **surface** (a texture
shot straight down, flat light) and **cutout** (a subject on a flat green backdrop).

What was redone, and why:

| Picture | First try | Fix |
| --- | --- | --- |
| `poster-authority` | A small "©"-like symbol on a machine | "Plain, unmarked machines and walls" |
| `loading-hangar` | The sensor boom looked like a gun | "a slim sensor mast… it carries no guns" |
| `loading-mast` | The star's disc darker than the sky, like a planet | "glows softly from within" (now in the shared part) |
| `loading-concourse` | Too grey; the emergency light was not red enough | "bathed in deep red emergency light" |
| `ridge-horizon` | A haze band that read as a reflection | "dry land only: no water, no reflections" |

How each kind is finished by [scripts/art/images.ts](../../scripts/art/images.ts):

- **cover** (key art, loading): cropped and scaled to size.
- **tile** (ground): a patch a quarter larger than the tile, its lighting evened out, then wrapped
  in x and y along the cheapest seams (image quilting's minimum-error cut), so nothing inside the
  tile repeats. (Gemini's own "tileable" output was a 2 × 2 repeat; the cut uses that.)
- **ridge:** the ridge line found in each column against the green, the two ends cross-faded along
  the ridge line so the strip wraps, a soft alpha edge, green spill removed.
- **sign:** the plate's rim trimmed, the drawing laid over it; paint takes the plate's shading, and
  bright scratches show through the paint.
- **poster:** the art set between drawn colour bands, then paper grain, two folds and tired edges.

## 3. The materials (Poly Haven, CC0)

Eight new materials, fetched like the first four by
[scripts/art/materials.ts](../../scripts/art/materials.ts): Poly Haven's 1k JPEGs, unchanged (the
same quality as the first four), each checked against Poly Haven's MD5. Each folder has
`albedo.jpg`, `normal.jpg` (OpenGL) and `arm.jpg` (AO, roughness, metal in R, G, B). The new eight
come to 13.1 MB (the budget was 15 MB); all twelve to 20.1 MB.

| Id | Use | Authors | MB |
| --- | --- | --- | --- |
| [`blue_metal_plate`](https://polyhaven.com/a/blue_metal_plate) | clean painted wall panels | Rob Tuytel | 1.05 |
| [`rubber_tiles`](https://polyhaven.com/a/rubber_tiles) | dark rubber deck floors | Amal Kumar | 1.47 |
| [`concrete_floor_worn_001`](https://polyhaven.com/a/concrete_floor_worn_001) | concrete floors and walls | Dimitrios Savva, Rico Cilliers | 0.38 |
| [`metal_grate_rusty`](https://polyhaven.com/a/metal_grate_rusty) | grated floors and catwalks | Rob Tuytel, Dimitrios Savva | 2.77 |
| [`fabric_leather_02`](https://polyhaven.com/a/fabric_leather_02) | upholstery: the lounge seats | Rob Tuytel | 1.19 |
| [`interior_tiles`](https://polyhaven.com/a/interior_tiles) | the clinic floor | Charlotte Baglioni | 1.67 |
| [`corrugated_iron_02`](https://polyhaven.com/a/corrugated_iron_02) | corrugated metal cladding | Jenelle van Heerden, Sergej Majboroda | 1.96 |
| [`cracked_red_ground`](https://polyhaven.com/a/cracked_red_ground) | the rocky ground outside | Amal Kumar | 2.56 |

Chosen from Poly Haven's texture list (`https://api.polyhaven.com/assets?t=textures`) by looking
at the candidates side by side. Notes:

- Poly Haven has **no see-through grating**. `metal_grate_rusty` is a solid plate with a raised
  grate pattern (rust orange); tint it towards grey for a cleaner deck. A true open grating needs an
  alpha mask of our own.
- `interior_tiles` is laid on the diagonal; rotate the UVs 45 degrees for a square grid.
- A wool fabric (`poly_wool_herringbone`, 3.2 MB) was passed over for the leather to stay inside
  the budget.

## 4. Licences

- **Generated pictures:** made for this project with Google Gemini on the owner's key. Google's
  Gemini API terms claim no ownership of what is generated. They are shared with the project.
- **Drawn pictures and lettering:** made by our scripts; shared with the project.
- **Fonts:** SIL Open Font License 1.1 (only the pictures are shared, not the font files).
- **Materials:** CC0 1.0 (Poly Haven), credited gladly in [CREDITS.md](../../CREDITS.md).

## 5. Making them again

```bash
npm run art:images -- generate [id ...]        # a new Gemini candidate (needs GEMINI_API_KEY in .env)
npm run art:images -- build [id ...]           # candidates and drawings → public/assets/textures/
npm run art:images -- sheet                    # a contact sheet to look at: art/out/images/sheet.jpg
npm run art:materials                          # the materials (keeps files that already match)
```

`generate` with no ids makes a first candidate only for pictures that have none. Candidates are
kept, numbered, in the git-ignored `art/out/images/<id>/`; `build` uses the newest unless the
picture's entry in `art/images.json` names another with `"pick"`. The screens need no key: they
are drawn every time and come out the same. Because candidates are not in the repository, a fresh
clone rebuilds the screens exactly, but must generate new candidates (which will differ) before it
can rebuild a generated picture; the shipped WebP files and their records stay the reference.
Look at every new picture before keeping it: misspelt or stray letters, logos, and anything that
looks like another game's design are reasons to generate again.
