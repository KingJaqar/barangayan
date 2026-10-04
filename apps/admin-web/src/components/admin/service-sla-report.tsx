'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { calculateAgencySla, summarizeAgencySla, formatSlaDuration, AGENCY_SLA_LABEL, computeDocumentTypeTrends, type SlaRequest, type SlaPause } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Row = SlaRequest & { id:string; reference_number:string; status:string; document_type_id:string; document_type_name:string; legacy_target_hours:number; status_history:unknown; pauses:SlaPause[] };
export function ServiceSlaReport() {
  const [data,setData]=useState<{requests:Row[]; evaluated_at:string; alerts: {id:string;request_id:string;threshold:string;evaluated_at:string;agency_seconds:number}[]}|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [start,setStart]=useState(()=>new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const [end,setEnd]=useState(()=>new Date(Date.now()+86400000).toISOString().slice(0,10));
  useEffect(()=>{
    let active=true;
    let inFlight=false;
    let controller:AbortController|null=null;
    async function load() {
      if(inFlight)return;
      inFlight=true;
      controller=new AbortController();
      const timeout=setTimeout(()=>controller?.abort(),10000);
      try {
        const result=await createSupabaseBrowserClient().rpc('service_sla_report_rows').abortSignal(controller.signal);
        if(result.error || !result.data) throw Error('report_unavailable');
        if(active){setData(result.data as unknown as NonNullable<typeof data>);setError('');}
      } catch {if(active)setError('SLA report unavailable. Check your connection and administrator access, then retry.');}
      finally {clearTimeout(timeout);inFlight=false;}
    }
    void load(); const timer=setInterval(()=>void load(),15000);
    return ()=>{active=false;controller?.abort();clearInterval(timer);};
  },[retry]);
  const valid=!!start&&!!end&&start<end;
  const report=data&&valid ? summarizeAgencySla(data.requests,new Date(start),new Date(end),data.evaluated_at):null;
  const legacyRows=data?.requests.filter(r=>r.timing_model==='legacy_hours'&&r.status==='completed'&&valid).filter(r=>{
    const history=Array.isArray(r.status_history)?r.status_history as {status:string;at:string}[]:[];
    const completed=history.find(h=>h.status==='completed');
    return completed && new Date(completed.at).getTime()>=new Date(start).getTime()&&new Date(completed.at).getTime()<new Date(end).getTime();
  })??[];
  const legacyTypes=[...new Map(legacyRows.map(r=>[r.document_type_id,{id:r.document_type_id,name:r.document_type_name,processing_target_hours:r.legacy_target_hours}])).values()];
  const legacyTrends=computeDocumentTypeTrends(legacyRows,legacyTypes);
  const windowAlerts=data?.alerts.filter(a=>valid&&new Date(a.evaluated_at).getTime()>=new Date(start).getTime()&&new Date(a.evaluated_at).getTime()<new Date(end).getTime())??[];
  return <section className="rounded-xl border p-4 space-y-3">
    <h2 className="font-semibold">Service processing report</h2>
    <div className="flex flex-wrap gap-3"><label>From (UTC)<input className="block rounded border p-2" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>Until, exclusive (UTC)<input className="block rounded border p-2" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
    {!valid?<p role="alert">Select an end date after the start date.</p>:null}
    {error?<p role="alert">{error}<button className="ml-2 underline" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>:!data?<p>Loading SLA report…</p>:null}
    {report?<><p className="text-sm">Processing and waits use readiness in this window. Turnaround uses actual release. Current overdue and paused counts are as of {new Date(data!.evaluated_at).toLocaleString()}. Cancelled requests are excluded from successful-completion compliance.</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt>Ready requests</dt><dd>{report.readyCount}</dd></div><div><dt>Average agency processing</dt><dd>{report.averageProcessingSeconds===null?'No samples':formatSlaDuration(report.averageProcessingSeconds)}</dd></div>
        <div><dt>Within target</dt><dd>{report.withinTargetPercent===null?'No samples':`${report.withinTargetPercent.toFixed(1)}%`}</dd></div>
        <div><dt>Average resident wait</dt><dd>{report.averageResidentWaitSeconds===null?'No samples':formatSlaDuration(report.averageResidentWaitSeconds)}</dd></div>
        <div><dt>Current overdue requests</dt><dd>{report.overdueCount}</dd></div><div><dt>Current paused requests</dt><dd>{report.pausedCount}</dd></div>
        <div><dt>Released requests</dt><dd>{report.releasedCount}</dd></div><div><dt>Average total turnaround</dt><dd>{report.averageTurnaroundSeconds===null?'No samples':formatSlaDuration(report.averageTurnaroundSeconds)}</dd></div>
      </dl>
      <p className="text-sm">Previous timing model: {report.legacyCount} retained requests; {legacyRows.length} completed in this window. These samples are separate from agency-minute compliance.</p>
      <ul>{legacyTrends.map(t=><li key={t.documentTypeId}>{t.documentTypeName} · {t.completedCount} completed · original target {t.targetHours}h · {t.averageHours===null?'No samples':`${t.averageHours.toFixed(1)}h average submission-to-completion`}</li>)}</ul>
      <h3 className="font-semibold">Requests needing attention</h3>
      <ul className="space-y-2">{data!.requests.filter(r=>r.timing_model==='agency_minutes_v1').map(r=>({r,m:calculateAgencySla(r,r.pauses,data!.evaluated_at)})).filter(({r,m})=>m.position==='overdue'||r.sla_state==='paused').map(({r,m})=><li key={r.id}><Link className="underline" href={`/requests/${r.id}`}>#{r.reference_number}</Link> · {AGENCY_SLA_LABEL[m.position]} · {formatSlaDuration(m.agencySeconds)}{m.waitingReason?` · Waiting: ${m.waitingReason}`:''}</li>)}</ul>
      {!report.overdueCount&&!report.pausedCount?<p>No overdue or paused requests.</p>:null}
      <h3 className="font-semibold">Recorded threshold alerts</h3>
      <p className="text-xs">Each threshold is recorded once per request. Delayed evaluation retains both crossed thresholds. Alerts remain available after readiness.</p>
      <ul className="space-y-2">{windowAlerts.map(a=><li key={a.id}><Link className="underline" href={`/requests/${a.request_id}`}>#{data!.requests.find(r=>r.id===a.request_id)?.reference_number??'Request'}</Link> · {a.threshold==='overdue'?'Overdue':'Near Target'} · {formatSlaDuration(Number(a.agency_seconds))} at evaluation · {new Date(a.evaluated_at).toLocaleString()}</li>)}</ul>
      {!windowAlerts.length?<p>No recorded threshold alerts in this window.</p>:null}
    </>:null}
  </section>;
}
