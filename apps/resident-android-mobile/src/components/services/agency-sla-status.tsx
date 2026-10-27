import { AGENCY_SLA_LABEL, calculateAgencySla, projectSlaTime, formatSlaDuration } from '@barangayan/shared';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { trackingDuration } from '@/lib/tracking-duration';
import { TrackingReveal } from './tracking-reveal';
import { mountDiagnosticOwner, navigationDiagnosticsAvailable, recordNavigationDiagnostic } from '@/lib/navigation-diagnostics';
import { useAuth } from '@/hooks/use-auth';
import { useAppForeground } from '@/hooks/use-app-foreground';
import { useVisibleClock } from '@/hooks/use-visible-clock';
import { readAgencySlaSnapshot, type AgencySlaSnapshot } from '@/lib/agency-sla-snapshot';

interface Props { requestId: string; compact?: boolean }

export function AgencySlaStatus(props: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return <OwnedAgencySlaStatus key={`${userId}:${props.requestId}`} {...props} signedIn={userId !== null} />;
}

function OwnedAgencySlaStatus({ requestId, compact = false, signedIn }: Props & { signedIn: boolean }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const focused = useIsFocused();
  const foreground = useAppForeground();
  const visible = focused && foreground && signedIn;
  const [snapshot, setSnapshot] = useState<(AgencySlaSnapshot & { receivedAt: number }) | null>(null);
  const [error, setError] = useState('');
  const tick = useVisibleClock(visible && snapshot !== null && !error && snapshot.request.timing_model === 'agency_minutes_v1' && !snapshot.request.released_at && !snapshot.request.cancelled_at);
  const [retry, setRetry] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => mountDiagnosticOwner(compact ? 'sla-compact' : 'sla-full'), [compact]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    let inFlight = false;
    let pending: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      pending = new AbortController();
      timeout = setTimeout(() => pending?.abort(), 10000);
      try {
        const { data, error: failure } = await supabase.rpc('service_request_sla_tracking', { p_request_id: requestId }).abortSignal(pending.signal);
        const next = readAgencySlaSnapshot(data);
        if (failure || next === null) throw new Error('clock_unavailable');
        if (active) { setSnapshot({ ...next, receivedAt: performance.now() }); setError(''); }
      } catch { if (active) setError('Processing clock unavailable. Please retry.'); }
      finally { if (timeout !== null) clearTimeout(timeout); timeout = null; pending = null; inFlight = false; }
    }
    void load();
    const refresh = setInterval(() => { if (navigationDiagnosticsAvailable) recordNavigationDiagnostic('sla-poll', compact ? 'sla-compact' : 'sla-full'); void load(); }, 15000);
    return () => { active = false; pending?.abort(); if (timeout !== null) clearTimeout(timeout); clearInterval(refresh); };
  }, [requestId, retry, compact, visible]);
  useEffect(() => {
    if (visible && navigationDiagnosticsAvailable) recordNavigationDiagnostic('sla-tick', compact ? 'sla-compact' : 'sla-full');
  }, [tick, visible, compact]);
  if (error) return <View><ThemedText style={compact ? styles.compactText : undefined} accessibilityRole="alert">{error}</ThemedText>{!compact ? <Pressable style={{ minHeight:48, padding:12 }} accessibilityRole="button" onPress={() => setRetry(v=>v+1)}><ThemedText>Retry</ThemedText></Pressable> : null}</View>;
  if (!snapshot) return <View><ThemedText style={compact ? styles.compactText : undefined}>Loading processing clock…</ThemedText></View>;
  const r = snapshot.request;
  if (r.timing_model !== 'agency_minutes_v1') return compact ? null : <View><ThemedText type="small">Previous timing model · original processing estimate retained</ThemedText></View>;
  const value = calculateAgencySla(r, snapshot.pauses, projectSlaTime(snapshot.evaluated_at, Math.max(0,tick-snapshot.receivedAt)));
  const warning = value.position === 'near_target' || value.position === 'overdue' || value.position === 'completed_beyond';
  const cancelled = value.position === 'cancelled';
  const tone = cancelled ? resident.danger : warning ? resident.warning : resident.accentText;
  const soft = cancelled ? resident.dangerSoft : warning ? resident.warningSoft : resident.accentSoft;
  const used = value.targetSeconds > 0 ? Math.min(1, value.agencySeconds / value.targetSeconds) : 0;
  if (!compact) return <View style={[styles.panel, { backgroundColor: resident.card, borderColor: resident.border }]}>
    <View style={[styles.panelHeading, { backgroundColor: soft }]}>
      <View style={[styles.statusIcon, { backgroundColor: resident.card }]}>
        <Ionicons name={cancelled ? 'close-outline' : r.ready_at ? 'checkmark-done-outline' : 'time-outline'} size={18} color={tone} accessible={false} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={[styles.eyebrow, { color: resident.muted }]}>PROCESSING STATUS</ThemedText>
        <ThemedText style={[styles.statusTitle, { color: tone }]}>{AGENCY_SLA_LABEL[value.position]}</ThemedText>
      </View>
    </View>
    {value.waitingReason ? <ThemedText style={[styles.waitingReason, { color: resident.muted }]}>Waiting for resident: {value.waitingReason} · SLA position retained</ThemedText> : null}
    <View style={styles.agencyBlock}>
      <View style={styles.metricHeading}>
        <ThemedText style={[styles.metricLabel, { color: resident.muted }]}>Agency processing</ThemedText>
        <ThemedText style={[styles.target, { color: resident.accentText, backgroundColor: resident.accentSoft }]}>
          {value.targetSeconds > 0 ? `${trackingDuration(value.targetSeconds)} target` : 'Target unavailable'}
        </ThemedText>
      </View>
      <ThemedText style={styles.agencyValue}>{!r.accepted_at ? 'Not started' : trackingDuration(value.agencySeconds)}</ThemedText>
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Agency processing target used, not request completion"
        accessibilityValue={value.targetSeconds > 0 ? { min: 0, max: 100, now: Math.round(used * 100), text: `${trackingDuration(value.agencySeconds, true)} of ${trackingDuration(value.targetSeconds, true)} target used` } : { text: 'Target unavailable' }}
        style={[styles.track, { backgroundColor: resident.border }]}>
        <View style={[styles.fill, { width: `${used * 100}%`, backgroundColor: tone }]} />
      </View>
      <ThemedText style={[styles.caption, { color: resident.muted }]}>
        {cancelled ? 'Stopped at cancellation' : !r.accepted_at ? 'Begins when staff accept your request' : r.ready_at ? 'Processing finished at readiness' : r.sla_state === 'paused' ? 'Paused while awaiting requirements' : value.position === 'overdue' ? 'Beyond the agency processing target' : 'Active agency time · excludes resident wait'}
      </ThemedText>
    </View>
    <View style={[styles.secondaryMetrics, { borderColor: resident.border }]}>
      <View style={[styles.secondaryMetric, { backgroundColor: resident.surface }]}>
        <View style={styles.secondaryHeading}>
        <Ionicons name="pause-circle-outline" size={16} color={resident.muted} accessible={false} />
        <ThemedText style={[styles.metricLabel, { color: resident.muted }]}>Resident wait</ThemedText>
        </View>
        <ThemedText style={styles.secondaryValue}>{value.residentWaitSeconds > 0 ? trackingDuration(value.residentWaitSeconds) : 'No wait recorded'}</ThemedText>
        <ThemedText style={[styles.caption, { color: resident.muted }]}>Awaiting requirements</ThemedText>
      </View>
      <View style={[styles.secondaryMetric, { backgroundColor: resident.surface }]}>
        <View style={styles.secondaryHeading}>
        <Ionicons name="hourglass-outline" size={16} color={resident.muted} accessible={false} />
        <ThemedText style={[styles.metricLabel, { color: resident.muted }]}>Total turnaround</ThemedText>
        </View>
        <ThemedText style={styles.secondaryValue}>{trackingDuration(value.turnaroundSeconds)}</ThemedText>
        <ThemedText style={[styles.caption, { color: resident.muted }]}>{cancelled ? 'Until cancellation' : r.released_at ? 'Submission to release' : 'Since submission'}</ThemedText>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Timing details" accessibilityState={{ expanded: detailsOpen }}
      onPress={() => setDetailsOpen(open => !open)}
      style={({ pressed }) => [styles.disclosure, { backgroundColor: pressed ? resident.pressed : resident.card }]}>
      <Ionicons name="information-circle-outline" size={16} color={resident.accentText} accessible={false} />
      <ThemedText style={[styles.disclosureLabel, { color: resident.accentText }]}>Timing details</ThemedText>
      <Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={resident.muted} accessible={false} />
    </Pressable>
    {detailsOpen ? <TrackingReveal reducedMotion={reducedMotion} style={[styles.timingDetails, { borderColor: resident.border }]}>
      {[
        ['Agency processing', trackingDuration(value.agencySeconds, true)],
        ['Processing target', value.targetSeconds > 0 ? trackingDuration(value.targetSeconds, true) : 'Unavailable'],
        ['Resident wait', trackingDuration(value.residentWaitSeconds, true)],
        ['Total turnaround', trackingDuration(value.turnaroundSeconds, true)],
      ].map(([label, duration]) => <View key={label} style={styles.exactRow}>
        <ThemedText style={[styles.caption, { color: resident.muted }]}>{label}</ThemedText>
        <ThemedText style={styles.exactValue}>{duration}</ThemedText>
      </View>)}
      <ThemedText style={[styles.caption, { color: resident.muted }]}>Processing starts at staff acceptance and ends at readiness. Turnaround ends at release.</ThemedText>
      {snapshot.pauses.map((p, i) => <ThemedText style={[styles.caption, { color: resident.muted }]} key={`${p.started_at}:${i}`}>{p.reason} · {new Date(p.started_at).toLocaleString()} → {p.resumed_at ? new Date(p.resumed_at).toLocaleString() : 'Waiting'}</ThemedText>)}
    </TrackingReveal> : null}
  </View>;
  const remaining = value.targetSeconds - value.agencySeconds;
  // One short estimate line; the list card owns status and next action. Never a ticking 00:00:00.
  const estimate = !r.accepted_at
    ? (value.targetSeconds > 0 ? `Est. ${trackingDuration(value.targetSeconds)} once accepted` : 'Estimate unavailable')
    : remaining >= 60 ? `Est. ${trackingDuration(remaining)} left`
    : remaining > 0 ? 'Est. under 1 min left' : 'Past estimated time';
  return <ThemedText type="small" themeColor="textSecondary" style={styles.compactText}
    accessibilityLabel={`Agency processing: ${formatSlaDuration(value.agencySeconds)} of ${r.target_minutes_snapshot} minutes target. ${estimate}`}>{estimate}</ThemedText>;
}

const styles = StyleSheet.create({
  panel: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  panelHeading: { flexDirection: 'row', gap: 10, padding: 14, alignItems: 'center' },
  statusIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 0.8, fontWeight: '700' },
  statusTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  waitingReason: { paddingHorizontal: 14, paddingTop: 12, fontSize: 12, lineHeight: 18 },
  agencyBlock: { padding: 14, gap: 7 },
  metricHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  metricLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  target: { fontSize: 11, lineHeight: 16, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 1 },
  agencyValue: { fontSize: 23, lineHeight: 30, fontWeight: '800' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginVertical: 2 },
  fill: { height: '100%', borderRadius: 3 },
  caption: { fontSize: 12, lineHeight: 17 },
  secondaryMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 4 },
  secondaryMetric: { flex: 1, minWidth: 120, padding: 10, borderRadius: 12, gap: 4 },
  secondaryHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  secondaryValue: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 48, paddingHorizontal: 14 },
  disclosureLabel: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  timingDetails: { borderTopWidth: 1, padding: 14, gap: 10 },
  exactRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  exactValue: { fontSize: 12, lineHeight: 17, fontWeight: '600', flexShrink: 1 },
  compactText: { fontSize: 12.5, lineHeight: 16 },
});
