'use client';

import { describeConnectedFailure } from '@barangayan/shared/src/lib/connected-route-client';
import type { AttachmentCandidate } from '@barangayan/shared/src/lib/evacuation-routing';
import { AlertCircle, Route as RouteIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/loading';
import type { ConnectedRouteState } from '@/hooks/use-connected-route';
import styles from './emergency.module.css';

function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function statusMessage(state: ConnectedRouteState): string | null {
  const result = state.result;
  if (result === null) return null;
  switch (result.status) {
    case 'ok':
      return result.warnings.some((w) => w.code === 'unknown_center_availability')
        ? 'No center is confirmed open on a safe route, so this one has unconfirmed availability.'
        : null;
    case 'attachment_ambiguous':
      return 'Several streets are near your location. Choose the one you are on:';
    case 'outside_coverage':
      return 'You are outside the Ampid I route area. Walking routes are only available inside Ampid I.';
    case 'no_nearby_path':
      return 'No walkable street is within 50 m of your location.';
    case 'no_route_within_coverage':
      return 'No open walking route reaches this center. Road closures cut it off.';
    case 'center_unavailable':
      return 'This center cannot be routed to: it is unavailable or its entrance is not reviewed yet.';
    case 'restrictions_unmapped':
      return 'Some road restrictions do not match the route map, so no route is shown.';
    case 'invalid_origin':
      return 'Your location could not be used for routing. Try locating again.';
    case 'cancelled':
      return null;
  }
}

/**
 * Route-service status for the web Centers screen (DRRM routing plan R7): what the route is
 * based on, how fresh it is, and every failure in words. Web needs the service for every new
 * route, and a failed one is never drawn as a straight line (invariants 7 and 8).
 */
export function RouteStatusCard({
  state,
  now,
  onChooseSegment,
  onRetry,
}: {
  state: ConnectedRouteState;
  now: number;
  onChooseSegment: (candidate: AttachmentCandidate, graphVersion: string) => void;
  onRetry: () => void;
}) {
  if (state.status === 'idle') return null;

  const lines: { text: string; tone: 'info' | 'warning'; busy?: boolean }[] = [];
  let retryable = false;
  if (state.status === 'loading') {
    lines.push({ text: 'Calculating walking route…', tone: 'info', busy: true });
  } else if (state.status === 'failed' && state.failure !== null) {
    lines.push({ text: describeConnectedFailure(state.failure), tone: 'warning' });
    lines.push({ text: 'Walking routes need a connection to the route service. No route is shown until it answers.', tone: 'warning' });
    retryable = true;
  } else if (state.status === 'ready') {
    if (state.stale && state.failure !== null) {
      lines.push({
        text: `${describeConnectedFailure(state.failure)} Showing the last route received ${state.checkedAt === null ? 'earlier' : formatAge(now - state.checkedAt)}; road conditions may have changed.`,
        tone: 'warning',
      });
      retryable = true;
    } else if (state.checkedAt !== null) {
      lines.push({ text: `Road closures and center status checked ${formatAge(now - state.checkedAt)}.`, tone: 'info' });
    }
    const message = statusMessage(state);
    if (message !== null) lines.push({ text: message, tone: state.result?.status === 'attachment_ambiguous' ? 'info' : 'warning' });
    const result = state.result;
    if (result !== null && result.status === 'ok' && result.shortest !== null) {
      const extra = Math.round(result.best.distanceMeters - result.shortest.distanceMeters);
      const reason = result.shortestAvoids.includes('sensor_risk')
        ? 'it avoids a road near a high river gauge reading'
        : result.shortestAvoids.includes('traffic')
          ? 'it avoids congestion'
          : 'it is safer';
      lines.push({ text: `The recommended route is ${extra} m longer than the shortest open route because ${reason}.`, tone: 'info' });
    }
  }
  if (lines.length === 0 && state.result === null) return null;

  const candidates = state.result !== null && state.result.status === 'attachment_ambiguous' ? state.result.candidates : [];
  const graphVersion = state.result?.provenance.graphVersion ?? null;

  return (
    <div role="status" aria-live="polite" className={styles.locationCard}>
      {lines.map((line) => (
        <div key={line.text} className="flex items-start gap-2.5">
          {line.busy ? (
            <Spinner className="mt-0.5 text-primary" />
          ) : line.tone === 'info' ? (
            <RouteIcon size={16} className="mt-0.5 shrink-0 text-primary" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
          )}
          <p className="text-sm">{line.text}</p>
        </div>
      ))}
      {candidates.length > 0 && graphVersion !== null ? (
        <div className="flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <Button
              key={candidate.edgeId}
              type="button"
              size="sm"
              variant="outline"
              className={styles.secondaryButton}
              onClick={() => onChooseSegment(candidate, graphVersion)}>
              {candidate.name ?? 'Unnamed path'} · {Math.round(candidate.distanceMeters)} m
            </Button>
          ))}
        </div>
      ) : null}
      {retryable ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className={styles.primaryButton} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
      {state.attribution !== null ? <p className="text-[11px] text-muted-foreground">{state.attribution}</p> : null}
    </div>
  );
}
