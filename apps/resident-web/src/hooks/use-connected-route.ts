'use client';

import type { ConfirmedOrigin } from '@barangayan/shared';
import {
  requestConnectedRoute,
  type ConnectedRouteFailure,
  type ConnectedRouteResult,
} from '@barangayan/shared/src/lib/connected-route-client';
import type { CenterRouteSummary } from '@barangayan/shared/src/lib/evacuation-routing';
import type { RouteServiceProvenance } from '@barangayan/shared/src/lib/evacuation-route-service';
import { useCallback, useEffect, useRef, useState } from 'react';
import { beginAttempt, notify, type OperationId } from '@/lib/notify';

/** Plan section 4: refresh every 30 s while visible, backing off after failures up to 5 minutes. */
const REFRESH_INTERVAL_MS = 30_000;
const MAX_REFRESH_INTERVAL_MS = 300_000;

const SERVICE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/evacuation-route`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface ConnectedRouteState {
  /** idle: no origin yet; loading: first answer for this selection pending; ready: a route result; failed: service failure and nothing to show. */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** The newest answer for the current origin revision, center and street choice. */
  result: ConnectedRouteResult | null;
  failure: ConnectedRouteFailure | null;
  /** The latest refresh failed, so `result` is the previous answer for this selection; no new route is calculated. */
  stale: boolean;
  /** When this device last received `result` from the service (epoch ms), for the freshness line. */
  checkedAt: number | null;
  attribution: string | null;
  /** One-to-many walking distances for the current origin; reachable centers first. */
  ranking: CenterRouteSummary[] | null;
  /** A terminal explicit result was assigned to the toast announcement owner. */
  outcomeAnnounced: boolean;
  retry: () => void;
}

interface RouteEntry {
  key: string;
  result: ConnectedRouteResult;
  service: RouteServiceProvenance;
  checkedAt: number;
  announced: boolean;
}

interface FailureEntry {
  key: string;
  failure: ConnectedRouteFailure;
  announced: boolean;
}

/** A street picked from the attachment chooser; it belongs to the graph named in the answer that offered it. */
export interface SegmentChoice {
  graphVersion: string;
  edgeId: string;
}

/**
 * Server-backed walking route for the web Centers screen (DRRM routing plan R7). Web has no
 * local routing: after the service is lost nothing new is calculated (invariant 8), and the
 * previous answer for the same selection is only kept, labelled stale. Answers belong to one
 * origin revision, center and street choice; a result for any other key is never shown, and an
 * older conditions revision never replaces a newer one (invariant 5).
 */
export function useConnectedRoute(options: {
  origin: ConfirmedOrigin | null;
  centerId: string | null;
  segment: SegmentChoice | null;
  explicitOriginRevision?: number | null;
  originNotificationId?: OperationId | null;
  selectionNotificationId?: OperationId | null;
}): ConnectedRouteState {
  const { origin, centerId, segment } = options;
  const feedback = useRef(options);
  useEffect(() => { feedback.current = options; });
  const [routeEntry, setRouteEntry] = useState<RouteEntry | null>(null);
  const [failureEntry, setFailureEntry] = useState<FailureEntry | null>(null);
  const [nonce, setNonce] = useState(0);
  const newestRevision = useRef<number | null>(null);
  const retryAttempt = useRef<OperationId | null>(null);
  const selectionAttempt = useRef<{ key: string; id: OperationId | null } | null>(null);
  const previousSelection = useRef<{ centerId: string | null; revision: number | undefined; graph: string | null; edge: string | null } | null>(null);

  const lat = origin?.lat;
  const lng = origin?.lng;
  const accuracyMeters = origin?.accuracyMeters ?? null;
  const revision = origin?.revision;
  const segmentGraph = segment?.graphVersion ?? null;
  const segmentEdge = segment?.edgeId ?? null;
  const key = revision === undefined ? null : JSON.stringify([revision, centerId, segmentGraph, segmentEdge]);

  useEffect(() => {
    if (key === null || lat === undefined || lng === undefined || revision === undefined) return;
    const requestKey: string = key;
    const requestOrigin = { lat, lng, accuracyMeters, revision };
    const previous = previousSelection.current;
    const selectionChanged = (centerId !== null && centerId !== (previous?.centerId ?? null)) || (revision === previous?.revision && (segmentGraph !== previous.graph || segmentEdge !== previous.edge));
    const originChanged = revision !== previous?.revision && revision === feedback.current.explicitOriginRevision;
    const attemptKey = JSON.stringify([key, nonce]);
    if (selectionAttempt.current?.key !== attemptKey) selectionAttempt.current = { key: attemptKey, id: retryAttempt.current ?? (selectionChanged ? feedback.current.selectionNotificationId ?? null : originChanged ? feedback.current.originNotificationId ?? null : null) };
    const receipt = selectionAttempt.current;
    retryAttempt.current = null;
    previousSelection.current = { centerId, revision, graph: segmentGraph, edge: segmentEdge };
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const schedule = (delay: number) => {
      timer = setTimeout(() => void run(), delay);
    };
    async function run() {
      timer = null;
      if (controller.signal.aborted) return;
      if (document.visibilityState !== 'visible') {
        schedule(REFRESH_INTERVAL_MS);
        return;
      }
      const outcome = await requestConnectedRoute({
        url: SERVICE_URL,
        anonKey: ANON_KEY,
        signal: controller.signal,
        request: {
          graphVersion: segmentGraph,
          origin: requestOrigin,
          originEdgeId: segmentEdge,
          centerId,
          avoidEdgeIds: [],
          minConditionsRevision: newestRevision.current,
        },
      });
      if (controller.signal.aborted || outcome.kind === 'cancelled') return;
      const notification = receipt.id;
      receipt.id = null;
      if (notification) {
        if (outcome.kind !== 'route') notify.error("Couldn't calculate the route. Check your connection and try again.", { id: notification });
        else if (outcome.result.status === 'ok') notify.success('Walking route ready. Review the route guidance.', { id: notification });
        else if (outcome.result.status !== 'attachment_ambiguous') notify.warning('No available walking route was found. Review the guidance below.', { id: notification });
      }
      if (outcome.kind === 'route') {
        newestRevision.current = Math.max(newestRevision.current ?? 0, outcome.result.provenance.conditionsRevision);
        failures = 0;
        setRouteEntry({ key: requestKey, result: outcome.result, service: outcome.service, checkedAt: Date.now(), announced: notification !== null && outcome.result.status !== 'attachment_ambiguous' });
        setFailureEntry(null);
      } else {
        failures += 1;
        setFailureEntry({ key: requestKey, failure: outcome.failure, announced: notification !== null });
      }
      schedule(failures === 0 ? REFRESH_INTERVAL_MS : Math.min(MAX_REFRESH_INTERVAL_MS, REFRESH_INTERVAL_MS * 2 ** failures));
    }

    void run();
    return () => {
      controller.abort();
      if (timer !== null) clearTimeout(timer);
    };
  }, [key, lat, lng, accuracyMeters, revision, centerId, segmentGraph, segmentEdge, nonce]);

  const retry = useCallback(() => { retryAttempt.current = beginAttempt('walking-route'); setNonce(n => n + 1); }, []);

  const base = { result: null, failure: null, stale: false, checkedAt: null, attribution: null, ranking: null, outcomeAnnounced: false, retry };
  if (key === null) return { ...base, status: 'idle' };
  const current = routeEntry !== null && routeEntry.key === key ? routeEntry : null;
  const failure = failureEntry !== null && failureEntry.key === key ? failureEntry.failure : null;
  if (current !== null) {
    const { result, service } = current;
    const ranking = result.status === 'ok' || result.status === 'no_route_within_coverage' ? result.centers : null;
    return {
      ...base,
      status: 'ready',
      result,
      ranking,
      failure,
      stale: failure !== null,
      checkedAt: current.checkedAt,
      attribution: service.attribution,
      outcomeAnnounced: failure ? failureEntry?.announced === true : current.announced,
    };
  }
  if (failure !== null) return { ...base, status: 'failed', failure, outcomeAnnounced: failureEntry?.announced === true };
  return { ...base, status: 'loading' };
}
