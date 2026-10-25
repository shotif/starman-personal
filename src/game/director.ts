import { type Line, parseTags, type StoryRunner } from './conversation.ts';

/**
 * The director (SLICE.md): runs the slice's main flow in ink. A line beginning `>>>` is a command
 * for the game (open a door, start a fight, set the objective); `>>> wait <event>` stops until the
 * game reports that event (several may be given, split by `|`, or a number of seconds); an event
 * that came before the story waited for it counts (the player may talk to Jo before Ren). Any other
 * line is spoken in the world, a bark with its speaker, and the story waits while it is said.
 * Commands that start something the story must wait for (a forced conversation, a fight, the drill,
 * the lift-off) wait by themselves. Pure of the game: it talks to a host, so the whole slice can be
 * walked in a test.
 */
export interface Command {
  verb: string;
  args: string[];
  /** Everything after the verb, as written (objective text, captions). */
  rest: string;
}

export interface DirectorHost {
  command(command: Command): void;
  /** Says a line in the world; returns how many seconds it takes, for the story to wait (none: 0). */
  bark(line: Line): number | undefined;
  /** The story reached a checkpoint: save `state`. */
  checkpoint(name: string, state: string): void;
}

/** Commands that start something, and the event that says it is over. */
const WAITS_FOR: Record<string, (c: Command) => string> = {
  scene: (c) => `talked:${c.args[1] ?? ''}`,
  encounter: (c) => `cleared:${c.args[0] ?? ''}`,
  drill: () => 'cleared:drill',
  liftoff: () => 'done:liftoff',
  // *Lantern* leaves orbit and the lane takes her.
  depart: () => 'done:depart',
  // On the way to another place: this game ends here; the next starts past the command.
  travel: () => 'done:travel',
  // A chapter's card: the player goes on when ready.
  card: () => 'done:card',
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
  /** Events that came before the story waited for them, kept until it does. */
  private readonly happened = new Set<string>();
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
        const line = { speaker: tags.speaker ?? 'narrator', text, id: tags.line ?? null, codex: tags.codex };
        const seconds = this.host.bark(line) ?? 0;
        if (seconds > 0) {
          this.timer = seconds;
          this.waiting = ['time'];
          return;
        }
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
          return;
        }
        const events = command.rest.split('|').map((e) => e.trim());
        const past = events.find((e) => this.happened.has(e));
        if (past) {
          this.happened.delete(past);
          this.runner.set('event', past);
          continue;
        }
        this.waiting = events;
        return;
      }
      if (command.verb === 'end') this.ended = true;
      this.host.command(command);
      const waitsFor = WAITS_FOR[command.verb];
      if (waitsFor) {
        const event = waitsFor(command);
        // Over already (a travel to the place the hero is in): go on.
        if (this.happened.delete(event)) {
          this.runner.set('event', event);
          continue;
        }
        this.waiting = [event];
        return;
      }
    }
    this.ended = true;
    this.waiting = null;
  }

  /** The game reports something that happened; if the story waits for it, it goes on. */
  event(name: string): void {
    if (!this.waiting?.includes(name)) {
      // Being somewhere is checked while the story waits for it; anything else is remembered.
      if (!name.startsWith('enter:')) this.happened.add(name);
      return;
    }
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
