// Pyre Remnant (docs/design/PYRE.md, decided by D-57 to D-65): the first lead of Act 1. Pyre was the
// invented star of Starman Reborn; Fomalhaut, its companion and YZ Ceti are real. Included in
// story/slice.ink, so the whole game is one story and one save. The main flow's chapters are the
// stitches of `pyre`; the conversations and remarks are the knots below it. As in the prologue, every
// spoken line has its speaker and its voice's id, and every choice its manner (D-12). People call the
// hero "Captain" and never by name. `#spend:` on a hero's line takes that many credits when it is
// said (the game sets `credits` before each conversation); `#why:` names what a line's `#xp:` is for,
// where it is not a hard choice.

VAR way_in = ""
VAR unlisted = ""
VAR pyre_saved = ""
VAR next_star_found = false
VAR joost_lost = false
VAR linde_won = false
VAR matti_won = false
VAR ruth_won = false
VAR esben_fate = ""
VAR second = ""
VAR quaye_argued = false
VAR mira_approval = 0
VAR evidence = 0
VAR crate_opened = false
VAR credits = 0

=== pyre ===

// The station's doors as they are while the audit lasts: the archive shut, everything else open.
= doors
>>> lock berth_two
>>> lock berth_door
>>> lock freight_door
>>> unlock customs_gate
>>> open customs_gate
>>> unlock committee_door
>>> open committee_door
>>> unlock mira_door
>>> open mira_door
>>> lock archive_front
>>> lock reading_door
>>> lock stacks_door
>>> lock landing_door
>>> lock core_door
>>> unlock dome_door
>>> open dome_door
->->

// From the stacks on, the archive's doors stay open behind the hero, and the way they came in
// with them: a player who wandered into the core or back down the freight way is never shut in.
= archive_open
>>> unlock archive_front
>>> open archive_front
>>> unlock reading_door
>>> open reading_door
>>> unlock stacks_door
>>> open stacks_door
>>> unlock core_door
>>> open core_door
{ way_in == "cargo":
    >>> unlock freight_door
    >>> open freight_door
    >>> unlock landing_door
    >>> open landing_door
}
->->

// The station's people in their usual places.
= people
>>> place quaye quaye_lectern
>>> place crowd1 crowd1
>>> place crowd2 crowd2
>>> place crowd3 crowd3
>>> place crowd4 crowd4
>>> place tilly tilly
>>> place ruth ruth_office
>>> place linde linde_door
>>> place lenz lenz
>>> place matti matti_booth
{ unlisted == "aboard":
    >>> hide nell
    >>> hide ref1
    >>> hide ref2
    >>> hide ref3
- else:
    >>> place nell nell
    >>> place ref1 ref1
    >>> place ref2 ref2
    >>> place ref3 ref3
}
>>> place aud1 aud1
>>> place aud2 aud2
{ joost_lost:
    >>> hide joost
    >>> hide dome1
    >>> hide dome2
- else:
    >>> place joost joost
    >>> place dome1 dome1
    >>> place dome2 dome2
}
>>> hide esben
>>> hide sorrel
->->

// Who comes with the hero (D-59): Ren and Jo until Mira joins, then Mira and the one the player chose.
= squad(at)
{ second:
- "ren":
    >>> start ren {at}
    >>> show ren
    >>> join ren
    >>> follow ren
    >>> leave jo
- "jo":
    >>> start jo {at}
    >>> show jo
    >>> join jo
    >>> follow jo
    >>> leave ren
- else:
    >>> start ren {at}
    >>> start jo {at}
    >>> show jo
    >>> join jo
    >>> follow ren
    >>> follow jo
}
{ second != "":
    >>> start mira {at}
    >>> show mira
    >>> join mira
    >>> follow mira
}
->->

= pyre_dock
>>> travel pyre
>>> checkpoint pyre_dock
>>> music pyre
>>> sky pyre space
>>> lights on
>>> start hero pyre_dock_hero
-> squad("pyre_dock_hero") ->
>>> hide mira
-> doors ->
-> people ->
>>> place matti matti_gate
>>> lock customs_gate
>>> caption Pyre Remnant Station · the Cooperative's observatory · 33 light-years from the Sun
Before you ask, Captain: six hundred credits in the ship's account. The old captain's float. It won't buy much. #speaker: Jo #line: jo_dock_01
>>> pay 600 The old captain's float
>>> xp 60 Pyre Remnant reached
>>> objective Clear customs
>>> marker matti
>>> talk matti matti_dock
>>> look crates dock_crates look_crates Look at the stacked crates
>>> look berth dock_window look_berth Look out at Lantern
>>> wait talked:matti_dock
>>> unlock customs_gate
>>> open customs_gate
>>> walk matti matti_booth
>>> objective Find out why the archive is closed
>>> marker commons_entry
>>> wait enter:commons
-> pyre_commons

= pyre_commons
>>> checkpoint pyre_commons
>>> music pyre
>>> sky pyre space
>>> lights on
>>> start hero commons_entry
-> squad("commons_entry") ->
-> doors ->
-> people ->
>>> place mira mira_clinic
>>> stay mira
>>> caption The commons
We have watched stars die from this station for a hundred years, and we called it science. #speaker: Quaye #line: quaye_address_01
Every one of those curves is a light going out. Every one. #speaker: Quaye #line: quaye_address_02
The Banked ask one thing. What if some of it could be kept? #speaker: Quaye #line: quaye_address_03
Kept by whom, Tobias? Who holds the bank? #speaker: Researcher #line: researcher_heckle_01
People who'll still be here when the dark comes, Arno. I'd like you to be one of them. #speaker: Quaye #line: quaye_address_04
He's good. That's the worst kind. #speaker: Ren #line: ren_commons_01
>>> objective Ask the committee why the archive is closed
>>> marker ruth
-> hub_talks ->
- (hub)
>>> wait talked:mira_clinic\|talked:ruth_office\|talked:ruth_proof\|talked:linde_door\|talked:matti_again\|talked:quaye_talk\|talked:tilly_stall\|talked:nell_overflow\|talked:joost_dome
{ event:
- "talked:mira_clinic":
    -> pyre_clinic
- "talked:ruth_office":
    >>> xp 40 Why the archive is shut
    >>> objective See Dr Achterberg in the clinic
    >>> marker mira
- "talked:quaye_talk":
    >>> xp 25 Quaye heard out
}
{ linde_won && event == "talked:linde_door":
    >>> xp 40 Linde's trust
}
{ matti_won && event == "talked:matti_again":
    >>> xp 40 Matti's help
}
{ ruth_won && (event == "talked:ruth_office" || event == "talked:ruth_proof"):
    >>> xp 40 Ruth's order
}
-> hub_talks -> hub

// Who has something to say now: a conversation is had once, and the next is offered when there is one.
= hub_talks
{ not ruth_office:
    >>> talk ruth ruth_office
}
{ ruth_office && not ruth_won && not ruth_proof && (crate_opened || linde_won):
    >>> talk ruth ruth_proof
}
{ not linde_door:
    >>> talk linde linde_door
}
{ not matti_again:
    >>> talk matti matti_again
}
{ not quaye_talk:
    >>> talk quaye quaye_talk
}
{ not tilly_stall:
    >>> talk tilly tilly_stall
}
{ not nell_overflow && unlisted != "aboard":
    >>> talk nell nell_overflow
}
{ not joost_dome:
    >>> talk joost joost_dome
}
{ not lenz_door:
    >>> talk lenz lenz_door
}
{ not auditor_door:
    >>> talk aud1 auditor_door
}
{ not mira_clinic:
    >>> talk mira mira_clinic
}
>>> screen trade tilly_stall Trade with Tilly
{ not look_remnant:
    >>> look remnant remnant_window look_remnant Look out at the remnant
}
{ not look_fomalhaut:
    >>> look fomalhaut fomalhaut_window look_fomalhaut Look at the bright star low in the west
}
{ not look_notice:
    >>> look notice notice look_notice Read the noticeboard
}
{ not look_drawing && unlisted != "aboard":
    >>> look drawing drawing look_drawing Look at the children's drawing
}
{ not look_charts:
    >>> look charts charts look_charts Read the patients' charts
}
{ ruth_office && not look_request:
    >>> look request ruth_desk look_request Read the Lane Office's letter
}
->->

= pyre_clinic
>>> checkpoint pyre_clinic
>>> music pyre
>>> sky pyre space
>>> lights on
>>> start hero clinic_hero
-> squad("clinic_hero") ->
-> doors ->
-> people ->
>>> place mira mira_clinic
>>> stay mira
>>> xp 50 Mira's side of it
>>> scene jo pick_second
-> squad("clinic_hero") ->
>>> walk nell clinic_nell
>>> wait 2
>>> scene nell nell_choice
{ unlisted:
- "aboard":
    >>> walk nell berth
    >>> walk ref1 berth
    >>> walk ref2 berth
    >>> walk ref3 berth
- "listed":
    >>> place ruth hearing_ruth
    >>> walk nell hearing_nell
    >>> objective Make the Orchard's case to the committee
    >>> marker ruth
    >>> wait enter:committee
    >>> scene ruth ruth_hearing
    { ruth_won:
        >>> xp 40 Ruth's order
    }
    >>> place ruth ruth_office
    >>> walk nell nell
}
-> pyre_way

= pyre_way
>>> checkpoint pyre_way
>>> music pyre
>>> sky pyre space
>>> lights on
>>> start hero clinic_hero
-> squad("clinic_hero") ->
-> doors ->
-> people ->
>>> objective Find a way into the archive
>>> marker linde
-> ways ->
- (choose)
>>> wait used:way_front\|used:way_stacks\|used:way_cargo\|talked:linde_way\|talked:matti_again\|talked:ruth_office\|talked:ruth_proof
{ event:
- "used:way_front":
    ~ way_in = "front"
    -> way_front
- "used:way_stacks":
    ~ way_in = "stacks"
    -> way_stacks
- "used:way_cargo":
    ~ way_in = "cargo"
    -> way_cargo
}
{ matti_won && event == "talked:matti_again":
    >>> xp 40 Matti's help
}
{ ruth_won && (event == "talked:ruth_office" || event == "talked:ruth_proof"):
    >>> xp 40 Ruth's order
}
{ linde_won && event == "talked:linde_way":
    >>> xp 40 Linde's trust
}
-> ways -> choose

// The ways into the archive, as each is won (PYRE.md §4). Linde's is always open once Mira has joined.
= ways
{ not linde_way:
    >>> talk linde linde_way
- else:
    >>> use way_stacks way_stacks Go in through the reading room with Linde
}
{ ruth_won:
    >>> use way_front way_front Open the archive on the committee's order
- else:
    { not ruth_office:
        >>> talk ruth ruth_office
    }
    { ruth_office && not ruth_proof && (crate_opened || linde_won):
        >>> talk ruth ruth_proof
    }
}
{ matti_won:
    >>> use way_cargo freight_head Take the freight way up to the archive
- else:
    { not matti_again:
        >>> talk matti matti_again
    }
}
->->

= way_front
>>> forget way_stacks
>>> forget way_cargo
>>> lock dome_door
The committee's order. The archive is to be opened for inspection. We'll, ah. We'll just tell the others. #speaker: Auditor #line: auditor_front_01
>>> walk aud1 front_hall_hero
>>> walk aud2 front_hall_hero
>>> unlock archive_front
>>> open archive_front
>>> objective Into the archive
>>> marker front_hall_hero
>>> wait enter:front_hall
>>> hide aud1
>>> hide aud2
{ ren_sent_file:
    That's Lantern's captain. We were told. Weapons! #speaker: Banked #line: banked_front_01a
    >>> encounter pyre_front_warned
- else:
    They've let them in. Weapons! #speaker: Banked #line: banked_front_01b
    >>> encounter pyre_front
}
>>> xp 120 Into the archive
-> pyre_stacks

= way_stacks
>>> forget way_front
>>> forget way_cargo
>>> lock dome_door
>>> unlock reading_door
>>> open reading_door
>>> walk linde reading_linde
>>> objective Follow Linde into the reading room
>>> marker reading_linde
>>> wait enter:reading_room
Through there. They walk the stacks in pairs. Keep low, and don't lean on the racks; they hum when they're touched. #speaker: Linde #line: linde_way_in_01
>>> unlock stacks_door
>>> open stacks_door
>>> objective Into the stacks
>>> marker stacks_quiet
>>> wait enter:stacks
Two of them, by the far racks. They haven't seen us. #speaker: Mira #line: mira_stacks_quiet_01
>>> hint cover
{ ren_sent_file:
    >>> encounter pyre_quiet_warned
- else:
    >>> encounter pyre_quiet
}
>>> xp 120 Into the archive
-> pyre_stacks

= way_cargo
>>> forget way_front
>>> forget way_stacks
>>> lock dome_door
>>> unlock freight_door
>>> open freight_door
>>> unlock landing_door
>>> open landing_door
>>> objective Up the freight way to the archive's landing
>>> marker landing_hero
>>> wait enter:freight_way
It's a long way round. Matti says nobody's walked it since the last refit. #speaker: Mira #line: mira_freight_01
>>> wait enter:landing
More crates, opened. Rifles, under the binding. #speaker: hero #line: hero_landing_01
Who opened the freight way? Contact, contact! #speaker: Banked #line: banked_cargo_01
{ ren_sent_file:
    >>> encounter pyre_cargo_warned
- else:
    >>> encounter pyre_cargo
}
>>> xp 120 Into the archive
-> pyre_stacks

= pyre_stacks
>>> checkpoint pyre_stacks
>>> music tension
>>> sky pyre space
>>> lights on
{ way_in:
- "front":
    >>> start hero front_hall_hero
    -> squad("front_hall_hero") ->
- "cargo":
    >>> start hero landing_hero
    -> squad("landing_hero") ->
- else:
    >>> start hero stacks_quiet
    -> squad("stacks_quiet") ->
}
-> doors ->
-> people ->
>>> hide aud1
>>> hide aud2
>>> unlock archive_front
>>> open archive_front
>>> unlock reading_door
>>> open reading_door
>>> unlock stacks_door
>>> open stacks_door
{ way_in == "cargo":
    >>> unlock freight_door
    >>> open freight_door
    >>> unlock landing_door
    >>> open landing_door
}
// The Banked are in the archive: Joost has sealed the dome until he opens it himself.
>>> lock dome_door
{ way_in == "stacks":
    >>> place linde reading_linde
}
>>> place esben esben
>>> objective Get through the stacks to the core
>>> marker esben
They're in the stacks! Spread out, use the racks! #speaker: Banked #line: banked_stacks_01
>>> encounter pyre_stacks_1
Send them out. Send the motes! #speaker: Banked #line: banked_stacks_02
{ second == "jo":
    Those motes have rings on them. Control rings. Captain, I know those rings. #speaker: Jo #line: jo_stacks_rings
- else:
    They're giving the machines orders. The Banked have the swarm on a leash. #speaker: Ren #line: ren_stacks_leash
}
Barrier up. Walk them back. #speaker: Warden #line: warden_stacks_01
>>> encounter pyre_stacks_2
>>> xp 100 Through the stacks
{ second == "ren":
    Captain. Their list, on the rack. Records withdrawn for review. That's my report. My Ross 128 report. I sent it here a year ago for a second opinion. #speaker: Ren #line: ren_stacks_report
}
>>> scene esben esben_stacks
>>> walk esben core_esben
>>> unlock core_door
>>> open core_door
This is Pyre Remnant, on the open band. Our archive is closed. Our telescope is not. #speaker: Joost #line: joost_band_01
Fomalhaut B, a K4 dwarf twenty-five light-years from the Sun. Eight months of readings. Here they are. #speaker: Joost #line: joost_band_02
Dome team. Go. #speaker: Esben #line: esben_band_01
>>> scene mira cost_choice
{ pyre_saved == "archive":
    -> pyre_archive
- else:
    -> pyre_dome
}

= pyre_archive
>>> checkpoint pyre_archive
>>> music tension
>>> sky pyre space
>>> lights on
>>> start hero core_hero
-> squad("core_hero") ->
-> doors ->
-> archive_open ->
-> people ->
>>> hide aud1
>>> hide aud2
>>> place linde core_linde
>>> place esben core_esben
>>> objective Hold the core while the cores are pulled
>>> marker none
Twenty-six cores. Two minutes, if nobody shoots me. #speaker: Linde #line: linde_core_01
>>> encounter pyre_core_1
Nine out. Keep them off me! #speaker: Linde #line: linde_core_02
They're through the inner door. Mira, if you're listening, the curve's in the— #speaker: Joost #line: joost_core_01
Joost? Joost! #speaker: Mira #line: mira_core_01
>>> encounter pyre_core_2
That's the last. It's out. It's all out. #speaker: Linde #line: linde_core_03
~ joost_lost = true
>>> hide joost
>>> hide dome1
>>> hide dome2
>>> xp 100 The archive held
>>> scene esben esben_core
{ esben_fate == "freed":
    >>> walk esben esben
- else:
    >>> stay esben
}
-> pyre_after

= pyre_dome
>>> checkpoint pyre_dome
>>> music tension
>>> sky pyre space
>>> lights on
>>> start hero walk_start
-> squad("walk_start") ->
-> doors ->
-> archive_open ->
-> people ->
>>> hide aud1
>>> hide aud2
>>> place esben core_esben
>>> lock dome_door
>>> objective Get to the dome
>>> marker dome_hero
>>> wait enter:dome_walk
On the glass! They're coming along the outside! #speaker: Mira #line: mira_walk_01
>>> encounter pyre_walk
I'm opening the door. Come on, come on! #speaker: Joost #line: joost_dome_door_01
>>> unlock dome_door
>>> open dome_door
>>> wait enter:dome
>>> encounter pyre_dome
>>> hide esben
>>> scene joost joost_saved
This is Pyre Remnant, on the open band. Our archive was closed. Our telescope is not. #speaker: Joost #line: joost_broadcast_01
Fomalhaut B has lost a fifth of its light in eight months. Not slowly. In steps, every few days. #speaker: Joost #line: joost_broadcast_02
Anyone with a telescope can check. Please. Check. #speaker: Joost #line: joost_broadcast_03
It's gone. The archive. All of it. I'm sorry, Mira. I'm so sorry. #speaker: Linde #line: linde_dome_01
>>> xp 100 The dome held
>>> objective Go back to the archive's reading room
>>> marker after_hero
>>> place linde after_linde
>>> wait enter:reading_room
-> pyre_after

= pyre_after
>>> checkpoint pyre_after
>>> music pyre
>>> sky pyre space
>>> lights on
>>> start hero after_hero
-> squad("after_hero") ->
-> doors ->
-> archive_open ->
-> people ->
>>> hide aud1
>>> hide aud2
>>> place linde after_linde
>>> place mira after_mira
>>> scene mira mira_reads
>>> xp 80 The name in the oldest audit
>>> follow mira
>>> objective Go down to the dock
>>> marker dock_end_hero
>>> wait enter:dock
-> pyre_dock_end

= pyre_dock_end
>>> checkpoint pyre_dock_end
>>> music pyre
>>> sky pyre space
>>> lights on
>>> start hero dock_end_hero
-> squad("dock_end_hero") ->
-> doors ->
-> people ->
>>> hide aud1
>>> hide aud2
>>> place quaye dock_quaye
>>> place ruth dock_ruth
>>> place linde dock_linde
{ unlisted == "banked":
    >>> place nell dock_nell
    >>> place ref1 dock_ref1
    >>> place ref2 dock_ref2
    >>> place ref3 dock_ref3
}
{ esben_fate == "freed":
    >>> place esben dock_esben
}
>>> unlock berth_two
>>> open berth_two
Pyre Remnant, this is the Keeping, at berth two. We've come for our people. #speaker: Ship #line: ship_dock_01
>>> objective Speak with Quaye before he goes
>>> marker quaye
>>> talk quaye quaye_goodbye
>>> wait talked:quaye_goodbye
{ unlisted == "banked":
    Thank you, Captain. For being honest with us. #speaker: Nell #line: nell_dock_01
    >>> walk nell banked_berth
    >>> walk ref1 banked_berth
    >>> walk ref2 banked_berth
    >>> walk ref3 banked_berth
}
{ esben_fate == "freed":
    >>> walk esben banked_berth
}
>>> walk quaye banked_berth
Lantern's captain. The Lightkeeper knows your ship now. #speaker: Ship #line: ship_dock_02
>>> wait 4
>>> lock berth_two
>>> objective Speak with Ruth
>>> marker ruth
>>> scene ruth ruth_end
{ pyre_saved == "archive":
    >>> pay 600 The committee's thanks
- else:
    >>> pay 600 The dome's thanks
}
{ sorrel_named_linde:
    >>> place sorrel dock_sorrel
    >>> scene linde linde_sorrel
}
>>> scene mira mira_joins
>>> xp 80 Dr Achterberg joins Lantern
>>> xp 200 The Orchard's people settled
>>> objective Go aboard Lantern
>>> marker berth
>>> unlock berth_door
>>> open berth_door
>>> use board berth Go aboard Lantern
>>> wait used:board
-> pyre_aboard

// Aboard Lantern at berth four, Pyre Remnant behind the windows.
= pyre_aboard
>>> travel lantern
>>> checkpoint pyre_aboard
>>> music ending
>>> sky pyre space
>>> lights on
>>> hide hale
>>> place hero aboard_hero
>>> place mira medbay_mira
>>> place ren cabin_ren
>>> place jo engineering_jo
>>> stay mira
>>> stay ren
>>> stay jo
>>> place sorrel engineering_sorrel
>>> place pell bridge_pell
{ ilya_lost:
    >>> hide ilya
- else:
    >>> place ilya mess_ilya
}
{ unlisted == "aboard":
    >>> place dena hold_dena
    >>> place nell hold_nell
    >>> place ref1 hold_ref1
    >>> place ref2 hold_ref2
    >>> place ref3 hold_ref3
- else:
    >>> place dena mess_dena
    >>> hide nell
    >>> hide ref1
    >>> hide ref2
    >>> hide ref3
}
>>> caption Lantern · at berth four, Pyre Remnant
>>> objective Speak with your crew
>>> marker medbay_mira
>>> screen armoury armoury Open the armoury
>>> talk mira mira_aboard
>>> talk ren ren_after
>>> talk jo jo_after
>>> talk dena dena_after
>>> talk pell pell_after
>>> talk sorrel sorrel_after
{ not ilya_lost:
    >>> talk ilya ilya_after
}
{ unlisted == "aboard":
    >>> talk nell nell_aboard
}
>>> wait talked:mira_aboard
>>> marker none
>>> wait talked:ren_after
>>> wait talked:jo_after
>>> end
-> END

// ─── Pyre Remnant: conversations ────────────────────────────────────────────

=== matti_dock ===
Lantern, berth four. Customs. That's me, today. Names? #speaker: Matti #line: matti_dock_01
{ ren_sent_file:
    Never mind. I've got your names. I've had them since yesterday. #speaker: Matti #line: matti_dock_02a
    Since yesterday. From whom? #speaker: Ren #line: ren_matti_dock_03a
    From the people who pay me to have things. #speaker: Matti #line: matti_dock_04a
}
* [What's in the crates by the wall? #manner: ask]
    What's in the crates by the wall? #speaker: hero #line: hero_matti_dock_05a
    Paper. For the archive's audit. Says so on the side. #speaker: Matti #line: matti_dock_06a
* [Why did the open band go quiet? #manner: ask]
    Why did your open band go quiet? #speaker: hero #line: hero_matti_dock_05b
    Committee's orders. Somebody up in the dome kept talking about a star, and the committee said that was enough talking. #speaker: Matti #line: matti_dock_06b
* [Just let us through. #manner: plain]
    Just let us through. #speaker: hero #line: hero_matti_dock_05c
    Gladly. #speaker: Matti #line: matti_dock_06c
- You're cleared. Welcome to Pyre Remnant. Don't look for the black hole; you can't see it anyway. #speaker: Matti #line: matti_dock_07
-> DONE

=== matti_again ===
Something wrong with your clearance? #speaker: Matti #line: matti_again_01
{ hero_origin == "den-raised":
    I grew up in a den. I know the look of a man who's paid to look away. You've got it. #speaker: hero #line: hero_matti_again_02_den
}
* [Who's paying you? #manner: ask]
    Who's paying you, Matti? #speaker: hero #line: hero_matti_again_03a
    The auditors. For not looking at crates. I'm very good at not looking at things. #speaker: Matti #line: matti_again_04a
    My sister's in the overflow with thirty-three others. The Banked said they'd take them somewhere with a sun that works. They pay on time. I'm not proud of it. #speaker: Matti #line: matti_again_05a
    ** [Help me, and I'll help her people. #manner: mercy]
        Help me, and I'll do what I can for her people. #speaker: hero #line: hero_matti_again_06a
        ~ matti_won = true
        You mean that. You actually mean it. #speaker: Matti #line: matti_again_07a
    ** [Help me, or the committee hears about this. #manner: resolve]
        Help me, or the committee hears who's been taking the auditors' money. #speaker: hero #line: hero_matti_again_06b
        ~ matti_won = true
        Fine. Fine. You'd have found out anyway. #speaker: Matti #line: matti_again_07b
    ** {credits >= 200} [Here's two hundred to look the other way for once. #manner: plain]
        Here's two hundred. Look the other way for once, in my direction. #speaker: hero #line: hero_matti_again_06c #spend: 200
        ~ matti_won = true
        That's more than they pay. That's a lot more than they pay. #speaker: Matti #line: matti_again_07c
    ** [Keep your secret. #manner: plain]
        Keep your secret, Matti. For now. #speaker: hero #line: hero_matti_again_06d
        For now. Right. #speaker: Matti #line: matti_again_07d
    - -
    { matti_won:
        ~ crate_opened = true
        Come and look at the paper, then. #speaker: Matti #line: matti_again_08
        Rifles. Under a layer of binding. #speaker: hero #line: hero_matti_again_09
        There's a freight way from here to the back of the archive. Their crates went up it. I can open the doors for you. #speaker: Matti #line: matti_again_10
    }
* [Nothing. #manner: plain]
    Nothing. Carry on. #speaker: hero #line: hero_matti_again_03b
    Always do. #speaker: Matti #line: matti_again_04b
- -> DONE

=== ruth_office ===
Ruth Amadi, committee, supply. If you're here about the archive, you're the fourth today, and the answer hasn't changed. #speaker: Ruth #line: ruth_office_01
* [Why is it closed? #manner: ask]
    Why is it closed? #speaker: hero #line: hero_ruth_office_02a
    It's under audit. The Lane Office asked for a review of every record bearing on lane safety. Their words. #speaker: Ruth #line: ruth_office_03a
* [Who's doing the auditing? #manner: ask]
    Who's doing the auditing? #speaker: hero #line: hero_ruth_office_02b
    Our deputy archivist, and a team the Lane Office vouched for. They came on a ship with their own crates and their own armbands. #speaker: Ruth #line: ruth_office_03b
- Two hundred people live on that lane, Captain. If the Authority shuts it, we eat what we grow, and we don't grow much under a black hole. #speaker: Ruth #line: ruth_office_04
{ hero_origin == "steader":
    You're one of ours. I can hear it. Then you know the Cooperative votes. It doesn't fight. #speaker: Ruth #line: ruth_office_05_steader
}
And Dr Achterberg refused to hand over her family's papers on Pyre, so the committee suspended her. I voted against. I lost. #speaker: Ruth #line: ruth_office_06
* [Then open the archive. #manner: resolve]
    Then open the archive, and let me see what they're doing in there. #speaker: hero #line: hero_ruth_office_07a
    On what grounds? Show me the audit isn't what it says, and I'll put it to the committee tonight. #speaker: Ruth #line: ruth_office_08a
* [Ren, tell her what you told me. #manner: plain]
    Ren. Tell her. #speaker: hero #line: hero_ruth_office_07b
    Lane officer Okafor. The Lane Office can ask to see a Cooperative archive. It can't audit one. That letter has no power here at all. #speaker: Ren #line: ren_ruth_office_08b
    { not ren_sent_file:
        And now the Lane Office will hear I said so. #speaker: Ren #line: ren_ruth_office_09b
    }
    Then they've been lying to us since the first day. All right. If there's nothing to hide in there, the auditors will open the door on my order. #speaker: Ruth #line: ruth_office_10b
    ~ ruth_won = true
    ~ ren_approval += 1
* [I'll find you proof. #manner: plain]
    I'll find you proof. #speaker: hero #line: hero_ruth_office_07c
    Do. And quickly. The audit's due to finish when the next ship docks. #speaker: Ruth #line: ruth_office_08c
- -> DONE

=== ruth_proof ===
You've found something. You've got that look. #speaker: Ruth #line: ruth_proof_01
{ crate_opened:
    The auditors' crates on the dock. Under the paper, rifles. #speaker: hero #line: hero_ruth_proof_02a
- else:
    Teodor Linde kept a copy of everything the audit is erasing. Every curve that falls in steps. #speaker: hero #line: hero_ruth_proof_02b
}
* [Open the archive, Ruth. #manner: resolve]
    Open the archive, Ruth. Tonight. #speaker: hero #line: hero_ruth_proof_03a
* [The Cooperative can't stay out of this now. #manner: plain]
    The Cooperative can't stay out of this now. #speaker: hero #line: hero_ruth_proof_03b
-
~ ruth_won = true
I know. I've known for a week. I just wanted someone else to say it first. The order's going out now. Go in the front door. #speaker: Ruth #line: ruth_proof_04
-> DONE

=== linde_door ===
The archive's closed. I'm only reading. Reading isn't closed. Yet. #speaker: Linde #line: linde_door_01
* {sorrel_named_linde} [Sorrel says you never took the money. #manner: plain]
    Teodor Linde? Sorrel sends his regards. He says you never took the money. #speaker: hero #line: hero_linde_door_02a
    Sorrel. He's alive. #speaker: Linde #line: linde_door_03a
    He took the money, you know. We all knew he would. He was the only one of us with children. #speaker: Linde #line: linde_door_04a
    ~ linde_won = true
* {have_curve} [Ross 128 is dimming in steps. #manner: ask]
    Ross 128 is dimming in steps. Every three days. I have the readings aboard. #speaker: hero #line: hero_linde_door_02b
    Every three days. #speaker: Linde #line: linde_door_03b
    Then you'd better see what I've got. #speaker: Linde #line: linde_door_04b
    ~ linde_won = true
* [What's happening in there? #manner: ask]
    What's happening in there? #speaker: hero #line: hero_linde_door_02c
    An audit. I watched one once, twenty years ago. Nobody shouted. Nobody was hurt. Things just weren't there any more, afterwards. #speaker: Linde #line: linde_door_03c
-
{ hero_origin == "beltborn":
    Beltborn, by your hands. Half of Sorrel's crew were belt. They didn't frighten easily. I did. #speaker: Linde #line: linde_door_05_belt
}
{ linde_won:
    I've kept a copy. Everything that falls in steps, for thirty years, in a biscuit tin. I've never once had the courage to show anyone. #speaker: Linde #line: linde_door_06a
    When you go in, come by the reading room. I have the key to the back of the stacks. #speaker: Linde #line: linde_door_07a
- else:
    If you want to help, see Dr Achterberg. If she trusts you, I might. #speaker: Linde #line: linde_door_06b
}
-> DONE

=== linde_way ===
{ linde_won:
    You've brought Mira. Good. The reading room's back door opens on the stacks. I'll take you through. #speaker: Linde #line: linde_way_01a
- else:
    Teodor. They're all right. I've checked. #speaker: Mira #line: mira_linde_way_01b
    Mira says you're all right. Mira doesn't say that. #speaker: Linde #line: linde_way_02b
    I've kept a copy, Captain. Everything that falls in steps, thirty years of it, in a biscuit tin. I'll show you after. If there's an after. #speaker: Linde #line: linde_way_03b
    ~ linde_won = true
}
* [Stay out of the fighting. #manner: mercy]
    Open the door and stay out of the fighting, Teodor. #speaker: hero #line: hero_linde_way_04a
    I'm sixty-eight. I've been staying out of the fighting all my life. It's the one thing I'm good at. #speaker: Linde #line: linde_way_05a
* [Show us the way. #manner: plain]
    Show us the way. #speaker: hero #line: hero_linde_way_04b
    The reading room. When you're ready. #speaker: Linde #line: linde_way_05b
- -> DONE

=== quaye_talk ===
You came from Ross 128. I heard. I'm sorry; I mean that. Nobody should have to see what you saw. #speaker: Quaye #line: quaye_talk_01
I'm trying to make it so fewer people do. #speaker: Quaye #line: quaye_talk_02
{ hero_origin == "borderer":
    You're from the border, by your voice. Then you've met the Duskfolk. Some of them are with us. They understand a twilight better than we do. #speaker: Quaye #line: quaye_talk_03_border
}
* [The machines at Ross 128 weren't keeping anything safe. #manner: resolve]
    The machines at Ross 128 weren't keeping anything safe. They were killing people. #speaker: hero #line: hero_quaye_talk_04a
    They were keeping the light. The people, that's the hard part, and I won't pretend it isn't. But a dying star will die. Somebody should keep what it gave. #speaker: Quaye #line: quaye_talk_05a
    ** [Ross 128 wasn't dying. #manner: resolve]
        Ross 128 wasn't dying. It's a red dwarf. It had more years left than the universe has had. Until your machines came. #speaker: hero #line: hero_quaye_talk_06a
        That's not what we've been told. #speaker: Quaye #line: quaye_talk_07a
        ~ quaye_argued = true
    ** [Who tells you what to believe? #manner: ask]
        Who tells you what to believe, Quaye? #speaker: hero #line: hero_quaye_talk_06b
        Nobody tells me. I read the curves for twenty years. The Lightkeeper only said it out loud. #speaker: Quaye #line: quaye_talk_07b
* [What does banked mean? #manner: ask]
    What does banked mean, to you? #speaker: hero #line: hero_quaye_talk_04b
    Kept. Saved for after. The light gathered while there's light to gather, and held. When the last stars go, someone will need it. #speaker: Quaye #line: quaye_talk_05b
* [I'll hear you out. #manner: plain]
    Go on. I'll hear you out. #speaker: hero #line: hero_quaye_talk_04c
    Thank you. Most people here have stopped listening. That's when they get frightened. #speaker: Quaye #line: quaye_talk_05c
- Come and listen tonight, if you like. People are frightened. Somebody should talk to them who isn't. #speaker: Quaye #line: quaye_talk_08
-> DONE

=== tilly_stall ===
Mods, parts and coffee. Two of the three are legal. #speaker: Tilly #line: tilly_stall_01
{ hero_origin == "laneborn":
    Laneborn? I can tell by how you stand on a deck. Then you know what a hold costs to keep, and you won't haggle. #speaker: Tilly #line: tilly_stall_02_lane
}
* [Who else buys from you? #manner: ask]
    Who else buys from you? #speaker: hero #line: hero_tilly_stall_03a
    Everyone. The Banked pay on time, which is more than the committee does. #speaker: Tilly #line: tilly_stall_04a
    Their auditors' crates came up on my lift. Paper, they said. Paper doesn't weigh that much, Captain. I've sold paper. #speaker: Tilly #line: tilly_stall_05a
* [Why are you still here? #manner: ask]
    Why are you still here? #speaker: hero #line: hero_tilly_stall_03b
    Because the committee won't clear a ship till the audit's done, and I'm a ship. So I sell what's in my hold to whoever's still talking. #speaker: Tilly #line: tilly_stall_04b
* [Show me what you've got. #manner: plain]
    Show me what you've got. #speaker: hero #line: hero_tilly_stall_03c
- Look all you like. Buying's the part I enjoy. #speaker: Tilly #line: tilly_stall_06
-> DONE

=== nell_overflow ===
Are you the committee? No. They don't come down here. #speaker: Nell #line: nell_overflow_01
Nell Lund. We're from Fomalhaut B Orchard, thirty-four of us. The Banked brought us here for a few days. That was five weeks ago. #speaker: Nell #line: nell_overflow_02 #codex: orchard
My family grew apples under that sun for eighty years. Last spring the trees stopped knowing what season it was. #speaker: Nell #line: nell_overflow_03 #codex: fomalhaut_b
* [What happened to your star? #manner: ask]
    What happened to your star? #speaker: hero #line: hero_nell_overflow_04a
    It went dim. Our grow lamps log the sun every hour, for the trees. It doesn't fade. It steps. Down, and holds, and down again. #speaker: Nell #line: nell_overflow_05a
* [Why aren't you on the station's list? #manner: ask]
    Why aren't you on the station's list? #speaker: hero #line: hero_nell_overflow_04b
    Because if they list us, they have to say why we came. And then somebody has to say a Cooperative star is going out. #speaker: Nell #line: nell_overflow_05b
* [Is anyone sick? #manner: mercy]
    Is anyone sick? #speaker: hero #line: hero_nell_overflow_04c
    The air plant failed before we left. It ran on light. Dr Achterberg's been seeing the children. She isn't supposed to. She does anyway. #speaker: Nell #line: nell_overflow_05c
- The Banked say there's work for us. Somewhere with a sun that works. They've been kind. I want to believe them. #speaker: Nell #line: nell_overflow_06
-> DONE

=== joost_dome ===
Visitors! Nobody visits the dome any more. The committee thinks I'll talk to them. #speaker: Joost #line: joost_dome_01
Joost Achterberg, night watch. You've met my sister? Then you've been told off already. #speaker: Joost #line: joost_dome_02
* [What are you watching? #manner: ask]
    What are you watching? #speaker: hero #line: hero_joost_dome_03a
    Fomalhaut B. Every night for eight months. It steps down every few days, and it doesn't come back up. #speaker: Joost #line: joost_dome_04a #codex: fomalhaut_b
    I was reading the numbers on the open band when the committee switched it off. Mid-sentence. They didn't even let me finish the number. #speaker: Joost #line: joost_dome_05a
* [Can you see the black hole? #manner: ask]
    Can you see the black hole from here? #speaker: hero #line: hero_joost_dome_03b
    Nobody can. It's a few tens of kilometres across. You see where the light bends round it: a little ring, in the mirror. That's all a black hole ever looks like. #speaker: Joost #line: joost_dome_04b #codex: remnant
* [Keep your head down. #manner: mercy]
    Keep your head down, Joost. #speaker: hero #line: hero_joost_dome_03c
    I've been told. By Mira, mostly. #speaker: Joost #line: joost_dome_04c
- If they ever let me back on the band, I'll tell everyone. Every station that can hear. Somebody should. #speaker: Joost #line: joost_dome_06
-> DONE

=== lenz_door ===
Dr Achterberg's confined to the clinic. Committee's orders. You can go in. She can't come out. #speaker: Lenz #line: lenz_door_01
* [Do you agree with the order? #manner: ask]
    Do you agree with the order? #speaker: hero #line: hero_lenz_door_02a
    I agree she set my daughter's arm at three in the morning. I'm on the door anyway. #speaker: Lenz #line: lenz_door_03a
* [Thank you. #manner: plain]
    Thank you. #speaker: hero #line: hero_lenz_door_02b
    Don't thank me. I'm the one with the door. #speaker: Lenz #line: lenz_door_03b
- -> DONE

=== auditor_door ===
The archive is closed for audit, I'm afraid. Is there something you need from it? #speaker: Auditor #line: auditor_door_01
* [What are you auditing for? #manner: ask]
    What are you auditing for? #speaker: hero #line: hero_auditor_door_02a
    Records bearing on lane safety. It's very dull. You'd be bored in a minute. #speaker: Auditor #line: auditor_door_03a
* [Who do you work for? #manner: ask]
    Who do you work for? #speaker: hero #line: hero_auditor_door_02b
    The Lane Office. And the committee, of course. Everyone, really. #speaker: Auditor #line: auditor_door_03b
* [Nothing. #manner: plain]
    Nothing. #speaker: hero #line: hero_auditor_door_02c
- Then have a good evening, Captain. #speaker: Auditor #line: auditor_door_04
-> DONE

=== mira_clinic ===
I'm suspended, not dead. Come in. Sit down. You look like you've walked through something. #speaker: Mira #line: mira_clinic_01
{ hero_moment:
- "survivor":
    You've been the last one out of somewhere, haven't you? People who have stand like that. Near the door. #speaker: Mira #line: mira_clinic_02_survivor
- "hero-of-the-line":
    That's an old break in your left hand, set by someone in a hurry. A front line, I'd guess. #speaker: Mira #line: mira_clinic_02_line
- "hard-call":
    You've the look of somebody who made a decision for other people and kept the list. Don't tell me. I'm off duty. #speaker: Mira #line: mira_clinic_02_call
- else:
    You keep looking at the door as if someone's about to come through it. Somebody didn't, once. #speaker: Mira #line: mira_clinic_02_lost
}
* [Why were you suspended? #manner: ask]
    Why were you suspended? #speaker: hero #line: hero_mira_clinic_03a
    They wanted my family's papers on Pyre. Selene's notebooks. I said no. #speaker: Mira #line: mira_clinic_04a
    Selene Achterberg ran the observatory when the star died. She wrote its last years down by hand, because she didn't trust the drives. I'm not giving her handwriting to a man with gold on his sleeve. #speaker: Mira #line: mira_clinic_05a #codex: selene
* [What's in the notebooks? #manner: ask]
    What's in the notebooks? #speaker: hero #line: hero_mira_clinic_03b
    Pyre's light, every night for six years. It doesn't slope down the way a dying giant should. It steps. #speaker: Mira #line: mira_clinic_04b #codex: selene
    And her last entry. An hour before the end, the light rose. In steps. She wrote: as if something in the way were leaving in a hurry. #speaker: Mira #line: mira_clinic_05b
* [Who are you treating? #manner: mercy]
    Who are you treating, if you're suspended? #speaker: hero #line: hero_mira_clinic_03c
    The Orchard's people. They're on no list, so officially I'm treating nobody. The children's lungs are bad. Their air plant ran on light. #speaker: Mira #line: mira_clinic_04c
- They'll finish that audit and hand the rest to whoever docks next. I'm going in, committee or not. #speaker: Mira #line: mira_clinic_06
* [Then come with us. #manner: resolve]
    Then come with us. We're going in too. #speaker: hero #line: hero_mira_clinic_07a
    Good. You'll need a doctor before you need a reader. You'll get both. #speaker: Mira #line: mira_clinic_08a
* [It'll be a fight in there. #manner: mercy]
    It won't stay an audit for long in there. It'll be a fight. #speaker: hero #line: hero_mira_clinic_07b
    I'm a Warden, Captain. I held a line in the Cooperative's field service before I was a doctor. And I sew people up afterwards. It comes in handy. #speaker: Mira #line: mira_clinic_08b
- Lenz won't stop me. He's been hoping I'd walk out for a week. #speaker: Mira #line: mira_clinic_09
-> DONE

=== pick_second ===
Captain, one of us should keep the ship hot. If this goes wrong, we'll want to leave in a hurry. #speaker: Jo #line: jo_pick_01
And someone should be on Lantern's bands, listening for whoever's coming to collect. #speaker: Ren #line: ren_pick_02
* [Ren, you're with me. Jo, keep her ready. #manner: plain]
    Ren, you're with me. Jo, keep her ready to go. #speaker: hero #line: hero_pick_03a
    ~ second = "ren"
    Aye. I'll have her warm. Shout if you need a door opened from outside. #speaker: Jo #line: jo_pick_04a
* [Jo, you're with me. Ren, take the bands. #manner: plain]
    Jo, you're with me. Ren, take the bands. #speaker: hero #line: hero_pick_03b
    ~ second = "jo"
    I'll listen. If anything's coming down Pyre's lane, you'll know before it docks. #speaker: Ren #line: ren_pick_04b
- -> DONE

=== nell_choice ===
Doctor! The Banked ship's early. The committee says we're to be at the dock within the hour, all of us. #speaker: Nell #line: nell_choice_01
The speaker says there's work, and food, and a sun that works. They'll take us. Should we go? #speaker: Nell #line: nell_choice_02
Nobody they've carried has written home, Nell. Not one. I've asked. #speaker: Mira #line: mira_nell_choice_03
* [Come aboard Lantern. All of you. #manner: mercy]
    Don't go with them. Come aboard Lantern, all of you. #speaker: hero #line: hero_nell_choice_04a #xp: 50
    ~ unlisted = "aboard"
    ~ mira_approval += 1
    ~ jo_approval += 1
    Thirty-four of us? On your ship? #speaker: Nell #line: nell_choice_05a
    { second == "ren":
        Thirty-four. Dena's going to kill you. I'll clear the hold. #speaker: Jo #line: jo_nell_choice_06a
    - else:
        I'll clear the hold. The committee won't forget this, Captain. #speaker: Ren #line: ren_nell_choice_06a
    }
    Then we'll come. Thank you. #speaker: Nell #line: nell_choice_07a
* [I'll argue your case before the committee. #manner: resolve]
    Nobody's leaving. You're Cooperative citizens. I'll make the committee say so, now. #speaker: hero #line: hero_nell_choice_04b #xp: 50
    ~ unlisted = "listed"
    ~ mira_approval += 1
    ~ ren_approval += 1
    That will take time we don't have, Captain. The audit won't wait for a hearing. #speaker: Mira #line: mira_nell_choice_05b
    All right. We'll come with you. #speaker: Nell #line: nell_choice_06b
* [Go with the Banked. They'll keep you alive. #manner: plain]
    Go with them. They'll feed you, and they'll keep you alive. I can't promise you that. #speaker: hero #line: hero_nell_choice_04c #xp: 50
    ~ unlisted = "banked"
    ~ mira_approval -= 1
    Captain. #speaker: Mira #line: mira_nell_choice_05c
    Then we'll be at the dock. Thank you for being honest with us. #speaker: Nell #line: nell_choice_06c
- -> DONE

=== ruth_hearing ===
~ evidence = 2
{ have_curve:
    ~ evidence += 1
}
{ crate_opened:
    ~ evidence += 1
}
{ hero_origin == "steader":
    ~ evidence += 1
}
This is a hearing of the committee, recorded. Captain, you asked for it. Say what you came to say. #speaker: Ruth #line: ruth_hearing_01
Thirty-four people from Fomalhaut B Orchard are living in your overflow. They're Cooperative citizens, and they're on no list. #speaker: hero #line: hero_ruth_hearing_02
The committee is aware it has guests. Why should it list them now? #speaker: Ruth #line: ruth_hearing_03
Because our star is going out. Here. Our grow lamps logged it every hour for the trees. It steps. #speaker: Nell #line: nell_hearing_04
And their children's lungs are failing. I have the charts. I've treated them for five weeks while this committee pretended they weren't here. #speaker: Mira #line: mira_hearing_05
{ have_curve:
    Ross 128 fell in the same steps. Every three days. We have the readings aboard Lantern. #speaker: hero #line: hero_ruth_hearing_06
}
{ crate_opened:
    And the auditors who asked you to keep them quiet brought rifles onto this station in crates marked paper. #speaker: hero #line: hero_ruth_hearing_07
}
{ hero_origin == "steader":
    I grew up on a Cooperative farm, being told the Cooperative looks after its own. Was that true? #speaker: hero #line: hero_ruth_hearing_08
}
{ evidence >= 3:
    The committee lists them, as of now. They go to Tau Ceti on our next ship, at the committee's cost. #speaker: Ruth #line: ruth_hearing_09a
    And if the auditors brought rifles onto my station, that archive is opened tonight, on my order. Go in the front door, Captain. #speaker: Ruth #line: ruth_hearing_10a
    ~ ruth_won = true
- else:
    The committee lists them, as of now. They go to Tau Ceti on our next ship. #speaker: Ruth #line: ruth_hearing_09b
}
That took an hour we didn't have. I hope it was worth it. #speaker: Ruth #line: ruth_hearing_11
* [It was. #manner: resolve]
    It was. #speaker: hero #line: hero_ruth_hearing_12a
* [Thank you, Ruth. #manner: mercy]
    Thank you, Ruth. #speaker: hero #line: hero_ruth_hearing_12b
    Don't. I should have done it five weeks ago. #speaker: Ruth #line: ruth_hearing_13b
- -> DONE

=== esben_stacks ===
Teodor taught me to read those curves. Twelve years. I know what's coming better than anyone on this station. #speaker: Esben #line: esben_stacks_01
* [Then you know what the machines are doing. #manner: resolve]
    Then you know what the machines are doing. They're not keeping anything. They're taking it. #speaker: hero #line: hero_esben_stacks_02a
    Keeping, taking. You can't stop it either way. You can only decide whether people spend their last years afraid. #speaker: Esben #line: esben_stacks_03a
* [Why the rifles, Esben? #manner: ask]
    Why the rifles, Esben? #speaker: hero #line: hero_esben_stacks_02b
    Because people like you come. #speaker: Esben #line: esben_stacks_03b
- It's already running. Every curve that steps, gone in ten minutes. Then the rest goes to the Keeping. #speaker: Esben #line: esben_stacks_04
-> DONE

=== cost_choice ===
Captain? This is Joost, in the dome. They're cutting through the inner door. Five of them, and the machines. #speaker: Joost #line: joost_cost_01
I've got the band back. I'm sending Fomalhaut B's curve to every station that can hear. They want it stopped. #speaker: Joost #line: joost_cost_02
The core's burning, Captain. Every ring, one after the other. I can pull the cores by hand, but not with them shooting at me. #speaker: Linde #line: linde_cost_03
That's my brother. And that's everything my family ever watched. #speaker: Mira #line: mira_cost_04
I can't choose this, Captain. You'll have to. #speaker: Mira #line: mira_cost_05
* [We hold the archive. #manner: resolve]
    We hold the archive. Joost, get your people down and keep your heads low. #speaker: hero #line: hero_cost_06a #xp: 50
    ~ pyre_saved = "archive"
    Understood. Keep it safe, Mira. #speaker: Joost #line: joost_cost_07a
* [We go for the dome. #manner: mercy]
    We go for the dome. Teodor, pull what you can and get out. #speaker: hero #line: hero_cost_06b #xp: 50
    ~ pyre_saved = "dome"
    Go. Go! I'll pull what I can. #speaker: Linde #line: linde_cost_07b
- -> DONE

=== esben_core ===
Don't. I'm not armed. I never was. That was their part. #speaker: Esben #line: esben_core_01
* [Go to your ship. Tell them what happened here. #manner: mercy]
    Go to your ship, Esben. Tell them what happened here. #speaker: hero #line: hero_esben_core_02a
    ~ esben_fate = "freed"
    They'll know. They always know. #speaker: Esben #line: esben_core_03a
* [The committee can have you. #manner: resolve]
    The committee can have you. #speaker: hero #line: hero_esben_core_02b
    ~ esben_fate = "held"
    The committee. Yes. They'll vote on me. #speaker: Esben #line: esben_core_03b
- -> DONE

=== joost_saved ===
Mira! You came. You absolute idiot, you came. #speaker: Joost #line: joost_saved_01
The captain chose. Teodor's alone with the core. #speaker: Mira #line: mira_saved_02
I know. I heard him. Then let's make it count. The band's still up. #speaker: Joost #line: joost_saved_03
* [Send it. Everyone should hear. #manner: resolve]
    Send it, Joost. Everyone should hear. #speaker: hero #line: hero_joost_saved_04a
* [Are your people hurt? #manner: mercy]
    Are your people hurt? #speaker: hero #line: hero_joost_saved_04b
    Bruised. Alive. Because of you. #speaker: Joost #line: joost_saved_05b
- -> DONE

=== mira_reads ===
{ pyre_saved == "archive":
    Teodor's cores. A century of curves, and every older record of a dying star the Cooperative could find. #speaker: Mira #line: mira_reads_01a
- else:
    Selene's notebooks, and Teodor's biscuit tin. It isn't a century. It will have to do. #speaker: Mira #line: mira_reads_01b
}
Pyre first. Selene's numbers. Down, hold, down. For six years before it died. #speaker: Mira #line: mira_reads_02
{ have_curve:
    And your Ilya's curve from Ross 128. Every three days. #speaker: Mira #line: mira_reads_03
    Selene's steps came every three days too. A hundred and fifty years apart. #speaker: Mira #line: mira_reads_04
}
{ pyre_saved == "archive" || linde_won:
    Antares. The old records. It stepped down before it went dark. #speaker: Mira #line: mira_reads_05a #codex: antares
- else:
    I flew past Antares, thirty years ago, with Sorrel. I took readings nobody wanted. It stepped, before it went dark. I remember every one. #speaker: Linde #line: linde_reads_05b #codex: antares
}
{ pyre_saved == "archive" && unlisted == "listed":
    The newest records are gone. The wipe reached them while we were at the hearing. Whatever they showed, we'll never see. #speaker: Mira #line: mira_reads_06
}
{ pyre_saved == "archive" && unlisted != "listed":
    ~ next_star_found = true
    And this. From last month. YZ Ceti. #speaker: Mira #line: mira_reads_07 #codex: yz_ceti
    A red dwarf, twelve light-years from the Sun. A light-year and a half from Tau Ceti. It's started to step. #speaker: Mira #line: mira_reads_08
}
There's one more thing. The oldest audit. Twenty years ago. #speaker: Linde #line: linde_reads_09
{ pyre_saved == "archive":
    It's in the log. Signed, and spoken. #speaker: Mira #line: mira_reads_10a
- else:
    I recorded her note that night, on my own. I never knew why. Now I do. #speaker: Linde #line: linde_reads_10b
}
Audit of the Pyre Remnant archive, closed. Nothing of note. Lightkeeper A. Varro. #speaker: Varro #line: varro_audit_01 #codex: lightkeeper
One thousand four hundred and twelve records taken for review. None returned. #speaker: Linde #line: linde_reads_11
Ansa Varro. She was kind to me. She asked about my work. That's the part I can't forgive. #speaker: Linde #line: linde_reads_12
* [Varro. The name on Ren's file. #manner: plain]
    Varro. The same name as on the file from Ross 128. #speaker: hero #line: hero_mira_reads_13a
    Then it's all one thing. Ross 128, Fomalhaut B, Pyre, Antares. And one name on all of it. #speaker: Mira #line: mira_reads_14a
* [Why didn't you say anything? #manner: ask]
    Why didn't you say anything, Teodor? #speaker: hero #line: hero_mira_reads_13b
    Because nobody shouted. I'm saying it now. #speaker: Linde #line: linde_reads_14b
- -> DONE

=== quaye_goodbye ===
Rifles. In the archive. On this station. #speaker: Quaye #line: quaye_goodbye_01
{ quaye_argued:
    You told me Ross 128 wasn't dying. I've thought about nothing else since. I'll ask her. I'll ask her myself. #speaker: Quaye #line: quaye_goodbye_02a
- else:
    They told me it was paperwork. I believed them. That's on me. #speaker: Quaye #line: quaye_goodbye_02b
}
{ unlisted == "banked":
    I'll look after the Orchard's people. Whatever else I'm wrong about, I'll do that. #speaker: Quaye #line: quaye_goodbye_03
}
* [Then stay. #manner: mercy]
    Then stay. Tell them here what you've seen. #speaker: hero #line: hero_quaye_goodbye_04a
    And be the man who brought the Banked to Pyre? No. I'll go and find out what I've been part of. #speaker: Quaye #line: quaye_goodbye_05a
* [Ask her. Then tell me what she says. #manner: resolve]
    Ask her. Then tell me what she says. #speaker: hero #line: hero_quaye_goodbye_04b
    If they let me. I'm not sure they will. #speaker: Quaye #line: quaye_goodbye_05b
- Goodbye, Captain. #speaker: Quaye #line: quaye_goodbye_06
-> DONE

=== ruth_end ===
{ pyre_saved == "archive":
    The archive's whole. The committee met an hour ago. We're not staying out of it any more. #speaker: Ruth #line: ruth_end_01a
    There's a berth for Lantern here whenever you want one. And the committee's thanks, for what they're worth. They're worth six hundred credits. #speaker: Ruth #line: ruth_end_02a
- else:
    Every station within thirty light-years has heard Joost by now. The committee's been called liars on four bands. #speaker: Ruth #line: ruth_end_01b
    I'd have done what you did. The committee won't say so. The dome's crew took a collection, and I added the committee's fee. Six hundred. #speaker: Ruth #line: ruth_end_02b
}
{ unlisted == "aboard":
    And you took thirty-four of our citizens off this station without a word to anyone. I'll say this once: thank you. The committee will say a great deal more, and none of it kind. #speaker: Ruth #line: ruth_end_03
}
* [Look after Teodor. #manner: mercy]
    Look after Teodor. #speaker: hero #line: hero_ruth_end_04a
    We will. Better than we have. #speaker: Ruth #line: ruth_end_05a
* [Keep the archive open. #manner: resolve]
    Keep the archive open, Ruth. #speaker: hero #line: hero_ruth_end_04b
    It stays open. I'll stand in the door myself. #speaker: Ruth #line: ruth_end_05b
- -> DONE

=== linde_sorrel ===
Teo. It's me. #speaker: Sorrel #line: sorrel_linde_01
Sorrel. You look old. #speaker: Linde #line: linde_sorrel_02
I took the money, Teo. #speaker: Sorrel #line: sorrel_linde_03
We knew you would. You were the only one of us with children. #speaker: Linde #line: linde_sorrel_04
They're grown. I've come to say it out loud, what we saw. Somebody should, before we're both gone. #speaker: Sorrel #line: sorrel_linde_05
Then we'll say it together. #speaker: Linde #line: linde_sorrel_06
-> DONE

=== mira_joins ===
{ joost_lost:
    Joost would have told you to save the archive. He'd have been right. I'll never forgive you for being right. #speaker: Mira #line: mira_joins_01a
    I'm coming with you anyway. Somebody has to read the rest of this. #speaker: Mira #line: mira_joins_02a
- else:
    You saved my brother and lost my family's whole life's work. I'll thank you properly when I can stand to. #speaker: Mira #line: mira_joins_01b
    Joost will keep the watch. I'm coming with you. Somebody has to read what's left. #speaker: Mira #line: mira_joins_02b
}
* [Welcome aboard, Doctor. #manner: plain]
    Welcome aboard, Doctor. #speaker: hero #line: hero_mira_joins_03a
    Show me the med bay. If it's anything like the rest of your ship, I'll have work to do. #speaker: Mira #line: mira_joins_04a
* [I'm sorry. #manner: mercy]
    I'm sorry, Mira. #speaker: hero #line: hero_mira_joins_03b
    I know. So am I. Show me the med bay. #speaker: Mira #line: mira_joins_04b
- -> DONE

// ─── Aboard Lantern, after Pyre Remnant ─────────────────────────────────────

=== mira_aboard ===
It's a good med bay. Somebody stocked it for a long voyage and then never got sick. #speaker: Mira #line: mira_aboard_01
Selene's last entry keeps going round my head. Something left Pyre an hour before it died. Where does something like that go? #speaker: Mira #line: mira_aboard_02
* [We'll find out. #manner: resolve]
    We'll find out. #speaker: hero #line: hero_mira_aboard_03a
    I believe you. That's new for me. #speaker: Mira #line: mira_aboard_04a
* [What do you think it was? #manner: ask]
    What do you think it was? #speaker: hero #line: hero_mira_aboard_03b
    The same thing that's round Ross 128, and round Fomalhaut B. I think it knew the star was about to go, and it left. #speaker: Mira #line: mira_aboard_04b
    Which means it can tell. Which means it chooses. #speaker: Mira #line: mira_aboard_05b
- -> DONE

=== ren_after ===
{ second == "ren":
    The audit's list had my report on it, Captain. I sent it to Pyre a year ago for a second opinion and never heard back. Now I know why. #speaker: Ren #line: ren_after_01a
- else:
    Mira says the audit's list ran to a thousand pages. Somewhere in it, I'd bet, is the report I sent to Pyre a year ago. #speaker: Ren #line: ren_after_01b
}
And the letter that started it was signed by Sallow. The deputy who reprimanded me. #speaker: Ren #line: ren_after_02
{ ren_sent_file:
    I sent him our file. He knew we were coming because I told him. I won't make that mistake again. #speaker: Ren #line: ren_after_03
}
* [Then we find Sallow. #manner: resolve]
    Then we find Sallow. #speaker: hero #line: hero_ren_after_04a
    ~ ren_approval += 1
    Yes. When we can. Carefully. #speaker: Ren #line: ren_after_05a
* [It wasn't your fault. #manner: mercy]
    None of this was your fault, Ren. #speaker: hero #line: hero_ren_after_04b
    No. But it's mine to finish. #speaker: Ren #line: ren_after_05b
- -> DONE

=== jo_after ===
{ second == "jo":
    Those rings on the engineer's motes. I've seen them before, Captain. On the parts my crew sold off that wreck. #speaker: Jo #line: jo_after_01a
    Whoever bought those parts made the Banked's leashes out of them. #speaker: Jo #line: jo_after_02a
- else:
    Ren says the Banked had their motes on leashes. Control rings. My crew sold parts off a wreck that looked just like the ones she described. #speaker: Jo #line: jo_after_01b
}
* [Then your crew's buyer was the Banked. #manner: plain]
    Then your crew's buyer was the Banked. #speaker: hero #line: hero_jo_after_03a
    Or someone selling to them. Either way, three of mine went to meet them and didn't come back. #speaker: Jo #line: jo_after_04a
* [We'll find them, Jo. #manner: mercy]
    We'll find them, Jo. #speaker: hero #line: hero_jo_after_03b
    ~ jo_approval += 1
    I know. I just don't know what we'll find. #speaker: Jo #line: jo_after_04b
- -> DONE

=== dena_after ===
{ unlisted == "aboard":
    Thirty-four more. I'll need a bigger pot, and you'll need to find them a planet sooner than you thought. #speaker: Dena #line: dena_after_01a
    Three weeks of stores, Captain. Maybe less. The children eat like growers. #speaker: Dena #line: dena_after_02a
- else:
    The station sold us flour, and a woman called Tilly sold us cardamom, at a price I won't repeat. I nearly kissed her. #speaker: Dena #line: dena_after_01b
}
* [We'll make it last. #manner: resolve]
    We'll make it last. #speaker: hero #line: hero_dena_after_03a
    I know. I'll see to the making. #speaker: Dena #line: dena_after_04a
* [How are you, Dena? #manner: mercy]
    And how are you, Dena? #speaker: hero #line: hero_dena_after_03b
    Busy. Busy is good. Ask me when it stops. #speaker: Dena #line: dena_after_04b
- -> DONE

=== pell_after ===
{ pyre_saved == "dome":
    Captain, it's on every band. Pyre Remnant's telling everyone. Stations are answering. Some of them have been watching their own stars. #speaker: Pell #line: pell_after_01a
- else:
    I heard the dome on the band, Captain. I heard it stop. I keep hearing it. #speaker: Pell #line: pell_after_01b
}
* [Keep listening. #manner: resolve]
    Keep listening, Pell. #speaker: hero #line: hero_pell_after_02a
    Always. #speaker: Pell #line: pell_after_03a
* [Get some rest. #manner: mercy]
    Get some rest, Pell. #speaker: hero #line: hero_pell_after_02b
    After this watch. Maybe the next. #speaker: Pell #line: pell_after_03b
- -> DONE

=== sorrel_after ===
{ sorrel_named_linde:
    Teo's going to write it all down, Captain. The halo, the money, all of it. Thirty years late. #speaker: Sorrel #line: sorrel_after_01a
- else:
    Teodor Linde went to count stars at an observatory, after Antares. I never asked which. I wonder if he's still counting. #speaker: Sorrel #line: sorrel_after_01b
}
-> DONE

=== ilya_after ===
{ have_curve:
    Captain! Dr Achterberg showed me Selene's numbers. Every three days. The same as mine. A hundred and fifty years apart. #speaker: Ilya #line: ilya_after_01a
- else:
    Captain. Dr Achterberg says Selene's steps came every three days. I think mine did too. I wish I had my readings. #speaker: Ilya #line: ilya_after_01b
}
It's not a star dying, is it? It's something keeping time. #speaker: Ilya #line: ilya_after_02
-> DONE

=== nell_aboard ===
It's warm. It's lit. The children found the galley. Dena gave them bread and told them off, in that order. #speaker: Nell #line: nell_aboard_01
* [You're welcome here. #manner: mercy]
    You're welcome here, Nell. All of you. #speaker: hero #line: hero_nell_aboard_02a
    I know. That's the strange part. #speaker: Nell #line: nell_aboard_03a
* [We'll find you somewhere. #manner: resolve]
    We'll find you somewhere with a sun that works. #speaker: hero #line: hero_nell_aboard_02b
    Find us somewhere with a sun that stays. #speaker: Nell #line: nell_aboard_03b
- -> DONE

// ─── Pyre Remnant: things to look at ────────────────────────────────────────

=== look_crates ===
'Archive supplies: paper and binding.' Forty kilos a crate. #speaker: hero #line: hero_look_crates_01
That's a lot of binding. #speaker: hero #line: hero_look_crates_02 #xp: 25 #why: The auditors' crates
-> DONE

=== look_berth ===
Lantern, at berth four. From out here she looks smaller than she feels. #speaker: hero #line: hero_look_berth_01
-> DONE

=== look_remnant ===
Pyre. What's left of it: a red haze over half the sky, two light-years out and still going. #speaker: hero #line: hero_look_remnant_01 #codex: remnant #xp: 25 #why: The remnant
The black hole's out there somewhere. There's nothing to see. #speaker: hero #line: hero_look_remnant_02
-> DONE

=== look_fomalhaut ===
Fomalhaut, the bright one. And the orange one just beside it, faint. Fomalhaut B. #speaker: hero #line: hero_look_fomalhaut_01 #codex: fomalhaut
Someone's scratched a mark on the glass beside it. Then another, a little lower. Then another. #speaker: hero #line: hero_look_fomalhaut_02 #xp: 25 #why: Fomalhaut's companion
-> DONE

=== look_notice ===
'The archive is closed for audit, by order of the committee.' #speaker: hero #line: hero_look_notice_01
Under it: 'Lost: grey cat, answers to Kepler.' And: 'The dome's star night is cancelled.' #speaker: hero #line: hero_look_notice_02 #xp: 25 #why: The noticeboard
-> DONE

=== look_drawing ===
A child's drawing of the sky at home. A small orange sun, and a bright white star beside it. #speaker: hero #line: hero_look_drawing_01 #codex: orchard
In every drawing the star's bigger. It isn't getting brighter. Their sun's getting dimmer. #speaker: hero #line: hero_look_drawing_02 #xp: 25 #why: The children's drawing
-> DONE

=== look_charts ===
Thirty-four patients who don't exist. Lungs, mostly. 'Air plant failure: it ran on light.' In Mira's hand, every one. #speaker: hero #line: hero_look_charts_01
-> DONE

=== look_request ===
The Lane Office's letter: 'a review of all records bearing on lane safety.' Signed, Deputy Director M. Sallow. #speaker: hero #line: hero_look_request_01 #xp: 25 #why: The Lane Office's letter
{ second != "jo":
    Sallow. He signed my reprimand, a year ago. #speaker: Ren #line: ren_look_request_02
}
{ hero_origin == "ringborn":
    'Requested', in the Lane Office's voice, means required. I grew up reading letters like this. #speaker: hero #line: hero_look_request_03
}
-> DONE
