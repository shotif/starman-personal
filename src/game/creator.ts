import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Scene } from '@babylonjs/core/scene';
import { CHARACTERS, type Wardrobe, wardrobe } from './appearance.ts';
import { type Character, loadCharacterTemplate, spawnCharacter } from './characters.ts';
import { createEngine, type Renderer } from './engine.ts';
import type { Body, Looks, Manifest } from './looks.ts';
import { poseWeights } from './pose.ts';
import type { QualityTier } from './quality.ts';

/**
 * The character creator's scene (CREATOR.md): the hero on a lit stand, breathing in their idle,
 * with a camera that orbits by drag and comes in close for the face.
 */
export type CreatorView = 'body' | 'face';

export interface Creator {
  /** Shows the hero in a set of looks; a change of body loads the other body. */
  show(looks: Looks): Promise<void>;
  focus(view: CreatorView): void;
  dispose(): void;
}

/** Where the camera looks, and from how far, for each view. */
const VIEWS: Record<CreatorView, { height: number; radius: number }> = {
  body: { height: 1.0, radius: 3.3 },
  face: { height: 1.62, radius: 0.85 },
};

export async function startCreator(
  canvas: HTMLCanvasElement,
  tier: QualityTier,
  renderer: Renderer,
  manifest: Manifest,
): Promise<Creator> {
  const engine = await createEngine(canvas, tier, renderer);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.03, 0.04, 0.06, 1);

  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
  fill.intensity = 0.55;
  fill.groundColor = new Color3(0.08, 0.09, 0.11);
  const key = new DirectionalLight('key', new Vector3(-0.4, -0.6, -1), scene);
  key.position = new Vector3(3, 4, 5);
  key.intensity = 1.6;
  const rim = new PointLight('rim', new Vector3(-1.5, 2.4, -2), scene);
  rim.diffuse = new Color3(0.5, 0.8, 1);
  rim.intensity = 14;

  const stand = CreateCylinder('stand', { diameter: 1.4, height: 0.08, tessellation: 48 }, scene);
  stand.position.y = -0.04;
  const standMaterial = new PBRMaterial('stand', scene);
  standMaterial.albedoColor = new Color3(0.1, 0.11, 0.13);
  standMaterial.metallic = 0.7;
  standMaterial.roughness = 0.35;
  standMaterial.emissiveColor = new Color3(0.02, 0.05, 0.08);
  stand.material = standMaterial;

  // The hero faces +z, so the camera stands on the +z side.
  const camera = new ArcRotateCamera('camera', Math.PI / 2, 1.42, VIEWS.body.radius, new Vector3(0, 1, 0), scene);
  camera.attachControl(canvas, true);
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  camera.panningSensibility = 0;
  camera.lowerBetaLimit = 0.9;
  camera.upperBetaLimit = 1.75;
  camera.lowerRadiusLimit = 0.6;
  camera.upperRadiusLimit = 5;
  camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.05;
  let goal = VIEWS.body;

  const templates = new Map<Body, Promise<AssetContainer | null>>();
  const template = (body: Body) => {
    let t = templates.get(body);
    if (!t) {
      t = loadCharacterTemplate(scene, `${CHARACTERS}${manifest.bodies[body].file}`);
      templates.set(body, t);
    }
    return t;
  };
  let shown: { body: Body; character: Character; clothes: Wardrobe } | null = null;

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    shown?.character.setPose(poseWeights({ mode: 'move', speed: 0 }), dt);
    const t = Math.min(1, dt * 5);
    camera.target.y += (goal.height - camera.target.y) * t;
    camera.radius += (goal.radius - camera.radius) * t;
  });
  engine.runRenderLoop(() => scene.render());
  // `?debug` exposes the creator's scene for testing in the browser's console.
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { lightkeeperCreator: { scene } });
  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  return {
    async show(looks) {
      if (shown?.body !== looks.body) {
        const container = await template(looks.body);
        shown?.character.root.dispose();
        const character = spawnCharacter(scene, container, `creator-${looks.body}`);
        shown = { body: looks.body, character, clothes: wardrobe(scene, character, manifest, looks.body) };
      }
      await shown.clothes.wear(looks);
    },
    focus(view) {
      goal = VIEWS[view];
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
