import { AGENCY_SLA_LABEL, calculateAgencySla, projectSlaTime, formatSlaDuration, type SlaRequest, type SlaPause } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export function AgencySlaStatus({ requestId, compact = false }: { requestId: string; compact?: boolean }) {
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
  if (error) return <View><ThemedText accessibilityRole="alert">{error}</ThemedText>{!compact ? <Pressable style={{ minHeight:48, padding:12 }} accessibilityRole="button" onPress={() => setRetry(v=>v+1)}><ThemedText>Retry</ThemedText></Pressable> : null}</View>;
  if (!snapshot || snapshot.receivedRequestId !== requestId) return <ThemedText>Loading processing clock…</ThemedText>;
  const r = snapshot.request;
  if (r.timing_model !== 'agency_minutes_v1') return <ThemedText type="small">Previous timing model · original processing estimate retained</ThemedText>;
  const value = calculateAgencySla(r, snapshot.pauses, projectSlaTime(snapshot.evaluated_at, Math.max(0,tick-snapshot.receivedAt)));
  return <View style={{ gap:8, paddingVertical:8 }}>
    <ThemedText type="smallBold">{AGENCY_SLA_LABEL[value.position]}</ThemedText>
    {value.waitingReason ? <ThemedText type="small">Waiting for resident: {value.waitingReason} · SLA position retained</ThemedText> : null}
    <ThemedText type="small">Agency processing: {formatSlaDuration(value.agencySeconds)} / {r.target_minutes_snapshot} minutes</ThemedText>
    {!compact ? <><ThemedText type="small">Resident wait: {formatSlaDuration(value.residentWaitSeconds)}</ThemedText><ThemedText type="small">Total turnaround: {formatSlaDuration(value.turnaroundSeconds)}</ThemedText>
      <ThemedText type="small">Processing starts at staff acceptance and ends at readiness. Turnaround ends at release.</ThemedText>
      {snapshot.pauses.map((p,i)=><ThemedText type="small" key={`${p.started_at}:${i}`}>{p.reason} · {new Date(p.started_at).toLocaleString()} → {p.resumed_at ? new Date(p.resumed_at).toLocaleString() : 'Waiting'}</ThemedText>)}</> : null}
  </View>;
}
