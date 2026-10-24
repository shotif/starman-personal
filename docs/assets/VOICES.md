# The voices

Every spoken line of the playable slice, voiced on 24 October 2026 (D-23), the hero in a man's and
a woman's voice (D-09). The voices are made by ElevenLabs text to speech from
[story/slice.ink](../../story/slice.ink), with every file recorded (D-28) and timed for lip sync
(D-31). Every person, place and line is fiction.

## 1. What was made

| | |
| --- | --- |
| Lines voiced | **225** (every line with `#speaker:` and `#line:`), 70 of them the hero's; 162 in the first run, the rest added as the slice grew (the drill's rounds, things to look at, the night shift in the dark, the hold) |
| Files | **295** MP3s in `public/assets/voices/`: 155 for the cast, 70 × 2 for the hero |
| Length | About 17 minutes in all (one hero voice) |
| Size | **9.6 MB** of MP3 with the manifest. A player hears one hero voice, so less is ever fetched |
| Format | MP3, mono, 44.1 kHz, 64 kbps (`mp3_44100_64`), about 8 KB a second |
| Heard back | Every take heard back by speech to text; three are flagged only for homophones ("crews" heard as "cruise", "Pell" as "pal") and kept |
| Not voiced | none: no spoken line holds ink logic (`{...}`) |

Commands (`>>>`) and choice text in brackets are not spoken. The hero's spoken line under each
choice is.

## 2. The cast

All are **ElevenLabs premade voices**, which the account offers to every paid plan. **No voice was
added to the account.** Library voices must be added before the API will speak with them (a test
on 24 October 2026 returned `voice_not_found`), which takes a voice slot, and in Control (its
D-103) the owner asked for stock voices so that no slots are used. Voice slots used: 321 before and
after.

| Part | Who (fiction) | Voice | Voice id | Why |
| --- | --- | --- | --- | --- |
| Ren | Ren Okafor, lane officer, about 35 | **Lily** | `pFZP5JQG7iQjIQuC4Bku` | British, velvety, confident: steady, with warmth under it; the lowest of the British women (about 174 Hz), so she never sounds like the hero |
| Hero, woman | the player, about 30 | **Alice** | `Xb7hH8MSUJpSbSDYk0k2` | British, clear, capable, not gruff; brighter than Lily |
| Hero, man | the player, about 30 | **Daniel** | `onwK4e9ZLuTAKqWW03F9` | British, steady and firm, without George's rasp or Dave's regional colour |
| Hale | Station Chief Hale, about 60 | **George** | `JBFqnCBsd6RMkjVDRZzb` | British, mature, a little rasp, directed *gravelly, tired*: an old officer, and a different grain from Daniel |
| Jo | Jo Rook, ship engineer, about 30 | **Laura** | `FGY2WhTYpPnrIDTdsKH5` | young, sassy, quick: brash. American: no premade voice is northern English or Scottish (§9) |
| Pell | comms officer, about 30 | **Dave** | `CYw3kZ02Hs0563khs1Fj` | young British, conversational, quick: anxious and decent |
| Dena | the station's cook, about 50 | **Matilda** | `XrExE9yKIg1WjnnlVkGX` | middle-aged, warm alto: motherly, and able to sound frightened |
| Sorrel | old technician, about 70 | **Bill** | `pqHfZKP75CvOlQylNhV4` | old, wise, comforting, the lowest in the cast (about 128 Hz), directed *soft, slow* |
| Ilya | young surveyor, about 23 | **Liam** | `TX3LPaxmHKxFdv7VOQHJ` | young, energetic, bright: eager and nervous |
| Merrow | a hauler's pilot, on the radio | **Chris** | `iP95p4xoKVk53GoZ742B` | down-to-earth; a voice heard nowhere else |

Ten different voices; no two people who talk to each other share one. Each part was auditioned
with three or four premade candidates reading one of its lines. The candidates are in
`art/out/voices/audition/` (ignored by git), with their measures (seconds, pace, median pitch,
words heard) in `measures.json` there. **The owner may overrule any voice**: change it in `CAST`
or `HERO` in `scripts/art/voices.ts` and run the script; only that part's lines are made again.

## 3. The model and the settings

**Model: `eleven_v4`**, chosen by measure on 24 October 2026 from `eleven_multilingual_v2`,
`eleven_v3` and `eleven_v4`, with four of the slice's lines:

- `eleven_v3` refuses request stitching ("Providing previous_text or next_text is not yet
  supported").
- `eleven_multilingual_v2` lost the cut-off in *"It's at the— Officer"* (heard as "It's at the
  officer") and ran *"Lightkeeper A. Varro"* into "Lightkeeper Avaro". It takes no delivery tags.
- `eleven_v4` stitches, reads the cut-off and the initial, follows delivery tags without speaking
  them, and returns word timings. Starman Control chose it the same day.

**Settings:** stability 0.5, similarity boost 0.75, style 0, speaker boost on, speed 1. Each take
has a seed, kept in its record.

**Delivery tags.** Each line is sent with a short tag the model reads but does not speak, such as
`[dry, quiet]`. Each conversation has one tag (`SCENE` in the script), so its lines sound alike.
A line has its own (`LINE`) only where the feeling changes: the barks in a fight are
`[shouting, urgent]`, Dena's grief `[grieving, shaken]`. The hero's lines follow the manner of the
choice (D-12): ask `[curious]`, plain `[plain, matter-of-fact]`, resolve `[firm]`, mercy
`[gentle]`. Speech to text confirmed that no tag was ever spoken.

**Request stitching** (`previous_text`, `next_text`), so that delivery flows:

- *Before:* the line heard just before, whoever says it, sets the tone.
- *After:* given only when the same person surely speaks next (as with Hale's run of lines in
  Control), so a line before someone else's answer still ends as a line should.
- **Never across alternatives.** The parser follows ink's choices, gathers and conditions, so a
  line is never stitched to one that cannot be heard with it (Ren's six origin lines each follow
  the end of the choice before them, not each other).
- **Never across play.** Any `>>>` command breaks a run, so a bark after a fight is not stitched
  to the bark before it.
- **Never "after" for a short line** (under 30 characters). *"Look at the star."* came out as
  "stars" in every take while the next line (*"Those aren't stars round it."*) was given, and as
  "star" without it.

## 4. How each take was checked

I cannot listen, so each take is measured and heard back:

1. **Heard back** by ElevenLabs speech to text (`scribe_v2`), and compared word by word with the
   line. A take needs 90% of its words in order, or it is made again, up to four takes, and the
   best is kept. The comparison writes numbers in words ("31", "6%", "3:00"), uses one spelling
   (*percent* and *per cent*, *-our* and *-or*), joins compounds ("farmhands"), and knows how the
   transcriber spells the invented names it cannot know ("Mero" and "Marrow" for *Merrow*,
   "Wren" for *Ren*, "more" for *Maw*, which sounds the same in British English).
2. **Pace:** characters a second between the first and last word. Median **14.1**; most lines
   between 10 and 19. The slowest are directed so (Dena's *"Yes. Yes, all right. Up."* at 7.7,
   Sorrel at about 10) and the fastest are anxious (Pell's *"Can't send the night shift…"* at
   21.8). A take outside 7 to 24 is made again; none was.
3. **Silence:** no take has more than 0.5 s of silence before its first word or 1 s after its
   last. **Clipping:** the loudest sample in any file is 0.95 of full scale; none clips.
4. **Leaks:** no take was heard with more words than its line.

**Retakes:** the full run made 15 extra takes: 11 for the transcriber's spellings of names and
numbers, before the rules above were added; 1 where it heard "the Wake Zone rock"; and 3 for
`ren_spine_01`. Three lines were then made again by hand: `ren_spine_01` ("stars", §3),
`hero_jo_bridge_03a.woman` (heard as "Empire Remnant"; the new take is heard as "Pyre Remnant")
and `ren_drill_02` (heard as "want to report"; the new take says "want a report").

## 5. The manifest the game reads

`public/assets/voices/voices.json`, read by `src/game/audio.ts`:

```json
{
  "about": "…",
  "envelopeRate": 20,
  "lines": { "ren_night_01": { "speaker": "Ren", "file": "ren_night_01.mp3", "seconds": 3.63, "envelope": [0, 0.12, …], "gain": 1.82 } },
  "hero": { "hero_ren_night_02a": { "man": { "file": "hero_ren_night_02a.man.mp3", … }, "woman": { … } } }
}
```

- **`file`** is relative to `assets/voices/`. Hero files are `<id>.man.mp3` and `<id>.woman.mp3`.
- **`seconds`** is the file's length, decoded.
- **`envelope`** is the line's loudness every 50 ms from the start of the file, 0 to 1: each
  50 ms's RMS divided by the line's loud level (its 98th percentile), clipped to 1, with anything
  under 0.05 set to 0. It is scaled per line, so a quiet line still moves the mouth fully.
- **`radio: true`** marks the seven lines heard over comms, for the game's radio band:
  `hale_call_01`, `hale_gate_01`, `pell_relay_01`, `pell_relay_02`, `pell_relay_03`,
  `pell_escort_01` and `merrow_01`.
- **`gain`** (new, not yet used by the game) is a playback gain that brings each line's speech to
  the same level, −20 dBFS RMS, without letting its peak pass 0.98, between 0.5 and 3. The tags
  make quiet lines quiet (*"Lightkeeper A. Varro."* is about −30 dBFS, a panicked Pell about
  −17), and the files are not levelled, since re-encoding MP3 would lose quality and no encoder
  is installed. Multiplying the voice's gain node by `gain` evens them out.

## 6. The record

`art/voices.json` (D-28) holds one record for each file: the line, the speaker, the text, the
delivery tag, a **hash** of the text, tag, voice, model, settings and format, the voice's **id and
name**, the service, the **model**, the **settings**, the format, the seed, the stitching sent,
what speech to text heard and how much matched, the checks, the number of takes, the length,
silences, peak, loudness, size, SHA-256, the **date made**, `aiGenerated: true` (for a store's
declaration, as in Control), the envelope, and the **word timings** (each word's start and end,
from ElevenLabs' alignment, with the tag left out), kept for the visemes of D-31.

## 7. Running it again

```sh
node scripts/art/voices.ts --list                   # the parsed lines, tags and stitching; no key, no cost
node scripts/art/voices.ts                          # makes only what changed
node scripts/art/voices.ts ren_night_01 jo_meet_02  # only these lines (if changed)
node scripts/art/voices.ts --again hero_jo_name_03a.woman.mp3   # a new take of one file
```

- **A line is made again when** its text, its delivery tag, its voice, the model, the settings or
  the format change (its hash). Stitching is not in the hash, so editing one line does not
  re-voice its neighbours. `--again` makes a new take from a new seed.
- Every run judges the stored transcripts again with the current comparison, measures any record
  missing a measure, and rewrites the manifest, all without calling the service.
- A line removed from the script leaves its file and record; the run names them, to be removed
  by hand.
- **Keys:** `ELEVENLABS_API_KEY`, and `ELEVENLABS_API_BASE` for the account's residency host,
  from the environment or the git-ignored `.env`, read by `scripts/art/env.ts`. The key is sent
  only to that host and is never printed. The game never sees it.
- **Tools:** Node 22.18+, and macOS's `afconvert` to decode the takes for measuring. Elsewhere,
  set `FFMPEG` in `.env` to an ffmpeg.
- Four requests at a time; each is tried again after 3, 10 and 30 seconds if the service is busy.
  A full run is about 14,000 characters and a few minutes.

## 8. Licence and terms

- The files are **generated speech**, made on the owner's **paid ElevenLabs plan** (Enterprise,
  active, checked through the API on 24 October 2026). ElevenLabs' Terms of Service allow
  commercial use on a paid plan (§1(c)) and say the user keeps "all rights in and to your Output"
  (§4(c)(ii)). Output may not be unique: another user may get similar audio (§10). An enterprise
  agreement may add its own terms.
- The voices are ElevenLabs' own premade voices, not clones or imitations of anyone, and no voice
  was designed or added.
- The lines are the game's own writing.
- **Credit:** a line for [CREDITS.md](../../CREDITS.md), to be added with the integration:
  "Voices: generated with ElevenLabs text to speech (model eleven_v4) from the game's own script,
  in ElevenLabs premade voices, on a paid plan. Records in art/voices.json."

## 9. Cost

About 20,000 characters from the plan's 109.65 million a month: the model trial and the
audition about 4,500, the full run 14,003, and the retakes about 1,200. Speech to text heard each
take once, about 15 minutes of audio. No voice slots.

## 10. Known limits and next steps

- **Accents.** The premade voices offer no northern English, Scottish or British-Nigerian voice.
  Jo is American-voiced and Ren neutral British. The voice library has such voices, but each must
  be added to the account, which takes a voice slot. **That is the owner's call.** If allowed, a
  library voice can replace any part through `CAST` (§2).
- **Legacy voices.** Dave (Pell) is one of ElevenLabs' older premade voices, which may be retired
  one day. The files already made stay; a re-run would then need a new pick.
- **Not yet in the game:** the `gain` field (§5) and the word timings (§6).
- `hero_pell_gate_07a.man` starts speaking within 0.08 s of the file's start. It is heard in full,
  only a quick start.
