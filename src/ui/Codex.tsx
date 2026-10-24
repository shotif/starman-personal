import { useState } from 'preact/hooks';
import { CODEX, CODEX_KEY } from '../game/codex.ts';
import { load, save } from './settings.ts';

/** The ids of the entries opened so far, kept on the device across games. */
export function readCodex(): string[] {
  try {
    const ids: unknown = JSON.parse(load(CODEX_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => CODEX.some((e) => e.id === id)) : [];
  } catch {
    return [];
  }
}

export function keepCodex(ids: string[]): void {
  save(CODEX_KEY, JSON.stringify(ids));
}

/** The codex over the pause menu: the entries opened so far, one read at a time. */
export function Codex({ open, onClose }: { open: string[]; onClose: () => void }) {
  const entries = CODEX.filter((e) => open.includes(e.id));
  const [reading, setReading] = useState(entries.at(-1)?.id ?? null);
  const entry = entries.find((e) => e.id === reading) ?? null;
  return (
    <div class="codex" role="dialog" aria-label="Codex">
      <p class="pause__title">Codex</p>
      <div class="codex__body">
        <nav class="codex__list" aria-label="Entries">
          {entries.map((e) => (
            <button
              type="button"
              key={e.id}
              class={e.id === reading ? 'codex__item codex__item--on' : 'codex__item'}
              aria-pressed={e.id === reading}
              onClick={() => setReading(e.id)}
            >
              {e.title}
            </button>
          ))}
          {entries.length === 0 && <p class="codex__empty">Nothing yet.</p>}
        </nav>
        {entry && (
          <article class="codex__entry">
            <h2 class="codex__title">{entry.title}</h2>
            {entry.observed && (
              <>
                <p class="codex__label">Observed</p>
                <p class="codex__text">{entry.observed}</p>
              </>
            )}
            <p class="codex__label codex__label--fiction">Fiction</p>
            <p class="codex__text">{entry.fiction}</p>
          </article>
        )}
      </div>
      <button type="button" class="codex__close" onClick={onClose}>
        Back
      </button>
    </div>
  );
}
