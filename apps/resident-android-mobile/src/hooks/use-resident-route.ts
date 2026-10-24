import type { ConfirmedOrigin } from '@barangayan/shared';
import {
  CONNECTED_ROUTE_DEADLINE_MS,
  requestConnectedRoute,
  type ConnectedRouteFailure,
  type ConnectedRouteOutcome,
} from '@barangayan/shared/src/lib/connected-route-client';
import type { CenterRouteSummary } from '@barangayan/shared/src/lib/evacuation-routing';
import type { RouteServiceProvenance } from '@barangayan/shared/src/lib/evacuation-route-service';
import { useEffect, useMemo, useState } from 'react';

import { useLocalRoute, type LocalRouteState } from '@/hooks/use-local-route';
import {
  avoidedEdgeIds,
  type LoadedPack,
  type LocalAvoidanceRecord,
  type StoredConditions,
} from '@/lib/offline-routing';

/** Plan section 4: refresh while visible every 30 s, backing off after failures up to 5 minutes. */
const REFRESH_INTERVAL_MS = 30_000;
const MAX_REFRESH_INTERVAL_MS = 300_000;

const SERVICE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/evacuation-route`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type RouteMode = 'connected' | 'local';

export interface ResidentRouteState {
  /** The route shown: the connected one while it is current, otherwise the local one. */
  route: LocalRouteState;
  mode: RouteMode;
  /** Why the last connected request for the current selection failed; null while pending or after success. */
  connectedFailure: ConnectedRouteFailure | null;
  /** A connected request for the current selection is in flight. */
  connectedPending: boolean;
  service: RouteServiceProvenance | null;
  /** One-to-many walking distances from the latest result for the current origin; null when unknown. */
  ranking: CenterRouteSummary[] | null;
}

interface ConnectedEntry {
  key: string;
  outcome: ConnectedRouteOutcome;
}

function sameRoute(a: ConnectedRouteOutcome, b: ConnectedRouteOutcome): boolean {
  return a.kind === 'route' && b.kind === 'route' && JSON.stringify(a.result) === JSON.stringify(b.result);
}

/**
 * Connected route over the local one (DRRM routing plan R7). The local route is always computed
 * first, so guidance is ready without the network; a connected route replaces it only while its
 * request key (graph, origin revision, center, street choice, avoidance set and conditions
 * revision) still matches. A failed or missing connected route returns the screen to labelled
 * local mode, and connected mode is restored only by a later successful request (section 4).
 */
export function useResidentRoute(options: {
  /** The owning Centers screen is focused and the app is foregrounded. */
  active: boolean;
  pack: LoadedPack | null;
  conditions: StoredConditions | null;
  avoidance: readonly LocalAvoidanceRecord[];
  origin: ConfirmedOrigin | null;
  centerId: string | null;
  originEdgeId: string | null;
  /** NetInfo says the internet is unreachable; no request is made (mode stays local). */
  internetUnreachable: boolean;
}): ResidentRouteState {
  const { active, pack, conditions, avoidance, origin, centerId, originEdgeId, internetUnreachable } = options;
  const local = useLocalRoute({ active, pack, conditions, avoidance, origin, centerId, originEdgeId });
  const avoid = useMemo(() => avoidedEdgeIds(avoidance), [avoidance]);
  const [entry, setEntry] = useState<ConnectedEntry | null>(null);

  const graphVersion = pack?.graph.version ?? null;
  const conditionsRevision = conditions?.snapshot.revision ?? null;
  const lat = origin?.lat;
  const lng = origin?.lng;
  const accuracyMeters = origin?.accuracyMeters ?? null;
  const revision = origin?.revision;
  const canRequest = graphVersion !== null && lat !== undefined && lng !== undefined && revision !== undefined && !internetUnreachable && SERVICE_URL.startsWith('http');
  const key = canRequest
    ? JSON.stringify([graphVersion, revision, lat, lng, accuracyMeters, centerId, originEdgeId, avoid, conditionsRevision])
    : null;

  useEffect(() => {
    if (!active || key === null || graphVersion === null || lat === undefined || lng === undefined || revision === undefined) return;
    const requestKey: string = key;
    const requestGraphVersion: string = graphVersion;
    const requestOrigin = { lat, lng, accuracyMeters, revision };
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const schedule = (delay: number) => {
      timer = setTimeout(() => void run(), delay);
    };
    async function run() {
      timer = null;
      if (controller.signal.aborted) return;
      const outcome = await requestConnectedRoute({
        url: SERVICE_URL,
        anonKey: ANON_KEY,
        signal: controller.signal,
        deadlineMs: CONNECTED_ROUTE_DEADLINE_MS,
        request: {
          graphVersion: requestGraphVersion,
          origin: requestOrigin,
          originEdgeId,
          centerId,
          avoidEdgeIds: avoid,
          minConditionsRevision: conditionsRevision,
        },
      });
      if (controller.signal.aborted || outcome.kind === 'cancelled') return;
      // An identical answer keeps the same object so the map is not redrawn every refresh.
      setEntry(previous => (previous !== null && previous.key === requestKey && sameRoute(previous.outcome, outcome) ? previous : { key: requestKey, outcome }));
      failures = outcome.kind === 'route' ? 0 : failures + 1;
      schedule(failures === 0 ? REFRESH_INTERVAL_MS : Math.min(MAX_REFRESH_INTERVAL_MS, REFRESH_INTERVAL_MS * 2 ** failures));
    }

    void run();
    return () => {
      controller.abort();
      if (timer !== null) clearTimeout(timer);
    };
  }, [active, key, graphVersion, lat, lng, accuracyMeters, revision, centerId, originEdgeId, avoid, conditionsRevision]);

  const current = key !== null && entry !== null && entry.key === key ? entry.outcome : null;
  const connected = current !== null && current.kind === 'route' ? current : null;

  const route = useMemo<LocalRouteState>(
    () => (connected !== null ? { status: 'done', result: connected.result, computeMs: 0 } : local),
    [connected, local],
  );
  const ranking = useMemo<CenterRouteSummary[] | null>(() => {
    if (route.status !== 'done') return null;
    const result = route.result;
    return result.status === 'ok' || result.status === 'no_route_within_coverage' ? result.centers : null;
  }, [route]);

  return {
    route,
    mode: connected !== null ? 'connected' : 'local',
    connectedFailure: current !== null && current.kind === 'failure' ? current.failure : null,
    connectedPending: active && key !== null && current === null,
    service: connected !== null ? connected.service : null,
    ranking,
  };
}
