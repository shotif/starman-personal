// The playable slice (docs/design/SLICE.md): Last light at Ross 128. Fiction, all of it, but the
// star and its planet. The main flow, `slice`, drives the game with `>>>` commands (src/game/director.ts);
// conversations are the knots below it, run in a flow of their own; a thing the hero can look at
// (`>>> look`) runs a knot of remarks, said in the world. A line's `#codex:` tag opens that entry of
// the codex (src/game/codex.ts) when it is said. Every spoken line carries its
// speaker and an id for its voice (D-23); every choice its manner (D-12). People call the hero
// "Officer" and never by name, so every line can be voiced.

VAR hero_name = ""
VAR hero_class = ""
VAR hero_origin = ""
VAR hero_moment = ""
// Commands: `start` places someone only when a saved game resumes at that checkpoint; `place`
// always does. The event that ended the last wait is in `event`.
VAR event = ""
VAR ren_approval = 0
VAR jo_approval = 0
VAR met_ilya = false
VAR met_dena = false
VAR met_sorrel = false
VAR asked_files = false
VAR took_mast = false
VAR merrow_warned = false
VAR ilya_lost = false
VAR first_lead = ""
VAR saw_curve = false
VAR read_board = false
VAR ilya_brings_curve = false
VAR have_curve = false

-> slice.night_shift

=== slice ===
= night_shift
>>> checkpoint night_shift
>>> music night
>>> sky clear
>>> lights on
>>> start hero hero_start
>>> place ren ren
>>> place dena dena
>>> place sorrel sorrel
>>> place ilya ilya
>>> hide pell
>>> hide hale
>>> hide jo
>>> close range_door
>>> lock east_door
>>> lock concourse_door
>>> lock service_door
>>> lock airlock
>>> lock hangar_gate
>>> open clinic_door
>>> caption Ross 128 b · Calder Station · 02:40, station time
>>> hint move
>>> objective Find Ren in the lounge
>>> marker ren
>>> talk ren ren_night
>>> talk dena dena_night
>>> talk sorrel sorrel_night
>>> talk ilya ilya_night
>>> look star window look_star Look at the star
>>> look curve curve look_curve Look at the readings on the table
>>> look board board look_board Read the supply board
>>> look locker locker look_locker Open your locker
>>> wait talked:ren_night
>>> talk ren
>>> follow ren
-> range

= range
>>> checkpoint range
>>> music night
>>> start hero drill
>>> start ren drill
>>> follow ren
>>> lights on
>>> open range_door
>>> objective Run the drill on the range
>>> marker drill
>>> wait enter:range
>>> hint cover
Three drones. Use the crates; that's what they're for. #speaker: Ren #line: ren_drill_01
>>> hint aim
>>> drill
Good. Now use me. Open your orders and send me at one; I'm quicker when I'm told. #speaker: Ren #line: ren_drill_orders
>>> hint orders
>>> drill
That's how we'll work. Last round: your own kit. Show me what you trained for. #speaker: Ren #line: ren_drill_powers
>>> hint powers
>>> drill
Clean. Hale's going to want a report on that star before— #speaker: Ren #line: ren_drill_02
>>> lights out
>>> sky swarm
>>> music tension
>>> wait 2
All staff to Control. Now. This is not a drill. #speaker: Hale #line: hale_call_01
That's the chief. #speaker: Ren #line: ren_drill_03
-> to_control

= to_control
>>> checkpoint to_control
>>> music tension
>>> sky swarm
>>> start hero drill
>>> start ren drill
>>> follow ren
>>> lights out
>>> unlock east_door
>>> open east_door
>>> unlock concourse_door
>>> close concourse_door
>>> objective Get to Control
>>> marker control
>>> forget curve
>>> forget board
>>> forget locker
>>> look star window look_star_dark Look at the star
>>> talk dena dena_dark
>>> talk sorrel sorrel_dark
>>> talk ilya ilya_dark
>>> wait enter:spine
Look at the star. #speaker: Ren #line: ren_spine_01
Those aren't stars round it. They're moving. #speaker: Ren #line: ren_spine_02
>>> wait enter:control
-> control

= control
>>> checkpoint control
>>> music tension
>>> sky swarm
>>> start hero control
>>> start ren control
>>> follow ren
>>> lights out
>>> show hale
>>> place hale hale
>>> show pell
>>> place pell pell
>>> scene hale hale_control
>>> forget star
>>> look screen screen look_screen Look at the main screen
>>> place dena clinic_dena
>>> place sorrel clinic_sorrel
>>> place ilya clinic_ilya
>>> talk dena
>>> walk pell booth
>>> talk sorrel
>>> talk ilya
>>> open concourse_door
>>> objective Get through the concourse
>>> marker concourse
>>> hint orders
-> concourse

= concourse
>>> checkpoint concourse
>>> music tension
>>> sky swarm
>>> start hero concourse
>>> start ren concourse
>>> follow ren
>>> lights out
>>> place pell booth
>>> place dena clinic_dena
>>> place sorrel clinic_sorrel
>>> place ilya clinic_ilya
>>> open concourse_door
>>> wait enter:concourse
>>> forget screen
Contacts! High, by the vents! #speaker: Ren #line: ren_concourse_01
>>> hint powers
>>> encounter concourse_1
That's the last of them. For now. #speaker: Ren #line: ren_concourse_02
>>> objective Talk to Pell at the comms booth
>>> marker booth
>>> talk pell pell_gate
>>> wait talked:pell_gate
>>> talk pell
{ took_mast:
    -> mast
- else:
    -> escort
}

= mast
>>> checkpoint mast
>>> music tension
>>> sky swarm
>>> start hero booth
>>> start ren booth
>>> follow ren
>>> lights out
>>> place pell clinic_pell
>>> place dena clinic_dena
>>> place sorrel clinic_sorrel
>>> place ilya clinic_ilya
>>> unlock service_door
>>> open service_door
>>> unlock airlock
>>> open airlock
>>> objective Get out to the relay mast
>>> marker catwalk
>>> wait enter:catwalk
Out in the open. Stay low, use what cover there is. #speaker: Ren #line: ren_catwalk_01
>>> encounter catwalk
>>> objective Turn the relay by hand
>>> marker relay
>>> use relay relay Turn the relay
>>> wait used:relay
Signal's going out. Merrow, Merrow, this is Calder Station. Turn back. Do not come in. #speaker: Pell #line: pell_relay_01
They've got it. They're answering. Officer, they've got it! #speaker: Pell #line: pell_relay_02
>>> wait 2
Something's at the clinic door. It's at the— Officer, they're inside! #speaker: Pell #line: pell_relay_03
>>> down ilya
~ ilya_lost = true
~ merrow_warned = true
>>> objective Get back to the clinic
>>> marker clinic
>>> wait enter:concourse
>>> encounter clinic
>>> objective See to the night shift
>>> marker clinic
>>> scene dena dena_loss
-> gate

= escort
>>> checkpoint escort
>>> music tension
>>> sky swarm
>>> start hero booth
>>> start ren booth
>>> follow ren
>>> lights out
>>> place pell clinic_pell
>>> place dena clinic_dena
>>> place sorrel clinic_sorrel
>>> place ilya clinic_ilya
>>> objective Bring the night shift from the clinic
>>> marker clinic
>>> wait enter:clinic
>>> scene dena dena_escort
>>> follow dena
>>> follow sorrel
>>> follow ilya
>>> follow pell
>>> objective Get them to the hangar gate
>>> marker hangar_gate
>>> wait enter:concourse
Movement! Get them down! #speaker: Ren #line: ren_escort_01
>>> encounter escort
I tried the Merrow. Nothing. They'll be in it before they hear us. #speaker: Pell #line: pell_escort_01
-> gate

= gate
>>> checkpoint gate
>>> music tension
>>> sky swarm
>>> start hero hangar_gate
>>> start ren hangar_gate
>>> follow ren
>>> lights out
{ ilya_lost:
    >>> down ilya
}
>>> follow dena
>>> follow sorrel
>>> follow pell
{ not ilya_lost:
    >>> follow ilya
}
Gate's open. Don't wait for me. Control out. #speaker: Hale #line: hale_gate_01
>>> unlock hangar_gate
>>> open hangar_gate
>>> objective Into the hangar
>>> marker hangar
>>> wait enter:hangar
-> hangar

= hangar
>>> checkpoint hangar
>>> music tension
>>> sky swarm
>>> start hero hangar
>>> start ren hangar
>>> follow ren
>>> lights out
>>> show jo
>>> place jo jo
>>> scene jo jo_meet
>>> join jo
>>> walk dena boarding
>>> walk sorrel boarding
>>> walk pell boarding
{ not ilya_lost:
    >>> walk ilya boarding
}
>>> objective Hold the hangar while they board
>>> marker none
Here they come. Through the roof! #speaker: Jo #line: jo_hangar_01
>>> encounter hangar_1
That big one's making more of them. Kill it and they stop. #speaker: Jo #line: jo_hangar_02
>>> encounter hangar_2
That's everyone aboard. Come on, before the next lot. #speaker: Jo #line: jo_hangar_03
>>> objective Board the surveyor
>>> marker ramp
>>> wait enter:ramp
>>> scene jo jo_name
>>> liftoff
-> bridge

= bridge
>>> checkpoint bridge
>>> music ending
>>> sky swarm space
>>> lights on
>>> place hero bridge_hero
>>> place ren bridge_ren
>>> place jo bridge_jo
>>> stay ren
>>> stay jo
>>> place dena hold_dena
>>> place sorrel hold_sorrel
>>> place pell hold_pell
{ ilya_lost:
    >>> hide ilya
- else:
    >>> place ilya hold_ilya
}
>>> marker none
{ merrow_warned:
    Calder, this is the Merrow. We see it. We've turned back. Whoever turned that relay: thank you. #speaker: Merrow #line: merrow_01
- else:
    Nothing on the band from the Merrow. Nothing at all. #speaker: Jo #line: jo_merrow_silent
}
Captain. They're all in the hold. See them first; the rest can wait a minute. #speaker: Ren #line: ren_bridge_hold
>>> objective See to the survivors in the hold
>>> marker hold_dena
>>> talk dena dena_ship
>>> talk sorrel sorrel_ship
>>> talk pell pell_ship
{ not ilya_lost:
    >>> talk ilya ilya_ship
}
>>> wait talked:dena_ship
>>> objective Talk to your crew
>>> marker ren
>>> talk ren ren_bridge
>>> talk jo jo_bridge
>>> wait talked:ren_bridge
>>> wait talked:jo_bridge
>>> end
-> END

// ─── Conversations ──────────────────────────────────────────────────────────

=== ren_night ===
You keep looking at that star as if it owes you money. #speaker: Ren #line: ren_night_01
* [Does it? #manner: ask]
    Does it? #speaker: hero #line: hero_ren_night_02a
    Six per cent, on the chief's numbers. It's dimmer than the charts by six per cent. Stars that size don't do that. #speaker: Ren #line: ren_night_03a #codex: ross128
* [Just checking it's still there. #manner: plain]
    Just checking it's still there. #speaker: hero #line: hero_ren_night_02b
    It's there. Less of it than the charts say. Six per cent less, on the chief's numbers. #speaker: Ren #line: ren_night_03b #codex: ross128
- -> origin

= origin
{ hero_origin:
- "laneborn":
    You stand like someone raised on a hauler. Hand on the rail even when there isn't one. #speaker: Ren #line: ren_origin_laneborn
- "den-raised":
    You checked the exits before you checked me. Wake habit. I won't ask. #speaker: Ren #line: ren_origin_den
- "ringborn":
    Halcyon, isn't it? You stand as if the floor's been paid for. #speaker: Ren #line: ren_origin_ring
- "steader":
    Farm hands. You fix things before anyone asks. Cooperative, I'd guess. #speaker: Ren #line: ren_origin_steader
- "beltborn":
    Belt crew. You flinch at open doors, the way people do who've watched a seal go. #speaker: Ren #line: ren_origin_belt
- else:
    You talk like someone from past the old frontier. The Duskfolk side of it. #speaker: Ren #line: ren_origin_border
}
-> measured

= measured
* [Who measured it? #manner: ask]
    Who measured it? #speaker: hero #line: hero_ren_night_04a
    Ilya. The young one on the sofa. He's measured it every night for a month, and every night it's less. #speaker: Ren #line: ren_night_05a
* [Six per cent is a rounding error. #manner: resolve]
    Six per cent is a rounding error. #speaker: hero #line: hero_ren_night_04b
    Not for a red dwarf. They burn steady for a trillion years. This one's found somewhere to be. #speaker: Ren #line: ren_night_05b
- I reported it a year ago. Through channels. I was told to stop wasting the Authority's bandwidth. #speaker: Ren #line: ren_night_06 #codex: authority
* [Then we'll make them listen. #manner: resolve]
    Then we'll make them listen. #speaker: hero #line: hero_ren_night_07a
    ~ ren_approval += 1
    I like you better every shift. #speaker: Ren #line: ren_night_08a
* [That must have hurt. #manner: mercy]
    That must have hurt. #speaker: hero #line: hero_ren_night_07b
    ~ ren_approval += 1
    It made me careful. That's not the same thing. #speaker: Ren #line: ren_night_08b
* [Maybe they were right. #manner: plain]
    Maybe they were right. #speaker: hero #line: hero_ren_night_07c
    Maybe. You'd be surprised how often I hope so. #speaker: Ren #line: ren_night_08c
- -> drill_talk

= drill_talk
{ hero_class:
- "warden":
    The chief wants us sharp tonight. You'll keep me alive; I'll keep you awake. #speaker: Ren #line: ren_class_warden
- "rigger":
    The chief wants us sharp tonight. Bring your drones; they're better company than the drill. #speaker: Ren #line: ren_class_rigger
- "fieldwright":
    The chief wants us sharp tonight. Mind the furniture when your implants warm up. #speaker: Ren #line: ren_class_field
- "striker":
    The chief wants us sharp tonight. Try not to hop through the targets this time. #speaker: Ren #line: ren_class_striker
- "shade":
    The chief wants us sharp tonight. I'll pretend I can see you coming. #speaker: Ren #line: ren_class_shade
- else:
    The chief wants us sharp tonight. You hold a pistol as if it had been issued to you young. #speaker: Ren #line: ren_class_arms
}
Range. Three drones. Then we write the chief a report she'll actually read. #speaker: Ren #line: ren_night_09
-> DONE

=== dena_night ===
~ met_dena = true
Kettle's on, if you're staying up with the rest of us owls. #speaker: Dena #line: dena_night_01
* [What's keeping everyone up? #manner: ask]
    What's keeping everyone up? #speaker: hero #line: hero_dena_night_02a
    The star. Nobody says it, but the light's gone redder. Like the bottom of a glass of tea. #speaker: Dena #line: dena_night_03a
* [I'll take a cup. #manner: mercy]
    I'll take a cup. #speaker: hero #line: hero_dena_night_02b
    Good. People who drink tea at three in the morning are people I can trust. #speaker: Dena #line: dena_night_03b
- Twelve years I've cooked here. Supply runs every forty days. The next is the Merrow, on Thursday. #speaker: Dena #line: dena_night_04 #codex: calder
-> DONE

=== sorrel_night ===
~ met_sorrel = true
Officer. Can't sleep either, or are you working? #speaker: Sorrel #line: sorrel_night_01
* [Working. What are you fixing? #manner: ask]
    Working. What are you fixing? #speaker: hero #line: hero_sorrel_night_02a
    The beacon's spare regulator. Nobody's used it in thirty years. I like to keep it ready. #speaker: Sorrel #line: sorrel_night_03a
* [Neither. Just walking. #manner: plain]
    Neither. Just walking. #speaker: hero #line: hero_sorrel_night_02b
    Walking's good. Station's small enough you can walk all of it twice before breakfast. #speaker: Sorrel #line: sorrel_night_03b
- I was on the Antares run when I was young. Before it went dark. #speaker: Sorrel #line: sorrel_night_04 #codex: antares
* [What was it like, before? #manner: ask]
    What was it like, before? #speaker: hero #line: hero_sorrel_night_05a
    Red, and huge, and you felt it on your face through the glass. Then one year it was a smudge. Then nothing. #speaker: Sorrel #line: sorrel_night_06a
    They told us it was natural. Old stars die. I believed them, mostly. #speaker: Sorrel #line: sorrel_night_07a
* [Long time ago. #manner: plain]
    Long time ago. #speaker: hero #line: hero_sorrel_night_05b
    Not long enough. #speaker: Sorrel #line: sorrel_night_06b
- -> DONE

=== ilya_night ===
~ met_ilya = true
Oh. Hello. Sorry, I was miles away. Eleven light-years, really. #speaker: Ilya #line: ilya_night_01
* [What are you working on? #manner: ask]
    What are you working on? #speaker: hero #line: hero_ilya_night_02a
    The star's light curve. Every night for thirty-one nights. It goes down in steps, not a slope. Steps. #speaker: Ilya #line: ilya_night_03a
    Something is in front of it, and it's getting bigger. I haven't told anyone that part. #speaker: Ilya #line: ilya_night_04a
    * * [Tell the chief. Tonight. #manner: resolve]
        Tell the chief. Tonight. #speaker: hero #line: hero_ilya_night_05a
        Tonight. Right. Yes. If you think it's not stupid. #speaker: Ilya #line: ilya_night_06a
    * * [It's not stupid. #manner: mercy]
        It's not stupid. #speaker: hero #line: hero_ilya_night_05b
        Thank you. Really. Nobody here thinks a surveyor knows anything. #speaker: Ilya #line: ilya_night_06b
* [Get some sleep. #manner: plain]
    Get some sleep. #speaker: hero #line: hero_ilya_night_02b
    I will. After this. After the next reading. You know how it is. #speaker: Ilya #line: ilya_night_03b
- -> DONE

=== dena_dark ===
Officer, what's happening? The lights, and the star, it's got a ring round it! #speaker: Dena #line: dena_dark_01
* [Stay here. Keep everyone together. #manner: resolve]
    Stay here. Keep everyone together. #speaker: hero #line: hero_dena_dark_02a
    Together. Right. I can do together. #speaker: Dena #line: dena_dark_03a
* [I don't know yet. I'll find out. #manner: plain]
    I don't know yet. I'll find out. #speaker: hero #line: hero_dena_dark_02b
    Find out quickly. Please. #speaker: Dena #line: dena_dark_03b
- -> DONE

=== hale_control ===
Officer. Lane officer. Good. Look at the main screen. #speaker: Hale #line: hale_control_01
That's the star, and that's the ring round it. Machines. Thousands. The sensors started counting and gave up. #speaker: Hale #line: hale_control_02 #codex: swarm
And these came out of it ten minutes ago, and they're not slowing down. #speaker: Hale #line: hale_control_03
* [You've seen this before. #manner: ask]
    You've seen this before. #speaker: hero #line: hero_hale_control_04a
    ~ asked_files = true
    In a file. Sealed, Lightkeeper's eyes only. Antares, thirty years ago, before it went dark. #speaker: Hale #line: hale_control_05a #codex: antares
    I was an aide then. I wasn't meant to read it. I've wished every day since that I hadn't. #speaker: Hale #line: hale_control_06a
* [What do you need from us? #manner: resolve]
    What do you need from us? #speaker: hero #line: hero_hale_control_04b
    Everyone off this rock. I'll come to how. #speaker: Hale #line: hale_control_05b
- One ship can fly: the surveyor in the hangar. Her captain's in the settlement, and the settlement went quiet an hour ago. #speaker: Hale #line: hale_control_07
Pell will open the hangar gate from the comms booth in the concourse. The night shift goes to the clinic by the back way and waits for you. #speaker: Hale #line: hale_control_08
* [And you? #manner: mercy]
    And you? #speaker: hero #line: hero_hale_control_09a
    Someone keeps the doors working. That's me. Don't argue, Officer, I'm older than you and I outrank you. #speaker: Hale #line: hale_control_10a
* [Understood. #manner: plain]
    Understood. #speaker: hero #line: hero_hale_control_09b
    Good. #speaker: Hale #line: hale_control_10b
- The concourse is between you and the hangar, and so are they. Go. #speaker: Hale #line: hale_control_11
{ asked_files:
    Chief. The files. Whose eyes were they for? #speaker: Ren #line: ren_hale_files_01
    Get out alive, Lane Officer, and I'll tell you. #speaker: Hale #line: hale_files_02
}
-> DONE

=== pell_gate ===
Officer! The gate's coming, but the motors are on emergency power. Four minutes, maybe five. #speaker: Pell #line: pell_gate_01
And there's something else. The Merrow, the supply hauler. She's three hours out, and she'll fly straight into that. #speaker: Pell #line: pell_gate_02
The relay's dead. But the mast has a manual turn, out past the airlock. Someone could get out there and point it by hand. #speaker: Pell #line: pell_gate_03
Can't send the night shift on their own, though. Somebody has to bring them through. #speaker: Pell #line: pell_gate_04
-> ask

= ask
* [How many on the Merrow? #manner: ask]
    How many on the Merrow? #speaker: hero #line: hero_pell_gate_05a
    Crew of nine. And she'd be carrying forty days' supplies for the settlement. #speaker: Pell #line: pell_gate_06a #codex: merrow
    -> ask
* [What do you think, Ren? #manner: ask]
    What do you think, Ren? #speaker: hero #line: hero_pell_gate_05b
    I think whatever we choose, someone pays for it. Choose the one you can carry. #speaker: Ren #line: ren_pell_gate_06b
    -> ask
* [I'll go to the mast. Keep them in the clinic. #manner: resolve]
    I'll go to the mast. Keep them in the clinic, and keep the door shut. #speaker: hero #line: hero_pell_gate_07a
    ~ took_mast = true
    Out past the airlock, up the ramp. The console's on the platform. Be quick, Officer. #speaker: Pell #line: pell_gate_08a
    Nine strangers against our own. I hope you're right. #speaker: Ren #line: ren_pell_gate_09a
    -> DONE
* [Our people first. The Merrow will have to take its chances. #manner: plain]
    Our people first. The Merrow will have to take its chances. #speaker: hero #line: hero_pell_gate_07b
    ~ took_mast = false
    I'll keep trying the band. Maybe something gets through. #speaker: Pell #line: pell_gate_08b
    Can't save everyone. Doesn't stop you wishing. #speaker: Ren #line: ren_pell_gate_09b
    -> DONE

=== dena_loss ===
He stood in front of me. The stupid, brave boy. He stood in front of me. #speaker: Dena #line: dena_loss_01
{ met_ilya:
    He told me he'd measured the star every night for a month. He said it was going down in steps. #speaker: Dena #line: dena_loss_02a
- else:
    Ilya. He was twenty-three. He measured the star every night, and nobody ever asked him what he saw. #speaker: Dena #line: dena_loss_02b
}
* [I'm sorry. I should have been here. #manner: mercy]
    I'm sorry. I should have been here. #speaker: hero #line: hero_dena_loss_03a
    You were saving a ship. Nine people. I know. I know. It doesn't help yet. #speaker: Dena #line: dena_loss_04a
* [We grieve on the ship. Up. Now. #manner: resolve]
    We grieve on the ship. Up. Now. #speaker: hero #line: hero_dena_loss_03b
    Yes. Yes, all right. Up. #speaker: Dena #line: dena_loss_04b
- -> DONE

=== dena_escort ===
Officer! Thank the stars. Pell said you'd come. #speaker: Dena #line: dena_escort_01
* [Stay close behind me. Don't stop for anything. #manner: resolve]
    Stay close behind me. Don't stop for anything. #speaker: hero #line: hero_dena_escort_02a
* [Everyone all right? #manner: mercy]
    Everyone all right? #speaker: hero #line: hero_dena_escort_02b
    Frightened. All of us. But all of us. #speaker: Dena #line: dena_escort_03b
- -> DONE

=== jo_meet ===
You're the cavalry? You're late, and there's two of you. #speaker: Jo #line: jo_meet_01
Jo Rook. Engineer, this thing. She's sound, she's fuelled, and she's got a gun on her back that somebody bolted on in a hurry. #speaker: Jo #line: jo_meet_02 #codex: surveyor
* [Where's your captain? #manner: ask]
    Where's your captain? #speaker: hero #line: hero_jo_meet_03a
    In the settlement. The settlement went dark an hour ago. So: nowhere. #speaker: Jo #line: jo_meet_04a
* [Can she fly with what's coming? #manner: resolve]
    Can she fly with what's coming? #speaker: hero #line: hero_jo_meet_03b
    She'll fly through anything that isn't a mountain. Those things aren't mountains. #speaker: Jo #line: jo_meet_04b
- Somebody's got to give the orders. I fix things. I don't give orders, nobody takes them. #speaker: Jo #line: jo_meet_05
Don't look at me. Look at the officer. #speaker: Ren #line: ren_jo_meet_06
* [Then I'll give them. Get the people aboard. #manner: resolve]
    Then I'll give them. Get the people aboard; we hold the floor. #speaker: hero #line: hero_jo_meet_07a
    ~ jo_approval += 1
    Now that's an order. Torch is good for more than cutting, by the way. #speaker: Jo #line: jo_meet_08a
* [We decide together. For now: get them aboard. #manner: mercy]
    We decide together. For now: get them aboard. #speaker: hero #line: hero_jo_meet_07b
    Together. Sweet. Fine, aboard. #speaker: Jo #line: jo_meet_08b
- -> DONE

=== jo_name ===
That's all of them. Twenty-two souls and a ship with no captain and a number for a name. #speaker: Jo #line: jo_name_01
She needs a captain and a name. Ren says you're the captain. So. #speaker: Jo #line: jo_name_02
* [Lantern. Something to carry light out of the dark. #manner: mercy]
    Lantern. Something to carry light out of the dark. #speaker: hero #line: hero_jo_name_03a
    ~ ren_approval += 1
* [Lantern. Because we're going to need one. #manner: resolve]
    Lantern. Because we're going to need one. #speaker: hero #line: hero_jo_name_03b
    ~ jo_approval += 1
* [Lantern. It was my grandmother's word for a ship. #manner: plain]
    Lantern. It was my grandmother's word for a ship. #speaker: hero #line: hero_jo_name_03c
- Lantern. Good. Lantern, lifting. Hold on to something. #speaker: Jo #line: jo_name_04
-> DONE

=== ren_bridge ===
{ asked_files:
    The chief gave me this, at the door. Sealed. One name on the header. #speaker: Ren #line: ren_bridge_01a
- else:
    The chief pressed this into my hand at the door. Sealed. One name on the header. #speaker: Ren #line: ren_bridge_01b
}
Lightkeeper A. Varro. #speaker: Ren #line: ren_bridge_02 #codex: lightkeeper
* [Who's Varro? #manner: ask]
    Who's Varro? #speaker: hero #line: hero_ren_bridge_03a
    The youngest Lightkeeper the Authority ever made. She kept the lanes lit through the Lapse. Then she resigned, and nobody would say why. #speaker: Ren #line: ren_bridge_04a
* [The chief didn't make it out. #manner: mercy]
    The chief didn't make it out. #speaker: hero #line: hero_ren_bridge_03b
    No. He kept the doors working. That's what he said he'd do. #speaker: Ren #line: ren_bridge_04b
- -> after

= after
{ ilya_lost:
    And Ilya. I'll write to his people. Somebody should, who saw him do it. #speaker: Ren #line: ren_bridge_05a
}
{ have_curve:
    And we have his curve. Steps, not a slope. Someone who isn't us can read that. #speaker: Ren #line: ren_bridge_curve
}
Whatever's eating that star has done this before. Someone with a Lightkeeper's seal knew, and buried it. I want to know why. #speaker: Ren #line: ren_bridge_06
* [So do I. We'll find out. #manner: resolve]
    So do I. We'll find out. #speaker: hero #line: hero_ren_bridge_07a
    ~ ren_approval += 1
* [First we keep these people alive. #manner: plain]
    First we keep these people alive. #speaker: hero #line: hero_ren_bridge_07b
- I'll be on comms. Captain. #speaker: Ren #line: ren_bridge_08
-> DONE

=== jo_bridge ===
Twenty-two souls, a hold full of the settlement's flour, and one gun. Where to, Captain? #speaker: Jo #line: jo_bridge_01
The files point three ways, if Ren's reading them right. #speaker: Jo #line: jo_bridge_02
* [Pyre Remnant. The Cooperative's observatory saw something. #manner: ask]
    Pyre Remnant. The Cooperative's observatory has been watching dying stars for a century. #speaker: hero #line: hero_jo_bridge_03a
    ~ first_lead = "pyre"
    The Cooperative. They'll want forms filled. Fine. #speaker: Jo #line: jo_bridge_04a
* [Maw Roost. Someone's selling engine parts. #manner: resolve]
    Maw Roost. Someone's selling parts of those machines on the black market. #speaker: hero #line: hero_jo_bridge_03b
    ~ first_lead = "maw"
    The Wake's own rock. Lovely. I'll lock the tools away. #speaker: Jo #line: jo_bridge_04b
* [The Duskfolk border. Their star is dimming too. #manner: mercy]
    The Duskfolk border. If their star is dimming too, they need to hear it from us. #speaker: hero #line: hero_jo_bridge_03c
    ~ first_lead = "dusk"
    Four legs and a lot of patience. Better company than the Wake. #speaker: Jo #line: jo_bridge_04c
- Course laid in. Lantern's yours, Captain. Try to bring her back in one piece. #speaker: Jo #line: jo_bridge_05
-> DONE

// ─── The night shift in the dark ────────────────────────────────────────────

=== sorrel_dark ===
That ring. Officer, I've seen that ring before. #speaker: Sorrel #line: sorrel_dark_01
Antares, the last year of the run. We called it the halo. A year after it came, there was nothing left to call anything. #speaker: Sorrel #line: sorrel_dark_02 #codex: antares
* [What happened to the crews? #manner: ask]
    What happened to the crews? #speaker: hero #line: hero_sorrel_dark_03a
    An Authority ship came for our logs. Took every one. Paid us well to remember it was natural. #speaker: Sorrel #line: sorrel_dark_04a
* [It isn't Antares. Not yet. #manner: resolve]
    It isn't Antares. Not yet. #speaker: hero #line: hero_sorrel_dark_03b
    No. Not yet. You go and make sure of that, Officer. #speaker: Sorrel #line: sorrel_dark_04b
- -> DONE

=== ilya_dark ===
{ met_ilya:
    It's not in front of the star. It's round it. Every step on my curve was more of that ring, closing. #speaker: Ilya #line: ilya_dark_01a
- else:
    Officer, the ring. I've measured the star for a month, and it goes down in steps. Every step was more of that, closing. #speaker: Ilya #line: ilya_dark_01b
}
I should have said. I should have gone to the chief the first night. #speaker: Ilya #line: ilya_dark_02
* [You're saying it now. Bring your readings. #manner: resolve]
    You're saying it now. Bring your readings. #speaker: hero #line: hero_ilya_dark_03a
    ~ ilya_brings_curve = true
    My readings. Yes. They're all on here. #speaker: Ilya #line: ilya_dark_04a
* [Nobody would have listened. Ren tried. #manner: mercy]
    Nobody would have listened. Ren tried, a year ago. #speaker: hero #line: hero_ilya_dark_03b
    A year ago? Then it started long before my curve did. #speaker: Ilya #line: ilya_dark_04b
- -> DONE

// ─── Things to look at: the hero's remarks ──────────────────────────────────

=== look_star ===
Ross 128. Old, small and steady. The kind of star you build next to because nothing will ever happen. #speaker: hero #line: hero_look_star_01 #codex: ross128
Out there it's rock, frost in the shadows, and the settlement's lights past the ridge. #speaker: hero #line: hero_look_star_02 #codex: ross128b
-> DONE

=== look_star_dark ===
The ring's brighter than the star now. And it's turning. #speaker: hero #line: hero_look_dark_01
-> DONE

=== look_curve ===
~ saw_curve = true
{ met_ilya:
    Ilya's readings. Thirty-one nights. It doesn't slope. It drops, holds, and drops again. #speaker: hero #line: hero_look_curve_01a
- else:
    Someone's readings of the star. Thirty-one nights. It doesn't slope. It drops, holds, and drops again. #speaker: hero #line: hero_look_curve_01b
}
Like a door being closed in steps. #speaker: hero #line: hero_look_curve_02
-> DONE

=== look_board ===
~ read_board = true
Supply board. The Merrow, Thursday: forty days of stores for the station and the settlement. #speaker: hero #line: hero_look_board_01 #codex: merrow
And underneath, in pencil: "Bring cardamom. I am begging you. Dena." #speaker: hero #line: hero_look_board_02
-> DONE

=== look_locker ===
{ hero_moment:
- "survivor":
    The crew tag from my first posting. I'm the only one who still has theirs to keep. #speaker: hero #line: hero_locker_survivor
- "hero-of-the-line":
    The commendation. I keep it face down. The ones who held the line with me got a wall with their names on it. #speaker: hero #line: hero_locker_line
- "hard-call":
    A list of names: the ones my order cost. I read it whenever I think I'm getting used to command. #speaker: hero #line: hero_locker_call
- else:
    Their last message. Eleven seconds long. I've never once played it to the end. #speaker: hero #line: hero_locker_lost
}
-> DONE

=== look_screen ===
The count in the corner is still going up. Nobody's watching it any more. #speaker: hero #line: hero_look_screen_01
-> DONE

// ─── Aboard Lantern: the survivors in the hold ──────────────────────────────

=== dena_ship ===
{ ilya_lost:
    Tea's on. I keep making one cup too many. My hands haven't heard yet. #speaker: Dena #line: dena_ship_01a
    { ilya_brings_curve:
        He had his readings in his pocket. All thirty-one nights. I think he'd want them with you. #speaker: Dena #line: dena_ship_02a
        ~ have_curve = true
    }
- else:
    Tea's on. Everyone's got a cup, Captain. I counted twice. Everyone. #speaker: Dena #line: dena_ship_01b
}
{ merrow_warned:
    And the Merrow turned back. With my cardamom. Worth it. #speaker: Dena #line: dena_ship_03a
- else:
    The Merrow never answered. Nine of them. I used to save them the end of the pie when they docked. #speaker: Dena #line: dena_ship_03b
}
* [How are you holding up? #manner: mercy]
    How are you holding up? #speaker: hero #line: hero_dena_ship_04a
    I'm cooking. That's how I hold up. Ask me again when there's nothing left to cook. #speaker: Dena #line: dena_ship_05a
* [We'll find somewhere safe for everyone. #manner: resolve]
    We'll find somewhere safe for everyone. I promise you that. #speaker: hero #line: hero_dena_ship_04b
    Don't promise. Just do it. I'll have the tea ready when you have. #speaker: Dena #line: dena_ship_05b
- -> DONE

=== sorrel_ship ===
Thirty years I kept that regulator ready, for a beacon nobody used. Turns out I was keeping it for a ship. #speaker: Sorrel #line: sorrel_ship_01
Your engineer's already found it a home. She says it's the best-kept part on board. #speaker: Sorrel #line: sorrel_ship_02
* [What will you do now? #manner: ask]
    What will you do now? #speaker: hero #line: hero_sorrel_ship_03a
    What I did after Antares. Keep something ready. Only this time, I'll tell people what I saw. #speaker: Sorrel #line: sorrel_ship_04a
* [Thank you, Sorrel. #manner: mercy]
    Thank you, Sorrel. For keeping it ready. #speaker: hero #line: hero_sorrel_ship_03b
    Thank me when the lights stay on. #speaker: Sorrel #line: sorrel_ship_04b
- -> DONE

=== pell_ship ===
{ merrow_warned:
    I keep playing their answer back. Nine people turned round because you climbed out to a mast. #speaker: Pell #line: pell_ship_01a
    { ilya_lost:
        And Ilya didn't make it. I know that's not a sum. I keep doing it anyway. #speaker: Pell #line: pell_ship_02a
    }
- else:
    I tried every band, Captain. Every one. If they heard anything, it was static. #speaker: Pell #line: pell_ship_01b
}
* [You did what you could. #manner: mercy]
    You did what you could, Pell. #speaker: hero #line: hero_pell_ship_03a
    I did what I was told. It's not quite the same thing. But thank you. #speaker: Pell #line: pell_ship_04a
* [Then keep listening. #manner: resolve]
    Then keep listening. This ship will need ears like yours. #speaker: hero #line: hero_pell_ship_03b
    Ears I've got. Point me at a console. #speaker: Pell #line: pell_ship_04b
- -> DONE

=== ilya_ship ===
{ ilya_brings_curve:
    I brought my readings. Thirty-one nights, and the last hour, which nobody is going to believe. #speaker: Ilya #line: ilya_ship_01a
    ~ have_curve = true
- else:
    I left my readings on the lounge table. Thirty-one nights of work, on a table in the dark. #speaker: Ilya #line: ilya_ship_01b
}
If this has happened to other stars, the steps will be in their light too. Somebody's telescope will have caught them. #speaker: Ilya #line: ilya_ship_02
* [Where would you look? #manner: ask]
    Where would you look first? #speaker: hero #line: hero_ilya_ship_03a
    Pyre Remnant. The Cooperative's observatory there has a century of dying stars on file. #speaker: Ilya #line: ilya_ship_04a
* [You did well tonight. #manner: mercy]
    You did well tonight, Ilya. You saw it first. #speaker: hero #line: hero_ilya_ship_03b
    I saw it. I just didn't say it. Next time I'll say it. #speaker: Ilya #line: ilya_ship_04b
- -> DONE
