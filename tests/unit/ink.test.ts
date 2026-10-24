import { Compiler } from 'inkjs/full';
import { describe, expect, it } from 'vitest';

/**
 * Dialogue and quests are written in ink (OPEN_SOURCE.md §4). This checks the toolchain: a scene
 * with a choice that is remembered compiles and plays in Node.
 */
const SCENE = `
VAR trusted_by_vael = false
The dock officer looks up from her slate. "You're the one who came in on the courier."
* "I am. I'm looking for the Pyre survey crew."
  ~ trusted_by_vael = true
  "Then you'll want the lower ring. Mind the lifts."
* "Who's asking?"
  "Someone who can close this dock to you."
- -> END
`;

describe('ink', () => {
  it('compiles a scene and remembers the choice made', () => {
    const story = new Compiler(SCENE).Compile();
    expect(story.Continue()).toContain('dock officer');
    expect(story.currentChoices.map((c) => c.text)).toHaveLength(2);
    story.ChooseChoiceIndex(0);
    expect(story.ContinueMaximally()).toContain('lower ring');
    expect(story.variablesState.$('trusted_by_vael')).toBe(true);
  });
});
