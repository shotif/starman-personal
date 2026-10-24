import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';

/**
 * The style test's gallery (docs/design/STYLE_TEST.md): each subject made by both tools, side by
 * side on pedestals along the room's left wall, turning slowly, labelled with the tool. It reads
 * public/assets/props/props.json and shows nothing if there is none.
 */
interface Prop {
  subject: string;
  tool: string;
  label: string;
  file: string;
  /** Metres along the longest side. */
  size: number;
}

const ORDER = ['sidearm', 'helmet', 'terminal', 'locker'];
const WALL_X = -5.35;
const FIRST_Z = 27.2;
const STEP = 1.15;
const PAIR_GAP = 0.45;
const SPIN = 0.35;

function label(scene: Scene, text: string, at: Vector3): void {
  const texture = new DynamicTexture(`label-${text}`, { width: 512, height: 96 }, scene, true);
  texture.drawText(text, null, 64, '600 44px system-ui, sans-serif', '#e8edf2', '#0a1018', true);
  const material = new PBRMaterial(`label-${text}-mat`, scene);
  material.albedoColor = new Color3(0, 0, 0);
  material.emissiveTexture = texture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.unlit = true;
  const plane = CreatePlane(`label-${text}`, { width: 0.9, height: 0.17 }, scene);
  plane.material = material;
  plane.position.copyFrom(at);
  // Facing into the room (+x).
  plane.rotation.y = -Math.PI / 2;
  plane.isPickable = false;
}

export async function buildGallery(scene: Scene, maxLights: number): Promise<void> {
  const base = `${import.meta.env.BASE_URL}assets/props/`;
  let props: Prop[];
  try {
    const response = await fetch(`${base}props.json`);
    if (!response.ok) return;
    props = ((await response.json()) as { props: Prop[] }).props;
  } catch {
    return;
  }
  const stand = new PBRMaterial('pedestal', scene);
  stand.albedoColor = new Color3(0.12, 0.13, 0.15);
  stand.metallic = 0.6;
  stand.roughness = 0.45;
  stand.maxSimultaneousLights = maxLights;

  const spinning: TransformNode[] = [];
  let z = FIRST_Z;
  for (const subject of ORDER) {
    const pair = props.filter((p) => p.subject === subject);
    if (pair.length === 0) continue;
    for (const prop of pair) {
      const onFloor = prop.size > 0.9;
      const top = onFloor ? 0 : 0.95;
      if (!onFloor) {
        const pedestal = CreateBox(`pedestal-${prop.file}`, { width: 0.5, height: top, depth: 0.5 }, scene);
        pedestal.position.set(WALL_X, top / 2, z);
        pedestal.material = stand;
        pedestal.receiveShadows = true;
        new PhysicsAggregate(pedestal, PhysicsShapeType.BOX, { mass: 0 }, scene);
      }
      const container = await LoadAssetContainerAsync(`${base}${prop.file}`, scene);
      container.addAllToScene();
      const holder = new TransformNode(`prop-${prop.file}`, scene);
      const model = new TransformNode(`prop-${prop.file}-model`, scene);
      model.parent = holder;
      for (const node of container.rootNodes) node.parent = model;
      // Scale to the subject's real size, and stand it on its pedestal.
      const meshes = model.getChildMeshes(false);
      const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      const max = min.scale(-1);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        min.minimizeInPlace(mesh.getBoundingInfo().boundingBox.minimumWorld);
        max.maximizeInPlace(mesh.getBoundingInfo().boundingBox.maximumWorld);
        if (mesh.material instanceof PBRMaterial) mesh.material.maxSimultaneousLights = maxLights;
      }
      const extent = max.subtract(min);
      const scale = prop.size / Math.max(extent.x, extent.y, extent.z, 1e-6);
      model.scaling.setAll(scale);
      const centre = min.add(max).scale(0.5);
      model.position.set(-centre.x * scale, -min.y * scale, -centre.z * scale);
      holder.position.set(WALL_X, top, z);
      spinning.push(holder);
      label(scene, prop.label, new Vector3(WALL_X + 0.32, onFloor ? 1.45 : 0.62, z));
      z += STEP;
    }
    z += PAIR_GAP;
  }
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (const holder of spinning) holder.rotation.y += SPIN * dt;
  });
}
