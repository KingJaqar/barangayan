import type { SlaPause, SlaRequest } from '@barangayan/shared';

export interface AgencySlaSnapshot {
  request: SlaRequest;
  pauses: SlaPause[];
  evaluated_at: string;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const optionalTimestamp = (value: unknown): value is string | null => value === null || timestamp(value);

/** Validate the fields used by the clock before timestamp arithmetic reaches the UI. */
export function readAgencySlaSnapshot(value: unknown): AgencySlaSnapshot | null {
  if (!record(value) || !record(value.request) || !Array.isArray(value.pauses) || !timestamp(value.evaluated_at)) return null;
  const r = value.request;
  if (typeof r.timing_model !== 'string' || typeof r.sla_state !== 'string' || !timestamp(r.created_at)
    || !(r.target_minutes_snapshot === null || (typeof r.target_minutes_snapshot === 'number' && Number.isFinite(r.target_minutes_snapshot) && r.target_minutes_snapshot >= 0))
    || !optionalTimestamp(r.accepted_at) || !optionalTimestamp(r.ready_at) || !optionalTimestamp(r.released_at) || !optionalTimestamp(r.cancelled_at)) return null;
  const pauses: SlaPause[] = [];
  for (const p of value.pauses) {
    if (!record(p) || typeof p.reason !== 'string' || !timestamp(p.started_at) || !optionalTimestamp(p.resumed_at)) return null;
    pauses.push({ reason: p.reason, started_at: p.started_at, resumed_at: p.resumed_at });
  }
  return {
    request: { timing_model: r.timing_model, sla_state: r.sla_state, created_at: r.created_at, target_minutes_snapshot: r.target_minutes_snapshot,
      accepted_at: r.accepted_at, ready_at: r.ready_at, released_at: r.released_at, cancelled_at: r.cancelled_at },
    pauses, evaluated_at: value.evaluated_at,
  };
}
