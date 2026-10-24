import { keysToVector, type Vec2 } from './motion.ts';

/**
 * What the player is asking for this frame, from whichever device they use. The touch controls
 * (src/ui/TouchControls.tsx) write the stick and look drag here; this class adds the keyboard
 * and the mouse on a desktop.
 */
export class Input {
  /** Movement from the touch stick, x right, y forward, length 0–1. */
  stick: Vec2 = { x: 0, y: 0 };
  /** Sprint held (Shift) or toggled (the touch button). */
  sprintToggle = false;
  private readonly keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private readonly abort = new AbortController();
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const signal = this.abort.signal;
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.target instanceof HTMLInputElement) return;
        this.keys.add(e.code);
      },
      { signal },
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), { signal });
    window.addEventListener('blur', () => this.keys.clear(), { signal });
    // On a desktop, a click on the scene captures the mouse for looking around; Escape frees it.
    canvas.addEventListener(
      'click',
      () => {
        if (matchMedia('(pointer: fine)').matches && document.pointerLockElement !== canvas) {
          canvas.requestPointerLock?.()?.catch?.(() => {});
        }
      },
      { signal },
    );
    window.addEventListener(
      'mousemove',
      (e) => {
        if (document.pointerLockElement === canvas) this.addLook(e.movementX, e.movementY);
      },
      { signal },
    );
  }

  /** Adds a look movement in screen pixels (touch drag or mouse). */
  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  /** The look movement since the last call, then cleared. */
  takeLook(): Vec2 {
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  /** Movement from the keys or the stick, whichever is pushed further. */
  move(): Vec2 {
    const keys = keysToVector(this.keys);
    return Math.hypot(keys.x, keys.y) >= Math.hypot(this.stick.x, this.stick.y) ? keys : this.stick;
  }

  get sprint(): boolean {
    return this.sprintToggle || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  dispose(): void {
    this.abort.abort();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
