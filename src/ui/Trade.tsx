import { useEffect, useState } from 'preact/hooks';
import type { Game } from '../game/game.ts';
import {
  buyMod,
  buyPart,
  cannotBuy,
  cannotBuyPart,
  modPrice,
  modValue,
  PARTS,
  type PartId,
  sellMod,
} from '../game/money.ts';
import { type Kit, MODS, type ModId, WEAPONS } from '../game/weapons.ts';

/** What Tilly has in her hold, in the order she lays it out. */
const STOCK: ModId[] = ['stabiliser', 'scope', 'barrel', 'heavy', 'coil'];
const PART_STOCK: PartId[] = ['plating'];

/**
 * Tilly's stall (D-62; PYRE.md §7): what she sells, what the hero could sell her, and *Lantern*'s
 * account. Buying and selling each ask once. A phone has one column; a desktop two, hers and the
 * hero's. Every change goes through money.ts's rules and then the game.
 */
export function Trade({ game, onClose }: { game: Game; onClose(): void }) {
  const [state, setState] = useState(() => game.kit());
  /** A purchase or a sale waiting to be confirmed. */
  const [asking, setAsking] = useState<{ what: string; next: Kit } | null>(null);
  const apply = (next: Kit) => {
    if (game.setKit(next)) setState(game.kit());
    setAsking(null);
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (asking) setAsking(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [onClose, asking]);
  const { kit, fighting, makeDo } = state;

  return (
    <div class="growth trade" role="dialog" aria-label="Tilly's stall">
      <p class="pause__title">Tilly's stall</p>
      <p class="armoury__carried" data-testid="credits">
        Lantern's account: <strong>{kit.credits} credits</strong>
        {makeDo && <span class="growth__xp"> · you make do: mods cost a fifth less</span>}
      </p>
      {fighting && <p class="growth__note">Trading waits until the fight is over.</p>}
      {asking && (
        <div class="trade__ask" role="alertdialog" aria-label="Confirm">
          <p class="trade__question">{asking.what}</p>
          <div class="growth__actions">
            <button type="button" class="growth__slotbutton" onClick={() => apply(asking.next)}>
              Yes
            </button>
            <button type="button" class="growth__slotbutton" onClick={() => setAsking(null)}>
              No
            </button>
          </div>
        </div>
      )}
      <div class="trade__columns">
        <section>
          <h2 class="growth__head">She sells</h2>
          <ul class="growth__list">
            {STOCK.map((id) => {
              const mod = MODS[id];
              const price = modPrice(id, makeDo);
              const why = cannotBuy(kit, id, makeDo);
              return (
                <li key={id} class="growth__power" data-buy={id}>
                  <div class="growth__row">
                    <strong>{mod.name}</strong>
                    <span class="growth__xp">{price} credits</span>
                  </div>
                  <p class="growth__says">{mod.says}</p>
                  <p class="growth__says">Fits: {mod.fits.map((k) => WEAPONS[k].name.toLowerCase()).join(', ')}</p>
                  <div class="growth__actions">
                    <button
                      type="button"
                      class="growth__slotbutton"
                      disabled={fighting || !!why}
                      title={why ?? undefined}
                      onClick={() =>
                        setAsking({
                          what: `Buy a ${mod.name.toLowerCase()} for ${price} credits?`,
                          next: buyMod(kit, id, makeDo),
                        })
                      }
                    >
                      {why ?? 'Buy'}
                    </button>
                  </div>
                </li>
              );
            })}
            {PART_STOCK.map((id) => {
              const part = PARTS[id];
              const why = cannotBuyPart(kit, id);
              return (
                <li key={id} class="growth__power" data-buy={id}>
                  <div class="growth__row">
                    <strong>{part.name}</strong>
                    <span class="growth__xp">{part.price} credits</span>
                  </div>
                  <p class="growth__says">{part.says}</p>
                  <div class="growth__actions">
                    <button
                      type="button"
                      class="growth__slotbutton"
                      disabled={fighting || !!why}
                      onClick={() =>
                        setAsking({ what: `Buy ${part.name} for ${part.price} credits?`, next: buyPart(kit, id) })
                      }
                    >
                      {why ?? 'Buy'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h2 class="growth__head">You could sell</h2>
          {kit.mods.length === 0 ? (
            <p class="growth__says">Nothing she wants. Mods turn up on missions.</p>
          ) : (
            <ul class="growth__list">
              {kit.mods.map((m, i) => {
                const mod = MODS[m.id];
                const value = modValue(m.id);
                return (
                  <li key={`${m.id}-${i}`} class="growth__power" data-sell={m.id}>
                    <div class="growth__row">
                      <strong>{mod.name}</strong>
                      <span class="growth__xp">
                        {m.on ? `on the ${WEAPONS[m.on].name.toLowerCase()}` : 'not fitted'} · {value} credits
                      </span>
                    </div>
                    <div class="growth__actions">
                      <button
                        type="button"
                        class="growth__slotbutton"
                        disabled={fighting}
                        onClick={() =>
                          setAsking({
                            what: `Sell the ${mod.name.toLowerCase()} for ${value} credits?`,
                            next: sellMod(kit, i),
                          })
                        }
                      >
                        Sell
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <button type="button" class="codex__close" onClick={onClose}>
        Back
      </button>
    </div>
  );
}
