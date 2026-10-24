import { describe, expect, it } from 'vitest';
import { readAgencySlaSnapshot } from './agency-sla-snapshot';

const request = { timing_model: 'agency_minutes_v1', sla_state: 'running', created_at: '2026-10-23T00:00:00Z',
  target_minutes_snapshot: 30, accepted_at: '2026-10-23T00:00:00.123456+00:00', ready_at: null, released_at: null, cancelled_at: null };
const data = { request, pauses: [{ reason: 'Awaiting documents', started_at: '2026-10-23T00:03:00Z', resumed_at: null }], evaluated_at: '2026-10-23T00:15:00.654321+00:00' };

describe('SLA response boundary', () => {
  it('preserves server microseconds and an open pause, selecting only clock fields', () => {
    expect(readAgencySlaSnapshot({ ...data, privateExtra: 'not used' })).toEqual(data);
  });
  it.each([null, {}, { ...data, pauses: null }, { ...data, evaluated_at: 'invalid' },
    { ...data, request: { ...request, target_minutes_snapshot: Infinity } },
    { ...data, request: { ...request, accepted_at: 'invalid' } },
    { ...data, pauses: [{ ...data.pauses[0], resumed_at: 'invalid' }] },
    { ...data, pauses: [{ ...data.pauses[0], reason: null }] },
  ])('rejects malformed data instead of throwing in timestamp arithmetic', value => {
    expect(readAgencySlaSnapshot(value)).toBeNull();
  });
});
