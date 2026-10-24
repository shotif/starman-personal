import { useEffect, useRef, useState } from 'preact/hooks';
import { CHARACTERS } from '../game/appearance.ts';
import type { Creator as CreatorScene, CreatorView } from '../game/creator.ts';
import type { Renderer } from '../game/engine.ts';
import {
  applyLineage,
  BODIES,
  type Body,
  defaultLooks,
  type Looks,
  type Manifest,
  randomLooks,
  sliderMorphs,
} from '../game/looks.ts';
import type { QualityTier } from '../game/quality.ts';

type Tab = 'who' | 'body' | 'face' | 'skin' | 'hair' | 'eyes';

/** A plain colour for each eye swatch; the iris textures are laid out for the eyeball, not a swatch. */
const IRIS: Record<string, string> = {
  brown: '#5b3a21',
  hazel: '#8a6b2e',
  green: '#4f7d3d',
  blue: '#3f6f9f',
  grey: '#8b959d',
};
const TABS: { id: Tab; label: string; view: CreatorView }[] = [
  { id: 'who', label: 'Who', view: 'body' },
  { id: 'body', label: 'Body', view: 'body' },
  { id: 'face', label: 'Face', view: 'face' },
  { id: 'skin', label: 'Skin', view: 'face' },
  { id: 'hair', label: 'Hair', view: 'face' },
  { id: 'eyes', label: 'Eyes', view: 'face' },
];

export interface CreatorProps {
  manifest: Manifest;
  initial: Looks;
  tier: QualityTier;
  renderer: Renderer;
  onStart(looks: Looks): void;
}

/** One choice of a group: a native radio button inside a label drawn as a button or a swatch. */
function Option({
  group,
  label,
  checked,
  onSelect,
  class: className,
  style,
  children,
}: {
  group: string;
  label: string;
  checked: boolean;
  onSelect(): void;
  class: string;
  style?: Record<string, string>;
  children?: preact.ComponentChildren;
}) {
  return (
    <label class={`${className}${checked ? ' choice--on' : ''}`} style={style} title={label}>
      <input
        type="radio"
        class="visually-hidden"
        name={group}
        checked={checked}
        aria-label={label}
        onChange={onSelect}
      />
      {children}
    </label>
  );
}

/** The character creator (CREATOR.md): a live 3D preview and the choices, in tabs. */
export function Creator({ manifest, initial, tier, renderer, onStart }: CreatorProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CreatorScene | null>(null);
  const [ready, setReady] = useState(false);
  const [looks, setLooks] = useState(initial);
  const [tab, setTab] = useState<Tab>('who');

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    import('../game/creator.ts')
      .then(({ startCreator }) => startCreator(element, tier, renderer, manifest))
      .then((c) => {
        if (disposed) c.dispose();
        else {
          scene.current = c;
          setReady(true);
        }
      })
      .catch((error: unknown) => console.error('The creator could not start.', error));
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [tier, renderer, manifest]);

  useEffect(() => {
    if (!ready || !scene.current) return;
    scene.current
      .show(looks)
      .then(() => {
        document.body.dataset.creator = 'ready';
      })
      .catch((error: unknown) => console.error(error));
  }, [ready, looks]);

  const choose = (next: Tab) => {
    setTab(next);
    scene.current?.focus(TABS.find((t) => t.id === next)?.view ?? 'body');
  };
  const setBody = (body: Body) => {
    if (body === looks.body) return;
    setLooks({ ...applyLineage(manifest, defaultLooks(manifest, body), looks.lineage), name: looks.name });
  };
  const slider = (name: string, value: number) => setLooks({ ...looks, sliders: { ...looks.sliders, [name]: value } });
  const options = manifest.looks[looks.body];
  const [minHeight, maxHeight] = manifest.heightScale.range;

  return (
    <main class="creator">
      <canvas ref={canvas} class="creator__scene" aria-label="Your hero" />
      {!ready && <p class="notice">Preparing the creator…</p>}
      <section class="creator__panel" aria-label="Create your hero">
        <h1 class="creator__title">Create your hero</h1>
        <div class="creator__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              class={`creator__tab${tab === t.id ? ' creator__tab--on' : ''}`}
              onClick={() => choose(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div class="creator__content" role="tabpanel">
          {tab === 'who' && (
            <>
              <label class="field">
                <span>Name</span>
                <input
                  type="text"
                  value={looks.name}
                  maxLength={40}
                  placeholder="Your hero's name"
                  onInput={(e) => setLooks({ ...looks, name: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
              <div class="choice-row" role="radiogroup" aria-label="Body">
                {BODIES.map((b) => (
                  <Option
                    key={b}
                    group="body"
                    label={b === 'man' ? 'Man' : 'Woman'}
                    checked={looks.body === b}
                    onSelect={() => setBody(b)}
                    class="choice"
                  >
                    {b === 'man' ? 'Man' : 'Woman'}
                  </Option>
                ))}
              </div>
              <div class="lineages" role="radiogroup" aria-label="Lineage">
                {Object.entries(manifest.lineages).map(([id, l]) => (
                  <Option
                    key={id}
                    group="lineage"
                    label={l.label}
                    checked={looks.lineage === id}
                    onSelect={() => setLooks(applyLineage(manifest, looks, id))}
                    class="lineage"
                  >
                    <strong>{l.label}</strong>
                    <span>{l.summary}</span>
                  </Option>
                ))}
              </div>
            </>
          )}

          {(tab === 'body' || tab === 'face') && (
            <div class="sliders">
              {tab === 'body' && (
                <label class="slider">
                  <span>Height</span>
                  <input
                    type="range"
                    min={minHeight}
                    max={maxHeight}
                    step={0.005}
                    value={looks.height}
                    onInput={(e) => setLooks({ ...looks, height: Number((e.currentTarget as HTMLInputElement).value) })}
                  />
                </label>
              )}
              {sliderMorphs(manifest, looks.body)
                .filter((m) => m.group === tab)
                .map((m) => (
                  <label key={m.name} class="slider">
                    <span>{m.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={looks.sliders[m.name] ?? 0}
                      onInput={(e) => slider(m.name, Number((e.currentTarget as HTMLInputElement).value))}
                    />
                  </label>
                ))}
            </div>
          )}

          {tab === 'skin' && (
            <div class="swatches" role="radiogroup" aria-label="Skin">
              {options.skins.map((o) => (
                <Option
                  key={o.id}
                  group="skin"
                  label={o.label}
                  checked={looks.skin === o.id}
                  onSelect={() => setLooks({ ...looks, skin: o.id })}
                  class="swatch swatch--skin"
                  style={o.file ? { backgroundImage: `url(${CHARACTERS}${o.file})` } : undefined}
                />
              ))}
            </div>
          )}

          {tab === 'hair' && (
            <div class="choice-grid" role="radiogroup" aria-label="Hair">
              {options.hair.map((o) => (
                <Option
                  key={o.id}
                  group="hair"
                  label={o.label}
                  checked={looks.hair === o.id}
                  onSelect={() => setLooks({ ...looks, hair: o.id })}
                  class="choice"
                >
                  {o.label}
                </Option>
              ))}
            </div>
          )}

          {tab === 'eyes' && (
            <div class="swatches" role="radiogroup" aria-label="Eyes">
              {options.eyes.map((o) => (
                <Option
                  key={o.id}
                  group="eyes"
                  label={o.label}
                  checked={looks.eyes === o.id}
                  onSelect={() => setLooks({ ...looks, eyes: o.id })}
                  class="swatch swatch--eye"
                  style={{ '--iris': IRIS[o.id] ?? '#777' }}
                />
              ))}
            </div>
          )}
        </div>

        <div class="creator__actions">
          <button
            type="button"
            class="button"
            onClick={() => setLooks({ ...randomLooks(manifest, Math.random), name: looks.name })}
          >
            Randomise
          </button>
          <button type="button" class="button button--primary" onClick={() => onStart(looks)}>
            Start
          </button>
        </div>
      </section>
    </main>
  );
}
