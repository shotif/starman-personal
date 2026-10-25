import { useEffect, useRef, useState } from 'preact/hooks';
import type { Prompt } from '../game/game.ts';
import type { Input } from '../game/input.ts';
import { stickVector } from '../game/motion.ts';

/** How far the stick travels, in CSS pixels. */
const STICK_RADIUS = 56;
/** Touch look is a little faster than the mouse, since a thumb travels less. */
const LOOK_SCALE = 1.5;

/**
 * Phone controls (D-02, D-17): a stick that appears under the left thumb, a look area for the
 * right thumb, and a run toggle. Each area follows its own finger, so both work at once.
 */
export function TouchControls({
  input,
  commanding,
  talking,
  prompt,
  powers,
  onPower,
  onOrders,
  onInteract,
}: {
  input: Input;
  /** In the command view only the look area stays, to point the crosshair. */
  commanding: boolean;
  /** In a conversation (or paused, or down) none of the controls show. */
  talking: boolean;
  /** Someone to talk to, or something to use, within reach. */
  prompt: Prompt | null;
  /** The hero's three powers, and how far each is from ready. */
  powers: { id: string; name: string; waiting: number }[];
  onPower: (slot: number) => void;
  onOrders: () => void;
  onInteract: () => void;
}) {
  const stickFinger = useRef<number | null>(null);
  const stickOrigin = useRef({ x: 0, y: 0 });
  const lookFinger = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [running, setRunning] = useState(false);
  const runTouchedAt = useRef(Number.NEGATIVE_INFINITY);
  const [aiming, setAiming] = useState(false);
  const aimTouchedAt = useRef(Number.NEGATIVE_INFINITY);
  const [firing, setFiring] = useState(false);

  // The controls hide for a conversation, and the stick for the command view, often with a finger
  // still down: its lift goes elsewhere, and a finger remembered as down keeps every new touch out.
  // After the chief's scene, which starts by itself as the hero walks in, the camera would not turn
  // (the owner's phone, 25 October 2026). So hiding forgets the fingers.
  useEffect(() => {
    if (!talking) return;
    lookFinger.current = null;
    stickFinger.current = null;
    input.stick = { x: 0, y: 0 };
    input.fireTouch = false;
    setStick(null);
    setFiring(false);
  }, [talking, input]);
  useEffect(() => {
    if (!commanding) return;
    stickFinger.current = null;
    input.stick = { x: 0, y: 0 };
    setStick(null);
  }, [commanding, input]);

  /** When the left thumb last touched down: two touches close together are a dodge. */
  const lastStickDown = useRef(Number.NEGATIVE_INFINITY);
  const stickDown = (e: PointerEvent) => {
    if (stickFinger.current !== null) return;
    const now = performance.now();
    if (now - lastStickDown.current < 280) input.dodge = true;
    lastStickDown.current = now;
    stickFinger.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    stickOrigin.current = { x: e.clientX, y: e.clientY };
    setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  };
  const stickMove = (e: PointerEvent) => {
    if (e.pointerId !== stickFinger.current) return;
    const dx = e.clientX - stickOrigin.current.x;
    const dy = e.clientY - stickOrigin.current.y;
    input.stick = stickVector(dx, dy, STICK_RADIUS);
    const length = Math.hypot(dx, dy);
    const clamp = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
    setStick({ x: stickOrigin.current.x, y: stickOrigin.current.y, dx: dx * clamp, dy: dy * clamp });
  };
  const stickUp = (e: PointerEvent) => {
    if (e.pointerId !== stickFinger.current) return;
    stickFinger.current = null;
    input.stick = { x: 0, y: 0 };
    setStick(null);
  };

  const lookDown = (e: PointerEvent) => {
    if (lookFinger.current !== null) return;
    lookFinger.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: PointerEvent) => {
    if (e.pointerId !== lookFinger.current) return;
    input.addLook((e.clientX - lookLast.current.x) * LOOK_SCALE, (e.clientY - lookLast.current.y) * LOOK_SCALE);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e: PointerEvent) => {
    if (e.pointerId === lookFinger.current) lookFinger.current = null;
  };

  const toggleRun = () => {
    input.sprintToggle = !running;
    setRunning(!running);
  };
  // Phones send no click for a tap made while another finger is down (the left thumb is on the
  // stick), so the button acts on the touch itself. The click that may follow that touch is
  // ignored; a click with no touch before it (the keyboard) still toggles, for accessibility.
  const runDown = (e: PointerEvent) => {
    e.preventDefault();
    runTouchedAt.current = performance.now();
    toggleRun();
  };
  const runClick = () => {
    if (performance.now() - runTouchedAt.current > 1000) toggleRun();
  };

  // Aim toggles like Run; Fire fires for as long as it is held.
  const toggleAim = () => {
    input.aimToggle = !aiming;
    setAiming(!aiming);
  };
  const aimDown = (e: PointerEvent) => {
    e.preventDefault();
    aimTouchedAt.current = performance.now();
    toggleAim();
  };
  const aimClick = () => {
    if (performance.now() - aimTouchedAt.current > 1000) toggleAim();
  };
  const fireDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    input.fireTouch = true;
    setFiring(true);
  };
  const fireUp = () => {
    input.fireTouch = false;
    setFiring(false);
  };

  if (talking) return null;
  return (
    <div class="touch">
      {!commanding && (
        <div
          class="touch__move"
          data-testid="touch-move"
          onPointerDown={stickDown}
          onPointerMove={stickMove}
          onPointerUp={stickUp}
          onPointerCancel={stickUp}
          onLostPointerCapture={stickUp}
        />
      )}
      <div
        class="touch__look"
        data-testid="touch-look"
        onPointerDown={lookDown}
        onPointerMove={lookMove}
        onPointerUp={lookUp}
        onPointerCancel={lookUp}
        onLostPointerCapture={lookUp}
      />
      {!commanding && (
        <>
          {stick && (
            <div class="stick" style={{ left: `${stick.x}px`, top: `${stick.y}px` }} aria-hidden="true">
              <div class="stick__knob" style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
            </div>
          )}
          <button
            type="button"
            class={`touch__run${running ? ' touch__run--on' : ''}`}
            aria-pressed={running}
            onPointerDown={runDown}
            onClick={runClick}
          >
            Run
          </button>
          <button
            type="button"
            class="touch__orders"
            onPointerDown={(e) => {
              e.preventDefault();
              onOrders();
            }}
          >
            Orders
          </button>
          {prompt && (
            <button
              type="button"
              class="touch__talk"
              aria-label={prompt.label}
              onPointerDown={(e) => {
                e.preventDefault();
                onInteract();
              }}
            >
              {prompt.kind === 'talk' ? 'Talk' : 'Use'}
            </button>
          )}
          {powers.map((p, i) => (
            <button
              type="button"
              key={p.id}
              class={`touch__power touch__power--${i}${p.waiting > 0 ? ' touch__power--waiting' : ''}`}
              aria-label={p.name}
              onPointerDown={(e) => {
                e.preventDefault();
                onPower(i);
              }}
            >
              <span class="touch__power-fill" style={{ height: `${Math.round(p.waiting * 100)}%` }} />
              <span class="touch__power-name">{p.name}</span>
            </button>
          ))}
          <button
            type="button"
            class="touch__strike"
            onPointerDown={(e) => {
              e.preventDefault();
              input.strike = true;
            }}
          >
            Strike
          </button>
          <button
            type="button"
            class={`touch__aim${aiming ? ' touch__aim--on' : ''}`}
            aria-pressed={aiming}
            onPointerDown={aimDown}
            onClick={aimClick}
          >
            Aim
          </button>
          <button
            type="button"
            class={`touch__fire${firing ? ' touch__fire--on' : ''}`}
            onPointerDown={fireDown}
            onPointerUp={fireUp}
            onPointerCancel={fireUp}
          >
            Fire
          </button>
        </>
      )}
    </div>
  );
}
