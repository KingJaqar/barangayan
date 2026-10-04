'use client';

import { AGENCY_SLA_LABEL, calculateAgencySla, projectSlaTime, formatSlaDuration, type SlaRequest, type SlaPause } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function AgencySlaStatus({ requestId, compact = false }: { requestId: string; compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<{ request: SlaRequest; pauses: SlaPause[]; evaluated_at: string; receivedAt: number; receivedRequestId: string } | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(() => performance.now());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let pending: AbortController | null = null;
    const client = createSupabaseBrowserClient();
    async function load() {
      if (inFlight) return;
      inFlight = true;
      pending = new AbortController();
      const timeout = setTimeout(() => pending?.abort(), 10000);
      try {
        const { data, error: failure } = await client.rpc('service_request_sla_tracking', { p_request_id: requestId }).abortSignal(pending.signal);
        if (failure || !data) throw new Error('Processing clock unavailable. Please retry.');
        if (active) { setSnapshot({ ...(data as unknown as Omit<NonNullable<typeof snapshot>, 'receivedAt' | 'receivedRequestId'>), receivedAt: performance.now(), receivedRequestId: requestId }); setError(''); }
      } catch { if (active) setError('Processing clock unavailable. Please retry.'); }
      finally { clearTimeout(timeout); pending = null; inFlight = false; }
    }
    void load();
    const refresh = setInterval(() => void load(), 15000);
    const timer = setInterval(() => setTick(performance.now()), 1000);
    return () => { active = false; pending?.abort(); clearInterval(refresh); clearInterval(timer); };
  }, [requestId, retry]);
  if (error) return <span role="alert" className="block text-sm">{error}{!compact ? <button className="ml-2 underline" onClick={() => setRetry(v => v+1)}>Retry</button> : null}</span>;
  if (!snapshot || snapshot.receivedRequestId !== requestId || snapshot.request.created_at === undefined) return <span className="block text-sm">Loading processing clock…</span>;
  const r = snapshot.request;
  if (r.timing_model !== 'agency_minutes_v1') return <span className="block text-xs">Previous timing model · original processing estimate retained</span>;
  const value = calculateAgencySla(r, snapshot.pauses, projectSlaTime(snapshot.evaluated_at, Math.max(0,tick-snapshot.receivedAt)));
  return <div className={compact ? 'text-xs' : 'my-4 rounded-xl border p-4 text-sm'}>
    <p className="font-semibold">{AGENCY_SLA_LABEL[value.position]}</p>
    {value.waitingReason ? <p>Waiting for resident: {value.waitingReason} · SLA position retained</p> : null}
    <p>Agency processing: {formatSlaDuration(value.agencySeconds)} / {r.target_minutes_snapshot} minutes</p>
    {!compact ? <><p>Resident wait: {formatSlaDuration(value.residentWaitSeconds)}</p><p>Total turnaround: {formatSlaDuration(value.turnaroundSeconds)}</p>
      <p className="text-xs">Processing starts after staff accept complete requirements and stops at readiness. Turnaround ends at actual release.</p>
      <ul>{snapshot.pauses.map((p,i) => <li key={`${p.started_at}:${i}`}>{p.reason} · {new Date(p.started_at).toLocaleString()} → {p.resumed_at ? new Date(p.resumed_at).toLocaleString() : 'Waiting'}</li>)}</ul></> : null}
  </div>;
}
