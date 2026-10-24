import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { CreateNavigationPluginAsync } from '@babylonjs/addons/navigation';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import {
  CharacterSupportedState,
  type CharacterSurfaceInfo,
  PhysicsCharacterController,
} from '@babylonjs/core/Physics/v2/characterController';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { Scene } from '@babylonjs/core/scene';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import * as RecastCore from '@recast-navigation/core';
import * as RecastGenerators from '@recast-navigation/generators';
import { pickAssistTarget } from './aim.ts';
import { type Character, loadCharacterTemplate, spawnCharacter } from './characters.ts';
import { buildRange } from './combat.ts';
import { COVER, type CoverProbe, type CoverState, coverStep } from './cover.ts';
import { Input } from './input.ts';
import { buildLevel } from './level.ts';
import {
  cameraDistance,
  cameraFraming,
  cameraRelative,
  SPEED,
  targetSpeed,
  turnTowards,
  type Vec3Like,
  yawOf,
} from './motion.ts';
import { poseWeights } from './pose.ts';
import { QUALITY, type QualityTier } from './quality.ts';

export interface GameStats {
  fps: number;
  renderer: string;
  tier: QualityTier;
  activeMeshes: number;
  /** The hero's ground speed in metres a second. */
  speed: number;
  companionNavigation: boolean;
  inCover: boolean;
  /** Shots fired since the start, and drones down right now. */
  shots: number;
  dronesDown: number;
}

export interface Game {
  input: Input;
  dispose(): void;
}

export interface GameOptions {
  tier: QualityTier;
  /** Which MPFB person the player is (D-09); the other is the companion. */
  hero: 'man' | 'woman';
  /** `?renderer=webgpu` in the address asks for WebGPU; WebGL2 is the default. */
  renderer: 'webgl2' | 'webgpu';
  /** Aim assist turns shots towards a nearby target (D-17: on phones). */
  assist: boolean;
  onStats(stats: GameStats): void;
  onReady(): void;
  /** Called when the hero starts or stops aiming, to show the crosshair. */
  onAim(aiming: boolean): void;
}

const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.35;
const GRAVITY = new Vector3(0, -18, 0);
const UP = Vector3.Up();
const DOWN = Vector3.Down();
const CAMERA = { minDistance: 0.9, eye: 1.55, coverEye: 1.05, minBeta: 0.55, maxBeta: 1.85, fov: 0.95, aimFov: 0.72 };
/** Seconds between shots, and how long the shooting clip shows after each. */
const FIRE_INTERVAL = 0.22;
const SHOT_POSE = 0.18;
const SHOT_RANGE = 60;
const DRONES = [new Vector3(-4.5, 1.6, 36.5), new Vector3(0, 1.9, 37), new Vector3(4.8, 1.4, 31.5)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

async function createEngine(canvas: HTMLCanvasElement, options: GameOptions): Promise<AbstractEngine> {
  const q = QUALITY[options.tier];
  if (options.renderer === 'webgpu' && 'gpu' in navigator) {
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
      const engine = new WebGPUEngine(canvas, { antialias: q.antialias, powerPreference: 'high-performance' });
      await engine.initAsync();
      return engine;
    } catch (error) {
      console.warn('WebGPU could not start; using WebGL2.', error);
    }
  }
  return new Engine(canvas, q.antialias, { powerPreference: 'high-performance', stencil: true }, false);
}

export async function startGame(canvas: HTMLCanvasElement, options: GameOptions): Promise<Game> {
  const q = QUALITY[options.tier];
  const engine = await createEngine(canvas, options);
  const applyScaling = () =>
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
  applyScaling();

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.015, 0.02, 0.03, 1);
  scene.skipPointerMovePicking = true;

  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  const physics = new HavokPlugin(true, havok);
  scene.enablePhysics(GRAVITY, physics);

  const level = buildLevel(scene, q);
  const { hero, companion } = await spawnCast(scene, options.hero);
  for (const mesh of [...hero.meshes, ...companion.meshes]) level.castShadow(mesh as Mesh);

  const controller = new PhysicsCharacterController(
    level.heroStart.clone(),
    { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
    scene,
  );
  const follow = await companionFollower(scene, level.navigationMeshes, companion, level.companionStart);

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.2, 3.4, level.heroStart.clone(), scene);
  camera.inputs.clear();
  camera.minZ = 0.05;
  camera.fov = CAMERA.fov;

  const range = buildRange(scene, DRONES, q.maxLights);
  const input = new Input(canvas);
  const ray = new PhysicsRaycastResult();
  let heroYaw = 0;
  const desired = new Vector3();
  const heroForward = new Vector3(0, 0, 1);
  let cover: CoverState = { inCover: false };
  let aimBlend = 0;
  let coverBlend = 0;
  let wasAiming = false;
  let fireCooldown = 0;
  let shotPose = 0;
  let shots = 0;

  /** Distance to the first thing a ray meets, its point and normal; null if it meets nothing. */
  const cast = (from: Vector3, to: Vector3) => {
    physics.raycast(from, to, ray);
    return ray.hasHit
      ? {
          distance: Vector3.Distance(from, ray.hitPointWorld),
          point: ray.hitPointWorld.clone(),
          normal: ray.hitNormalWorld.clone(),
          body: ray.body,
        }
      : null;
  };

  /** The two cover rays from the hero's feet along a ground direction (COVER_AND_AIM.md). */
  const probeCover = (feet: Vector3, dir: Vec3Like): CoverProbe => {
    const reach = COVER.reach + 0.4;
    const along = new Vector3(dir.x, 0, dir.z);
    const knee = cast(
      feet.add(new Vector3(0, COVER.kneeHeight, 0)),
      feet.add(new Vector3(0, COVER.kneeHeight, 0)).add(along.scale(reach)),
    );
    const chest = cast(
      feet.add(new Vector3(0, COVER.chestHeight, 0)),
      feet.add(new Vector3(0, COVER.chestHeight, 0)).add(along.scale(reach)),
    );
    let normal: Vec3Like | null = null;
    if (knee) {
      const flat = Math.hypot(knee.normal.x, knee.normal.z);
      if (flat > 0.5) normal = { x: knee.normal.x / flat, z: knee.normal.z / flat };
    }
    return {
      knee: knee ? Math.max(0, knee.distance - CAPSULE_RADIUS) : null,
      chest: chest ? Math.max(0, chest.distance - CAPSULE_RADIUS) : null,
      normal,
    };
  };

  const shoot = () => {
    const from = camera.globalPosition.clone();
    let dir = camera.getTarget().subtract(from).normalize();
    if (options.assist) {
      const id = pickAssistTarget(range.candidates(from), dir);
      if (id !== null) dir = range.centre(id).subtract(from).normalize();
    }
    const end = from.add(dir.scale(SHOT_RANGE));
    const struck = cast(from.add(dir.scale(0.3)), end);
    const point = struck ? struck.point : end;
    const hitDrone = range.hit(struck?.body);
    hero.fire();
    range.shot(hero.muzzle(), point, hitDrone);
    shots += 1;
    shotPose = SHOT_POSE;
  };

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    const aiming = input.aiming || input.firing;
    if (aiming !== wasAiming) {
      wasAiming = aiming;
      options.onAim(aiming);
    }

    // Look: drag or mouse turns the camera round the hero, more finely while aiming.
    const look = input.takeLook();
    const fine = aiming ? 0.6 : 1;
    camera.alpha -= look.x * 0.0055 * fine;
    camera.beta = Math.min(CAMERA.maxBeta, Math.max(CAMERA.minBeta, camera.beta - look.y * 0.0045 * fine));

    // Move: relative to where the camera looks.
    const forward: Vec3Like = { x: -Math.cos(camera.alpha), z: -Math.sin(camera.alpha) };
    const move = input.move();
    const push = Math.min(1, Math.hypot(move.x, move.y));
    const direction = cameraRelative(move, forward);
    const length = Math.hypot(direction.x, direction.z);
    const unit = length > 0 ? { x: direction.x / length, z: direction.z / length } : { x: 0, z: 0 };
    const feet = hero.root.position;

    // Cover: walk into low cover to take it; push away, sprint, or run out of it to leave.
    const result = coverStep(cover, {
      move: { x: unit.x * push, z: unit.z * push },
      sprint: input.sprint,
      aiming,
      probe: !cover.inCover && push > 0.3 ? probeCover(feet, unit) : null,
      coverAhead: cover.inCover
        ? cast(
            feet.add(new Vector3(0, COVER.kneeHeight, 0)),
            feet.add(new Vector3(-cover.normal.x * 1.1, COVER.kneeHeight, -cover.normal.z * 1.1)),
          ) !== null
        : false,
    });
    cover = result.state;

    const velocity = controller.getVelocity();
    const groundSpeed = Math.hypot(velocity.x, velocity.z);
    if (aiming) {
      // Aiming: face where the camera looks and walk in any direction; from cover, stand and aim.
      const speed = cover.inCover ? 0 : SPEED.walk * push;
      desired.set(unit.x * speed, 0, unit.z * speed);
      heroYaw = turnTowards(heroYaw, yawOf(forward), 14 * dt);
      hero.setPose(
        poseWeights({
          mode: 'aim',
          speed: groundSpeed,
          direction: push > 0 ? { x: move.x / push, y: move.y / push } : { x: 0, y: 0 },
          firing: shotPose > 0,
        }),
        dt,
      );
    } else if (cover.inCover) {
      desired.set(result.velocity.x, 0, result.velocity.z);
      heroYaw = turnTowards(heroYaw, yawOf({ x: -cover.normal.x, z: -cover.normal.z }), 10 * dt);
      hero.setPose(poseWeights({ mode: 'cover', slide: result.slide }), dt);
    } else {
      const speed = targetSpeed(push, input.sprint);
      if (length > 0 && speed > 0) {
        desired.set(unit.x * speed, 0, unit.z * speed);
        heroYaw = turnTowards(heroYaw, yawOf(direction), 11 * dt);
      } else {
        desired.set(0, 0, 0);
      }
      hero.setPose(poseWeights({ mode: 'move', speed: groundSpeed }), dt);
    }
    heroForward.set(Math.sin(heroYaw), 0, Math.cos(heroYaw));

    const position = controller.getPosition();
    hero.root.position.set(position.x, position.y - CAPSULE_HEIGHT / 2, position.z);
    hero.root.rotation.y = heroYaw;

    // Shoot: where the crosshair points, or at the nearest drone near it with aim assist.
    fireCooldown -= dt;
    shotPose -= dt;
    if (input.firing && fireCooldown <= 0) {
      fireCooldown = FIRE_INTERVAL;
      shoot();
    }
    range.update(dt);
    follow.update(dt, hero.root.position, heroForward);

    // Camera: over the right shoulder, closer while aiming and lower in cover, pulled in when a
    // wall is in the way. On a portrait phone the view is narrow, so it stands further back.
    aimBlend = lerp(aimBlend, aiming ? 1 : 0, Math.min(1, dt * 9));
    coverBlend = lerp(coverBlend, cover.inCover && !aiming ? 1 : 0, Math.min(1, dt * 6));
    const framing = cameraFraming(engine.getAspectRatio(camera));
    const distance = lerp(framing.distance, framing.distance * 0.55, aimBlend);
    const shoulder = lerp(framing.shoulder, Math.max(framing.shoulder, 0.6), aimBlend);
    const eye = lerp(CAMERA.eye, CAMERA.coverEye, coverBlend);
    camera.fov = lerp(CAMERA.fov, CAMERA.aimFov, aimBlend);
    const right = { x: forward.z, z: -forward.x };
    const pivot = new Vector3(feet.x + right.x * shoulder, feet.y + eye, feet.z + right.z * shoulder);
    const back = new Vector3(
      Math.cos(camera.alpha) * Math.sin(camera.beta),
      Math.cos(camera.beta),
      Math.sin(camera.alpha) * Math.sin(camera.beta),
    );
    const head = new Vector3(feet.x, feet.y + eye, feet.z);
    // From the hero's head to the far end of the shoulder offset and the camera's place.
    const blocked = cast(head, pivot.add(back.scale(distance)));
    const hit = blocked ? Vector3.Distance(pivot, blocked.point) : null;
    // Keep the camera's angles as its target moves: plain `target =` would re-aim it from where it
    // stood, turning it a little every frame, and the hero, walking "forward", would drift.
    camera.setTarget(pivot, false, false, true);
    camera.radius = cameraDistance(hit, distance, CAMERA.minDistance);
  });

  scene.onAfterPhysicsObservable.add(() => {
    // Capped, so a long pause (a tab in the background, a slow frame) cannot throw the hero
    // through a wall in one step.
    const dt = Math.min(scene.deltaTime / 1000, 1 / 20);
    if (!dt) return;
    const support = controller.checkSupport(dt, DOWN);
    controller.setVelocity(characterVelocity(controller, dt, support, desired, heroForward));
    controller.integrate(dt, support, GRAVITY);
  });

  // `?debug` in the address exposes the hero's state for testing in the browser's console.
  if (new URLSearchParams(location.search).has('debug')) {
    const facing = () => ({ x: -Math.cos(camera.alpha), z: -Math.sin(camera.alpha) });
    Object.assign(window, {
      lightkeeper: {
        state: () => ({ feet: hero.root.position.asArray(), cover, aiming: input.aiming, shots }),
        probe: () => probeCover(hero.root.position, facing()),
      },
    });
  }

  let ready = false;
  let statsTime = 0;
  engine.runRenderLoop(() => {
    scene.render();
    if (!ready) {
      ready = true;
      options.onReady();
    }
    statsTime += engine.getDeltaTime();
    if (statsTime > 500) {
      statsTime = 0;
      options.onStats({
        fps: Math.round(engine.getFps()),
        renderer: engine.isWebGPU ? 'WebGPU' : `WebGL${(engine as Engine).webGLVersion}`,
        tier: options.tier,
        activeMeshes: scene.getActiveMeshes().length,
        speed: Math.hypot(controller.getVelocity().x, controller.getVelocity().z),
        companionNavigation: follow.navigated,
        inCover: cover.inCover,
        shots,
        dronesDown: range.down,
      });
    }
  });

  const onResize = () => {
    applyScaling();
    engine.resize();
  };
  window.addEventListener('resize', onResize);

  return {
    input,
    dispose() {
      window.removeEventListener('resize', onResize);
      input.dispose();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}

/**
 * The hero and the companion: the MPFB man and woman from the art pipeline (docs/ART_PIPELINE.md),
 * or two tinted mannequins if they cannot be loaded.
 */
async function spawnCast(scene: Scene, heroBody: 'man' | 'woman'): Promise<{ hero: Character; companion: Character }> {
  const folder = `${import.meta.env.BASE_URL}assets/characters`;
  const companionBody = heroBody === 'man' ? 'woman' : 'man';
  const [heroTemplate, companionTemplate] = await Promise.all([
    loadCharacterTemplate(scene, `${folder}/hero-${heroBody}.glb`),
    loadCharacterTemplate(scene, `${folder}/hero-${companionBody}.glb`),
  ]);
  if (heroTemplate && companionTemplate) {
    return {
      hero: spawnCharacter(scene, heroTemplate, 'hero'),
      companion: spawnCharacter(scene, companionTemplate, 'companion'),
    };
  }
  const mannequin = await loadCharacterTemplate(scene, `${folder}/mannequin.glb`);
  return {
    hero: spawnCharacter(scene, mannequin, 'hero', { height: 1.8 }),
    companion: spawnCharacter(scene, mannequin, 'companion', { height: 1.8, tint: new Color3(0.45, 0.75, 0.8) }),
  };
}

/**
 * The velocity the character controller should take this step: on the ground it follows the
 * surface towards the desired velocity; in the air it keeps falling. After Babylon's character
 * controller example.
 */
function characterVelocity(
  controller: PhysicsCharacterController,
  dt: number,
  support: CharacterSurfaceInfo,
  desired: Vector3,
  forward: Vector3,
): Vector3 {
  const current = controller.getVelocity();
  if (support.supportedState === CharacterSupportedState.SUPPORTED) {
    let output = controller.calculateMovement(
      dt,
      forward,
      support.averageSurfaceNormal,
      current,
      support.averageSurfaceVelocity,
      desired,
      UP,
    );
    output.subtractInPlace(support.averageSurfaceVelocity);
    if (output.dot(UP) > 1e-3) {
      // Keep the speed along a slope horizontal rather than letting it lift the character.
      const length = output.length();
      output.normalizeFromLength(length);
      const horizontal = length / support.averageSurfaceNormal.dot(UP);
      output = support.averageSurfaceNormal.cross(output).cross(UP).scale(horizontal);
    }
    return output.addInPlace(support.averageSurfaceVelocity);
  }
  const output = controller.calculateMovement(dt, forward, UP, current, Vector3.ZeroReadOnly, desired, UP);
  output.addInPlace(UP.scale(-output.dot(UP)));
  output.addInPlace(UP.scale(current.dot(UP)));
  return output.addInPlace(GRAVITY.scale(dt));
}

interface Follower {
  /** Whether the companion walks the navigation mesh (false: the simple fallback). */
  navigated: boolean;
  update(dt: number, heroFeet: Vector3, heroForward: Vector3): void;
}

/**
 * For the proof the companion has one standing objective, "stay with me": keep a couple of metres
 * behind the hero on the navigation mesh. Real objectives (D-16) build on this.
 */
async function companionFollower(
  scene: Scene,
  meshes: Mesh[],
  companion: Character,
  start: Vector3,
): Promise<Follower> {
  companion.root.position.copyFrom(start);
  let yaw = 0;
  let sinceGoal = 1;
  try {
    await RecastCore.init();
    const navigation = await CreateNavigationPluginAsync({ instance: { ...RecastCore, ...RecastGenerators } });
    navigation.createNavMesh(meshes, {
      cs: 0.15,
      ch: 0.1,
      walkableSlopeAngle: 40,
      walkableHeight: 18,
      walkableClimb: 3,
      walkableRadius: 3,
      maxEdgeLen: 40,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    });
    const crowd = navigation.createCrowd(4, 0.5, scene);
    const agent = crowd.addAgent(
      navigation.getClosestPoint(start),
      {
        radius: 0.35,
        height: 1.8,
        maxAcceleration: 14,
        maxSpeed: 6.8,
        collisionQueryRange: 2,
        pathOptimizationRange: 4,
        separationWeight: 1,
      },
      companion.root,
    );
    return {
      navigated: true,
      update(dt, heroFeet, heroForward) {
        sinceGoal += dt;
        const here = crowd.getAgentPosition(agent);
        const distance = Vector3.Distance(here, heroFeet);
        if (sinceGoal > 0.3) {
          sinceGoal = 0;
          if (distance > 2.6) {
            const goal = heroFeet
              .subtract(heroForward.scale(1.6))
              .add(new Vector3(-heroForward.z, 0, heroForward.x).scale(0.9));
            crowd.agentGoto(agent, navigation.getClosestPoint(goal));
          } else if (distance < 1.6) {
            crowd.agentGoto(agent, here);
          }
        }
        const velocity = crowd.getAgentVelocity(agent);
        const speed = Math.hypot(velocity.x, velocity.z);
        if (speed > 0.2) yaw = turnTowards(yaw, yawOf(velocity), 8 * dt);
        companion.root.rotation.y = yaw;
        companion.setPose(poseWeights({ mode: 'move', speed }), dt);
      },
    };
  } catch (error) {
    console.warn('Navigation could not start; the companion follows directly.', error);
    return {
      navigated: false,
      update(dt, heroFeet, heroForward) {
        const goal = heroFeet.subtract(heroForward.scale(1.8));
        const offset = goal.subtract(companion.root.position);
        offset.y = 0;
        const distance = offset.length();
        const speed = distance > 0.4 ? Math.min(6.5, distance * 2.5) : 0;
        if (speed > 0) {
          companion.root.position.addInPlace(offset.normalize().scale(speed * dt));
          yaw = turnTowards(yaw, yawOf(offset), 8 * dt);
        }
        companion.root.position.y = heroFeet.y;
        companion.root.rotation.y = yaw;
        companion.setPose(poseWeights({ mode: 'move', speed }), dt);
      },
    };
  }
}
