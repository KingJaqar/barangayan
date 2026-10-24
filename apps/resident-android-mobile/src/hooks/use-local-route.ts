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
  | { status: 'failed' }
  | { status: 'done'; result: RouteResult; computeMs: number };

/** Lets the JS thread render and handle input between search chunks (plan section 4: yield on Hermes). */
const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Walking route on the installed pack (Dijkstra in the shared core, profile `ampid-fine`). A route
 * belongs to one origin revision, center, segment choice, conditions snapshot, avoidance set and
 * graph; any change cancels the running search and its result is never shown (invariants 2 and 5).
 */
export function useLocalRoute(options: {
  active: boolean;
  pack: LoadedPack | null;
  conditions: StoredConditions | null;
  avoidance: readonly LocalAvoidanceRecord[];
  origin: ConfirmedOrigin | null;
  /** null = automatic: the nearest confirmed-available center; the result still ranks every center. */
  centerId: string | null;
  originEdgeId: string | null;
}): LocalRouteState {
  const { active, pack, conditions, avoidance, origin, centerId, originEdgeId } = options;
  // Keyed on the snapshot, not the stored wrapper: a refresh that only updates the check time
  // keeps the same snapshot and must not restart the search.
  const snapshot = conditions?.snapshot ?? null;
  const hasOrigin = origin !== null;
  const inputs = useMemo(() => (!active || pack === null || !hasOrigin ? null : localRoutingInputs(pack.graph, snapshot)), [active, pack, snapshot, hasOrigin]);
  const avoid = useMemo(() => avoidedEdgeIds(avoidance), [avoidance]);

  const lat = origin?.lat;
  const lng = origin?.lng;
  const accuracyMeters = origin?.accuracyMeters ?? null;
  const revision = origin?.revision;
  const owner = useMemo(() => ({ pack, snapshot, avoid, lat, lng, accuracyMeters, revision, centerId, originEdgeId }),
    [pack, snapshot, avoid, lat, lng, accuracyMeters, revision, centerId, originEdgeId]);
  const [entry, setEntry] = useState<{ owner: typeof owner; state: LocalRouteState } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (pack === null || inputs === null || lat === undefined || lng === undefined || revision === undefined) {
      setEntry({ owner, state: { status: 'idle' } });
      return;
    }
    if (!inputs.ok) {
      setEntry({ owner, state: { status: 'unavailable', problem: inputs.problem } });
      return;
    }
    const token: { aborted: boolean } & CancellationToken = { aborted: false };
    setEntry(previous => previous?.owner === owner && previous.state.status === 'done' ? previous : { owner, state: { status: 'computing' } });
    const started = Date.now();
    // Let the destination commit before synchronous preparation; blur can cancel before it starts.
    void yieldToEventLoop().then(() => token.aborted ? null : planEvacuationRouteAsync(
      {
        graph: pack.graph,
        conditions: inputs.conditions,
        centers: inputs.centers,
        request: { origin: { lat, lng, accuracyMeters, revision }, originEdgeId, centerId, avoidEdgeIds: avoid },
        profile: ROUTING_PROFILES['ampid-fine'],
      },
      { cancel: token, yieldControl: yieldToEventLoop },
    )).then(result => {
      if (!token.aborted && result !== null) setEntry({ owner, state: { status: 'done', result, computeMs: Date.now() - started } });
    }).catch(() => {
      if (!token.aborted) setEntry({ owner, state: { status: 'failed' } });
    });
    return () => {
      token.aborted = true;
    };
  }, [active, owner, pack, inputs, avoid, lat, lng, accuracyMeters, revision, centerId, originEdgeId]);

  // Effects run after render; never expose an old origin/filter result in that first frame.
  return entry?.owner === owner ? entry.state : { status: active && origin !== null && pack !== null ? 'computing' : 'idle' };
}
