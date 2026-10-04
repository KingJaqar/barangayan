import type { RequestFoundationFields, ServiceRequestPauseRow } from '../types/service-foundations';

export type SlaRequest = Pick<RequestFoundationFields, 'timing_model' | 'target_minutes_snapshot' | 'sla_state' | 'accepted_at' | 'ready_at' | 'released_at' | 'cancelled_at'> & { created_at: string };
export type SlaPause = Pick<ServiceRequestPauseRow, 'started_at' | 'resumed_at' | 'reason'>;
export type AgencyPosition = 'pre_processing' | 'on_track' | 'near_target' | 'overdue' | 'completed_within' | 'completed_beyond' | 'cancelled' | 'legacy';
export const AGENCY_SLA_LABEL: Record<AgencyPosition, string> = {
  pre_processing: 'Awaiting complete requirements', on_track: 'On Track', near_target: 'Near Target', overdue: 'Overdue',
  completed_within: 'Completed Within Target', completed_beyond: 'Completed Beyond Target', cancelled: 'Cancelled', legacy: 'Previous timing model',
};
const ms = (value: string) => new Date(value).getTime();
const zero = BigInt(0);
/** PostgreSQL timestamps retain microseconds; Date alone silently discards them. */
const micros = (value: string) => {
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? '';
  return BigInt(ms(value)) * BigInt(1000) + BigInt(fraction.slice(3,6).padEnd(3,'0'));
};
const max = (a: bigint, b: bigint) => a > b ? a : b;
const min = (a: bigint, b: bigint) => a < b ? a : b;
/** Exact seconds, rounded only by the presentation layer. Ready stops agency time; release stops turnaround. */
export function projectSlaTime(serverAt: string, elapsedMilliseconds: number): string {
  const value = micros(serverAt) + BigInt(Math.max(0,Math.floor(elapsedMilliseconds))) * BigInt(1000);
  return new Date(Number(value / BigInt(1000))).toISOString().replace(/Z$/, `${(value % BigInt(1000)).toString().padStart(3,'0')}Z`);
}
export function calculateAgencySla(request: SlaRequest, pauses: readonly SlaPause[], now: Date | string = new Date()) {
  const clock = typeof now === 'string' ? now : now.toISOString();
  const end = micros(request.ready_at ?? request.cancelled_at ?? clock);
  const start = request.accepted_at ? micros(request.accepted_at) : end;
  const wait = pauses.reduce((total, pause) => total + max(zero,
    min(micros(pause.resumed_at ?? clock), end) - max(micros(pause.started_at), start)), zero);
  const residentWaitSeconds = Number(wait) / 1000000;
  const agencySeconds = Number(max(zero, end - start - wait)) / 1000000;
  const turnaroundSeconds = Number(max(zero, micros(request.released_at ?? request.cancelled_at ?? clock) - micros(request.created_at))) / 1000000;
  const targetSeconds = (request.target_minutes_snapshot ?? 0) * 60;
  let position: AgencyPosition;
  if (request.timing_model !== 'agency_minutes_v1') position = 'legacy';
  else if (request.sla_state === 'cancelled') position = 'cancelled';
  else if (!request.accepted_at) position = 'pre_processing';
  else if (request.ready_at) position = agencySeconds <= targetSeconds ? 'completed_within' : 'completed_beyond';
  else position = agencySeconds > targetSeconds ? 'overdue' : agencySeconds >= targetSeconds * 0.8 ? 'near_target' : 'on_track';
  const waitingReason = request.sla_state === 'paused' ? pauses.find(p => !p.resumed_at)?.reason ?? null : null;
  return { agencySeconds, residentWaitSeconds, turnaroundSeconds, targetSeconds, position, waitingReason };
}
export function formatSlaDuration(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}
export function summarizeAgencySla(rows: readonly (SlaRequest & { pauses: readonly SlaPause[] })[], start: Date, end: Date, now: Date | string = new Date()) {
  const inWindow = (value: string | null) => !!value && ms(value) >= start.getTime() && ms(value) < end.getTime();
  const current = rows.filter(r => r.timing_model === 'agency_minutes_v1');
  const ready = current.filter(r => r.sla_state !== 'cancelled' && inWindow(r.ready_at)).map(r => calculateAgencySla(r, r.pauses, now));
  const released = current.filter(r => r.sla_state !== 'cancelled' && inWindow(r.released_at)).map(r => calculateAgencySla(r, r.pauses, now));
  const average = (values: number[]) => values.length ? values.reduce((a,b) => a+b,0) / values.length : null;
  return {
    readyCount: ready.length, averageProcessingSeconds: average(ready.map(r => r.agencySeconds)),
    withinTargetPercent: ready.length ? ready.filter(r => r.agencySeconds <= r.targetSeconds).length / ready.length * 100 : null,
    averageResidentWaitSeconds: average(ready.map(r => r.residentWaitSeconds)),
    releasedCount: released.length, averageTurnaroundSeconds: average(released.map(r => r.turnaroundSeconds)),
    overdueCount: current.filter(r => calculateAgencySla(r,r.pauses,now).position === 'overdue').length,
    pausedCount: current.filter(r => r.sla_state === 'paused').length,
    legacyCount: rows.length-current.length,
  };
}
