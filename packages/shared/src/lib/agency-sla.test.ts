import { describe, expect, it } from 'vitest';
import { calculateAgencySla, projectSlaTime, summarizeAgencySla, type SlaRequest } from './agency-sla';
const at=(seconds:number)=>new Date(Date.UTC(2026,0,2)+seconds*1000).toISOString();
const request: SlaRequest={created_at:at(-86400),timing_model:'agency_minutes_v1',target_minutes_snapshot:15,sla_state:'running',accepted_at:at(0),ready_at:null,released_at:null,cancelled_at:null};
describe('agency SLA exact-second clock',()=>{
  it('projects monotonic elapsed time from a server timestamp without discarding microseconds',()=>{
    const clock=projectSlaTime('2026-01-02T00:14:59.999999+00:00',1);
    expect(clock).toBe('2026-01-02T00:15:00.000999Z');
    expect(calculateAgencySla(request,[],clock)).toMatchObject({agencySeconds:900.000999,position:'overdue'});
  });
  it('preserves PostgreSQL microseconds without rounding the threshold position',()=>{
    const r={...request,accepted_at:'2026-01-02T00:00:00.000001+00:00',ready_at:'2026-01-02T00:15:00.000002+00:00',sla_state:'ready'};
    expect(calculateAgencySla(r,[])).toMatchObject({agencySeconds:900.000001,position:'completed_beyond'});
    expect(calculateAgencySla({...r,ready_at:'2026-01-02T00:15:00.000001+00:00'},[])).toMatchObject({agencySeconds:900,position:'completed_within'});
  });
  it.each([[719.999,'on_track'],[720,'near_target'],[899.999,'near_target'],[900,'near_target'],[900.001,'overdue']])('threshold %s seconds', (seconds,position)=>expect(calculateAgencySla(request,[],new Date(at(seconds as number))).position).toBe(position));
  it('does not start on online submission',()=>expect(calculateAgencySla({...request,accepted_at:null,sla_state:'pre_processing'},[],new Date(at(999))).agencySeconds).toBe(0));
  it('excludes documented waits and retains threshold while paused',()=>{
    const result=calculateAgencySla({...request,sla_state:'paused'},[{started_at:at(720),resumed_at:null,reason:'Awaiting resident clarification'}],new Date(at(9999)));
    expect(result).toMatchObject({agencySeconds:720,residentWaitSeconds:9279,position:'near_target',waitingReason:'Awaiting resident clarification'});
  });
  it('stops at readiness, includes release separately and counts internal delays',()=>{
    const r={...request,sla_state:'released',ready_at:at(960),released_at:at(3000)};
    const pauses=[{started_at:at(300),resumed_at:at(360),reason:'Resident document'}];
    expect(calculateAgencySla(r,pauses,new Date(at(9999)))).toMatchObject({agencySeconds:900,residentWaitSeconds:60,turnaroundSeconds:89400,position:'completed_within'});
    expect(calculateAgencySla({...r,ready_at:at(960.001)},pauses).position).toBe('completed_beyond');
  });
  it('freezes cancellation and keeps ready clock stopped after cancellation',()=>{
    expect(calculateAgencySla({...request,sla_state:'cancelled',cancelled_at:at(800)},[],new Date(at(9999)))).toMatchObject({agencySeconds:800,position:'cancelled'});
    expect(calculateAgencySla({...request,sla_state:'cancelled',ready_at:at(750),cancelled_at:at(2000)},[]).agencySeconds).toBe(750);
  });
  it('keeps original snapshot and historical model separate',()=>expect(calculateAgencySla({...request,timing_model:'legacy_hours',target_minutes_snapshot:null},[]).position).toBe('legacy'));
  it('selects by readiness and release using half-open windows, excludes cancellation',()=>{
    const rows=[{...request,ready_at:at(900),released_at:at(2000),sla_state:'released',pauses:[]},
      {...request,ready_at:at(1200),sla_state:'ready',pauses:[]},
      {...request,ready_at:at(1000),cancelled_at:at(1001),sla_state:'cancelled',pauses:[]},
      {...request,timing_model:'legacy_hours',pauses:[]}];
    expect(summarizeAgencySla(rows,new Date(at(900)),new Date(at(1200)),new Date(at(3000)))).toMatchObject({readyCount:1,withinTargetPercent:100,averageProcessingSeconds:900,releasedCount:0,legacyCount:1});
    expect(summarizeAgencySla(rows,new Date(at(2000)),new Date(at(3000)))).toMatchObject({readyCount:0,withinTargetPercent:null,releasedCount:1,averageTurnaroundSeconds:88400});
  });
});
