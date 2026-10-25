import { CreateNavigationPluginAsync } from '@babylonjs/addons/navigation';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import * as RecastCore from '@recast-navigation/core';
import * as RecastGenerators from '@recast-navigation/generators';

/**
 * The navigation mesh and the crowd everyone walks in: companions, the night shift, evacuees
 * (recast-navigation-js through Babylon's navigation plugin, bundled, never from a CDN: D-21).
 */
export type Navigation = Awaited<ReturnType<typeof createNavigation>>;

export interface AgentHandle {
  index: number;
  /** Where the agent is, on the navigation mesh. */
  position(): Vector3;
  velocity(): Vector3;
  goTo(p: Vector3): void;
  stop(): void;
  /** Puts the agent somewhere at once (a scene change, a restart). */
  teleport(p: Vector3): void;
}

export async function createNavigation(scene: Scene, meshes: Mesh[]) {
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
  // Room for everyone in the busiest place: Pyre Remnant's people, the squad, the hero and the Banked.
  const crowd = navigation.createCrowd(40, 0.5, scene);
  return {
    closest: (p: Vector3) => navigation.getClosestPoint(p),
    /** The way a walker would go from one point to another; it ends short of a place it cannot reach. */
    path: (from: Vector3, to: Vector3) => navigation.computePath(navigation.getClosestPoint(from), to),
    setTimeFactor(factor: number) {
      navigation.timeFactor = factor;
    },
    /** Adds a walker; the crowd moves `anchor`, and the caller stands the body on the floor beneath it. */
    addAgent(at: Vector3, anchor: TransformNode, speed = 6.8): AgentHandle {
      const index = crowd.addAgent(
        navigation.getClosestPoint(at),
        {
          radius: 0.35,
          height: 1.8,
          maxAcceleration: 14,
          maxSpeed: speed,
          collisionQueryRange: 2,
          pathOptimizationRange: 4,
          separationWeight: 1,
        },
        anchor,
      );
      return {
        index,
        position: () => crowd.getAgentPosition(index),
        velocity: () => crowd.getAgentVelocity(index),
        goTo: (p) => crowd.agentGoto(index, navigation.getClosestPoint(p)),
        stop: () => crowd.agentGoto(index, crowd.getAgentPosition(index)),
        teleport: (p) => crowd.agentTeleport(index, navigation.getClosestPoint(p)),
      };
    },
  };
}
