import type { Camera } from '@babylonjs/core/Cameras/camera';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { Scene } from '@babylonjs/core/scene';
import type { QualityTier } from './quality.ts';

/**
 * The look of every frame (D-22): filmic tone mapping, a little contrast, a vignette and a thin haze
 * on every tier (they cost almost nothing: the materials apply them); bloom on the station's lamps,
 * screens and the swarm's eyes on high only, since phones pay for every full-screen pass.
 */
export interface Atmosphere {
  /** Thicker haze outside and in the hangar, thinner indoors; redder once the lights go. */
  setMood(mood: { lightsOut: boolean; outdoors: boolean }): void;
}

export function buildAtmosphere(scene: Scene, camera: Camera, tier: QualityTier): Atmosphere {
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.25;
  ip.contrast = 1.18;
  ip.vignetteEnabled = true;
  ip.vignetteWeight = 1.6;
  ip.vignetteStretch = 0.3;
  ip.vignetteColor = new Color4(0, 0, 0, 0);
  ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.006;
  scene.fogColor = new Color3(0.04, 0.045, 0.06);

  if (tier === 'high') {
    const pipeline = new DefaultRenderingPipeline('look', true, scene, [camera]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.72;
    pipeline.bloomWeight = 0.32;
    pipeline.bloomKernel = 48;
    pipeline.bloomScale = 0.5;
    pipeline.fxaaEnabled = false;
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 6;
    pipeline.grain.animated = true;
    // The pipeline runs its own image processing; keep the scene's settings.
    pipeline.imageProcessingEnabled = false;
  }

  return {
    setMood({ lightsOut, outdoors }) {
      scene.fogDensity = outdoors ? 0.004 : lightsOut ? 0.012 : 0.006;
      scene.fogColor = lightsOut ? new Color3(0.07, 0.025, 0.025) : new Color3(0.04, 0.045, 0.06);
      ip.exposure = lightsOut ? 1.45 : 1.25;
    },
  };
}
