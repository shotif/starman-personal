import { useEffect, useState } from 'preact/hooks';
import type { Game } from '../game/game.ts';
import {
  carriedWeight,
  carry,
  fitMod,
  fitted,
  KINDS,
  type Kit,
  MOD_SLOTS,
  MODS,
  modsOn,
  TRAINED,
  WEAPONS,
  type WeaponKind,
  weightScale,
} from '../game/weapons.ts';

const CLASS_NAMES: Record<string, string> = {
  breacher: 'Breachers',
  rigger: 'Riggers',
  fieldwright: 'Fieldwrights',
  shade: 'Shades',
  striker: 'Strikers',
  warden: 'Wardens',
};

/** Who is trained in a kind, in words: "Breachers and Shades". */
const trainedIn = (kind: WeaponKind) => {
  const names = Object.entries(TRAINED)
    .filter(([, kinds]) => kinds.includes(kind))
    .map(([c]) => CLASS_NAMES[c] ?? c);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '');
};

/**
 * The armoury in *Lantern*'s store room (D-56; ACT1.md, increment 3): the two weapons carried, each
 * kind's numbers, and the mods found, fitted two to a weapon. Every change goes through weapons.ts's
 * rules and then the game.
 */
export function Armoury({ game, heroClass, onClose }: { game: Game; heroClass: string; onClose(): void }) {
  const [state, setState] = useState(() => game.kit());
  const apply = (next: Kit) => {
    if (game.setKit(next)) setState(game.kit());
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [onClose]);
  const { kit, fighting } = state;
  const [first, second] = kit.carried;
  const weight = carriedWeight(kit);
  const slower = Math.round((weightScale(weight) - 1) * 100);

  return (
    <div class="growth armoury" role="dialog" aria-label="Armoury">
      <p class="pause__title">Armoury</p>
      {fighting && <p class="growth__note">Changes wait until the fight is over.</p>}
      <p class="armoury__carried" data-testid="carried">
        In hand: <strong>{WEAPONS[first].name}</strong>
        {second && (
          <>
            {' '}
            · second: <strong>{WEAPONS[second].name}</strong>
          </>
        )}
        <span class="growth__xp">
          {' '}
          · weight {weight}
          {slower > 0 ? `: your powers return ${slower}% slower` : ''}
        </span>
      </p>
      <h2 class="growth__head">Weapons</h2>
      <ul class="growth__list">
        {KINDS.map((kind) => {
          const w = fitted(kind, modsOn(kit, kind));
          const trained = (TRAINED[heroClass] ?? []).includes(kind);
          const have = kit.weapons.includes(kind);
          return (
            <li key={kind} class="growth__power" data-weapon={kind}>
              <div class="growth__row">
                <strong>{w.name}</strong>
                <span class="growth__xp">weight {w.weight}</span>
              </div>
              <p class="growth__says">{w.says}</p>
              <p class="armoury__numbers">
                {(1 / w.interval).toFixed(1)} a second · {w.pellets > 1 ? `${w.pellets} × ` : ''}
                {Math.round(w.damage)} damage · {Math.round(w.reach)} m
              </p>
              {w.mods.length > 0 && <p class="growth__says">Fitted: {w.mods.map((m) => MODS[m].name).join(', ')}</p>}
              {!trained ? (
                <p class="growth__says">Not trained: for {trainedIn(kind)}.</p>
              ) : !have ? (
                <p class="growth__says">Not yet found.</p>
              ) : (
                <div class="growth__actions">
                  <button
                    type="button"
                    class="growth__slotbutton armoury__carry"
                    aria-pressed={first === kind}
                    disabled={fighting}
                    onClick={() => apply(carry(kit, heroClass, kind, first === kind ? second : first))}
                  >
                    In hand
                  </button>
                  <button
                    type="button"
                    class="growth__slotbutton armoury__carry"
                    aria-pressed={second === kind}
                    disabled={fighting || first === kind}
                    onClick={() => apply(carry(kit, heroClass, first, second === kind ? null : kind))}
                  >
                    Second
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <h2 class="growth__head">Mods</h2>
      {kit.mods.length === 0 ? (
        <p class="growth__says">None found yet. They turn up on missions.</p>
      ) : (
        <ul class="growth__list">
          {kit.mods.map((m) => {
            const mod = MODS[m.id];
            return (
              <li key={m.id} class="growth__power" data-mod={m.id}>
                <div class="growth__row">
                  <strong>{mod.name}</strong>
                  <span class="growth__xp">{m.on ? `on the ${WEAPONS[m.on].name.toLowerCase()}` : 'not fitted'}</span>
                </div>
                <p class="growth__says">{mod.says}</p>
                <div class="growth__actions">
                  {kit.weapons
                    .filter((k) => mod.fits.includes(k))
                    .map((k) => {
                      const full = m.on !== k && modsOn(kit, k).length >= MOD_SLOTS;
                      return (
                        <button
                          type="button"
                          key={k}
                          class="growth__slotbutton"
                          aria-pressed={m.on === k}
                          disabled={fighting || full}
                          title={full ? 'Two mods already' : undefined}
                          onClick={() => apply(fitMod(kit, m.id, m.on === k ? null : k))}
                        >
                          {WEAPONS[k].name}
                        </button>
                      );
                    })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" class="codex__close" onClick={onClose}>
        Back
      </button>
    </div>
  );
}
