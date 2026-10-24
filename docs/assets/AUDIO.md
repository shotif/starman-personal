# Sound effects and music

The slice's sound, made on 24 October 2026 under D-45: CC0 libraries first, ElevenLabs sound
effects where they had nothing that fits, and music made with Google's Lyria on the Gemini key, as
Starman Control does. Every file is recorded with its source and licence in
[`art/audio.json`](../../art/audio.json) (D-28). The scripts are re-runnable, and the owner can
overrule any choice.

## 1. What was made

| | |
| --- | --- |
| Sound effects | **46** files in `public/assets/audio/sfx/`, **1.5 MB** in all: 37 from ElevenLabs, 8 from Kenney (CC0), 1 from OpenGameArt (CC0) |
| Music | **5** pieces in `public/assets/audio/music/`, **8.2 MB** in all: all made with Lyria 3.5 |
| Manifest | `public/assets/audio/audio.json`, which the game reads |
| Total | **9.7 MB** (the limit was about 25 MB) |
| Effects format | MP3, mono, 44.1 kHz, 96 kbps, with the LAME header that tells browsers to trim the encoder's delay |
| Music format | MP3, stereo, 44.1 kHz, 128 kbps |
| Level | Effects: their loudest 400 ms at −16 LUFS (loops: −18 LUFS over the whole), peaks at most −1.5 dBFS. Music: −18 LUFS over the whole, as Control's music |

### Sound effects

| id | What it is for | Source | Length | Volume |
| --- | --- | --- | --- | --- |
| `pistol` | The hero's sidearm, a station-security coil pistol (fiction): one shot | ElevenLabs (take 1 of 3) | 0.65 s | 0.9 |
| `pistol_ally` | Ren's sidearm, the same make heard from a few metres: a little lower and duller | ElevenLabs (take 2 of 2) | 0.81 s | 0.75 |
| `bolt_fire` | A mote fires its slow, bright bolt | ElevenLabs (take 2 of 2) | 0.68 s | 0.7 |
| `bolt_hit` | A bolt strikes metal (cover, walls, deck) | ElevenLabs (take 1 of 2) | 0.68 s | 0.6 |
| `bolt_whizz` | A bolt passes close to the hero | ElevenLabs (take 1 of 4) | 0.77 s | 0.6 |
| `beam_charge` | A lattice charges its beam (two seconds, while the line is drawn) | ElevenLabs (take 1 of 4) | 2.0 s | 0.75 |
| `beam_fire` | A lattice fires its beam | ElevenLabs (take 1 of 2) | 1.35 s | 0.95 |
| `tender_spawn` | The tender releases motes in threes | ElevenLabs (take 3 of 4) | 2.48 s | 0.8 |
| `mote_hum` | A mote's hum while it flies | ElevenLabs (take 2 of 2) | 3.2 s, loop | 0.35 |
| `machine_down` | A mote destroyed: a small electrical explosion | ElevenLabs (take 2 of 4) | 0.86 s | 0.85 |
| `lattice_break` | A lattice comes apart into motes | ElevenLabs (take 1 of 2) | 1.51 s | 0.9 |
| `tender_down` | The tender destroyed | ElevenLabs (take 1 of 2) | 2.69 s | 1.0 |
| `power_field` | A field power (*Lift*, *Pull*, *Slam*; the priming glow) | ElevenLabs (take 2 of 2) | 1.05 s | 0.8 |
| `power_arc` | *Overload*: an electric arc | ElevenLabs (take 2 of 2) | 1.0 s | 0.85 |
| `charge_blast` | A *Breach Charge* goes off | ElevenLabs (take 1 of 2) | 1.84 s | 1.0 |
| `barrier` | *Barrier*: a field shell switches on | ElevenLabs (take 4 of 4) | 1.39 s | 0.7 |
| `stim` | *Stim Burst*: the world slows | ElevenLabs (take 1 of 4) | 1.69 s | 0.8 |
| `veil` | *Veil*: the light-bending cloak | ElevenLabs (take 1 of 2) | 1.39 s | 0.7 |
| `drone` | A *Seeker* or *Repair Drone* flying | ElevenLabs (take 2 of 2) | 3.2 s, loop | 0.4 |
| `repair` | *Repair*: a drone or med-patch mends someone | ElevenLabs (take 1 of 2) | 1.47 s | 0.6 |
| `punch` | A strike lands on a plated machine | ElevenLabs (take 1 of 2) | 0.56 s | 0.85 |
| `dodge` | The dodge | ElevenLabs (take 4 of 4) | 0.44 s | 0.7 |
| `step_1` … `step_4` | Walking footsteps on a metal deck, one chosen at random each step | Kenney *Impact Sounds*: `footstep_concrete` with `impactPlate_light` 9 dB under it | 0.24–0.35 s | 0.5 |
| `door_open` | A station door slides open | ElevenLabs (take 1 of 2) | 1.0 s | 0.6 |
| `door_close` | A station door slides shut | ElevenLabs (take 1 of 2) | 0.93 s | 0.6 |
| `power_fail` | The power fails: a big thunk, then everything winds down | ElevenLabs (take 1 of 2) | 4.28 s | 0.95 |
| `alarm` | The emergency alarm after the lights go: soft, not shrill | ElevenLabs (take 1 of 2) | 4.2 s, loop | 0.35 |
| `ambience_station` | Inside Calder Station at night | ElevenLabs (take 1 of 2) | 20.2 s, loop | 0.4 |
| `ambience_hangar` | The hangar | ElevenLabs (take 2 of 2) | 18.7 s, loop | 0.45 |
| `wind` | Outside on the catwalk: thin, cold wind | ElevenLabs (take 1 of 2) | 15.2 s, loop | 0.45 |
| `radio` | A comms call opens: click, static, click | ElevenLabs (take 2 of 2) | 0.84 s | 0.5 |
| `ui_click` | Any button or menu press | Kenney *UI Audio*: `click1` | 0.09 s | 0.55 |
| `ui_choice` | A dialogue choice is chosen | Kenney *Interface Sounds*: `glass_001` | 0.27 s | 0.5 |
| `objective` | The objective is updated | ElevenLabs (take 1 of 2) | 1.23 s | 0.55 |
| `saved` | A checkpoint is saved (subtle) | Kenney *Interface Sounds*: `bong_001` | 0.12 s | 0.45 |
| `shield_hit` | A hit on the hero's shield | OpenGameArt *Space Ship Shield Sounds* by bart: `space shield sounds - 3` | 1.04 s | 0.65 |
| `health_hit` | A hit on the hero's health, under the shield | Kenney *Impact Sounds*: `impactSoft_heavy_000` with `impactPunch_heavy_000` | 0.51 s | 0.75 |
| `shield_down` | The shield is gone (a warning, with the red edge) | ElevenLabs (take 1 of 4) | 1.2 s | 0.8 |
| `heartbeat` | Low health | ElevenLabs (take 1 of 2) | 3.4 s, loop | 0.6 |
| `down` | The hero goes down | ElevenLabs (take 4 of 4) | 1.45 s | 0.8 |
| `revive` | A companion brings the hero back up | ElevenLabs (take 4 of 4) | 1.93 s | 0.7 |
| `liftoff` | The ship lifts off and escapes | ElevenLabs (take 1 of 2) | 6.86 s | 1.0 |
| `relay` | A relay console turned by hand | ElevenLabs (take 1 of 2) | 1.82 s | 0.7 |

*Volume* is a suggested starting mix (0–1), on top of the levelling. The footsteps and the click
are short, so their peaks, not their loudness, set their level; they are already about 10 dB under
the others, and their suggested volume allows for that.

### Music

All five share one palette, written once in `art/audio.json` (`lyria.style`): warm synthesiser
pads, low strings, sparse felt piano and glassy textures, instrumental only. No prompt names an
artist, a composer or a work.

| id | Plays | Take | Length | How it loops | Size |
| --- | --- | --- | --- | --- | --- |
| `title` | The title and the menus | 2 of 2 | 94.3 s | The whole piece: from the top once, then 3.0 → 94.24 s | 1.44 MB |
| `night` | The night shift before the attack | 2 of 4 | 127.5 s | The whole piece: 3.0 → 127.39 s | 1.95 MB |
| `tension` | After the lights go, walking to Control | 2 of 2 | 92.6 s | The whole piece: 3.0 → 92.50 s | 1.41 MB |
| `combat` | Fights with the swarm | 5 of 7 | 115.1 s | Inside the piece: from the top once, then 19.0 → 115.00 s (200 beats at 125 BPM, 50 bars) | 1.76 MB |
| `ending` | The bridge, the escape and the ending | 1 of 2 | 109.0 s | Plays once and fades | 1.66 MB |

## 2. How the game plays them

The manifest gives each file's length, whether it loops, and a suggested volume:

```json
{
  "sfx": {
    "pistol": { "file": "sfx/pistol.mp3", "seconds": 0.649, "loop": false, "volume": 0.9 },
    "mote_hum": { "file": "sfx/mote_hum.mp3", "seconds": 3.2, "loop": true, "loopStart": 0.1, "loopEnd": 3.1, "volume": 0.35 }
  },
  "music": {
    "combat": { "file": "music/combat.mp3", "seconds": 115.1, "loop": true, "loopStart": 19, "loopEnd": 115.0002 }
  }
}
```

- **Loops carry `loopStart` and `loopEnd`** (seconds). Play them with Web Audio: an
  `AudioBufferSourceNode` with `loop = true`, `loopStart` and `loopEnd` from the manifest. Do not
  loop the whole file (an `<audio loop>` element would play the margins and stutter).
- **Why the margins:** an MP3 decoder may add a few hundredths of a second of silence at the start
  and pads the end. Each sound-effect loop has 0.1 s of its own end before `loopStart` and 0.1 s
  of its own start after `loopEnd`, so even a decoder that does not trim (a shift of up to about
  25 ms) still loops one whole, seamless cycle. Chromium trims exactly: it decodes every file to
  the length in the manifest, and a one-shot starts on its first sample (checked with Playwright's
  Chromium on 24 October 2026; WebKit was not installed, so Safari is untested).
- **Music** plays from the top the first time (its opening is heard once), then loops between the
  two points. A piece is decoded whole into memory: about 40 MB for two minutes of stereo, so the
  game should keep at most the current and the next piece decoded.
- **Footsteps:** pick one of `step_1` … `step_4` at random for each step, never the same twice in a
  row, and vary the playback rate by a few per cent.

## 3. Where it came from, and licences

| Source | Licence | Used for |
| --- | --- | --- |
| [Kenney](https://kenney.nl) *Impact Sounds*, *Interface Sounds*, *UI Audio* | CC0 1.0 (the `License.txt` in each pack) | Footsteps, health hit, click, choice, checkpoint |
| [OpenGameArt](https://opengameart.org/content/space-ship-shield-sounds) *Space Ship Shield Sounds* by bart | CC0 1.0 (as the page lists it) | The shield hit |
| ElevenLabs sound effects, model `eleven_text_to_sound_v3`, on the owner's paid account | Made for this project; ElevenLabs' terms give the output to the account holder and allow commercial use. No third party holds rights in it. AI-generated | The other 37 effects |
| Google Lyria (`lyria-3.5`) through the Gemini API, on the owner's key | Made for this project; Google claims no ownership of generated output (Gemini API terms). Every piece carries Google's inaudible SynthID watermark. AI-generated | All five pieces |

- **Also listened to and not used:** Kenney's *Sci-Fi Sounds* (tried first for the bolt's hit,
  the shield hit, the doors and the three explosions, and *Impact Sounds*' punch; heard side by
  side with ElevenLabs takes, they were too synthetic for the semi-realistic look, D-22), *Digital Audio* (too
  retro) and *RPG Audio* (footsteps on grit and wood); OpenGameArt's *50 CC0 Sci-Fi SFX* by
  rubberduck (mostly retro beeps; its best ambient loop lost to the ElevenLabs hangar) and *Door
  Open, Door Close Set* by qubodup (hinged wooden doors, not sliding ones). All are CC0 and
  recorded in `art/audio.json` with their checksums. Each brief that moved from a library to
  ElevenLabs says so in its `tried` field.
- **Not used, as D-45 requires:** no royalty-free pack whose licence forbids passing the files on
  (such as the Sonniss GDC bundles).
- **Credits:** no CC BY file is used, so nothing must be credited. Suggested lines for
  [CREDITS.md](../../CREDITS.md), under *CC0 assets*: *Kenney* (Impact Sounds, Interface Sounds,
  UI Audio) and *bart* (Space Ship Shield Sounds, OpenGameArt); and under tools, that the other
  effects are made with ElevenLabs and the music with Google's Lyria.

**What `art/audio.json` holds:** the packs (`sources`: page, download URL, SHA-256, date), the
services (`elevenlabs`, `lyria`), every brief written by hand (`sfx`, `music`: what it is for, the
prompt or the library files, any `pick` and why), and, filled in by the scripts, every output
(`outputs`: the source with its prompt, model, date and take, the licence, the processing, the
loudness, the bytes and the SHA-256).

## 4. How it was made

1. **Briefs** in `art/audio.json`, each naming its moment in the game and either its library
   files (layered, with offsets and gains) or its ElevenLabs prompt (length, loop, how closely to
   follow the prompt).
2. **Takes:** two from ElevenLabs for each brief (three for the pistol, four for those that came
   out weak the first time), as 44.1 kHz 16-bit PCM, kept in `art/out/audio/<id>/` (ignored by
   git) with a record beside each. Loops were asked for with ElevenLabs' `loop` option.
3. **Choosing, by listening machine:** the scripts cannot hear, so Gemini 3.1 Pro listens to the
   takes and rates them against the brief. It is **asked twice, with the takes in opposite
   orders**, and the ratings are averaged: asked once, Gemini favoured whichever came first.
   Gemini 3.8 Flash was tried first and dropped: it described a steady hum as a fly-by. Even 3.1
   Pro hears short clips poorly (it sometimes reports "no audio" for a fraction of a second, so
   short clips are padded with silence for it) and its scores swing between runs. For the music,
   Claude chose from Gemini's timeline description of every take instead of its scores, because
   the scores missed brass and choir that the descriptions found: the first four combat takes all
   had heroic brass or a choir, so the brief was rewritten and three more were made.
4. **Processing** (`scripts/art/sound.ts`, all on plain samples): quiet trimmed from both ends,
   a short fade at the end, levelled (ITU-R BS.1770 loudness) with a gentle look-ahead limiter of
   at most 5 dB, encoded by ffmpeg's LAME.
5. **Loops:** where ElevenLabs' own join measures clean (the jump and the level step across it
   no bigger than between neighbouring samples) it is kept; where it is rough (only the hangar), the
   end is crossfaded into the start. Rhythms (the alarm, the heartbeat) always keep the
   generator's join. For music, the script looks for two points whose surroundings match
   (spectrum in 20 bands over three seconds; for music with a steady beat, only whole phrases of
   16 beats, then whole bars of 4, are tried, then the onsets are lined up and the waveform to the
   sample) and crossfades 1.5 s there. If no match is within 4 dB, the whole piece loops, its quiet
   end crossfaded over 3 s into its soft opening, as a piece that ends and begins again. Every
   loop point was checked in the decoded MP3: the audio after `loopEnd` matches the audio after
   `loopStart` (correlation 0.97 to 1.00).

## 5. How to re-run

From the repository root (Node 22.18 or newer). Keys come from the git-ignored `.env`
(`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_API_BASE`) and go only to their own service;
nothing prints them.

```bash
node scripts/art/audio.ts fetch              # the CC0 packs, checked by SHA-256, into art/cache/
node scripts/art/audio.ts generate [id ...]  # ElevenLabs takes not yet made (--again for new ones)
node scripts/art/audio.ts pick [id ...]      # Gemini listens and picks (art/out/audio/<id>/pick.json)
node scripts/art/audio.ts build [id ...]     # writes public/assets/audio/sfx/, the manifest and the records
node scripts/art/audio.ts listen [id ...]    # Gemini describes each finished file (art/out/audio/listen.json)
node scripts/art/audio.ts all                # fetch, generate, pick, build

node scripts/art/music.ts generate [id ...]  # Lyria takes not yet made
node scripts/art/music.ts pick [id ...]
node scripts/art/music.ts build [id ...]     # also writes art/out/music/<id>/seam.mp3: 8 s either side of each join
```

- **ffmpeg** is needed to decode and encode. The scripts use `FFMPEG` from the environment or
  `.env`, else `ffmpeg-static` if installed in this repository, else the one in Starman Control's
  `tools/` (`npm ci --prefix ../starman-control/tools`, which is what was used), else `ffmpeg` on
  the `PATH`. This Mac has no Homebrew.
- **To overrule a choice,** set `"pick": <take>` (and a `pickNote`) on the brief in
  `art/audio.json`, then `build` that id. The takes are in `art/out/audio/<id>/` and
  `art/out/music/<id>/` to listen to.
- **To change a sound,** edit its brief (a new prompt, or other library files), then `generate`
  (with `--again` to replace the takes), `pick` and `build` it.
- **Building again with nothing changed** gives the same files, but not byte for byte the same
  records (dates).

**Cost:** about 11,000 ElevenLabs credits (97 takes, 273 seconds, at 40 credits a second) from the
owner's enterprise quota; 17 Lyria takes, about $1.40 at Control's $0.08 a piece; Gemini's
listening, a few cents.

## 6. For the owner

- **Please listen.** Every choice was made by a machine that hears imperfectly. Gemini's weakest
  verdicts on the finished files were for `tender_spawn` (the three whirs are faint), `down`,
  `revive`, `stim` and `pistol` (heard as a plain modern gun rather than a coilgun). Each has other
  takes in `art/out/audio/<id>/`; a better prompt is a cheap fix.
- **The music** is chosen from Gemini's descriptions. `night` has a sweeping swell in its middle
  that a calmer take might avoid; two more were made and had a choir or woodwinds, so take 2 stays.
- **The generated sound's licence:** the records say what ElevenLabs' and Google's terms give us.
  If you want the generated files under a named licence in the repository (such as CC0, or all
  rights reserved), that is your decision.
