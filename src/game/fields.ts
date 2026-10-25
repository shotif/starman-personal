import { Constants } from '@babylonjs/core/Engines/constants';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Scene } from '@babylonjs/core/scene';

/**
 * One look for every field (D-69; ACT1_ART.md §4): the Shelter's dome, the Barrier round a person,
 * the Banked warden's barrier. A field is bent space with emitters at its edge, so it is drawn as a
 * faint shimmer that brightens where it is seen edge-on, with a fine lattice drifting across it, and a
 * ring that spreads from where something strikes it. Babylon's own Fresnel material: no shader of
 * our own, cheap enough for a phone. Blue for the hero's side, amber for the Banked.
 */
export const FIELD_BLUE = new Color3(0.45, 0.82, 1);
export const FIELD_AMBER = new Color3(1, 0.62, 0.2);

const lattices = new Map<string, DynamicTexture>();

/** A fine hexagonal lattice in a colour, drawn once, tiled across a field and drifting. */
function lattice(scene: Scene, colour: Color3): DynamicTexture {
  const key = colour.toHexString();
  const known = lattices.get(key);
  if (known && !known.getScene()?.isDisposed) return known;
  const t = new DynamicTexture(`field-lattice-${key}`, { width: 256, height: 256 }, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = colour.scale(0.28).toHexString();
  g.lineWidth = 1.5;
  // Hexagons 32 px across, in rows offset by half.
  const r = 16;
  const h = Math.sqrt(3) * r;
  for (let row = -1; row < 256 / h + 1; row++) {
    for (let col = -1; col < 256 / (1.5 * r) + 1; col++) {
      const cx = col * 1.5 * r;
      const cy = row * h + (col % 2 === 0 ? 0 : h / 2);
      g.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (Math.PI / 3) * k;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  t.update();
  t.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
  t.wrapV = DynamicTexture.WRAP_ADDRESSMODE;
  t.uScale = 9;
  t.vScale = 9;
  // It drifts, slowly, the same in every field of its colour.
  scene.onBeforeRenderObservable.add(() => {
    t.vOffset = (t.vOffset + scene.getEngine().getDeltaTime() / 1000 / 40) % 1;
  });
  lattices.set(key, t);
  return t;
}

/**
 * A field's material: see-through in the middle, bright at its edge, a lattice across it. It adds
 * light and never darkens what is behind it, as light bent by a field would.
 */
export function fieldMaterial(scene: Scene, name: string, colour: Color3, strength = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.emissiveColor = colour.scale(0.12 * strength);
  m.emissiveTexture = lattice(scene, colour);
  m.emissiveFresnelParameters = new FresnelParameters({
    bias: 0.1,
    power: 2.2,
    leftColor: colour.scale(1.1 * strength),
    rightColor: colour.scale(0.18 * strength),
  });
  m.alphaMode = Constants.ALPHA_ADD;
  m.alpha = 0.85;
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  return m;
}

/**
 * A ring spreading over a field from where it was struck: `at` on the field, `normal` its outward
 * facing there. Gone in under half a second.
 */
export function ripple(scene: Scene, at: Vector3, normal: Vector3, colour: Color3): void {
  const ring = CreateTorus('field-ripple', { diameter: 0.4, thickness: 0.05, tessellation: 24 }, scene);
  const m = new StandardMaterial('field-ripple', scene);
  m.disableLighting = true;
  m.emissiveColor = colour.scale(1.4);
  m.alphaMode = Constants.ALPHA_ADD;
  m.alpha = 0.9;
  ring.material = m;
  ring.isPickable = false;
  ring.position.copyFrom(at);
  // A torus lies in its own XZ plane: turned so its axis is the field's facing.
  ring.lookAt(at.add(normal), 0, Math.PI / 2);
  let t = 0;
  const tick = scene.onBeforeRenderObservable.add(() => {
    t += scene.getEngine().getDeltaTime() / 1000;
    const k = Math.min(1, t / 0.45);
    ring.scaling.setAll(1 + k * 3);
    m.alpha = 0.9 * (1 - k);
    if (k >= 1) {
      scene.onBeforeRenderObservable.remove(tick);
      ring.dispose();
      m.dispose();
    }
  });
}

/** Where a shot from `from` meets a round field of `radius` about `centre`, and its facing there. */
export function struckAt(centre: Vector3, radius: number, from: Vector3): { at: Vector3; normal: Vector3 } {
  const d = from.subtract(centre);
  const normal = d.lengthSquared() > 1e-6 ? d.normalize() : new Vector3(0, 0, 1);
  return { at: centre.add(normal.scale(radius)), normal };
}
