import { AGENCY_SLA_LABEL, formatDateTime, formatSlaDuration } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Action, Body, Loading, Notice } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { residentError } from '../../lib/errors';
import { useLatest } from '../../lib/use-latest';
import { radius, space, useColors } from '../../lib/theme';
import { agencyProgress, clockSettled, projectClock, type SlaSnapshot } from './request-tracking';

/** The server clock is re-read this often while the screen is focused and the app is active. */
export const CLOCK_REFRESH_MS = 15_000;
const CLOCK_TIMEOUT_MS = 10_000;

type Loaded = { requestId: string; snapshot: SlaSnapshot; receivedAt: number };

/**
 * Server snapshot of an agency-timed request plus a once-a-second monotonic projection
 * (plan §6.3, P09-T04). It reads on focus, on return to the foreground, every 15 seconds and
 * when `reload` is called; it does nothing while the screen is not focused or the app is in
 * the background, so no hidden timer keeps running. A failed read keeps the last snapshot.
 */
export function useSlaClock(requestId: string) {
  const api = useApi();
  const latest = useLatest(api);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const reloadRef = useRef<(() => void) | null>(null);
  const reload = useCallback(() => reloadRef.current?.(), []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    let inFlight = false;
    let controller: AbortController | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let tickTimer: ReturnType<typeof setInterval> | undefined;
    let settled = false;

    async function load() {
      if (inFlight) return;
      inFlight = true;
      const own = new AbortController();
      controller = own;
      const timeout = setTimeout(() => own.abort(), CLOCK_TIMEOUT_MS);
      try {
        const snapshot = await latest.current.slaTracking(requestId, own.signal);
        if (!alive) return;
        settled = clockSettled(snapshot.request);
        setLoaded({ requestId, snapshot, receivedAt: performance.now() });
        setNow(performance.now());
        setError(null);
      } catch (failure) {
        if (alive) setError(residentError(failure));
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    }
    function stop() {
      if (refreshTimer) clearInterval(refreshTimer);
      if (tickTimer) clearInterval(tickTimer);
      refreshTimer = undefined;
      tickTimer = undefined;
    }
    function start() {
      stop();
      void load();
      refreshTimer = setInterval(() => { if (!settled) void load(); }, CLOCK_REFRESH_MS);
      tickTimer = setInterval(() => { if (!settled) setNow(performance.now()); }, 1000);
    }
    reloadRef.current = () => { if (AppState.currentState === 'active') void load(); };
    if (AppState.currentState === 'active') start();
    const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active') start(); else stop(); });
    return () => {
      alive = false;
      reloadRef.current = null;
      controller?.abort();
      stop();
      lifecycle.remove();
    };
  }, [latest, requestId]));

  const current = loaded && loaded.requestId === requestId ? loaded : null;
  return { snapshot: current?.snapshot ?? null, elapsed: current ? Math.max(0, now - current.receivedAt) : 0, error, reload };
}

/** Agency processing time against the target recorded at submission, resident wait, turnaround and pauses (A13-023…031). */
export function AgencyClockPanel({ requestId, reloadKey }: { requestId: string; reloadKey: number }) {
  const colors = useColors();
  const { snapshot, elapsed, error, reload } = useSlaClock(requestId);
  // A change signalled by the screen (request, payment or pause row) re-reads the clock.
  useEffect(() => { if (reloadKey > 0) reload(); }, [reloadKey, reload]);
  if (!snapshot) {
    return error
      ? <View style={{ gap: space[2] }}><Notice tone="danger" message={`The processing clock could not be loaded. ${error}`} /><Action label="Retry processing clock" secondary onPress={reload} /></View>
      : <Loading label="Loading the processing clock…" />;
  }
  const value = projectClock(snapshot, elapsed);
  const target = snapshot.request.target_minutes_snapshot;
  const progress = agencyProgress(value.agencySeconds, value.targetSeconds);
  return <View style={{ gap: space[2] }}>
    <Body heading role="headline">{AGENCY_SLA_LABEL[value.position]}</Body>
    {value.waitingReason && <Body>{`Waiting for you: ${value.waitingReason}. The processing clock is paused while the barangay waits.`}</Body>}
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Agency processing time against target" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{ height: 8, borderRadius: radius.sm, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(progress * 100)}%`, height: 8, backgroundColor: value.position === 'overdue' || value.position === 'completed_beyond' ? colors.warning : colors.primary }} />
    </View>
    <Body>{`Agency processing: ${formatSlaDuration(value.agencySeconds)}${target ? ` of ${target} minutes target (set at submission)` : ''}`}</Body>
    <Body>{`Time waiting for you: ${formatSlaDuration(value.residentWaitSeconds)}`}</Body>
    <Body>{`Total turnaround: ${formatSlaDuration(value.turnaroundSeconds)}`}</Body>
    <Body role="footnote" tone="secondary">Processing starts when staff accept the request and ends when it is ready. Turnaround ends at release.</Body>
    {snapshot.pauses.length > 0 && <View style={{ gap: space[1] }}>
      <Body role="subheadline" tone="secondary">Pause history</Body>
      {snapshot.pauses.map((pause, index) => <Body key={`${pause.started_at}:${index}`} role="footnote">
        {`${pause.reason} · ${formatDateTime(pause.started_at)} → ${pause.resumed_at ? formatDateTime(pause.resumed_at) : 'still waiting'}`}
      </Body>)}
    </View>}
    {error && <Notice tone="danger" message={`The clock could not be refreshed, so it may be out of date. ${error}`} />}
  </View>;
}
