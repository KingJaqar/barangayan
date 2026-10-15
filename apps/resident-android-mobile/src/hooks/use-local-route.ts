import type { ConfirmedOrigin } from '@barangayan/shared';
import {
  ROUTING_PROFILES,
  planEvacuationRouteAsync,
  type CancellationToken,
  type RouteResult,
} from '@barangayan/shared/src/lib/evacuation-routing';
import { useEffect, useMemo, useState } from 'react';

import {
  avoidedEdgeIds,
  localRoutingInputs,
  type LoadedPack,
  type LocalAvoidanceRecord,
  type LocalConditionsProblem,
  type StoredConditions,
} from '@/lib/offline-routing';

export type LocalRouteState =
  | { status: 'idle' }
  | { status: 'unavailable'; problem: LocalConditionsProblem }
  | { status: 'computing' }
  | { status: 'done'; result: RouteResult; computeMs: number };

/** Lets the JS thread render and handle input between search chunks (plan section 4: yield on Hermes). */
const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Walking route on the installed pack (Dijkstra in the shared core, profile `ampid-fine`). A route
 * belongs to one origin revision, center, segment choice, conditions snapshot, avoidance set and
 * graph; any change cancels the running search and its result is never shown (invariants 2 and 5).
 */
export function useLocalRoute(options: {
  pack: LoadedPack | null;
  conditions: StoredConditions | null;
  avoidance: readonly LocalAvoidanceRecord[];
  origin: ConfirmedOrigin | null;
  /** null = automatic: the nearest confirmed-available center; the result still ranks every center. */
  centerId: string | null;
  originEdgeId: string | null;
}): LocalRouteState {
  const { pack, conditions, avoidance, origin, centerId, originEdgeId } = options;
  // Keyed on the snapshot, not the stored wrapper: a refresh that only updates the check time
  // keeps the same snapshot and must not restart the search.
  const snapshot = conditions?.snapshot ?? null;
  const inputs = useMemo(() => (pack === null ? null : localRoutingInputs(pack.graph, snapshot)), [pack, snapshot]);
  const avoid = useMemo(() => avoidedEdgeIds(avoidance), [avoidance]);
  const [state, setState] = useState<LocalRouteState>({ status: 'idle' });

  const lat = origin?.lat;
  const lng = origin?.lng;
  const accuracyMeters = origin?.accuracyMeters ?? null;
  const revision = origin?.revision;

  useEffect(() => {
    if (pack === null || inputs === null || lat === undefined || lng === undefined || revision === undefined) {
      setState({ status: 'idle' });
      return;
    }
    if (!inputs.ok) {
      setState({ status: 'unavailable', problem: inputs.problem });
      return;
    }
    const token: { aborted: boolean } & CancellationToken = { aborted: false };
    setState({ status: 'computing' });
    const started = Date.now();
    void planEvacuationRouteAsync(
      {
        graph: pack.graph,
        conditions: inputs.conditions,
        centers: inputs.centers,
        request: { origin: { lat, lng, accuracyMeters, revision }, originEdgeId, centerId, avoidEdgeIds: avoid },
        profile: ROUTING_PROFILES['ampid-fine'],
      },
      { cancel: token, yieldControl: yieldToEventLoop },
    ).then(result => {
      if (!token.aborted) setState({ status: 'done', result, computeMs: Date.now() - started });
    });
    return () => {
      token.aborted = true;
    };
  }, [pack, inputs, avoid, lat, lng, accuracyMeters, revision, centerId, originEdgeId]);

  return state;
}
