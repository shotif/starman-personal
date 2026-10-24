/**
 * Aim assist for phones (D-17, COVER_AND_AIM.md): the shot turns towards the nearest live target
 * inside a small cone around the crosshair. Pure.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AimCandidate {
  id: number;
  /** From the camera to the target's centre. */
  offset: Vec3;
}

/** Half-angle of the assist cone. */
export const ASSIST_CONE = (8 * Math.PI) / 180;

/** The candidate closest in angle to `forward` inside the cone and range, or null. */
export function pickAssistTarget(
  candidates: readonly AimCandidate[],
  forward: Vec3,
  cone = ASSIST_CONE,
  range = 45,
): number | null {
  const fl = Math.hypot(forward.x, forward.y, forward.z);
  if (fl === 0) return null;
  let best: { id: number; angle: number } | null = null;
  for (const c of candidates) {
    const d = Math.hypot(c.offset.x, c.offset.y, c.offset.z);
    if (d === 0 || d > range) continue;
    const cos = (c.offset.x * forward.x + c.offset.y * forward.y + c.offset.z * forward.z) / (d * fl);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle <= cone && (!best || angle < best.angle)) best = { id: c.id, angle };
  }
  return best?.id ?? null;
}
