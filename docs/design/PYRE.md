# Pyre Remnant: the first lead, in full — a design

*Written 25 October 2026 for increment 5 of Act 1 ([ACT1.md](ACT1.md) §6, decided by D-48 and
D-51). It turns the outline into a mission: the station and its people, the beats, the script's
shape, the place, the fights, experience and money, and what it adds to the canon. The decisions it
needs are round 9 in [DECISIONS.md](../DECISIONS.md), D-57 to D-65, all decided as recommended on
25 October 2026. Every name is a working name the owner may change.*

## Goals

1. **A station full of people with reasons** (D-04, D-41). The conversation side of the game:
   about half the time talking, looking and choosing, half fighting.
2. **Talking decides the way in.** Whom the hero trusts decides how they reach the archive, and so
   which fight they have first.
3. **The Banked meet the hero**, first as a calm voice in the commons, then as clerks at a door,
   then as soldiers in the stacks with the engines' motes at their call.
4. **A cost that stays.** The archive or the dome: neither is the wrong answer, both are remembered.
5. **Mira joins**, a Warden and a doctor, and the hero chooses who goes with them for the first time
   (D-14: two at a time).
6. **The first money and the first trader**, and the hero reaches level 4 by the end.
7. **Every line voiced** (D-23), the hero in two voices (D-09), on a phone and a desktop (D-02).

About an hour and a half to two hours, with the side story.

## Out of scope

The other two leads; the Banked ship as a place; Varro in person; Mira's personal quest beyond its
first step; romance (D-15); interrupts (D-12, later); *Lantern*'s parts doing anything before the
ship's encounters exist (D-18); the refugees' later story (Act 2 or 3); the Banked's own armour,
helmets and fuller battle talk (increment 6); weapon makes and tiers.

## 1. The place

### Where it is

Pyre was a red supergiant 33 light-years from the Sun, toward Phoenix, reached by one lane from
GJ 915. It died in Starman Reborn's time, about a century and a half ago: its core collapsed, its
outer layers were thrown off, and a black hole was left. Pyre Remnant Station opened well clear of the hole once
the lane did, and the Cooperative has run it as an observatory ever since. About two hundred people
live there.

**The sky, as it would be.** The station sits inside what is left of the star. Thrown off at a few
thousand kilometres a second, Pyre's outer layers are now a shell about two light-years out, still
glowing faintly where they run into the gas the star shed before it died: a thin red haze over half
the sky, its threads only visible in the dome's mirror. The black hole cannot be seen at all. It is
a few tens of kilometres across; the mirror finds it only by the way the light behind it bends.
**Fomalhaut** is the second-brightest star in the station's sky (about magnitude −0.4 from here, 12
light-years away; only Canopus is brighter), and its companion **Fomalhaut B** (TW Piscis Austrini,
a K4 dwarf) sits about four degrees from it at about magnitude 5, faint to the eye. It used to be
brighter.

### The station

A Cooperative research station: practical, crowded, lived in, kept clean by people who vote on the
rota. Pale walls, blue doors (the Cooperative's colour), plants wherever there is light, notices
everywhere. Since the audit began it has gone quiet: people talk lower, the open band is off, and
gold armbands are seen at the archive's door.

| Part | What it is | What happens there |
| --- | --- | --- |
| **The dock** | Berth four, where *Lantern* docks, behind a window onto her hull; the customs gate; containers; Matti's booth; the head of the freight way | Arrival; Matti; the auditors' heavy crates; the cargo way in; the Banked ship at the end |
| **The commons** | The station's heart: a great window to the west onto the remnant, benches, planters, the noticeboard, the canteen, Tilly's stall, Quaye's lectern by the window | Quaye's address; people overheard; most conversations; the trader |
| **The committee room** | A round table under a screen; Ruth's office beside it | Ruth; the hearing for the unlisted |
| **The clinic** | Mira's: three beds, a dispensary, a door to the overflow | Mira, confined; Nell; the squad chosen; the side story's choice |
| **The overflow** | An emptied cargo hold behind the clinic: cots, hung sheets for walls, a sapling in a pot | The unlisted from Fomalhaut B Orchard |
| **The spine** | A long corridor north from the commons, branching west to the archive and east to the dome walk | The way between |
| **The archive** | The front hall (counters, reading desks); the reading room and Linde's office; the stacks (rows of waist-high racks holding the data cores: low cover, long lanes); the cargo landing at the back where the freight way comes in; the core at the far end | The way in; the stacks; the core |
| **The dome walk** | A glassed bridge, 60 m, out to the dome, the remnant on both sides | The run to the dome |
| **The observatory dome** | A round hall 26 m across under a shuttered dome, the great mirror's mount in the middle, consoles round the wall, the band's transmitter | Joost and the dome's crew; the dome's fight |
| **The freight way** | A dim service tunnel along the station's west side, from the dock to the archive's cargo landing | The cargo way in |

### The plan

North is up; the station is about 140 m by 110 m, a little larger than Calder Station.

```
            ARCHIVE                                   OBSERVATORY DOME
  ┌───────────────────────────────┐            ┌──────────────────────┐
  │ core │   stacks    │ reading  │            │    the great mirror  │
  │      │  (racks)    │ room,    │            │  consoles · band     │
  │cargo │             │ Linde    │            └──────────┬───────────┘
  │landing    front hall          │                       │ dome walk (glass, 60 m)
  └──┬──────────────┬─────────────┘─────── spine ─────────┘
     │ freight way  │
     │       committee ── COMMONS ── clinic ── overflow
     │         room   (window W)
     │                    │ customs
     └────────────── DOCK (berth 4: Lantern) 
```

Built from the kit (`src/game/kit.ts`) as Calder and *Lantern* are: rooms with doors and windows,
lights by area, static pieces merged by material. Its areas and marks go in `src/game/places.ts`
(`PYRE_AREAS`, `PYRE_MARKS`), its builder in `src/game/pyre.ts`, and it loads on its own (`>>>
travel pyre`), one place in memory at a time.

## 2. The people

| Who | What they are | What they want | Why | What they can give |
| --- | --- | --- | --- | --- |
| **Dr Mira Achterberg** (about 42) | The station's doctor; the fifth generation of Achterbergs to watch Pyre, the great-great-granddaughter of Dr Selene Achterberg, who directed Pyre Observatory when the star died | To keep her family's records out of the audit; to keep her patients alive | Selene wrote down Pyre's last years by hand. Mira will not give her handwriting to people with gold on their sleeves | A companion (Warden, D-39); Linde's trust; the reading of what is saved |
| **Teodor Linde** (about 68) | The archivist. Sorrel's navigator on the Antares run thirty years ago, the one who never took the Authority's money | To keep the copy he has hidden for thirty years; to stop being afraid | Twenty years ago he watched an audit. Nobody shouted; nothing was broken; things simply were not there afterwards. He did nothing | The stacks' back way; his copy; the name |
| **Ruth Amadi** (about 50) | The committee member for supply | To keep the station fed and the lane open | The audit was "requested" by the Authority's Lane Office, with a hint that traffic might be reviewed. Two hundred people eat what comes down that lane. The Cooperative votes; it does not fight | The front door, officially; the hearing; Mira's suspension lifted |
| **Tobias Quaye** (about 45) | The Banked's speaker on the station; once a Cooperative astronomer | To persuade people that the light should be banked | He believes it. He has watched stars die for twenty years and thinks the Banked are keeping something safe. He has been told the audit is honest | His argument; doubt, later; the Banked's offer to the unlisted |
| **Matti Lund** (about 30) | A dock hand, from Fomalhaut B Orchard, hired here last year | His sister and her people somewhere with a sun that works | The Banked pay him to look away from some crates, and promised his sister's people passage | The freight way; the crates' secret |
| **Nell Lund** (about 34) | Matti's sister, a grower from Fomalhaut B Orchard; speaks for the unlisted | Her people listed, fed, and somewhere to go | Thirty-four of them came here on a Banked ship "for a few days", five weeks ago. They are on no list | The side story; her people's light logs |
| **Tilly Brennan** (about 55) | A free trader, Laneborn, stuck here by the audit with a hold of goods | To sell, and to get her ship out | Business. She sells to everyone, the Banked included, and noticed their "paper" was too heavy | Mods, for money; a hint about the crates |
| **Joost Achterberg** (about 35) | Mira's brother; keeps the night watch in the dome | To tell everyone what he has seen | He has watched Fomalhaut B step down every night for eight months, and the committee switched off his band mid-sentence | The broadcast, if he lives |
| **Esben Rask** (about 40) | The deputy archivist; the Banked's man inside | To finish the audit and hand the rest to the Banked ship | He has read the curves for twelve years and believes people should not spend their last years afraid | A conversation in the stacks; his fate, at the core |
| **Lenz** | Station security, at the clinic door | To do his job without being ashamed of it | Ordered to keep Mira in; does not like it | Lets Mira go, or does not stop her |
| **The Banked** | Auditors with gold armbands, then troopers, an engineer and a warden | — | — | The first fights with people |

The crew: **Ren** and **Jo** come ashore at first; when Mira joins, one goes back to keep *Lantern*
ready and listen on the bands, and the other comes with the hero (D-59). **Dena, Sorrel, Pell and
Ilya** (if he lived) stay aboard; Sorrel may come down to the dock at the end, if he named Linde in
the prologue's aboard chapter.

## 3. The story, beat by beat

| # | Chapter | Beat | What the player does |
| --- | --- | --- | --- |
| 1 | `lane` (its end) | **Arrival.** The last lane, Pyre's own; the remnant's haze ahead. Pell hails the station; a long silence; Matti answers and gives berth four | Watches, listens |
| 2 | `pyre_dock` | **The dock.** Matti at customs, nervous. If Ren sent the file to the Lane Office (the prologue's aboard chapter), he says *Lantern* was expected, and Ren knows what that means. The auditors' crates by the freight way, too heavy for paper | Talks to Matti; looks |
| 3 | `pyre_commons` | **The commons.** Quaye mid-address by the great window, calm and reasonable; a heckler; people overheard; the noticeboard ("The archive is closed for audit, by order of the committee"); Tilly's stall; the remnant through the glass; Fomalhaut and its dimming companion | A hub: talk to whom you like, in any order; look |
| 4 | `pyre_commons` | **People with reasons.** Ruth (why the archive is shut; the Lane Office's request; Mira suspended); Linde at the archive's side door, frightened; Matti again, if pressed; Quaye, if the hero answers him; the overflow and Nell | Learns what each knows and what each would do. Each conversation can open a way in (§4) |
| 5 | `pyre_clinic` | **Mira.** Confined to her clinic, still treating the unlisted. Who she is; Selene's notebook; why she refused. She is coming into the archive whatever anyone says. Lenz at the door | Talks; gets her out; **chooses who comes: Ren or Jo** |
| 6 | `pyre_clinic` | **The unlisted** (side story). Nell comes in: the Banked ship is early, the committee wants her people at the dock within the hour, and the Banked offer them passage to "work, food and a sun that works". Mira says what "work" means for people the Banked carry: nobody has written home | **The choice**: take them aboard *Lantern*, argue their case before the committee now, or let the Banked carry them |
| 6b | `pyre_hearing` | **The hearing** (if argued). Ruth chairs; the evidence the hero has gathered decides how well it goes (§4). The unlisted are listed. It takes time the archive needed | Argues, with what they have |
| 7 | `pyre_way` | **The way in.** By whichever door the hero has won: the front, with Ruth's order; the stacks, with Linde; the freight way, with Matti | Goes; **the first fight with the Banked** |
| 8 | `pyre_stacks` | **The stacks.** The auditors are soldiers. An engineer sends out the engines' motes: the Banked command the machines that ate Ross 128's light. Esben, cornered behind a warden, talks, then starts the final wipe and calls the dome | Fights through the racks; listens to Esben |
| 9 | `pyre_cost` | **The cost.** The core is burning its records one by one; only pulling them by hand will stop it. Joost, on the band: the Banked are cutting into the dome to stop his broadcast of Fomalhaut B's curve. One or the other | **The choice**: hold the archive, or run for the dome |
| 10a | `pyre_archive` | **The archive held.** A fight at the core while Linde and Mira pull cores. Joost's voice stops mid-sentence, as the band did. Esben is caught | Fights; decides Esben's fate |
| 10b | `pyre_dome` | **The dome held.** The run down the dome walk; the fight under the mirror; Joost alive. His broadcast goes out on every band. Behind them, Linde reports the archive going, core by core. Esben gets away | Fights |
| 11 | `pyre_after` | **The name.** Mira reads what was saved (§4). The oldest audit, twenty years ago: Lightkeeper A. Varro, her own voice in the record (D-64). Linde was there: "Ansa Varro. She was kind to me" | Listens; asks |
| 12 | `pyre_dock_end` | **The Banked leave.** Ruth lets their ship dock: the station has no guns to say otherwise. Their people go aboard; the unlisted with them, if that was the choice. Quaye, shaken by what the audit was, says goodbye. A voice from the ship: the Lightkeeper knows *Lantern* now | Watches; a last word with Quaye |
| 13 | `pyre_dock_end` | **Mira joins.** Ruth's last word (the Cooperative's trust, or its embarrassment). Mira joins *Lantern*. If Sorrel named Linde, Sorrel walks down to the dock, and the two old navigators of the Antares run meet | Talks |
| 14 | `aboard_pyre` | **Aboard.** *Lantern* at berth four. Mira in the med bay, which is now hers; the crew's view of what happened; Dena with thirty-four more mouths, if they came aboard; Ilya and Mira comparing steps. The map: the other leads later in Act 1 | Talks; the honest "to be continued" |

## 4. The choices, and what they change

### Ways in (beat 7)

Each way needs its person won. At least one is always open: once Mira has joined, she vouches for
the hero to Linde.

| Way | Whose | How they are won | The fight it starts |
| --- | --- | --- | --- |
| **The front door** | Ruth's order | Proof the audit is not what it says: the crates' contents (Matti opens one, once won; Tilly's remark sends the hero to him), or Linde's copy, or Ren's word as a lane officer that the request is irregular; a Ringborn hero's *Paperwork* reads the request's wording for what it is | The front hall: the auditors are warned and ready; the hardest |
| **The stacks** | Linde's key | Sorrel's name (if the hero heard it aboard), Ilya's curve (if it reached the ship), or Mira's word | The stacks from the reading room: the Banked are surprised, the hero starts in cover |
| **The freight way** | Matti's silence broken | A promise for his sister's people (mercy), the threat of the committee (resolve), or 200 credits, more than the Banked pay | The cargo landing, among the opened crates: rifles under the "paper" |

If Ren sent the file to the Lane Office, whichever way the hero takes, the Banked have one trooper
more: they were told *Lantern* was coming.

### The unlisted (beat 6)

| Choice | Now | Later (Act 2 or 3) |
| --- | --- | --- |
| **Take them aboard *Lantern*** | Thirty-four more in the hold; Dena's stores fall from six weeks to three, so the next part must find them a home first; the committee will not forget that the hero took Cooperative citizens off its station without leave | They remember who carried them; some become *Lantern*'s people |
| **Argue their case** | The hearing: they are listed as Cooperative citizens and go on to Tau Ceti on the Cooperative's next ship. The time it takes lets the wipe reach the archive's newest records. With strong evidence, Ruth also opens the front door | The Cooperative, shamed into it, starts to listen |
| **Let the Banked carry them** | They board the Banked ship at the end, grateful. Nell thanks the hero | They live, as crews on Varro's engines, and the hero meets them there |

The same 50 experience whichever is chosen, and the side story's 200 when it is settled. **The
hearing's evidence:** Nell's light logs (always: the Orchard's grow lamps log the sun every hour for
the trees, and it does not fade, it steps), Mira's patients' charts (always), Ilya's curve (if it
reached the ship), the crates' rifles (if found), and a Steader hero's standing as one of the
Cooperative's own. Three or more, and Ruth opens the front door as well.

### The cost (beat 9)

| Choice | Lost | Saved |
| --- | --- | --- |
| **The archive** | Joost and the dome's crew (D-60); the broadcast never goes out | The century of curves and every older record of a dying star; the Cooperative's trust; and, if the hearing did not take the time, a star not yet on anyone's list (D-61) |
| **The dome** | The archive, wiped; the Cooperative's committee embarrassed in front of every band | Joost and the crew; Fomalhaut B's curve told to the whole neighbourhood at once; Joost keeps the watch, and finds the next star later, when it has stepped further |

There is no timer and no way to save both: the choice is the cost (D-41). Mira loses something
either way, and says so; her approval does not change with it.

### What Mira reads (beat 11)

| What | Where it comes from | Always? |
| --- | --- | --- |
| **Pyre's last years fell in steps** | Selene's notebooks, which Mira kept | Yes |
| **Selene's last entry**: an hour before the end, the light *rose*, in steps, "as if something in the way were leaving in a hurry" | The same | Yes |
| **Antares fell in steps** before it went dark | The archive's old records; or Linde's copy of the Antares run's readings | Yes, if the archive is saved or Linde was won; otherwise Linde tells it |
| **Ross 128's steps keep the same time as Pyre's**, every three days | Ilya's curve against Selene's | If the curve reached the ship |
| **A star not yet on anyone's list** has begun to step | The archive's newest records | Only if the archive is saved and the hearing did not take the time |
| **The oldest audit**, twenty years ago: "Nothing of note. Lightkeeper A. Varro." 1,412 records taken for review, none returned | The archive's own log; or Linde's copy; or Linde's memory | Yes (the name ends every lead, ACT1.md) |

### Smaller choices

- **Who comes** (beat 5): Ren or Jo. Both see the Lane Office's request in Ruth's office, and Ren
  knows the signature: the deputy who told her to drop her report a year ago. Inside, with Ren, the
  audit's list of records withdrawn holds that report itself, which she sent here for a second
  opinion and never heard back about (her personal quest's next step). With Jo, the engineer's
  motes wear the control rings Jo saw on the parts her crew sold (hers). The one at the ship hears
  of it over the comms, and both talk about the other's find aboard.
- **Esben** (archive path): let him go to the Banked ship (*mercy*), or hand him to the committee
  (*resolve*). On the dome path he gets away with the Banked.
- **Quaye**: argue with him in the commons, or hear him out. Either way, at the end he has seen the
  rifles; if the hero argued honestly, he says he will ask Varro himself. He returns in Act 2.

### The story's variables

`pyre_way` (front, stacks, cargo), `unlisted` (aboard, listed, banked), `pyre_saved` (archive, dome),
`next_star_found`, `joost_lost`, `linde_won`, `matti_won`, `ruth_won`, `esben` (freed, held, fled),
`second` (ren, jo), `quaye_argued`, `mira_approval`, `evidence` (a count). The prologue's own are read:
`ren_sent_file`, `have_curve`, `ilya_lost`, `sorrel_named_linde`, `merrow_warned`.

## 5. The script, in outline

Written in ink as the prologue was (`story/pyre.ink`, included in the one story so a save carries
everything), each line with its speaker and id, each choice with its manner. Samples set the tone;
the full lines are written when it is built.

**`lane`, its end.** Jo counts the last jumps; GJ 915 falls behind; Pyre's lane. Pell: *"Pyre
Remnant, this is Lantern, asking for a berth."* Nothing. Then Matti: *"Lantern. Berth four. Stay
with your ship until customs clears you."* (If the file was sent: *"Lantern. Yes. You're…
expected."* Ren, quietly: *"Expected."*) `>>> travel pyre`.

**`matti_dock`.** Customs that is not quite customs. Matti checks nothing and looks at everything
but the crates. Choices: ask about the crates (*ask*), ask why the band went quiet (*ask*), or let it
be (*plain*). The hero's look at the crates: *"'Archive supplies: paper and binding.' Forty kilos a
crate. That's a lot of binding."*

**Quaye's address** (in the world, as the hero comes into the commons): *"We have watched stars die
from this station for a hundred years, and we called it science. Every one of those curves is a
light going out. The Banked ask one thing: what if some of it could be kept?"* A researcher
heckles; Quaye answers him kindly, which is worse.

**`quaye_talk`.** *"You came from Ross 128. I'm sorry; I mean that. Nobody should see what you saw. I
am trying to make it so fewer people do."* The hero can argue (*resolve*: the machines at Ross 128
were not keeping anything safe), ask what "banked" means (*ask*), or listen (*plain*). Quaye is never
a fool and never wins the argument outright.

**`ruth_office`.** *"Two hundred people live on that lane. If the Authority shuts it, we eat what we
grow, and we don't grow much under a black hole."* She shows the request (*look*: the Lane Office's
letterhead; a Ringborn hero reads the wording, *"'requested' in the Lane Office's voice means
'required'"*). Mira's suspension. What it would take to open the archive: proof. A Steader hero:
*"You're one of ours. Then you know we don't fight."*

**`linde_door`.** He is at the archive's side door, pretending to read. If Sorrel named him: *"Sorrel.
He took the money, you know. We all knew he would. He was the only one of us with children."*
Otherwise cagey until someone vouches. His fear: *"I watched an audit once. Nobody shouted. Nobody
was hurt. Things just weren't there any more, afterwards."* His copy: *"Everything that falls in
steps, for thirty years, in a biscuit tin. I've never once had the courage to show it to anyone."*

**`tilly_stall`.** *"Mods, parts and coffee. Two of the three are legal."* The trade screen. Her view
of the Banked: they pay on time. Their crates: *"Paper doesn't weigh that much. I've sold paper."*

**`nell_overflow`.** The cots, the sapling they carried from the Orchard, a child's drawing of their
sky: a dim orange sun and a bright white star, the star drawn bigger every month. It is not getting
brighter; their sun is getting dimmer (from the Orchard, Fomalhaut shines brighter than Venus does
from Earth). *"My family grew apples under that sun for eighty years. Last spring the trees stopped
knowing what season it was."*

**`mira_clinic`.** *"I'm suspended, not dead. Sit down; you're bleeding on my floor."* (If the hero is
not hurt: *"Sit down anyway."*) Selene's notebook, in Selene's hand. Why she refused. A doctor's eye
on the hero's past, one line for each moment (D-35). She is going into the archive. *"You'll need a
doctor before you need a reader. You'll get both."* Then Jo (or Ren): *"Captain, one of us should
keep the ship hot."* The player chooses who comes.

**`nell_choice`.** Nell, out of breath: the Banked ship is early. Mira: *"Nobody they've carried has
written home. Not one."* The three choices, each with its manner; *Lantern*'s other companion
answers over the comms when it touches the ship.

**`ruth_hearing`.** Ruth chairs, recording for the committee. The hero's case, one argument at a
time, each piece of evidence a line; Ruth's questions are fair and hard. The unlisted are listed.

**The way in, the stacks.** Barks as they fight (*"Contact, the reading room!"*, *"Shield on you,
hold still"*, *"They're going round the racks!"*), a dozen lines between two Banked voices and the
warden. Esben, behind his warden's barrier: *"I read those curves for twelve years. I know what's
coming better than anyone on this station. You can't stop it. You can only decide whether people
spend their last years afraid."*

**`joost_band`.** On every speaker in the archive: *"This is Pyre Remnant on the open band. Our
archive is closed. Our telescope is not."* Then, to the hero directly: the dome's inner door, the
cutting torches. The choice.

**Archive path.** Joost, later, in the fight: *"Mira, if you're listening, the curve's in the—"* and
nothing, as the band stopped the first time. Esben at the core, his hands up.

**Dome path.** The dome walk at a run, motes against the glass. Under the mirror: the fight; Joost
alive; his broadcast goes out. Linde on the comms, counting cores as they go.

**`pyre_after`.** Mira reads (§4). Varro's recorded note, twenty years old: *"Audit of the Pyre
Remnant archive, closed. Nothing of note. Lightkeeper A. Varro."* (D-64.) Linde: *"Ansa Varro. She
was kind to me. That's the part I can't forgive."*

**The dock, the end.** Quaye, if the hero argued with him: *"I'll ask her. I'll ask her myself."* The
ship's voice: *"Lantern's captain. The Lightkeeper knows your ship now."* Mira's choice made aloud.
Sorrel and Linde, if Sorrel named him: *"I took the money, Teo." "We knew you would. You were the
only one of us with children." "They're grown. I've come to say it out loud, what we saw."*

**`aboard_pyre`.** Mira in the med bay; Ren's and Jo's view; Dena (*"Thirty-four more. I'll need a
bigger pot, and you'll need to find them a planet sooner than you thought."*); Pell, if the dome's
broadcast went out (*"Captain, it's on every band"*); Ilya and Mira, *"Every three days. At Pyre,
every three days, a hundred and fifty years ago."*

**Every origin and moment is heard once** (D-11): Ruth to a Steader, Ruth's request to a Ringborn,
Matti to a Den-raised hero (who knows the look of a man paid to look away), Tilly to a Laneborn,
Quaye to a Borderer (the Banked have Duskfolk among them too), Linde to a Beltborn; Mira's line for
each moment that made the hero.

## 6. The fights

All use the Banked's rules as built ([COMBAT.md](COMBAT.md), *The Banked*): a squad of at most five,
plus the motes an engineer sends.

| Fight | Where | Who | What it teaches |
| --- | --- | --- | --- |
| **The front hall** | Counters and reading desks; the doors behind the hero | 3 troopers, an engineer, a warden; warned | The full Banked squad at once; the hardest way in |
| **The stacks, quietly** | Between the racks, from the reading room | 2 troopers searching, then a trooper and an engineer | People in cover, and a first shot that is the hero's |
| **The cargo landing** | Among the opened crates | 3 troopers and an engineer | Flanking, among crates |
| **The stacks** | The long lanes of racks to the core | 3 troopers and an engineer (motes), then the warden with Esben behind him | The motes at the Banked's call; the warden's barrier |
| **The core** (archive path) | The core's hall, cores glowing as they burn | Two waves: 3 troopers and an engineer, then a warden and 2 troopers; about 90 seconds while the cores are pulled | Holding a place |
| **The dome** (dome path) | The dome walk (motes), then under the mirror | Motes on the walk; then 3 troopers, an engineer and a warden round the crew | Moving and fighting, then saving people under fire |

With *Ren sent the file*, one trooper more in the way in. Difficulty scales them as it does now
(D-46). The hero reaches level 3, and the class's level-3 power (D-54), at about the first fight.

## 7. Experience and money

### Experience (D-49)

The hero comes to Pyre with 470 to 510 (level 2). Every grant once by its key, never for a kill.

| Grant | Experience |
| --- | --- |
| Pyre Remnant reached | 60 |
| Six things to look at that matter (the remnant, Fomalhaut's companion, the notice, the crates, the drawing, the Lane Office's request) | 25 each, up to 150 |
| Why the archive is shut (Ruth) | 40 |
| Mira's side of it | 50 |
| Each person won (Linde, Matti, Ruth) | 40 each, up to 120 |
| Quaye heard or argued with | 25 |
| The unlisted's choice (a hard choice) | 50 |
| Into the archive | 120 |
| Through the stacks | 100 |
| The archive or the dome (a hard choice) | 50 |
| The archive held, or the dome held | 100 |
| The name in the oldest audit | 80 |
| Dr Achterberg joins *Lantern* | 80 |
| The unlisted, settled (the side story) | 200 |
| **In all** | **about 890 at the least, 1,225 at the most** |

Level 3 (750) comes with the first fight, before the stacks on every path; level 4 (1,300) by the
end on every path, with 1,360 to 1,735 in all. Three leads like this bring Act 1 to about level 6 to 7 (ACT1.md asks about 6;
the next leads can be tuned).

### Money (D-62)

- **Credits**, as in Reborn and Control. *Lantern*'s account holds 600 when she reaches Pyre (the old
  captain's float, which Jo mentions on arrival).
- **Earned from the story**, never from kills: the committee's thanks for the archive, or the dome's
  crew's thanks and the committee's fee for the dome (600 either way, so neither choice is the
  poorer); and by selling spare finds to a trader at half their price. `>>> pay <credits> <why>`, as
  `>>> xp`, each once by its key.
- **Spent**: on mods at Tilly's stall (a copy of a mod for each weapon, so two guns can both carry a
  stabiliser: the kit today allows one of each kind); on Matti's silence, if paid. *Make do* (the
  Steader's talent) takes a fifth off. **Recommended also**: *Lantern*'s first part, plating, for
  1,500, its effect when the ship's encounters come (D-18), so money has something large to save for.

| Tilly sells | Credits |
| --- | --- |
| Stabiliser | 250 |
| Scope, long barrel | 300 |
| Heavy rounds | 350 |
| Cooled coil | 450 |
| *Lantern*'s plating (recommended) | 1,500 |

**The trade screen** opens from Tilly's stall: what she sells, what the hero could sell her, the
account's balance; buying asks once, selling asks once. On a phone a single column with large
buttons; on a desktop two columns, hers and the hero's. The balance shows in the armoury and the
growth screen too.

## 8. Mira, as a companion

A **Warden** (D-33): *Barrier*, *Repair Drone*, *Pull*; *Shelter* at level 6 (D-54). As Ren and Jo do,
she uses her powers herself, half again slower to return than the hero's: a **Repair Drone** on
whoever is most hurt, a **Barrier** on whoever has lost their shield, **Pull** on a lone enemy with no
shield. She ranks her powers as she likes, or the player spends her points (her page in the growth
screen). She carries a pistol, and fights as Ren does from cover. Her approval (D-12) is moved by the
side story (taking the unlisted aboard or arguing for them, yes; letting the Banked carry them, no)
and later by how the hero treats the sick and the frightened.

**How she looks:** a station-born Spacer (tall, light), skin and eyes shared with Joost, her own hair;
the uniform in the clinic's white until she has clothes of her own (D-65). **Her voice:** a woman's, about forty, dry and warm
(D-63).

**Her personal quest's first step** (D-39) is here: Selene's notebooks, and the last entry, which
says something left Pyre an hour before it died. Where it went is for later.

## 9. What it adds to the canon

All the owner's to change.

- **Pyre Remnant Station**: the Cooperative's observatory, some two hundred people, a committee of
  five; inside the remnant's shell, two light-years out; the black hole seen only by its bending of
  light; Fomalhaut bright in its sky.
- **The archive of light**: a century of the station's own curves, and every older record of a dying
  star the Cooperative could gather.
- **Audits.** Twenty years ago Lightkeeper Ansa Varro audited the archive under the Authority's power
  over records "bearing on lane safety": 1,412 records taken for review, none returned. This audit
  was requested by the Lane Office, in the same words. A year ago Ren sent her report on Ross 128
  here for a second opinion; it is on the audit's list.
- **Fomalhaut B is dimming** (D-58), in steps, for eight months now; Fomalhaut B Orchard (Reborn's
  farm station there) is failing, and thirty-four of its people are at Pyre, on no list.
- **The Banked** carry people from dimming stars to "work": crews for Varro's engines. Their engineers
  command the motes with control rings made from the engines' parts. Their speakers are not always
  told the truth.
- **The Achterbergs** have kept a watch on Pyre for five generations. Selene's notebooks show Pyre's
  light stepping down in its last years, and rising, in steps, an hour before it died, as if
  something were leaving. Mira and Joost are her great-great-grandchildren.
- **Teodor Linde**, the navigator of Sorrel's Antares run, has been at Pyre Remnant thirty years, and
  was in the archive when Varro audited it.
- **The next star** (D-61), if the archive is saved and the hearing did not take the time.
- **Varro's voice**, twenty years younger, in the audit's record (D-64).

None of it decides anything Reborn or Control leaves open: which way Pyre Observatory's people went
in Reborn's ending is never said, only that Selene's own notebooks came out with her.

## 10. Art, voices and sound

| What | Source | Cost |
| --- | --- | --- |
| The station | The kit and its Poly Haven CC0 materials, as Calder; blue doors and pale walls | — |
| New models: the great mirror's mount, a rack of data cores, the core, a lectern, a folding cot, a trader's stall, a potted apple sapling, the dock's clamp ring | Meshy image-to-3D, as before; the low tier's copies | About 240 credits of 2,120 |
| Furniture already made | Bench, planter, table, console, crate, container, vending, medbed, cylinders | — |
| The sky | Drawn by the game: the remnant's haze (a shader of threads, faint red), Fomalhaut and its companion at their real places, the stars as now | — |
| Pictures | Pyre's loading painting; the noticeboard; Selene's notebook page; the children's drawing; the Lane Office's letter | Gemini, about $0.30 of D-24's budget |
| People | The two bodies as now; Mira, Joost, Linde, Ruth, Quaye, Matti, Nell, Tilly, Esben, Lenz, and about ten more who do not speak (D-65); older faces need an age setting the bodies do not have yet | MPFB's own age shapes (CC0), baked as the sliders are |
| Voices | About 400 lines, a quarter of them the hero's, in two voices; about fourteen new voices (D-63) | About 30,000 characters of the plan's 109 million |
| Music | A piece for the station (quiet, the remnant's), with Lyria (D-45); the fights' music as now | The Gemini key |
| Sounds | The commons' murmur, the dock, the dome's shutters, the core's hum, from the CC0 libraries first (D-45) | — |

## 11. Phones and desktops

- **One place in memory.** Pyre Remnant replaces *Lantern* while the hero is ashore, and *Lantern*
  replaces it when they go back aboard, behind the loading painting each time.
- **People.** At most fourteen besides the squad in the place at once; the commons is busy with about
  ten, the overflow with five or six (the rest are cots and bags). People out of sight and more than
  30 m away are not drawn or animated; the low tier shows fewer.
- **The stacks** are rows of one rack model, merged as the kit merges furniture; the racks are low
  cover, so the Banked's cover rules work there without change.
- **Controls** as now: *Talk*, *Look* and *Use* buttons on a phone, **E** on a desktop; the trade
  screen as the armoury's (§7). The cost's choice is a conversation, never a timer.
- **Tested at phone, tablet and desktop sizes**, on the Mac's GPU (the browser journeys).

## 12. Tests

- **Unit.** The script compiles; every path through every conversation reaches its end, for every
  origin, moment and class (as `story.test.ts` does now); every name the script uses is a mark or
  area of the place it is in; on every path through Pyre the hero reaches level 3 before the stacks
  and level 4 by the end; experience and money given once by their keys; the trader's prices, *Make
  do*, buying and selling, never below nothing; a copy of a mod for each weapon; the ways in open as
  §4 says; what Mira reads for each combination of choices; the Banked squads within their limits.
- **Browser**, on a phone and a desktop: arrive and walk the commons; talk to Mira and choose who
  comes; buy a mod from Tilly; each way in, to its first fight (from a debug chapter); the cost each
  way; the dock at the end; back aboard with Mira in the med bay.

## 13. How it is built

Each step playable and deployed (D-01), the story ending honestly where the building stops:

1. **The place**: Pyre Remnant from the kit, its areas, marks, doors and sky; the lane's end travels
   there; the arrival and the commons with their people standing in.
2. **The story**: every conversation, the hub and the ways in, the side story and the hearing, the
   cost, the end, back aboard; Mira joining and the choice of who comes; the tests that walk every
   path.
3. **Money and the trader**: the rules, the trade screen, the account in the armoury.
4. **The fights**: the Banked squads in each place; Mira's powers; the companion at the ship on the
   comms.
5. **Looks, models, pictures and music.**
6. **Voices** for every line; the full journeys on the Mac; pushed.

## 14. The decisions it needs

Round 9 in [DECISIONS.md](../DECISIONS.md):

- **D-57** Pyre Remnant as designed here (people, beats, ways in, choices, fights).
- **D-58** Where the unlisted come from.
- **D-59** When Mira joins, and who goes with the hero.
- **D-60** Who is in the dome.
- **D-61** The next star.
- **D-62** Money, and what it buys.
- **D-63** Voices for the new people.
- **D-64** Whether Varro is heard here.
- **D-65** How Pyre's people look in this increment.

## 15. As built

*25 October 2026.* Steps 1 to 4 of §13 are built and played through on the Mac's GPU, on a phone
and a desktop:

| Part | Where |
| --- | --- |
| The place: the dock, the freight way, the commons, the committee room, the clinic and the overflow, the spine, the archive (front hall, reading room, stacks, landing, core), the dome walk and the dome; its doors, marks and fights' entry points | `src/game/pyre.ts`, `PYRE_*` in `src/game/places.ts` |
| Pyre's sky: no sun, the remnant's red threads drawn on a canvas once, Fomalhaut, its companion 3.9° away, and Canopus | `pyre()` in `src/game/sky.ts` |
| The script, every chapter and conversation | `story/pyre.ink`, included by `story/slice.ink` and compiled by `scripts/ink.ts` |
| Money and Tilly's stall | `src/game/money.ts`, `src/ui/Trade.tsx`; mods may be had more than once, one of a kind to a weapon |
| The fights | `pyre_*` in `src/game/encounters.ts` |
| Mira as a companion: a Repair Drone for whoever is most hurt, a Barrier for whoever has lost their shield | `miraSupport` in `src/game/game.ts` |
| The people's looks, tinted by who they are (D-65) | `CAST_LOOKS`, `COSTUMES` in `src/game/people.ts` |
| The loading painting | `loading-pyre` ([IMAGES.md](../assets/IMAGES.md)) |
| Tests | `tests/unit/story.test.ts` (three routes through Pyre, every conversation walked for every origin and class), `tests/unit/money.test.ts`, `tests/e2e/pyre.spec.ts` |

Steps 5 and 6, the same day:

| Part | Where |
| --- | --- |
| Every line voiced: 428 new lines, 473 takes, the hero in two voices; Pyre's cast in stock voices of any accent, and four from ElevenLabs' library (D-63) | [VOICES.md](../assets/VOICES.md) |
| Seven models from Meshy (the great mirror, the archive's racks, the lectern, the cots, Tilly's stall, the sapling, the desks), 210 credits | [MODELS.md](../assets/MODELS.md) |
| Older faces: MPFB's age (CC0) as a body shape, MakeHuman's old skins and grey hair, for Linde, Sorrel, Hale, Ruth and Tilly; never offered in the creator | `art/hero.json`, `CAST_LOOKS` |
| The station's music, `pyre`, with Lyria | [AUDIO.md](../assets/AUDIO.md) |
| The dome shuttered, its slit open to the stars | `dome()` in `src/game/pyre.ts` |
