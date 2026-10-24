import type { Vec3Like } from './motion.ts';

/**
 * Where the camera stands in a conversation (DIALOGUE.md): over the listener's shoulder, looking at
 * the speaker's face. Pure, so the framing is tested: the listener's head must never hide the face.
 */
export interface Shot {
  position: Point;
  target: Point;
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

export const SHOT = {
  /** How far behind the listener's head the camera stands, in metres. */
  back: 0.9,
  /** How far to the side of the listener's head: on a wide screen, and on a narrow portrait one. */
  across: 0.75,
  acrossNarrow: 0.55,
  /** The least gap between the listener's head and the line from the camera to the speaker's face. */
  clearance: 0.38,
  /** The camera a little above the listener's eyes. */
  rise: 0.05,
  /** The camera aims this far below the speaker's head, so the face sits high in the frame. */
  drop: 0.15,
};

/**
 * The shot over `listener`'s shoulder onto `speaker` (both the middle of the head). `side` (+1 or
 * -1) is the side of the line from the hero to the partner the camera keeps all conversation, so the
 * two never swap places on screen; `heroToPartner` says which way that line runs. `aspect` is the
 * screen's width over its height: a narrow portrait screen frames the speaker with less shoulder.
 */
export function overShoulder(
  listener: Point,
  speaker: Point,
  heroToPartner: Vec3Like,
  side: 1 | -1,
  aspect: number,
): Shot {
  const dx = speaker.x - listener.x;
  const dz = speaker.z - listener.z;
  const apart = Math.hypot(dx, dz) || 1e-6;
  const d = { x: dx / apart, z: dz / apart };
  const line = Math.hypot(heroToPartner.x, heroToPartner.z) || 1e-6;
  const sideways = { x: (side * heroToPartner.z) / line, z: (-side * heroToPartner.x) / line };
  const narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.7));
  const wanted = SHOT.across + (SHOT.acrossNarrow - SHOT.across) * narrow;
  // The line from the camera to the speaker passes the listener's head at a distance of
  // across × apart / √((apart + back)² + across²); this is the least across that keeps it clear.
  const c = SHOT.clearance;
  const across = Math.max(wanted, (c * (apart + SHOT.back)) / Math.sqrt(Math.max(apart * apart - c * c, 0.01)));
  return {
    position: {
      x: listener.x - d.x * SHOT.back + sideways.x * across,
      y: listener.y + SHOT.rise,
      z: listener.z - d.z * SHOT.back + sideways.z * across,
    },
    // Copied by name: an engine vector keeps its coordinates behind getters, which a spread drops.
    target: { x: speaker.x, y: speaker.y - SHOT.drop, z: speaker.z },
  };
}

/** How far, across the ground, a point lies from the line from the camera to its target. */
export function clearanceOf(shot: Shot, point: Vec3Like): number {
  const ax = shot.target.x - shot.position.x;
  const az = shot.target.z - shot.position.z;
  const length = Math.hypot(ax, az) || 1e-6;
  return Math.abs((point.x - shot.position.x) * az - (point.z - shot.position.z) * ax) / length;
}

/** Which side of the line from the hero to the partner a point (the camera) is on: +1 or -1. */
export function sideOf(hero: Vec3Like, partner: Vec3Like, point: Vec3Like): 1 | -1 {
  const lx = partner.x - hero.x;
  const lz = partner.z - hero.z;
  return (point.x - hero.x) * lz - (point.z - hero.z) * lx >= 0 ? 1 : -1;
}
