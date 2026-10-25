import { describe, expect, it } from 'vitest';
import { compileStory, storySource } from '../../scripts/ink.ts';
import { CODEX } from '../../src/game/codex.ts';
import { type Beat, type HeroFacts, parseTags, StoryRunner } from '../../src/game/conversation.ts';
import { type Command, Director, parseCommand } from '../../src/game/director.ts';
import { ENCOUNTERS } from '../../src/game/encounters.ts';
import { levelOf, XP_BEFORE } from '../../src/game/growth.ts';
import { CLASSES, MOMENTS, ORIGINS } from '../../src/game/hero.ts';
import {
  ALL_CAST,
  ALL_DOORS,
  ALL_MARKS,
  AREAS,
  knotOf,
  LANTERN_AREAS,
  PEOPLE_OF,
  PLACES,
  PYRE_AREAS,
  placeOf,
} from '../../src/game/places.ts';
import { LEADS } from '../../src/game/starmap.ts';
import { MODS, WEAPONS } from '../../src/game/weapons.ts';

/** Every file of the story (story/slice.ink and what it includes), as one text. */
const SOURCE = storySource();

const compile = () => {
  const story = compileStory();
  expect(story.errors).toEqual([]);
  expect(story.warnings).toEqual([]);
  expect(story.files.length).toBeGreaterThan(1);
  return story.json;
};
const JSON_STORY = compile();

/** Every conversation knot the script opens with `talk` or `scene`, and every remark a `look` runs. */
const KNOTS = [
  ...[...SOURCE.matchAll(/^>>> (?:talk|scene) \w+ (\w+)/gm)].map((m) => m[1] as string),
  ...[...SOURCE.matchAll(/^>>> look \w+ \w+ (\w+)/gm)].map((m) => m[1] as string),
];
const facts = (origin: string, heroClass: string): HeroFacts => ({
  name: 'Ada',
  heroClass,
  origin,
  moment: MOMENTS[0]?.id ?? '',
});

/** Walks every path through a conversation; fails on a line without a speaker or voice, or a choice without a manner. */
function walk(runner: () => StoryRunner, knot: string, path: number[] = [], depth = 0): number {
  expect(depth).toBeLessThan(30);
  const conversation = runner().converse(knot);
  let step = 0;
  for (;;) {
    const beat = conversation.next();
    if (beat.kind === 'end') return 1;
    if (beat.kind === 'line') {
      expect(beat.speaker, `a line without a speaker: "${beat.text}"`).not.toBe('narrator');
      expect(beat.id, `a line without a voice id: "${beat.text}"`).not.toBeNull();
      expect(beat.text.startsWith('>>>'), `a command inside a conversation: "${beat.text}"`).toBe(false);
      continue;
    }
    for (const c of beat.choices) expect(c.manner, `a choice without a manner: "${c.text}"`).not.toBeNull();
    const taken = path[step];
    if (taken === undefined) {
      return beat.choices.reduce((n, c) => n + walk(runner, knot, [...path, c.index], depth + 1), 0);
    }
    conversation.choose(taken);
    step += 1;
  }
}

const VERBS = new Set([
  'checkpoint',
  'lights',
  'sky',
  'music',
  'place',
  'start',
  'hide',
  'show',
  'close',
  'open',
  'lock',
  'unlock',
  'caption',
  'hint',
  'objective',
  'marker',
  'talk',
  'wait',
  'drill',
  'scene',
  'walk',
  'follow',
  'stay',
  'join',
  'encounter',
  'use',
  'look',
  'forget',
  'codex',
  'down',
  'liftoff',
  'travel',
  'card',
  'screen',
  'find',
  'depart',
  'xp',
  'pay',
  'leave',
  'end',
]);

describe('the slice script', () => {
  it('compiles cleanly', () => {
    expect(JSON_STORY.length).toBeGreaterThan(1000);
  });

  it('gives every line a voice id of its own', () => {
    const ids = [...SOURCE.matchAll(/#line: (\S+)/g)].map((m) => m[1]);
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repeated).toEqual([]);
    expect(ids.length).toBeGreaterThan(150);
  });

  it('names only places, doors, people, fights and conversations that exist', () => {
    const marks = new Set([...Object.keys(ALL_MARKS), 'none']);
    const areas = new Set([...AREAS, ...LANTERN_AREAS, ...PYRE_AREAS].map((a) => a.id));
    const doors = new Set(ALL_DOORS);
    const cast = new Set(ALL_CAST);
    // A tunnel's marks, given as its arguments (`-> squad("commons_entry") ->`), are marks too.
    for (const m of SOURCE.matchAll(/-> \w+\("(\w+)"\) ->/g))
      expect(marks.has(m[1] ?? ''), `unknown mark: ${m[1]}`).toBe(true);
    const knots = new Set([...SOURCE.matchAll(/^=== (\w+) ===/gm)].map((m) => m[1]));
    // Ink escapes a bar in text (`\|`): the story says it as a bar.
    const commands = SOURCE.split('\n')
      .map((line) => parseCommand(line.trim().replaceAll('\\|', '|')))
      .filter((c): c is Command => c !== null);
    expect(commands.length).toBeGreaterThan(100);
    for (const c of commands) {
      const [a = '', b = ''] = c.args;
      // An argument filled in by the story as it runs (`{at}`) is checked where it is given.
      if (c.rest.includes('{')) continue;
      expect(VERBS.has(c.verb), `unknown command: ${c.verb}`).toBe(true);
      if (['place', 'walk', 'start'].includes(c.verb)) {
        expect(cast.has(a), `unknown person: ${a}`).toBe(true);
        expect(marks.has(b), `unknown mark: ${b}`).toBe(true);
      }
      if (['hide', 'show', 'follow', 'stay', 'down', 'join', 'leave'].includes(c.verb)) {
        expect(cast.has(a), `unknown person: ${a}`).toBe(true);
      }
      if (['talk', 'scene'].includes(c.verb)) {
        expect(cast.has(a), `unknown person: ${a}`).toBe(true);
        if (b) expect(knots.has(b), `unknown conversation: ${b}`).toBe(true);
      }
      if (['open', 'close', 'lock', 'unlock'].includes(c.verb)) expect(doors.has(a), `unknown door: ${a}`).toBe(true);
      // A marker points at a mark, or at a person.
      if (c.verb === 'marker') expect(marks.has(a) || cast.has(a), `unknown mark: ${a}`).toBe(true);
      if (['use', 'screen', 'find'].includes(c.verb)) expect(marks.has(b), `unknown mark: ${b}`).toBe(true);
      if (c.verb === 'screen') expect(['starmap', 'armoury', 'trade'], `unknown screen: ${a}`).toContain(a);
      if (c.verb === 'find') {
        const what = c.args[2] ?? '';
        expect(what in WEAPONS || what in MODS, `unknown find: ${what}`).toBe(true);
      }
      if (c.verb === 'look') {
        expect(marks.has(b), `unknown mark: ${b}`).toBe(true);
        expect(knots.has(c.args[2] ?? ''), `unknown remark: ${c.args[2]}`).toBe(true);
      }
      if (c.verb === 'codex')
        expect(
          CODEX.some((e) => e.id === a),
          `unknown codex entry: ${a}`,
        ).toBe(true);
      if (c.verb === 'encounter') expect(ENCOUNTERS[a], `unknown fight: ${a}`).toBeDefined();
      if (c.verb === 'travel') expect(Object.keys(PLACES), `unknown place: ${a}`).toContain(a);
      if (c.verb === 'xp' || c.verb === 'pay') {
        expect(Number(a), `an amount must be a number: ${c.rest}`).toBeGreaterThan(0);
        expect(c.args.length, `an amount needs a reason: ${c.rest}`).toBeGreaterThan(1);
      }
      if (c.verb === 'wait' && !Number.isFinite(Number(a))) {
        for (const event of c.rest.split('|').map((e) => e.trim())) {
          const [kind, what = ''] = event.split(':');
          if (kind === 'enter') expect(areas.has(what), `unknown area: ${what}`).toBe(true);
          if (kind === 'talked') expect(knots.has(what), `unknown conversation: ${what}`).toBe(true);
          // A course the story waits for is to a lead the star map lets the player set.
          if (kind === 'course') expect(LEADS.find((l) => l.id === what)?.open, `no open lead: ${what}`).toBe(true);
        }
      }
    }
  });

  for (const knot of [...new Set(KNOTS)]) {
    it(`${knot}: every path ends, for every hero`, () => {
      for (const origin of ORIGINS) {
        for (const heroClass of CLASSES) {
          const runner = () => new StoryRunner(JSON_STORY, facts(origin.id, heroClass.id));
          expect(walk(runner, knot)).toBeGreaterThan(0);
        }
      }
      // And with what the story may have set by then.
      for (const flags of [
        { met_ilya: true, asked_files: true, ilya_lost: true, merrow_warned: true, ilya_brings_curve: true },
        { met_ilya: false, asked_files: false, ilya_lost: false, merrow_warned: false, ilya_brings_curve: false },
        // And at Pyre Remnant (PYRE.md), each way things may have gone.
        {
          have_curve: true,
          sorrel_named_linde: true,
          ren_sent_file: true,
          second: 'ren',
          unlisted: 'aboard',
          pyre_saved: 'archive',
          linde_won: true,
          crate_opened: true,
          joost_lost: true,
          quaye_argued: true,
          esben_fate: 'freed',
          credits: 600,
        },
        {
          have_curve: false,
          sorrel_named_linde: false,
          ren_sent_file: false,
          second: 'jo',
          unlisted: 'listed',
          pyre_saved: 'dome',
          linde_won: false,
          crate_opened: false,
          credits: 0,
        },
        { second: 'jo', unlisted: 'banked', pyre_saved: 'archive', credits: 100 },
      ]) {
        const runner = () => {
          const r = new StoryRunner(JSON_STORY, facts('ringborn', 'warden'));
          for (const [k, v] of Object.entries(flags)) r.set(k, v);
          return r;
        };
        expect(walk(runner, knot)).toBeGreaterThan(0);
      }
    }, 60_000);
  }

  /**
   * A way through the whole story: the mast or not at Pell's booth, and then, wherever a conversation
   * offers one of `prefer`, that choice (otherwise the first), and wherever the story waits for one of
   * `events`, that event (otherwise the first it waits for).
   */
  interface Route {
    mast: boolean;
    prefer: RegExp[];
    events: string[];
  }
  const ROUTES: Record<string, Route> = {
    // Pyre Remnant by the front door: Ren comes, the Orchard aboard Lantern, the archive held.
    front: {
      mast: true,
      prefer: [/^Send it/, /^Ren, you're with me/, /^Come aboard/, /^We hold the archive/, /^Go to your ship/],
      events: ['used:way_front'],
    },
    // By the stacks with Linde: Jo comes, the hearing, the dome.
    stacks: {
      mast: false,
      prefer: [/^Wait\. We don't/, /^Jo, you're with me/, /argue your case/, /^We go for the dome/],
      events: ['used:way_stacks'],
    },
    // By the freight way: the Banked carry the Orchard's people, the archive held, Esben held.
    cargo: {
      mast: true,
      prefer: [/^Jo, you're with me/, /^Go with the Banked/, /^We hold the archive/, /committee can have you/],
      events: ['used:way_cargo'],
    },
  };

  /** Plays the whole story through the director along a route. */
  function play(route: Route) {
    const runner = new StoryRunner(JSON_STORY, facts('beltborn', 'striker'));
    const commands: Command[] = [];
    const checkpoints: string[] = [];
    /** Experience given so far, and at each checkpoint. */
    let xp = 0;
    const xpAt: Record<string, number> = {};
    const director = new Director(runner, {
      command: (c) => {
        commands.push(c);
        if (c.verb === 'xp') xp += Number(c.args[0]);
      },
      bark: (line) => {
        expect(line.speaker, `a bark without a speaker: "${line.text}"`).not.toBe('narrator');
        expect(line.id).not.toBeNull();
        xp += line.xp ?? 0;
      },
      checkpoint: (name, state) => {
        expect(state.length).toBeGreaterThan(100);
        checkpoints.push(name);
        xpAt[name] = xp;
      },
    });
    const talk = (knot: string) => {
      const conversation = runner.converse(knot);
      for (let beat: Beat = conversation.next(); beat.kind !== 'end'; beat = conversation.next()) {
        if (beat.kind === 'line') xp += beat.xp ?? 0;
        if (beat.kind !== 'choices') continue;
        const decision =
          knot === 'pell_gate'
            ? beat.choices.find((c) => (route.mast ? /mast/.test(c.text) : /Our people/.test(c.text)))
            : beat.choices.find((c) => route.prefer.some((p) => p.test(c.text)));
        conversation.choose((decision ?? beat.choices[0])?.index ?? 0);
      }
      director.event(`talked:${knot}`);
    };
    director.step();
    for (let guard = 0; guard < 600 && !director.ended; guard++) {
      const waiting = director.waiting;
      expect(waiting, 'the story stopped without waiting for anything').not.toBeNull();
      const event = waiting?.find((e) => route.events.includes(e)) ?? waiting?.[0] ?? '';
      if (event === 'time') director.update(30);
      else if (event.startsWith('talked:')) talk(event.slice('talked:'.length));
      else director.event(event);
    }
    expect(director.ended).toBe(true);
    return { commands, checkpoints, runner, xp, xpAt };
  }

  it('plays from the night shift to the bridge by the mast, and by the escort', () => {
    const mast = play(ROUTES.front as Route);
    expect(mast.runner.variable('took_mast')).toBe(true);
    expect(mast.runner.variable('merrow_warned')).toBe(true);
    expect(mast.runner.variable('ilya_lost')).toBe(true);
    expect(mast.checkpoints).toContain('mast');
    expect(mast.commands.some((c) => c.verb === 'encounter' && c.args[0] === 'catwalk')).toBe(true);

    const escort = play(ROUTES.stacks as Route);
    expect(escort.runner.variable('took_mast')).toBe(false);
    expect(escort.runner.variable('merrow_warned')).toBe(false);
    expect(escort.checkpoints).toContain('escort');
    expect(escort.commands.some((c) => c.verb === 'encounter' && c.args[0] === 'escort')).toBe(true);
    for (const run of [mast, escort]) {
      expect(run.checkpoints[0]).toBe('night_shift');
      expect(run.checkpoints).toContain('bridge');
      expect(run.checkpoints).toContain('aboard');
      expect(run.checkpoints).toContain('lane');
      expect(run.commands.some((c) => c.verb === 'depart')).toBe(true);
      expect(run.runner.variable('first_lead')).not.toBe('');
    }
  });

  it('plays Pyre Remnant every way in, and each way the choices go (PYRE.md)', () => {
    const front = play(ROUTES.front as Route);
    const stacks = play(ROUTES.stacks as Route);
    const cargo = play(ROUTES.cargo as Route);
    const encounters = (run: ReturnType<typeof play>) =>
      run.commands.filter((c) => c.verb === 'encounter').map((c) => c.args[0]);
    // The way in decides the first fight; Ren's file sent warns the Banked.
    expect(front.runner.variable('way_in')).toBe('front');
    expect(encounters(front)).toContain('pyre_front_warned');
    expect(stacks.runner.variable('way_in')).toBe('stacks');
    expect(encounters(stacks)).toContain('pyre_quiet');
    expect(cargo.runner.variable('way_in')).toBe('cargo');
    expect(encounters(cargo)).toContain('pyre_cargo_warned');
    // Who came, what became of the Orchard's people, what was saved.
    expect(front.runner.variable('second')).toBe('ren');
    expect(stacks.runner.variable('second')).toBe('jo');
    expect(front.runner.variable('unlisted')).toBe('aboard');
    expect(stacks.runner.variable('unlisted')).toBe('listed');
    expect(cargo.runner.variable('unlisted')).toBe('banked');
    expect(stacks.checkpoints).toContain('pyre_dome');
    expect(stacks.runner.variable('joost_lost')).toBe(false);
    for (const run of [front, cargo]) {
      expect(run.checkpoints).toContain('pyre_archive');
      expect(run.runner.variable('joost_lost')).toBe(true);
      // The next star is found only when the archive is saved and the hearing took no time.
      expect(run.runner.variable('next_star_found')).toBe(true);
    }
    expect(stacks.runner.variable('next_star_found')).toBe(false);
    expect(cargo.runner.variable('esben_fate')).toBe('held');
    for (const run of [front, stacks, cargo]) {
      expect(run.checkpoints.at(-1)).toBe('pyre_aboard');
      expect(run.commands.at(-1)?.verb).toBe('end');
      // The old captain's float, and Pyre's thanks: the same whichever way it went.
      const paid = run.commands.filter((c) => c.verb === 'pay').reduce((n, c) => n + Number(c.args[0]), 0);
      expect(paid).toBe(1200);
    }
  });

  it('gives experience for the story: level 2 by the prologue’s end, 3 before the stacks, 4 after Pyre', () => {
    const runs = Object.values(ROUTES).map((r) => play(r));
    for (const run of runs) {
      // The prologue ends at the bridge's card: level 2 by then.
      expect(levelOf(run.xpAt.aboard ?? 0)).toBe(2);
      // Level 3, and its new power, by the stacks on every way in (PYRE.md §7).
      expect(levelOf(run.xpAt.pyre_stacks ?? 0)).toBeGreaterThanOrEqual(3);
      // Level 4 by the end of Pyre Remnant, and not yet 5.
      expect(levelOf(run.xp)).toBe(4);
    }
    // A save from before growth is given the least any way to its chapter gave.
    for (const [chapter, xp] of Object.entries(XP_BEFORE)) {
      const seen = runs.map((r) => r.xpAt[chapter]).filter((n): n is number => n !== undefined);
      expect(seen.length, `${chapter} is a checkpoint`).toBeGreaterThan(0);
      expect(Math.min(...seen), chapter).toBe(xp);
    }
    const chapters = [...SOURCE.matchAll(/^>>> checkpoint (\w+)/gm)].map((m) => m[1] as string);
    for (const c of chapters) expect(XP_BEFORE[c], `XP_BEFORE has ${c}`).toBeDefined();
    // Each grant has a reason of its own, its key, so it is given once; a grant written in two places
    // (reached two ways) gives the same amount in both.
    const grants = [...SOURCE.matchAll(/^>>> xp (\d+) (.+)$/gm)].map((m) => [m[2], m[1]] as const);
    for (const [why, amount] of grants) {
      expect(
        grants.filter(([w]) => w === why).every(([, a]) => a === amount),
        why,
      ).toBe(true);
    }
  });

  it('opens only codex entries that exist', () => {
    const tagged = [...SOURCE.matchAll(/#codex: (\S+)/g)].map((m) => m[1] as string);
    expect(tagged.length).toBeGreaterThan(8);
    for (const id of tagged)
      expect(
        CODEX.some((e) => e.id === id),
        `unknown codex entry: ${id}`,
      ).toBe(true);
    // Every entry can be found somewhere in the slice.
    for (const e of CODEX) expect(tagged, e.id).toContain(e.id);
  });

  it('waits while a line is said, and remembers what happened before it waited', () => {
    const runner = new StoryRunner(JSON_STORY, facts('steader', 'rigger'));
    runner.story.ChoosePathString('slice.bridge');
    const said: string[] = [];
    const director = new Director(runner, {
      command: () => {},
      bark: (line) => {
        said.push(line.id ?? '');
        return 2;
      },
      checkpoint: () => {},
    });
    director.step();
    // The bridge is aboard Lantern: the story travels there first.
    expect(director.waiting).toEqual(['done:travel']);
    director.event('done:travel');
    // The first line of the bridge is said, and the story waits for it.
    expect(said).toHaveLength(1);
    expect(director.waiting).toEqual(['time']);
    director.update(2.1);
    expect(said).toHaveLength(2);
    director.update(2.1);
    expect(director.waiting).toEqual(['talked:dena_ship']);
    director.event('talked:dena_ship');
    // Jo before Ren: the story waits for Ren first, and still knows Jo was talked to.
    director.event('talked:jo_bridge');
    expect(director.waiting).toEqual(['talked:ren_bridge']);
    director.event('talked:ren_bridge');
    // Then the prologue's card, and the story waits for the player to go on.
    expect(director.waiting).toEqual(['done:card']);
  });

  it('sets the scene of every chapter by itself, so a resumed game finds everyone in place', () => {
    const chapters = [...SOURCE.matchAll(/^>>> checkpoint (\w+)/gm)].map((m) => m[1] as string);
    expect(chapters.length).toBeGreaterThan(8);
    for (const chapter of chapters) {
      for (const flags of [
        { ilya_lost: false, second: '' },
        { ilya_lost: true, second: 'ren', unlisted: 'aboard' },
        { ilya_lost: false, second: 'jo', unlisted: 'banked', joost_lost: true },
      ]) {
        const runner = new StoryRunner(JSON_STORY, facts('steader', 'rigger'));
        for (const [k, v] of Object.entries(flags)) runner.set(k, v);
        runner.story.ChoosePathString(`${knotOf(chapter)}.${chapter}`);
        const commands: string[] = [];
        // Up to the chapter's first wait or line: its scene.
        const director = new Director(runner, {
          command: (c) => commands.push(`${c.verb} ${c.rest}`),
          bark: () => 1,
          checkpoint: () => {},
        });
        director.step();
        // A chapter in another place begins with its travel.
        if (director.waiting?.[0] === 'done:travel') director.event('done:travel');
        const has = (verb: string, who: string) =>
          commands.some((c) => c === `${verb} ${who}` || c.startsWith(`${verb} ${who} `));
        const placed = (who: string) => has('start', who) || has('place', who);
        expect(placed('hero'), `${chapter}: the hero`).toBe(true);
        // Ren is with the hero, or back aboard Lantern (D-59).
        expect(placed('ren') || has('leave', 'ren'), `${chapter}: Ren`).toBe(true);
        const place = placeOf(chapter);
        // Jo is hidden until the hangar; at Pyre, with the hero or back aboard.
        if (place === 'calder' && chapter !== 'hangar') expect(has('hide', 'jo'), `${chapter}: Jo`).toBe(true);
        if (place === 'pyre') expect(placed('jo') || has('leave', 'jo'), `${chapter}: Jo`).toBe(true);
        // Everyone the place holds is placed, hidden, or lying where they fell.
        if (chapter !== 'night_shift') {
          for (const who of PEOPLE_OF[place]) {
            expect(placed(who) || has('hide', who) || has('down', who), `${chapter}: ${who}`).toBe(true);
          }
        }
        if (place === 'calder' && chapter !== 'night_shift') {
          expect(placed('hale') || has('hide', 'hale'), `${chapter}: Hale`).toBe(true);
        }
      }
    }
  });

  it('reads tags as keys and values', () => {
    expect(parseTags(['speaker: Ren', 'line: ren_01', 'junk'])).toEqual({ speaker: 'Ren', line: 'ren_01' });
    expect(parseTags(null)).toEqual({});
  });

  it('resumes from a checkpoint with the scene set up again', () => {
    const runner = new StoryRunner(JSON_STORY, facts('steader', 'rigger'));
    let saved = '';
    const director = new Director(runner, {
      command: () => {},
      bark: () => {},
      checkpoint: (name, state) => {
        if (name === 'range') saved = state;
      },
    });
    director.step();
    const night = runner.converse('ren_night');
    for (let beat: Beat = night.next(); beat.kind !== 'end'; beat = night.next()) {
      if (beat.kind === 'choices') night.choose(beat.choices[0]?.index ?? 0);
    }
    director.event('talked:ren_night');
    expect(saved).not.toBe('');
    const resumed = new StoryRunner(JSON_STORY, facts('steader', 'rigger'));
    resumed.load(saved);
    const commands: Command[] = [];
    const again = new Director(resumed, { command: (c) => commands.push(c), bark: () => {}, checkpoint: () => {} });
    again.step();
    // Straight after the checkpoint come the commands that set the scene up.
    const scene = commands.map((c) => `${c.verb} ${c.rest}`);
    for (const wanted of ['start hero drill', 'start ren drill', 'hide jo', 'hide hale', 'start dena dena']) {
      expect(scene).toContain(wanted);
    }
    expect(again.waiting).toEqual(['enter:range']);
  });
});
