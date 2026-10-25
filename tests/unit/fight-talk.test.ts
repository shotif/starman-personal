import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BANKED_VOICES,
  bankedLines,
  bankedSays,
  type CompanionCall,
  type CompanionName,
  companionLines,
  fightLines,
  newTalk,
  nextLine,
  TALK,
} from '../../src/game/fight-talk.ts';

const voices = JSON.parse(readFileSync('public/assets/voices/voices.json', 'utf8')) as {
  lines: Record<string, unknown>;
};

/** Battle talk (D-67; ACT1_ART.md §2): what is said in a fight, every line voiced (D-23). */
describe('fight talk', () => {
  const calls: CompanionCall[] = [
    'follow',
    'hold',
    'attack',
    'unreachable',
    'noTarget',
    'arrived',
    'targetDown',
    'down',
    'engineer',
    'barrierDown',
    'motes',
  ];

  it('gives each companion their own words for every call', () => {
    for (const name of ['Ren', 'Jo', 'Mira'] as CompanionName[]) {
      for (const call of calls) {
        const lines = companionLines(name, call);
        expect(lines.length, `${name} ${call}`).toBeGreaterThan(0);
        for (const l of lines) expect(l.speaker).toBe(name);
      }
    }
    // Ren still answers "With you." first, as the browser journeys expect.
    expect(companionLines('Ren', 'follow')[0]?.text).toBe('With you.');
  });

  it('has a voice for every line, each id once', () => {
    const ids = fightLines().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(voices.lines[id], `no voice for ${id}`).toBeDefined();
  });

  it('takes the wordings of a call in turn, so none is heard twice running', () => {
    const said = new Map<string, number>();
    const lines = companionLines('Jo', 'targetDown');
    const heard = [0, 1, 2, 3].map(() => nextLine(lines, said)?.text);
    expect(heard).toEqual([lines[0]?.text, lines[1]?.text, lines[0]?.text, lines[1]?.text]);
    // Another call keeps its own count.
    expect(nextLine(companionLines('Jo', 'down'), said)?.text).toBe(companionLines('Jo', 'down')[0]?.text);
    expect(nextLine([], said)).toBeNull();
  });

  it('gives each of the Banked only the calls of their kind, and everyone the rest', () => {
    expect(BANKED_VOICES).toHaveLength(5);
    expect(bankedLines('Trooper2', 'spotted').length).toBeGreaterThan(0);
    expect(bankedLines('Engineer', 'spotted')).toEqual([]);
    expect(bankedLines('Warden', 'shield')).toEqual([]);
    expect(bankedLines('Engineer', 'shield').length).toBeGreaterThan(0);
    expect(bankedLines('Warden', 'barrierDown').length).toBeGreaterThan(0);
    for (const voice of BANKED_VOICES) {
      expect(bankedLines(voice, 'allyDown').length, voice).toBeGreaterThan(0);
      expect(bankedLines(voice, 'taunt').length, voice).toBeGreaterThan(0);
    }
  });

  it('keeps the Banked to one voice at a time, apart, never the same line twice running', () => {
    let state = newTalk(0);
    const spotted = bankedLines('Trooper1', 'spotted');
    let said = bankedSays(state, spotted, 'spotted', 1, false);
    expect(said.line?.id).toBe(spotted[0]?.id);
    state = said.state;
    // Too soon after, or while someone speaks: nothing.
    expect(bankedSays(state, bankedLines('Trooper2', 'cover'), 'cover', 2, false).line).toBeNull();
    expect(bankedSays(state, bankedLines('Trooper2', 'cover'), 'cover', 9, true).line).toBeNull();
    // Later, the next wording; not the one just said.
    said = bankedSays(state, spotted, 'spotted', 1 + TALK.gap, false);
    expect(said.line?.id).toBe(spotted[1]?.id);
    state = said.state;
    // A death goes first: even straight after a line, even while one is said.
    expect(bankedSays(state, bankedLines('Trooper3', 'allyDown'), 'allyDown', 4, true).line).not.toBeNull();
    // Every wording said within the last half-minute: nothing more of that call.
    const one = bankedLines('Warden', 'barrierBack');
    let s2 = newTalk(0);
    for (const t of [0, 3]) s2 = bankedSays(s2, one, 'barrierBack', t, false).state;
    expect(bankedSays(s2, one, 'barrierBack', 6, false).line).toBeNull();
    expect(bankedSays(s2, one, 'barrierBack', 3 + TALK.repeat, false).line).not.toBeNull();
  });

  it('speaks to the hero once a fight, only after a while and in a quiet moment', () => {
    const lines = bankedLines('Trooper1', 'taunt');
    let state = newTalk(10);
    expect(bankedSays(state, lines, 'taunt', 12, false).line).toBeNull();
    state = bankedSays(state, bankedLines('Trooper1', 'cover'), 'cover', 17, false).state;
    expect(bankedSays(state, lines, 'taunt', 19, false).line).toBeNull();
    const said = bankedSays(state, lines, 'taunt', 17 + TALK.quietFor, false);
    expect(said.line).not.toBeNull();
    expect(bankedSays(said.state, lines, 'taunt', 60, false).line).toBeNull();
  });
});
