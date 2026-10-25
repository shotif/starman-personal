import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Compiler } from 'inkjs/full';
import { describe, expect, it } from 'vitest';
import { CODEX } from '../../src/game/codex.ts';
import { type Beat, type HeroFacts, parseTags, StoryRunner } from '../../src/game/conversation.ts';
import { type Command, Director, parseCommand } from '../../src/game/director.ts';
import { ENCOUNTERS } from '../../src/game/encounters.ts';
import { CLASSES, MOMENTS, ORIGINS } from '../../src/game/hero.ts';
import { AREAS, CAST, DOORS, MARKS } from '../../src/game/places.ts';

const SOURCE = readFileSync(join('story', 'slice.ink'), 'utf8');

const compile = () => {
  const compiler = new Compiler(SOURCE);
  const story = compiler.Compile();
  expect(compiler.errors).toEqual([]);
  expect(compiler.warnings).toEqual([]);
  return story.ToJson() as string;
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
    const marks = new Set([...Object.keys(MARKS), 'none']);
    const areas = new Set(AREAS.map((a) => a.id));
    const doors = new Set(DOORS);
    const cast = new Set(CAST);
    const knots = new Set([...SOURCE.matchAll(/^=== (\w+) ===/gm)].map((m) => m[1]));
    const commands = SOURCE.split('\n')
      .map((line) => parseCommand(line.trim()))
      .filter((c): c is Command => c !== null);
    expect(commands.length).toBeGreaterThan(100);
    for (const c of commands) {
      const [a = '', b = ''] = c.args;
      expect(VERBS.has(c.verb), `unknown command: ${c.verb}`).toBe(true);
      if (['place', 'walk', 'start'].includes(c.verb)) {
        expect(cast.has(a), `unknown person: ${a}`).toBe(true);
        expect(marks.has(b), `unknown mark: ${b}`).toBe(true);
      }
      if (['hide', 'show', 'follow', 'stay', 'down', 'join'].includes(c.verb)) {
        expect(cast.has(a), `unknown person: ${a}`).toBe(true);
      }
      if (['talk', 'scene'].includes(c.verb)) {
        expect(cast.has(a), `unknown person: ${a}`).toBe(true);
        if (b) expect(knots.has(b), `unknown conversation: ${b}`).toBe(true);
      }
      if (['open', 'close', 'lock', 'unlock'].includes(c.verb)) expect(doors.has(a), `unknown door: ${a}`).toBe(true);
      if (c.verb === 'marker') expect(marks.has(a), `unknown mark: ${a}`).toBe(true);
      if (c.verb === 'use') expect(marks.has(b), `unknown mark: ${b}`).toBe(true);
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
      if (c.verb === 'wait' && !Number.isFinite(Number(a))) {
        for (const event of c.rest.split('|').map((e) => e.trim())) {
          const [kind, what = ''] = event.split(':');
          if (kind === 'enter') expect(areas.has(what), `unknown area: ${what}`).toBe(true);
          if (kind === 'talked') expect(knots.has(what), `unknown conversation: ${what}`).toBe(true);
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
      ]) {
        const runner = () => {
          const r = new StoryRunner(JSON_STORY, facts('ringborn', 'warden'));
          for (const [k, v] of Object.entries(flags)) r.set(k, v);
          return r;
        };
        expect(walk(runner, knot)).toBeGreaterThan(0);
      }
    });
  }

  /** Plays the whole slice through the director, choosing the mast or not at Pell's booth. */
  function play(mast: boolean) {
    const runner = new StoryRunner(JSON_STORY, facts('beltborn', 'striker'));
    const commands: Command[] = [];
    const checkpoints: string[] = [];
    const director = new Director(runner, {
      command: (c) => commands.push(c),
      bark: (line) => {
        expect(line.speaker, `a bark without a speaker: "${line.text}"`).not.toBe('narrator');
        expect(line.id).not.toBeNull();
      },
      checkpoint: (name, state) => {
        expect(state.length).toBeGreaterThan(100);
        checkpoints.push(name);
      },
    });
    const talk = (knot: string) => {
      const conversation = runner.converse(knot);
      for (let beat: Beat = conversation.next(); beat.kind !== 'end'; beat = conversation.next()) {
        if (beat.kind !== 'choices') continue;
        const decision = beat.choices.find((c) => (mast ? /mast/.test(c.text) : /Our people/.test(c.text)));
        conversation.choose((knot === 'pell_gate' ? decision : beat.choices[0])?.index ?? 0);
      }
      director.event(`talked:${knot}`);
    };
    director.step();
    for (let guard = 0; guard < 200 && !director.ended; guard++) {
      const waiting = director.waiting;
      expect(waiting, 'the story stopped without waiting for anything').not.toBeNull();
      const event = waiting?.[0] ?? '';
      if (event === 'time') director.update(30);
      else if (event.startsWith('talked:')) talk(event.slice('talked:'.length));
      else director.event(event);
    }
    expect(director.ended).toBe(true);
    return { commands, checkpoints, runner };
  }

  it('plays from the night shift to the bridge by the mast, and by the escort', () => {
    const mast = play(true);
    expect(mast.runner.variable('took_mast')).toBe(true);
    expect(mast.runner.variable('merrow_warned')).toBe(true);
    expect(mast.runner.variable('ilya_lost')).toBe(true);
    expect(mast.checkpoints).toContain('mast');
    expect(mast.commands.some((c) => c.verb === 'encounter' && c.args[0] === 'catwalk')).toBe(true);

    const escort = play(false);
    expect(escort.runner.variable('took_mast')).toBe(false);
    expect(escort.runner.variable('merrow_warned')).toBe(false);
    expect(escort.checkpoints).toContain('escort');
    expect(escort.commands.some((c) => c.verb === 'encounter' && c.args[0] === 'escort')).toBe(true);
    for (const run of [mast, escort]) {
      expect(run.checkpoints[0]).toBe('night_shift');
      expect(run.checkpoints.at(-1)).toBe('bridge');
      expect(run.commands.at(-1)?.verb).toBe('end');
      expect(run.runner.variable('first_lead')).not.toBe('');
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
    expect(director.ended).toBe(true);
  });

  it('sets the scene of every chapter by itself, so a resumed game finds everyone in place', () => {
    const chapters = [...SOURCE.matchAll(/^>>> checkpoint (\w+)/gm)].map((m) => m[1] as string);
    expect(chapters.length).toBeGreaterThan(8);
    for (const chapter of chapters) {
      for (const lost of [false, true]) {
        const runner = new StoryRunner(JSON_STORY, facts('steader', 'rigger'));
        runner.set('ilya_lost', lost);
        runner.story.ChoosePathString(`slice.${chapter}`);
        const commands: string[] = [];
        // Up to the chapter's first wait or line: its scene.
        const director = new Director(runner, {
          command: (c) => commands.push(`${c.verb} ${c.rest}`),
          bark: () => 1,
          checkpoint: () => {},
        });
        director.step();
        const has = (verb: string, who: string) => commands.some((c) => c.startsWith(`${verb} ${who}`));
        const placed = (who: string) => has('start', who) || has('place', who);
        expect(placed('hero'), `${chapter}: the hero`).toBe(true);
        expect(placed('ren'), `${chapter}: Ren`).toBe(true);
        // Jo is hidden until the hangar; Hale is placed or hidden; the night shift placed or hidden.
        if (!['hangar', 'bridge'].includes(chapter)) expect(has('hide', 'jo'), `${chapter}: Jo`).toBe(true);
        if (chapter !== 'night_shift') {
          expect(placed('hale') || has('hide', 'hale'), `${chapter}: Hale`).toBe(true);
          for (const who of ['dena', 'sorrel', 'pell']) {
            expect(placed(who) || has('hide', who), `${chapter}: ${who}`).toBe(true);
          }
          expect(placed('ilya') || has('hide', 'ilya') || has('down', 'ilya'), `${chapter}: Ilya`).toBe(true);
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
