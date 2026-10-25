import { useState } from 'preact/hooks';
import type { Game, SavedGrowth } from '../game/game.ts';
import {
  COMPANION_POWERS,
  cannotRank,
  cannotTrain,
  companionPoints,
  companionRankUp,
  IN_HAND,
  levelOf,
  nextAt,
  pointsOf,
  powersAt,
  RANK_COST,
  rankOf,
  rankUp,
  TALENTS,
  TRAINING,
  toHand,
  train,
} from '../game/growth.ts';
import { CLASSES, MOMENTS, ORIGINS } from '../game/hero.ts';
import type { Looks } from '../game/looks.ts';
import { POWERS, type PowerId } from '../game/powers.ts';

const NAMES: Record<string, string> = { ren: 'Ren', jo: 'Jo' };

/** Rank pips: ●●○. */
function Pips({ rank }: { rank: number }) {
  return (
    <span class="growth__pips" role="img" aria-label={`Rank ${rank} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} class={i <= rank ? 'growth__pip growth__pip--on' : 'growth__pip'} />
      ))}
    </span>
  );
}

/**
 * The growth screen over the pause menu (ACT1.md, increment 3; D-53 to D-55): the hero's level and
 * points, each power's rank, the three in hand, the class's training and the backstory's talents;
 * and a page for each companion. Every change goes through growth.ts's rules and then the game.
 */
export function GrowthScreen({ game, looks, onClose }: { game: Game; looks: Looks; onClose(): void }) {
  const [state, setState] = useState(() => game.growth());
  const [tab, setTab] = useState<string>('hero');
  const apply = (next: SavedGrowth) => {
    if (game.setGrowth(next)) setState(game.growth());
  };
  const { hero, crew, fighting } = state;
  const heroClass = looks.heroClass;
  const level = levelOf(hero.xp);
  const next = nextAt(level);
  const points = pointsOf(hero);
  const learned = powersAt(heroClass, level);
  const training = TRAINING[heroClass];
  const className = CLASSES.find((c) => c.id === heroClass)?.name ?? '';
  const origin = ORIGINS.find((o) => o.id === looks.origin);
  const moment = MOMENTS.find((m) => m.id === looks.moment);
  const tabs = ['hero', ...state.crewKnown];
  const costLabel = (rank: number) => {
    const cost = RANK_COST[rank + 1];
    return cost === undefined ? 'Last rank' : `Rank ${rank + 1} · ${cost} ${cost === 1 ? 'point' : 'points'}`;
  };

  return (
    <div class="growth" role="dialog" aria-label="Growth">
      <p class="pause__title">Growth</p>
      <nav class="growth__tabs" aria-label="Who">
        {tabs.map((t) => (
          <button
            type="button"
            key={t}
            class={t === tab ? 'growth__tab growth__tab--on' : 'growth__tab'}
            aria-pressed={t === tab}
            onClick={() => setTab(t)}
          >
            {t === 'hero' ? looks.name || 'You' : NAMES[t]}
          </button>
        ))}
      </nav>
      <p class="growth__level">
        Level {level}
        <span class="growth__xp">
          {next === null ? ` · ${hero.xp} experience` : ` · ${hero.xp} of ${next} experience to level ${level + 1}`}
        </span>
      </p>
      <div class="growth__bar" aria-hidden="true">
        <span
          style={{
            width: `${next === null ? 100 : Math.round((100 * (hero.xp - (nextAt(level - 1) ?? 0))) / Math.max(1, next - (nextAt(level - 1) ?? 0)))}%`,
          }}
        />
      </div>
      {fighting && <p class="growth__note">Changes wait until the fight is over.</p>}

      {tab === 'hero' ? (
        <div class="growth__body">
          <p class="growth__points" data-testid="growth-points">
            {points} {points === 1 ? 'point' : 'points'} to spend
          </p>
          <h2 class="growth__head">In hand</h2>
          <ol class="growth__hand">
            {hero.hand.map((id, slot) => (
              <li key={id} class="growth__slot">
                <span class="growth__key">{slot + 1}</span> {POWERS[id].name}
              </li>
            ))}
          </ol>
          <h2 class="growth__head">{className} powers</h2>
          <ul class="growth__list">
            {learned.map((id) => {
              const rank = rankOf(hero, id);
              const why = cannotRank(hero, heroClass, id);
              return (
                <li key={id} class="growth__power" data-power={id}>
                  <div class="growth__row">
                    <strong>{POWERS[id].name}</strong> <Pips rank={rank} />
                  </div>
                  <p class="growth__says">{POWERS[id].says}</p>
                  <div class="growth__actions">
                    <button
                      type="button"
                      class="growth__rank"
                      disabled={!!why || fighting}
                      title={why ?? undefined}
                      onClick={() => apply({ hero: rankUp(hero, heroClass, id), crew })}
                    >
                      {costLabel(rank)}
                    </button>
                    {learned.length > IN_HAND && (
                      <fieldset class="growth__slots" aria-label={`Put ${POWERS[id].name} in hand`}>
                        {Array.from({ length: IN_HAND }, (_, slot) => (
                          <button
                            type="button"
                            key={slot}
                            class="growth__slotbutton"
                            aria-label={`${POWERS[id].name} to key ${slot + 1}`}
                            aria-pressed={hero.hand[slot] === id}
                            disabled={fighting}
                            onClick={() => apply({ hero: toHand(hero, heroClass, id as PowerId, slot), crew })}
                          >
                            {slot + 1}
                          </button>
                        ))}
                      </fieldset>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {training && (
            <>
              <h2 class="growth__head">Training</h2>
              <div class="growth__power" data-power="training">
                <div class="growth__row">
                  <strong>{training.name}</strong> <Pips rank={hero.training} />
                </div>
                <p class="growth__says">{training.says}</p>
                <button
                  type="button"
                  class="growth__rank"
                  disabled={!!cannotTrain(hero) || fighting}
                  onClick={() => apply({ hero: train(hero), crew })}
                >
                  {costLabel(hero.training)}
                </button>
              </div>
            </>
          )}
          <h2 class="growth__head">Talents</h2>
          <ul class="growth__talents">
            {origin && (
              <li>
                <strong>{origin.name}.</strong> {TALENTS[origin.id]?.says}
              </li>
            )}
            {moment && (
              <li>
                <strong>{moment.name}.</strong> {TALENTS[moment.id]?.says}
              </li>
            )}
          </ul>
        </div>
      ) : (
        <CrewPage who={tab} state={state} level={level} fighting={fighting} apply={apply} />
      )}
      <button type="button" class="codex__close" onClick={onClose}>
        Back
      </button>
    </div>
  );
}

function CrewPage({
  who,
  state,
  level,
  fighting,
  apply,
}: {
  who: string;
  state: SavedGrowth;
  level: number;
  fighting: boolean;
  apply(next: SavedGrowth): void;
}) {
  const c = state.crew[who];
  if (!c) return null;
  const name = NAMES[who] ?? who;
  const points = companionPoints(c, level);
  const set = (next: typeof c) => apply({ hero: state.hero, crew: { ...state.crew, [who]: next } });
  return (
    <div class="growth__body">
      <label class="growth__auto">
        <input type="checkbox" checked={c.auto} disabled={fighting} onChange={() => set({ ...c, auto: !c.auto })} />
        {name} chooses for herself
      </label>
      {!c.auto && (
        <p class="growth__points">
          {points} {points === 1 ? 'point' : 'points'} to spend
        </p>
      )}
      <ul class="growth__list">
        {(COMPANION_POWERS[who] ?? []).map((id) => {
          const rank = c.ranks[id] ?? 1;
          const cost = RANK_COST[rank + 1];
          return (
            <li key={id} class="growth__power" data-power={id}>
              <div class="growth__row">
                <strong>{POWERS[id].name}</strong> <Pips rank={rank} />
              </div>
              <p class="growth__says">{POWERS[id].says}</p>
              {!c.auto && (
                <button
                  type="button"
                  class="growth__rank"
                  disabled={fighting || cost === undefined || points < cost}
                  onClick={() => set(companionRankUp(c, who, id, level))}
                >
                  {cost === undefined ? 'Last rank' : `Rank ${rank + 1} · ${cost} ${cost === 1 ? 'point' : 'points'}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
