import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { QUALITY, type QualityTier } from './quality.ts';

/** The renderer: WebGL2 by default; `?renderer=webgpu` asks for WebGPU while it is being proven. */
export type Renderer = 'webgl2' | 'webgpu';

/** Starts Babylon on a canvas at a quality tier, drawing at no more than the tier's pixel ratio. */
export async function createEngine(
  canvas: HTMLCanvasElement,
  tier: QualityTier,
  renderer: Renderer,
): Promise<AbstractEngine> {
  const q = QUALITY[tier];
  let engine: AbstractEngine | null = null;
  if (renderer === 'webgpu' && 'gpu' in navigator) {
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
      const gpu = new WebGPUEngine(canvas, { antialias: q.antialias, powerPreference: 'high-performance' });
      await gpu.initAsync();
      engine = gpu;
    } catch (error) {
      console.warn('WebGPU could not start; using WebGL2.', error);
    }
  }
  engine ??= new Engine(canvas, q.antialias, { powerPreference: 'high-performance', stencil: true }, false);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
  return engine;
}

/** The renderer's name for the HUD. */
export function rendererName(engine: AbstractEngine): string {
  return engine.isWebGPU ? 'WebGPU' : `WebGL${(engine as Engine).webGLVersion}`;
}

/** The graphics chip's name where the browser tells it, so a screenshot of a fault says which chip. */
export function gpuName(engine: AbstractEngine): string {
  const name = engine.isWebGPU ? '' : ((engine as Engine).getGlInfo?.().renderer ?? '');
  // "ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)" → "Adreno (TM) 740"
  const inner = /ANGLE \([^,]*, ([^,]+)/.exec(name)?.[1];
  return (inner ?? name).trim().slice(0, 40);
}
