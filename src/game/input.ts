import { keysToVector, type Vec2 } from './motion.ts';

/**
 * What the player is asking for this frame, from whichever device they use. The touch controls
 * (src/ui/TouchControls.tsx) write the stick, look drag, aim toggle and fire button here; this class
 * adds the keyboard and the mouse on a desktop.
 */
export class Input {
  /** Movement from the touch stick, x right, y forward, length 0–1. */
  stick: Vec2 = { x: 0, y: 0 };
  /** Sprint held (Shift) or toggled (the touch button). */
  sprintToggle = false;
  /** Aim toggled by the touch button. */
  aimToggle = false;
  /** Fire held on the touch button. */
  fireTouch = false;
  /** A strike or a dodge asked for since the game last looked (F and Space, or the touch controls). */
  strike = false;
  dodge = false;
  private readonly keys = new Set<string>();
  private aimMouse = false;
  private fireMouse = false;
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
        if (e.repeat) return;
        if (e.code === 'KeyF') this.strike = true;
        if (e.code === 'Space') this.dodge = true;
      },
      { signal },
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), { signal });
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.aimMouse = false;
        this.fireMouse = false;
      },
      { signal },
    );
    // On a desktop, a click on the scene captures the mouse for looking around; Escape frees it.
    // With the mouse captured, the left button fires; the right button aims either way. The buttons
    // are read from every pointer event's button state: Babylon cancels pointerdown's default, so
    // no mousedown follows, and a second button pressed while one is held sends only a move.
    const buttons = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      this.aimMouse = (e.buttons & 2) !== 0;
      this.fireMouse = (e.buttons & 1) !== 0 && (document.pointerLockElement === canvas || this.aimMouse);
    };
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        buttons(e);
        const locked = document.pointerLockElement === canvas;
        if (e.pointerType === 'mouse' && e.button === 0 && !locked && !this.aimMouse) {
          if (matchMedia('(pointer: fine)').matches) canvas.requestPointerLock?.()?.catch?.(() => {});
        }
      },
      { signal },
    );
    window.addEventListener('pointermove', buttons, { signal });
    window.addEventListener('pointerup', buttons, { signal });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
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

  get aiming(): boolean {
    return this.aimToggle || this.aimMouse;
  }

  get firing(): boolean {
    return this.fireTouch || this.fireMouse;
  }

  /** A strike asked for since the last call, then cleared. */
  takeStrike(): boolean {
    const asked = this.strike;
    this.strike = false;
    return asked;
  }

  /** A dodge asked for since the last call, then cleared. */
  takeDodge(): boolean {
    const asked = this.dodge;
    this.dodge = false;
    return asked;
  }

  /** Lets go of everything held, and frees the mouse: a conversation needs the pointer for its choices. */
  release(): void {
    this.stick = { x: 0, y: 0 };
    this.fireTouch = false;
    this.fireMouse = false;
    this.strike = false;
    this.dodge = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  dispose(): void {
    this.abort.abort();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
