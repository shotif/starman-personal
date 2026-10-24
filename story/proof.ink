// The proof's one conversation (docs/design/DIALOGUE.md): Ren, in the practice range.
// Every line carries its speaker and an id for its voice (D-23). Choices carry their manner (D-12).
// The hero's facts are set by the game from the creator (CREATOR.md, hero.ts).

VAR hero_name = ""
VAR hero_class = ""
VAR hero_origin = ""
VAR hero_moment = ""
VAR ren_approval = 0

=== ren_range ===
You keep looking at those drones as if they owe you money. #speaker: Ren #line: ren_range_01
* [Do they? #manner: ask]
    Do they? #speaker: hero #line: hero_range_02a
    Three hits each, and they never shoot back. If anything, we owe them. #speaker: Ren #line: ren_range_03a
* [Just checking the range. #manner: plain]
    Just checking the range. #speaker: hero #line: hero_range_02b
    It's a range. It goes from here to that wall. #speaker: Ren #line: ren_range_03b
- -> where_from

= where_from
{
- hero_origin == "laneborn":
    You walk like someone raised on a hauler. Hand on the rail even when there isn't one. #speaker: Ren #line: ren_origin_laneborn
- hero_origin == "den-raised":
    You checked the exits before you checked me. Wake habit. I won't ask. #speaker: Ren #line: ren_origin_den
- hero_origin == "ringborn":
    Halcyon, isn't it? You stand as if the floor's been paid for. #speaker: Ren #line: ren_origin_ring
- hero_origin == "steader":
    Farm hands. You fix things before you're asked. Cooperative, I'd guess. #speaker: Ren #line: ren_origin_steader
- hero_origin == "beltborn":
    Belt crew. You flinch at open doors, the way people do who've seen a seal go. #speaker: Ren #line: ren_origin_belt
- else:
    You speak like someone from past the old frontier. The Duskfolk side of it. #speaker: Ren #line: ren_origin_border
}
{
- hero_class == "warden" || hero_class == "rigger":
    And you'd rather a drone took the first hit than a person. I like that. #speaker: Ren #line: ren_class_support
- hero_class == "fieldwright" || hero_class == "striker":
    And the air goes heavy around you when you're cross. Field implants. Mind the furniture. #speaker: Ren #line: ren_class_field
- else:
    And you hold a pistol as if it had been issued to you young. #speaker: Ren #line: ren_class_arms
}
-> after

= after
* [We'll get through this together. #manner: mercy]
    We'll get through this together. #speaker: hero #line: hero_range_04a
    ~ ren_approval += 1
    Together, then. Try to keep up. #speaker: Ren #line: ren_range_05a
* [Stay sharp. Next time they'll shoot back. #manner: resolve]
    Stay sharp. Next time they'll shoot back. #speaker: hero #line: hero_range_04b
    ~ ren_approval += 1
    That's what I like to hear. #speaker: Ren #line: ren_range_05b
* [Why are you here, Ren? #manner: ask]
    Why are you here, Ren? #speaker: hero #line: hero_range_04c
    Same reason as you. Someone has to be. #speaker: Ren #line: ren_range_05c
- Orders when you want them. I'll be behind you. #speaker: Ren #line: ren_range_06
-> END
