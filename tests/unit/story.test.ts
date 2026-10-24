import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Compiler } from 'inkjs/full';
import { describe, expect, it } from 'vitest';
import { Conversation, type HeroFacts, parseTags } from '../../src/game/conversation.ts';
import { CLASSES, MOMENTS, ORIGINS } from '../../src/game/hero.ts';

/** The knots the game starts conversations at, by ink file. */
const KNOTS: Record<string, string[]> = { 'proof.ink': ['ren_range'] };

const compile = (file: string) => {
  const compiler = new Compiler(readFileSync(join('story', file), 'utf8'));
  const story = compiler.Compile();
  expect(compiler.errors).toEqual([]);
  return story.ToJson() as string;
};

/** Walks every path from a knot, returning how many endings it reached; fails on a broken line. */
function walk(json: string, knot: string, facts: HeroFacts, path: number[] = [], depth = 0): number {
  expect(depth).toBeLessThan(40);
  const conversation = new Conversation(json, knot, facts);
  let step = 0;
  for (;;) {
    const beat = conversation.next();
    if (beat.kind === 'end') return 1;
    if (beat.kind === 'line') {
      expect(beat.speaker, `a line without a speaker: "${beat.text}"`).not.toBe('narrator');
      expect(beat.id, `a line without a voice id: "${beat.text}"`).not.toBeNull();
      continue;
    }
    for (const choice of beat.choices) {
      expect(choice.manner, `a choice without a manner: "${choice.text}"`).not.toBeNull();
    }
    const taken = path[step];
    if (taken === undefined) {
      return beat.choices.reduce((n, c) => n + walk(json, knot, facts, [...path, c.index], depth + 1), 0);
    }
    conversation.choose(taken);
    step += 1;
  }
}

describe('the story', () => {
  const files = readdirSync('story').filter((f) => f.endsWith('.ink'));

  it('has a list of starting knots for every ink file', () => {
    for (const file of files) expect(KNOTS[file], file).toBeDefined();
  });

  for (const file of files) {
    it(`${file}: compiles, and every path from every knot ends, for every hero`, () => {
      const json = compile(file);
      for (const knot of KNOTS[file] ?? []) {
        for (const origin of ORIGINS) {
          for (const heroClass of CLASSES) {
            const facts = { name: 'Ada', heroClass: heroClass.id, origin: origin.id, moment: MOMENTS[0]?.id ?? '' };
            expect(walk(json, knot, facts)).toBeGreaterThan(0);
          }
        }
      }
    });
  }

  it('reads tags as keys and values', () => {
    expect(parseTags(['speaker: Ren', 'line: ren_01', 'junk'])).toEqual({ speaker: 'Ren', line: 'ren_01' });
    expect(parseTags(null)).toEqual({});
  });

  it('marks each choice with its manner', () => {
    const range = new Conversation(compile('proof.ink'), 'ren_range', {
      name: 'Ada',
      heroClass: 'warden',
      origin: 'den-raised',
      moment: '',
    });
    range.next();
    const first = range.next();
    expect(first.kind === 'choices' && first.choices.map((c) => [c.text, c.manner])).toEqual([
      ['Do they?', 'ask'],
      ['Just checking the range.', 'plain'],
    ]);
  });

  it('answers who the hero is, and remembers what was said', () => {
    const json = compile('proof.ink');
    const den = new Conversation(json, 'ren_range', {
      name: 'Ada',
      heroClass: 'warden',
      origin: 'den-raised',
      moment: '',
    });
    den.next();
    den.next();
    den.choose(0);
    const lines: string[] = [];
    for (let beat = den.next(); beat.kind === 'line'; beat = den.next()) lines.push(beat.text);
    expect(lines.join(' ')).toContain('Wake habit');
    expect(lines.join(' ')).toContain('first hit');
    den.choose(0);
    while (den.next().kind !== 'end') {
      // read to the end
    }
    expect(den.variable('ren_approval')).toBe(1);
  });
});
