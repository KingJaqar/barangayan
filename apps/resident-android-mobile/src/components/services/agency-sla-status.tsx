import { AGENCY_SLA_LABEL, calculateAgencySla, projectSlaTime, formatSlaDuration, type SlaRequest, type SlaPause } from '@barangayan/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

export function AgencySlaStatus({ requestId, compact = false, footer }: { requestId: string; compact?: boolean; footer?: ReactNode }) {
  const { resident } = useTheme();
  const [snapshot, setSnapshot] = useState<{ request: SlaRequest; pauses: SlaPause[]; evaluated_at: string; receivedAt: number; receivedRequestId: string } | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(() => performance.now());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let pending: AbortController | null = null;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      pending = new AbortController();
      const timeout = setTimeout(() => pending?.abort(), 10000);
      try {
        const { data, error: failure } = await supabase.rpc('service_request_sla_tracking', { p_request_id: requestId }).abortSignal(pending.signal);
        if (failure || !data) throw new Error('clock_unavailable');
        if (active) { setSnapshot({ ...(data as unknown as Omit<NonNullable<typeof snapshot>, 'receivedAt' | 'receivedRequestId'>), receivedAt: performance.now(), receivedRequestId: requestId }); setError(''); }
      } catch { if (active) setError('Processing clock unavailable. Please retry.'); }
      finally { clearTimeout(timeout); pending = null; inFlight = false; }
    }
    void load();
    const refresh = setInterval(() => void load(), 15000);
    const timer = setInterval(() => setTick(performance.now()), 1000);
    return () => { active = false; pending?.abort(); clearInterval(refresh); clearInterval(timer); };
  }, [requestId, retry]);
  if (error) return <View><ThemedText style={compact ? styles.compactText : undefined} accessibilityRole="alert">{error}</ThemedText>{!compact ? <Pressable style={{ minHeight:48, padding:12 }} accessibilityRole="button" onPress={() => setRetry(v=>v+1)}><ThemedText>Retry</ThemedText></Pressable> : null}{compact ? footer : null}</View>;
  if (!snapshot || snapshot.receivedRequestId !== requestId) return <View><ThemedText style={compact ? styles.compactText : undefined}>Loading processing clock…</ThemedText>{compact ? footer : null}</View>;
  const r = snapshot.request;
  if (r.timing_model !== 'agency_minutes_v1') return <View><ThemedText type="small" style={compact ? styles.compactText : undefined}>Previous timing model · original processing estimate retained</ThemedText>{compact ? footer : null}</View>;
  const value = calculateAgencySla(r, snapshot.pauses, projectSlaTime(snapshot.evaluated_at, Math.max(0,tick-snapshot.receivedAt)));
  if (!compact) return <View style={[styles.panel, { backgroundColor: resident.card, borderColor: resident.border }]}>
    <View style={styles.panelHeading}>
      <Ionicons name="time-outline" size={18} color={resident.accentText} accessible={false} />
      <ThemedText style={{ flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{AGENCY_SLA_LABEL[value.position]}</ThemedText>
    </View>
    {value.waitingReason ? <ThemedText style={[styles.explainer, { color: resident.muted }]}>Waiting for resident: {value.waitingReason} · SLA position retained</ThemedText> : null}
    {[
      ['Agency processing', `${formatSlaDuration(value.agencySeconds)} / ${r.target_minutes_snapshot} minutes`],
      ['Resident wait', formatSlaDuration(value.residentWaitSeconds)],
      ['Total turnaround', formatSlaDuration(value.turnaroundSeconds)],
    ].map(([label, time]) => <View key={label} style={[styles.timingRow, { borderColor: resident.border }]}>
      <ThemedText style={{ fontSize: 13.5, lineHeight: 19, color: resident.muted, flexShrink: 1 }}>{label}</ThemedText>
      <ThemedText style={{ fontSize: 13.5, lineHeight: 19, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{time}</ThemedText>
    </View>)}
    <ThemedText style={[styles.explainer, { color: resident.muted, backgroundColor: resident.surface }]}>Processing starts at staff acceptance and ends at readiness. Turnaround ends at release.</ThemedText>
    {snapshot.pauses.map((p, i) => <ThemedText style={styles.explainer} key={`${p.started_at}:${i}`}>{p.reason} · {new Date(p.started_at).toLocaleString()} → {p.resumed_at ? new Date(p.resumed_at).toLocaleString() : 'Waiting'}</ThemedText>)}
  </View>;
  return <View style={styles.compact}>
    <ThemedText type="smallBold" style={styles.compactText}>{AGENCY_SLA_LABEL[value.position]}</ThemedText>
    {value.waitingReason ? <ThemedText type="small" style={styles.compactText}>Waiting for resident: {value.waitingReason} · SLA position retained</ThemedText> : null}
    <View style={styles.badgeRow}>
      <View accessible accessibilityLabel={`Agency processing: ${formatSlaDuration(value.agencySeconds)} of ${r.target_minutes_snapshot} minutes target`}
        style={[styles.clockBadge, { backgroundColor: resident.surface }]}>
        <Ionicons name="time-outline" size={14} color={resident.muted} accessible={false} />
        <ThemedText type="smallBold" style={[styles.compactText, styles.clockText, { color: resident.text }]}>
          {`${Math.floor(value.agencySeconds / 3600).toString().padStart(2, '0')}:${Math.floor((value.agencySeconds % 3600) / 60).toString().padStart(2, '0')}:${Math.floor(value.agencySeconds % 60).toString().padStart(2, '0')}`}
        </ThemedText>
      </View>
      {footer}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  panelHeading: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, alignItems: 'center' },
  timingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  explainer: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 12, lineHeight: 17 },
  compact: { gap: 3, paddingTop: 2 },
  compactText: { fontSize: 12.5, lineHeight: 16 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  clockBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  clockText: { fontVariant: ['tabular-nums'] },
});
