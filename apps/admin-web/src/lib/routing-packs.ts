import {
  haversineDistanceMeters,
  routingPackEditorGraphSchema,
  type LatLng,
  type RoutingPackEditorGraph,
} from '@barangayan/shared';

import ampid1Manifest from '../../../../data/routing-packs/ampid-1/pack/manifest.json';

// Routing packs built by packages/shared/scripts/build-routing-pack.mts (plan R3). The
// admin map bundles them at build time, so the graph it closes roads on is a trusted,
// versioned file.
interface BundledPack {
  graphVersion: string;
  attribution: string;
  loadGraph: () => Promise<unknown>;
}

const BUNDLED_PACKS: Readonly<Record<string, BundledPack>> = {
  'ampid-1': {
    graphVersion: ampid1Manifest.graphVersion,
    attribution: ampid1Manifest.attribution,
    loadGraph: () => import('../../../../data/routing-packs/ampid-1/pack/graph.json').then((module) => module.default),
  },
};

export type PackNode = RoutingPackEditorGraph['nodes'][number];

export function bundledPackFor(areaId: string): { graphVersion: string; attribution: string } | null {
  const pack = BUNDLED_PACKS[areaId];
  return pack ? { graphVersion: pack.graphVersion, attribution: pack.attribution } : null;
}

/** Loads and validates the bundled graph; rejects a file whose version does not match its manifest. */
export async function loadPackGraph(areaId: string): Promise<RoutingPackEditorGraph> {
  const pack = BUNDLED_PACKS[areaId];
  if (!pack) throw new Error(`No routing map data is bundled for area ${areaId}.`);
  const graph = routingPackEditorGraphSchema.parse(await pack.loadGraph());
  if (graph.version !== pack.graphVersion) {
    throw new Error(`Bundled routing graph ${graph.version} does not match its manifest (${pack.graphVersion}).`);
  }
  return graph;
}

/** Nearest graph node to a point, or null when none lies within `maxMeters`. */
export function nearestNode(nodes: readonly PackNode[], point: LatLng, maxMeters: number): { node: PackNode; meters: number } | null {
  let best: { node: PackNode; meters: number } | null = null;
  for (const node of nodes) {
    const meters = haversineDistanceMeters(point, node);
    if (meters <= maxMeters && (best === null || meters < best.meters)) best = { node, meters };
  }
  return best;
}
