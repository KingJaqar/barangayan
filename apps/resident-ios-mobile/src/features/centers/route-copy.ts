import { describeConnectedFailure } from '@barangayan/shared/src/lib/connected-route-client';
import type { AttachmentCandidate } from '@barangayan/shared/src/lib/evacuation-routing';
import { formatDistance } from './center-model';
import type { RouteState } from './route-controller';

export type RouteLine = { text: string; tone: 'info' | 'warning'; busy?: boolean };
export type RouteDescription = {
  lines: RouteLine[];
  /** `Walking route: 650 m, about 9 min` for the selected center; null when there is no route to show. */
  summary: string | null;
  /** Streets near the starting point, offered when the service cannot tell which one the resident is on. */
  candidates: AttachmentCandidate[];
  graphVersion: string | null;
  retryable: boolean;
  attribution: string | null;
};

export function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

const ESTIMATE_ONLY = 'Distances shown are straight-line estimates, not walking routes.';
const GUIDANCE = 'This route comes from current road information. Look around you and follow instructions from officials; the app cannot confirm that a route is safe.';

function resultMessage(state: RouteState): string | null {
  const result = state.result;
  if (result === null) return null;
  switch (result.status) {
    case 'ok':
      return result.warnings.some((warning) => warning.code === 'unknown_center_availability')
        ? 'No center is confirmed open on a safe route, so this one has unconfirmed availability.' : null;
    case 'attachment_ambiguous': return 'Several streets are near your starting point. Choose the one you are on:';
    case 'outside_coverage': return 'Your starting point is outside the Ampid I route area. Walking routes are only available inside Ampid I.';
    case 'no_nearby_path': return 'No walkable street is within 50 m of your starting point.';
    case 'no_route_within_coverage': return 'No open walking route reaches this center. Road closures cut it off.';
    case 'center_unavailable': return 'This center cannot be routed to: it is unavailable or its entrance is not reviewed yet.';
    case 'restrictions_unmapped': return 'Some road restrictions do not match the route map, so no route is shown.';
    case 'invalid_origin': return 'Your starting point could not be used for routing. Try setting it again.';
    case 'cancelled': return null;
  }
}

/**
 * What the route card says (plan P14-T04/T05): the state of the route service in words, the route for the selected
 * center when there is one, and, whenever there is no route, that the distances are estimates. A failure is never
 * presented as a route and never drawn as a straight line.
 */
export function describeRoute(state: RouteState, context: { now: number; hasStartingPoint: boolean; selectedId: string | null }): RouteDescription {
  const none: RouteDescription = { lines: [], summary: null, candidates: [], graphVersion: null, retryable: false, attribution: null };
  if (state.status === 'unavailable') {
    return { ...none, lines: [{ text: `Walking routes are not available in this version yet. ${ESTIMATE_ONLY}`, tone: 'info' }] };
  }
  if (!context.hasStartingPoint) {
    return { ...none, lines: [{ text: 'Use your location or place a starting point to see distances and a walking route.', tone: 'info' }] };
  }
  if (state.status === 'idle' || state.status === 'paused') return none;
  if (state.status === 'loading') return { ...none, lines: [{ text: 'Calculating walking route…', tone: 'info', busy: true }] };

  const lines: RouteLine[] = [];
  if (state.status === 'failed' && state.failure !== null) {
    lines.push({ text: describeConnectedFailure(state.failure), tone: 'warning' });
    lines.push({ text: `No route is shown until the route service answers. ${ESTIMATE_ONLY}`, tone: 'warning' });
    if (state.gaveUp) lines.push({ text: 'Automatic retries have stopped.', tone: 'warning' });
    return { ...none, lines, retryable: true };
  }

  if (state.stale && state.failure !== null) {
    lines.push({ text: `${describeConnectedFailure(state.failure)} Showing the last route received ${state.checkedAt === null ? 'earlier' : formatAge(context.now - state.checkedAt)}; road conditions may have changed.`, tone: 'warning' });
  } else if (state.checkedAt !== null) {
    lines.push({ text: `Road closures and center status checked ${formatAge(context.now - state.checkedAt)}.`, tone: 'info' });
  }
  const message = resultMessage(state);
  const result = state.result;
  if (message !== null) lines.push({ text: message, tone: result?.status === 'attachment_ambiguous' ? 'info' : 'warning' });
  if (result !== null && result.status !== 'ok' && result.status !== 'attachment_ambiguous') lines.push({ text: ESTIMATE_ONLY, tone: 'info' });

  let summary: string | null = null;
  if (result !== null && result.status === 'ok' && context.selectedId !== null && result.best.centerId === context.selectedId) {
    summary = `Walking route: ${formatDistance(result.best.distanceMeters)}, about ${Math.max(1, Math.round(result.best.durationSeconds / 60))} min`;
    if (result.shortest !== null) {
      const extra = Math.round(result.best.distanceMeters - result.shortest.distanceMeters);
      const reason = result.shortestAvoids.includes('sensor_risk') ? 'it avoids a road near a high river gauge reading'
        : result.shortestAvoids.includes('traffic') ? 'it avoids congestion' : 'it is safer';
      lines.push({ text: `The recommended route is ${extra} m longer than the shortest open route because ${reason}.`, tone: 'info' });
    }
    lines.push({ text: GUIDANCE, tone: 'info' });
  }
  return {
    lines, summary, retryable: state.stale,
    candidates: result !== null && result.status === 'attachment_ambiguous' ? result.candidates : [],
    graphVersion: result?.provenance.graphVersion ?? null,
    attribution: state.attribution,
  };
}
