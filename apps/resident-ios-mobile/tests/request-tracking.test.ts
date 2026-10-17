import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterClauses, withGroup } from '../src/data/request-filters';
import {
  agencyProgress, buildStages, cancelEligibility, cancellation, clockSettled, feeLine, legacyProgress, parseHistory, paymentMethodLabel, paymentStatusLabel,
  projectClock, requestStatusLabel, type SlaSnapshot,
} from '../src/features/services/request-tracking';

afterEach(() => vi.useRealTimers());

describe('request filters (A12-008…018, P09-T01)', () => {
  it('describes every group and sub-filter as a server restriction', () => {
    expect(filterClauses({ group: 'all', sub: 'all' })).toEqual([]);
    expect(filterClauses({ group: 'active', sub: 'all' })).toEqual([{ op: 'in', column: 'status', values: ['submitted', 'in_progress'] }]);
    expect(filterClauses({ group: 'pickup', sub: 'all' })).toEqual([{ op: 'in', column: 'status', values: ['ready_for_pickup'] }]);
    expect(filterClauses({ group: 'history', sub: 'all' })).toEqual([{ op: 'in', column: 'status', values: ['completed', 'cancelled'] }]);
  });
  it('splits Active into pending payment, paid/waived and processing without overlap', () => {
    const pending = filterClauses({ group: 'active', sub: 'pending_payment' });
    const paid = filterClauses({ group: 'active', sub: 'paid' });
    expect(pending).toContainEqual({ op: 'not-in', column: 'payment_status', values: ['paid', 'waived'] });
    expect(paid).toContainEqual({ op: 'in', column: 'payment_status', values: ['paid', 'waived'] });
    expect(filterClauses({ group: 'active', sub: 'processing' })).toEqual([{ op: 'in', column: 'status', values: ['in_progress'] }]);
  });
  it('resets the sub-filter whenever the group changes', () => {
    expect(withGroup('active')).toEqual({ group: 'active', sub: 'all' });
    expect(withGroup('history')).toEqual({ group: 'history', sub: 'all' });
  });
});

describe('status history and stages (A13-016…021)', () => {
  const history = [
    { status: 'submitted', at: '2026-10-01T01:00:00Z', note: null },
    { status: 'in_progress', at: '2026-10-01T02:00:00Z', note: ' Accepted by the secretary ' },
  ];
  it('skips malformed entries and trims notes', () => {
    expect(parseHistory([...history, null, 'x', { status: 7, at: 'x' }, { status: 'completed', at: 'not a date' }])).toEqual([
      { status: 'submitted', at: '2026-10-01T01:00:00Z', note: null }, { status: 'in_progress', at: '2026-10-01T02:00:00Z', note: 'Accepted by the secretary' },
    ]);
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory({})).toEqual([]);
  });
  it('marks reached stages done, the current stage, and future stages pending', () => {
    const stages = buildStages('in_progress', parseHistory(history));
    expect(stages.map((stage) => stage.state)).toEqual(['done', 'current', 'pending', 'pending']);
    expect(stages[1]).toMatchObject({ at: '2026-10-01T02:00:00Z', note: 'Accepted by the secretary' });
    expect(stages[2]).toMatchObject({ at: null, note: null });
  });
  it('shows no completed stage for a cancelled request and reports the cancellation with its note', () => {
    const recorded = parseHistory([...history, { status: 'cancelled', at: '2026-10-01T03:00:00Z', note: 'Cancelled by resident' }]);
    expect(buildStages('cancelled', recorded).map((stage) => stage.state)).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(cancellation('cancelled', recorded)).toEqual({ at: '2026-10-01T03:00:00Z', note: 'Cancelled by resident' });
    expect(cancellation('in_progress', recorded)).toBeNull();
    expect(cancellation('cancelled', [])).toEqual({ at: null, note: null });
  });
});

describe('cancellation eligibility (A14-006, 011)', () => {
  const base = { status: 'submitted', payment_status: 'pending', payments: [] as { status: string; method: string }[] };
  it('offers cancellation only before delivery advances and before payment clears', () => {
    expect(cancelEligibility(base)).toBe('eligible');
    expect(cancelEligibility({ ...base, status: 'in_progress' })).toBe('eligible');
    for (const status of ['ready_for_pickup', 'completed', 'cancelled']) expect(cancelEligibility({ ...base, status })).toBe('ineligible');
    expect(cancelEligibility({ ...base, payment_status: 'paid' })).toBe('ineligible');
  });
  it('asks for the payment to be cancelled first while a QR attempt is pending, and ignores finished attempts', () => {
    expect(cancelEligibility({ ...base, payments: [{ status: 'pending', method: 'qrph' }] })).toBe('payment-in-progress');
    expect(cancelEligibility({ ...base, payments: [{ status: 'cancelled', method: 'qrph' }, { status: 'pending', method: 'pickup' }] })).toBe('eligible');
  });
});

describe('amount shown for a request (A13-009…011, plan §6.2)', () => {
  const v2 = { contract_version: 2, fee_assessment_state: 'assessed', assessed_amount_centavos: 10000, legacy_fee_centavos: null, document_types: { fee_centavos: 5000 }, payments: [] };
  it('uses the committed assessment, never today’s catalogue fee, for a version-2 request', () => {
    expect(feeLine(v2)).toBe('₱100.00');
    expect(feeLine({ ...v2, assessed_amount_centavos: null, fee_assessment_state: 'legacy' })).toBe('Awaiting fee assessment');
  });
  it('names a fee that is not final and shows zero only when it is a waiver or free', () => {
    expect(feeLine({ ...v2, fee_assessment_state: 'waived', assessed_amount_centavos: 0 })).toBe('No payment required');
    expect(feeLine({ ...v2, fee_assessment_state: 'pickup_due', assessed_amount_centavos: null })).toContain('payable at pickup');
    expect(feeLine({ ...v2, fee_assessment_state: 'page_count_required', assessed_amount_centavos: null })).toContain('per page');
  });
  it('prefers a recorded paid amount, then a pending one, and ignores cancelled attempts', () => {
    const paid = { document_fee_centavos: 12000, amount_centavos: 12500, status: 'paid' };
    expect(feeLine({ ...v2, payments: [{ document_fee_centavos: 1, amount_centavos: 1, status: 'cancelled' }, paid] })).toBe('₱120.00');
    expect(feeLine({ ...v2, payments: [{ document_fee_centavos: null, amount_centavos: 7000, status: 'pending' }] })).toBe('₱70.00');
    expect(feeLine({ ...v2, payments: [{ document_fee_centavos: 1, amount_centavos: 1, status: 'cancelled' }] })).toBe('₱100.00');
  });
  it('keeps a legacy request at its snapshot, falling back to the catalogue only when none was stored', () => {
    const legacy = { contract_version: 1, fee_assessment_state: 'legacy', assessed_amount_centavos: null, legacy_fee_centavos: 5000, document_types: { fee_centavos: 9000 }, payments: [] };
    expect(feeLine(legacy)).toBe('₱50.00');
    expect(feeLine({ ...legacy, legacy_fee_centavos: null })).toBe('₱90.00');
    expect(feeLine({ ...legacy, legacy_fee_centavos: 0 })).toBe('No payment required');
  });
  it('labels payment method and status truthfully', () => {
    expect(paymentMethodLabel(null)).toBe('Not yet selected');
    expect(paymentMethodLabel('pickup')).toBe('Pay at pickup');
    expect(paymentMethodLabel('qrph')).toBe('QR PH');
    expect(['pending', 'paid', 'waived', 'refunded'].map(paymentStatusLabel)).toEqual(['Pending', 'Paid', 'Waived', 'Refunded']);
    expect(requestStatusLabel('submitted', 'paid')).toBe('Submitted (Paid)');
  });
});

describe('previous timing model (A13-032…035)', () => {
  it('reports progress and an estimate, never for a cancelled request', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T13:00:00Z'));
    const open = legacyProgress('in_progress', '2026-10-01T01:00:00Z', 24);
    expect(open?.percent).toBe(50);
    expect(open?.estimate).toMatch(/^Estimated completion — Est\. 12 hours$/);
    expect(legacyProgress('completed', '2026-10-01T01:00:00Z', 24)).toMatchObject({ percent: 100, estimate: 'Completed' });
    expect(legacyProgress('cancelled', '2026-10-01T01:00:00Z', 24)).toBeNull();
  });
});

describe('agency clock projection (A13-023…031, P09-T04)', () => {
  const request = { timing_model: 'agency_minutes_v1', target_minutes_snapshot: 60, sla_state: 'running', created_at: '2026-10-15T01:00:00Z', accepted_at: '2026-10-15T01:05:00Z', ready_at: null, released_at: null, cancelled_at: null };
  const snapshot = (patch: Partial<SlaSnapshot['request']>, pauses: SlaSnapshot['pauses'] = [], evaluated = '2026-10-15T01:30:00Z'): SlaSnapshot => ({ request: { ...request, ...patch }, pauses, evaluated_at: evaluated });
  it('counts agency time from acceptance, excluding resident waiting, and projects with elapsed foreground time only', () => {
    const paused = [{ started_at: '2026-10-15T01:10:00Z', resumed_at: '2026-10-15T01:20:00Z', reason: 'Missing form' }];
    const now = projectClock(snapshot({}, paused), 0);
    expect(now).toMatchObject({ agencySeconds: 900, residentWaitSeconds: 600, turnaroundSeconds: 1800, targetSeconds: 3600, position: 'on_track', waitingReason: null });
    expect(projectClock(snapshot({}, paused), 45_000).agencySeconds).toBe(945);
    expect(projectClock(snapshot({}, paused), -5_000).agencySeconds).toBe(900);
  });
  it('freezes agency time while paused and reports the reason the barangay is waiting', () => {
    const open = [{ started_at: '2026-10-15T01:10:00Z', resumed_at: null, reason: 'Missing form' }];
    const value = projectClock(snapshot({ sla_state: 'paused' }, open), 0);
    expect(value).toMatchObject({ agencySeconds: 300, residentWaitSeconds: 1200, waitingReason: 'Missing form' });
    expect(projectClock(snapshot({ sla_state: 'paused' }, open), 60_000)).toMatchObject({ agencySeconds: 300, residentWaitSeconds: 1260 });
  });
  it('stops agency time at readiness and turnaround at release, and classifies the result against the snapshot target', () => {
    const ready = projectClock(snapshot({ ready_at: '2026-10-15T01:35:00Z', sla_state: 'ready' }), 120_000);
    expect(ready).toMatchObject({ agencySeconds: 1800, position: 'completed_within' });
    const late = projectClock(snapshot({ target_minutes_snapshot: 20, ready_at: '2026-10-15T01:35:00Z', released_at: '2026-10-15T01:50:00Z', sla_state: 'released' }), 0);
    expect(late).toMatchObject({ position: 'completed_beyond', turnaroundSeconds: 3000 });
  });
  it('shows the pre-processing state before staff accept the request', () => {
    expect(projectClock(snapshot({ accepted_at: null, sla_state: 'pre_processing' }), 0).position).toBe('pre_processing');
  });
  it('bounds the progress bar and recognises a settled clock', () => {
    expect(agencyProgress(900, 3600)).toBe(0.25);
    expect(agencyProgress(7200, 3600)).toBe(1);
    expect(agencyProgress(10, 0)).toBe(0);
    expect(clockSettled({ released_at: null, cancelled_at: null })).toBe(false);
    expect(clockSettled({ released_at: '2026-10-15T01:50:00Z', cancelled_at: null })).toBe(true);
    expect(clockSettled({ released_at: null, cancelled_at: '2026-10-15T01:50:00Z' })).toBe(true);
  });
});
