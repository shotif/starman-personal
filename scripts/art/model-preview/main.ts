/**
 * The preview page for scripts/art/models.ts: loads one finished model with the game's own
 * Babylon.js and draws it from six sides, so its facing, size and base can be checked by eye.
 * Views are named by where the camera stands in glTF's axes: +Z is the model's front (Babylon's
 * loader keeps +Z as Babylon's forward), +X its left side and +Y up.
 */
import {
  ArcRotateCamera,
  type AssetContainer,
  Color3,
  Color4,
  CreateDisc,
  CreateLineSystem,
  CreateSphere,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  Mesh,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  StandardMaterial,
  Vector3,
  Viewport,
} from '@babylonjs/core';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';

registerBuiltInLoaders();

/** Camera directions in glTF's axes (Babylon's loader turns glTF +X into Babylon −X). */
const VIEWS: { label: string; dir: [number, number, number] }[] = [
  { label: 'front (from +Z)', dir: [0, 0.3, 1] },
  { label: 'three-quarter (from +Z+X)', dir: [0.75, 0.45, 1] },
  { label: 'left side (from +X)', dir: [1, 0.2, 0] },
  { label: 'back (from −Z)', dir: [0, 0.3, -1] },
  { label: 'right side (from −X)', dir: [-1, 0.2, 0] },
  { label: 'top (front at the bottom)', dir: [0, 1, 0.02] },
];

const canvas = document.getElementById('view') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.42, 0.43, 0.45, 1);
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.1;

const hemi = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.55;
hemi.groundColor = new Color3(0.25, 0.25, 0.28);
const key = new DirectionalLight('key', new Vector3(-0.5, -1, -0.7), scene);
key.intensity = 2.2;

// A plain studio environment for metal to reflect: a light dome over a dark floor, drawn once
// into a reflection probe and then hidden.
const dome = CreateSphere('dome', { diameter: 400, sideOrientation: Mesh.BACKSIDE }, scene);
const domeMaterial = new StandardMaterial('dome', scene);
domeMaterial.disableLighting = true;
domeMaterial.emissiveColor = new Color3(0.78, 0.8, 0.84);
dome.material = domeMaterial;
const floor = CreateDisc('floor', { radius: 190, sideOrientation: Mesh.DOUBLESIDE }, scene);
floor.rotation.x = Math.PI / 2;
floor.position.y = -2;
const floorMaterial = new StandardMaterial('floor', scene);
floorMaterial.disableLighting = true;
floorMaterial.emissiveColor = new Color3(0.16, 0.16, 0.17);
floor.material = floorMaterial;
const probe = new ReflectionProbe('studio', 256, scene);
probe.renderList?.push(dome, floor);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.7;

const cameras = VIEWS.map((_, i) => {
  const camera = new ArcRotateCamera(`view-${i}`, 0, 0, 1, Vector3.Zero(), scene);
  camera.fov = 0.55;
  camera.minZ = 0.01;
  camera.viewport = new Viewport((i % 3) / 3, i < 3 ? 0.5 : 0, 1 / 3, 0.5);
  return camera;
});
scene.activeCameras = cameras;
scene.render();
dome.setEnabled(false);
floor.setEnabled(false);

let shown: AssetContainer | null = null;
let grid: Mesh | null = null;

function makeGrid(half: number, step: number): Mesh {
  const lines: Vector3[][] = [];
  for (let v = -half; v <= half + 1e-6; v += step) {
    lines.push([new Vector3(v, 0, -half), new Vector3(v, 0, half)]);
    lines.push([new Vector3(-half, 0, v), new Vector3(half, 0, v)]);
  }
  const mesh = CreateLineSystem('grid', { lines }, scene);
  mesh.color = new Color3(0.2, 0.21, 0.23);
  return mesh;
}

export interface Shown {
  min: [number, number, number];
  max: [number, number, number];
  meshes: number;
  materials: string[];
}

async function show(url: string, title: string): Promise<Shown> {
  shown?.dispose();
  grid?.dispose();
  const container = await LoadAssetContainerAsync(url, scene);
  container.addAllToScene();
  shown = container;
  const root = container.meshes.find((m) => m.name === '__root__') ?? container.meshes[0];
  const { min, max } = root.getHierarchyBoundingVectors(true);
  const size = max.subtract(min);
  const longest = Math.max(size.x, size.y, size.z);
  const step = longest < 1.5 ? 0.1 : longest < 12 ? 1 : 5;
  grid = makeGrid(Math.ceil((longest * 0.75) / step) * step, step);
  const centre = min.add(max).scale(0.5);
  const radius = size.length() / 2;
  cameras.forEach((camera, i) => {
    const [x, y, z] = VIEWS[i].dir;
    const dir = new Vector3(-x, y, z).normalize(); // glTF +X is Babylon −X
    camera.target = centre.clone();
    camera.setPosition(centre.add(dir.scale((radius / Math.sin(camera.fov / 2)) * 1.02)));
  });
  (document.getElementById('title') as HTMLElement).innerHTML =
    `${title} <span>${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m (x × y × z)</span>` +
    `<span>base y = ${min.y.toFixed(3)} m</span><span>grid ${step} m</span>`;
  (document.getElementById('labels') as HTMLElement).innerHTML = VIEWS.map((v) => `<div>${v.label}</div>`).join('');
  await scene.whenReadyAsync();
  for (let i = 0; i < 3; i++) {
    scene.render();
    await new Promise((r) => requestAnimationFrame(r));
  }
  return {
    min: [-max.x, min.y, min.z],
    max: [-min.x, max.y, max.z],
    meshes: container.meshes.length,
    materials: container.materials.map((m) => m.name),
  };
}

(window as unknown as { preview: { show: typeof show } }).preview = { show };
engine.runRenderLoop(() => scene.render());
