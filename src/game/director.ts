import { type Line, parseTags, type StoryRunner } from './conversation.ts';

/**
 * The director (SLICE.md): runs the slice's main flow in ink. A line beginning `>>>` is a command
 * for the game (open a door, start a fight, set the objective); `>>> wait <event>` stops until the
 * game reports that event (several may be given, split by `|`, or a number of seconds); any other
 * line is spoken in the world, a bark with its speaker. Commands that start something the story
 * must wait for (a forced conversation, a fight, the drill, the lift-off) wait by themselves.
 * Pure of the game: it talks to a host, so the whole slice can be walked in a test.
 */
export interface Command {
  verb: string;
  args: string[];
  /** Everything after the verb, as written (objective text, captions). */
  rest: string;
}

export interface DirectorHost {
  command(command: Command): void;
  bark(line: Line): void;
  /** The story reached a checkpoint: save `state`. */
  checkpoint(name: string, state: string): void;
}

/** Commands that start something, and the event that says it is over. */
const WAITS_FOR: Record<string, (c: Command) => string> = {
  scene: (c) => `talked:${c.args[1] ?? ''}`,
  encounter: (c) => `cleared:${c.args[0] ?? ''}`,
  drill: () => 'cleared:drill',
  liftoff: () => 'done:liftoff',
};

export function parseCommand(line: string): Command | null {
  if (!line.startsWith('>>>')) return null;
  const body = line.slice(3).trim();
  const space = body.indexOf(' ');
  const verb = space < 0 ? body : body.slice(0, space);
  const rest = space < 0 ? '' : body.slice(space + 1).trim();
  return { verb, args: rest ? rest.split(/\s+/) : [], rest };
}

export class Director {
  /** The events the story waits for, or null when it is running or over. */
  waiting: string[] | null = null;
  /** Seconds left of a timed wait. */
  private timer = 0;
  ended = false;
  private readonly runner: StoryRunner;
  private readonly host: DirectorHost;

  constructor(runner: StoryRunner, host: DirectorHost) {
    this.runner = runner;
    this.host = host;
  }

  /** Runs the main flow until it waits or ends. */
  step(): void {
    const story = this.runner.story;
    story.SwitchToDefaultFlow();
    while (story.canContinue) {
      const text = (story.Continue() ?? '').trim();
      if (!text) continue;
      const command = parseCommand(text);
      if (!command) {
        const tags = parseTags(story.currentTags);
        this.host.bark({ speaker: tags.speaker ?? 'narrator', text, id: tags.line ?? null });
        continue;
      }
      if (command.verb === 'checkpoint') {
        this.host.checkpoint(command.args[0] ?? '', this.runner.save());
        continue;
      }
      if (command.verb === 'wait') {
        const seconds = Number(command.args[0]);
        if (command.args.length === 1 && Number.isFinite(seconds)) {
          this.timer = seconds;
          this.waiting = ['time'];
        } else {
          this.waiting = command.rest.split('|').map((e) => e.trim());
        }
        return;
      }
      if (command.verb === 'end') this.ended = true;
      this.host.command(command);
      const waitsFor = WAITS_FOR[command.verb];
      if (waitsFor) {
        this.waiting = [waitsFor(command)];
        return;
      }
    }
    this.ended = true;
    this.waiting = null;
  }

  /** The game reports something that happened; if the story waits for it, it goes on. */
  event(name: string): void {
    if (!this.waiting?.includes(name)) return;
    this.runner.set('event', name);
    this.waiting = null;
    this.step();
  }

  update(dt: number): void {
    if (this.waiting?.[0] !== 'time') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.waiting = null;
      this.step();
    }
  }
}
