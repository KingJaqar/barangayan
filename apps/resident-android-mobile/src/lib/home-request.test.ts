import { describe, expect, it } from 'vitest';
import { homeRequestSummary, homeRequestTitle, homeTimestamp, type HomeRequest } from './home-request';

const request: HomeRequest = {
  id: 'request', reference_number: 'REF', status: 'in_progress', payment_status: 'paid', payment_method: null,
  created_at: '2026-10-18T01:00:00Z', updated_at: '2026-10-19T01:00:00Z', status_history: null,
  cancelled_at: null, contract_version: 2, fee_assessment_state: 'assessed', assessed_amount_centavos: 10000,
  legacy_fee_centavos: null, sla_state: 'running', document_name: 'Business Barangay Clearance', service_kind: 'business',
  resolved_fee_centavos: 10000, next_action: null,
};

describe('Home loaded-data summary', () => {
  it('uses recorded dates, delivery progress and separate payment state', () => {
    const summary = homeRequestSummary(request);
    expect(summary.progressLabel).toBe('Step 2 of 4 · Processing');
    expect(summary.statusLabel).toBe('Processing');
    expect(summary.paymentLabel).toBe('Paid');
    expect(summary.steps.map(step => [step.date, step.detail])).toEqual([
      [request.created_at, null], [null, 'Date unavailable'], [null, 'Pending'], [null, 'Pending'],
    ]);
    expect(summary.updatedLabel).toBe(`Updated ${homeTimestamp(request.updated_at)}`);
  });
  it('accepts latest valid history and ignores malformed entries and future stages', () => {
    const summary = homeRequestSummary({ ...request, status_history: [null, 42, [], { status: 'in_progress', at: 'invalid' },
      { status: 'in_progress', at: '2026-10-20T02:00:00Z' }, { status: 'in_progress', at: '2026-10-19T02:00:00Z' },
      { status: 'ready_for_pickup', at: '2026-10-21T02:00:00Z' }] });
    expect(summary.steps[1]?.date).toBe('2026-10-20T02:00:00Z');
    expect(summary.steps[2]?.date).toBeNull();
    expect(summary.steps[2]?.reached).toBe(false);
    expect(homeTimestamp('invalid')).toBe('Date unavailable');
  });
  it('uses cancelled_at first and only the latest valid cancelled event note', () => {
    const summary = homeRequestSummary({ ...request, status: 'cancelled', cancelled_at: '2026-10-25T00:00:00Z', status_history: [
      { status: 'cancelled', at: '2026-10-22T00:00:00Z', note: 'Latest cancellation' },
      { status: 'cancelled', at: 'bad', note: 'Invalid' },
      { status: 'in_progress', at: '2026-10-24T00:00:00Z', note: 'Internal processing note' },
      { status: 'cancelled', at: '2026-10-21T00:00:00Z', note: 'Older cancellation' },
    ] });
    expect(summary.cancellationLabel).toBe(`Cancelled ${homeTimestamp('2026-10-25T00:00:00Z')}`);
    expect(summary.cancellationNote).toBe('Latest cancellation');
    expect(summary.cancelled).toBe(true);
    expect(summary.progressLabel).toBeNull();
    expect(summary.nextAction).toBeNull();
    expect(summary.steps.every(step => !step.reached)).toBe(true);
  });
  it('falls back to latest valid cancellation timestamp, never fabricated reason or date', () => {
    const history = [{ status: 'cancelled', at: '2026-10-22T00:00:00Z', note: ' ' },
      { status: 'cancelled', at: '2026-10-21T00:00:00Z', note: 'Old' }];
    expect(homeRequestSummary({ ...request, status: 'cancelled', status_history: history }).cancellationLabel)
      .toBe(`Cancelled ${homeTimestamp('2026-10-22T00:00:00Z')}`);
    expect(homeRequestSummary({ ...request, status: 'cancelled', status_history: history }).cancellationNote).toBeNull();
    const missing = homeRequestSummary({ ...request, status: 'cancelled', status_history: { reason: 'Not an event' } });
    expect(missing.cancellationLabel).toBe('Cancellation date unavailable');
    expect(missing.cancellationNote).toBeNull();
  });
  it.each([
    ['paid', 100, 'Paid'], ['waived', 100, 'Fee waived'], ['refunded', 100, 'Payment refunded'],
    ['pending', 0, 'No payment required'], ['unpaid', 100, 'Payment pending'],
    ['unpaid', null, 'Fee not yet assessed'], ['unpaid', -1, 'Fee not yet assessed'],
  ])('keeps submitted %s/%s distinct from stage count', (payment_status, resolved_fee_centavos, paymentLabel) => {
    const summary = homeRequestSummary({ ...request, status: 'submitted', payment_status, resolved_fee_centavos });
    expect(summary.progressLabel).toBe('Step 1 of 4 · Submitted');
    expect(summary.paymentLabel).toBe(paymentLabel);
  });
  it.each([
    ['submitted', 'choose_payment', 'Choose a payment method'], ['ready_for_pickup', 'collect', 'Collect your document'],
  ] as const)('shows the validated %s action without a new business action', (status, next_action, text) => {
    expect(homeRequestSummary({ ...request, status, next_action, payment_status: 'pending' }).nextAction).toBe(text);
  });
  it('does not prompt payment for unknown fees, settled requests or mismatched actions', () => {
    expect(homeRequestSummary({ ...request, status: 'submitted', payment_status: 'pending', resolved_fee_centavos: null, next_action: 'choose_payment' }).nextAction).toBeNull();
    expect(homeRequestSummary({ ...request, status: 'submitted', next_action: 'choose_payment' }).nextAction).toBeNull();
    expect(homeRequestSummary({ ...request, status: 'completed', next_action: 'collect' }).nextAction).toBeNull();
  });
  it('leaves unknown status/update honest, including valid but unrelated history', () => {
    const summary = homeRequestSummary({ ...request, status: 'unexpected', updated_at: 'bad', status_history: [{status:'submitted',at:request.created_at}] });
    expect(summary.statusLabel).toBe('Status unavailable');
    expect(summary.steps.every(step => !step.reached)).toBe(true);
    expect(summary.progressLabel).toBeNull();
    expect(summary.updatedLabel).toBe('Update time unavailable');
    expect(summary.nextAction).toBeNull();
    expect(homeRequestSummary({ ...request, status: 'completed' }).progressLabel).toBe('Step 4 of 4 · Completed');
    expect(homeRequestSummary({ ...request, status: 'ready_for_pickup' }).progressLabel).toBe('Step 3 of 4 · Ready for pickup');
  });
  it('shortens confirmed metadata only; unknown services preserve the full title', () => {
    expect(homeRequestTitle(request)).toBe('Business Clearance');
    expect(homeRequestTitle({ service_kind: 'certified_true_copy', document_name: 'Full catalog name' })).toBe('Certified True Copy');
    expect(homeRequestTitle({ service_kind: 'unknown', document_name: 'Unknown service with a very long title' })).toBe('Unknown service with a very long title');
    expect(homeRequestTitle({ service_kind: 'constructor', document_name: 'Unknown title' })).toBe('Unknown title');
    expect(homeRequestTitle({ service_kind: null, document_name: null })).toBe('Document request');
  });
});
