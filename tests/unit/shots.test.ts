import { describe, expect, it } from 'vitest';
import { clearanceOf, overShoulder, SHOT, sideOf } from '../../src/game/shots.ts';

const hero = { x: 0, y: 1.6, z: 0 };
const PHONE = 0.46;
const DESKTOP = 16 / 9;

describe('conversation shots', () => {
  for (const aspect of [PHONE, DESKTOP]) {
    for (const apart of [0.6, 1.2, 1.8, 3]) {
      it(`never lets the listener's head hide the speaker (${apart} m apart, aspect ${aspect.toFixed(2)})`, () => {
        const partner = { x: apart * 0.6, y: 1.55, z: apart * 0.8 };
        const line = { x: partner.x, z: partner.z };
        for (const side of [1, -1] as const) {
          // The hero listening to the partner, then the partner listening to the hero.
          for (const [listener, speaker] of [
            [hero, partner],
            [partner, hero],
          ]) {
            const shot = overShoulder(listener, speaker, line, side, aspect);
            expect(clearanceOf(shot, listener)).toBeGreaterThanOrEqual(SHOT.clearance - 1e-9);
            // Behind the listener, looking at the speaker's face.
            const back =
              (shot.position.x - listener.x) * (speaker.x - listener.x) +
              (shot.position.z - listener.z) * (speaker.z - listener.z);
            expect(back).toBeLessThan(0);
            expect(shot.target).toEqual({ ...speaker, y: speaker.y - SHOT.drop });
          }
        }
      });
    }
  }

  it('keeps one side of the line for both shots, so the two never swap places on screen', () => {
    const partner = { x: 0, y: 1.6, z: 1.8 };
    const line = { x: 0, z: 1.8 };
    for (const side of [1, -1] as const) {
      const onPartner = overShoulder(hero, partner, line, side, DESKTOP);
      const onHero = overShoulder(partner, hero, line, side, DESKTOP);
      expect(sideOf(hero, partner, onPartner.position)).toBe(side);
      expect(sideOf(hero, partner, onHero.position)).toBe(side);
    }
  });

  it('reads points whose coordinates sit behind getters, as engine vectors do', () => {
    class Vector {
      private readonly c: [number, number, number];
      constructor(x: number, y: number, z: number) {
        this.c = [x, y, z];
      }
      get x() {
        return this.c[0];
      }
      get y() {
        return this.c[1];
      }
      get z() {
        return this.c[2];
      }
    }
    const shot = overShoulder(new Vector(0, 1.6, 0), new Vector(1, 1.55, 1.5), { x: 1, z: 1.5 }, 1, PHONE);
    expect(shot.target).toEqual({ x: 1, y: 1.55 - SHOT.drop, z: 1.5 });
    expect(Number.isFinite(shot.position.x + shot.position.y + shot.position.z)).toBe(true);
  });

  it('shows less shoulder on a narrow phone than on a wide screen', () => {
    const partner = { x: 0, y: 1.6, z: 1.8 };
    const line = { x: 0, z: 1.8 };
    const phone = overShoulder(hero, partner, line, 1, PHONE);
    const desktop = overShoulder(hero, partner, line, 1, DESKTOP);
    expect(clearanceOf(phone, hero)).toBeLessThan(clearanceOf(desktop, hero));
  });
});
