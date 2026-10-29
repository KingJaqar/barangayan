import { describe, expect, it } from 'vitest';
import { homeGreeting, homeRequestSummary, homeTimestamp } from './home-request';

const request = { status: 'in_progress', payment_status: 'paid', created_at: '2026-10-18T01:00:00Z', status_history: null };

describe('Home loaded-data summary', () => {
  it('uses the real submission date and leaves missing reached dates unavailable', () => {
    const summary = homeRequestSummary(request);
    expect(summary.statusLabel).toBe('Processing');
    expect(summary.stepIndex).toBe(1);
    expect(summary.steps.map(step => [step.date, step.detail])).toEqual([
      [request.created_at, null], [null, 'Date unavailable'], [null, 'Pending'], [null, 'Pending'],
    ]);
  });

  it('accepts valid loaded history only and rejects malformed entries/dates', () => {
    const summary = homeRequestSummary({ ...request, status_history: [null, 42, [], { status: 'in_progress', at: 'invalid' },
      { status: 'in_progress', at: '2026-10-19T02:00:00Z' }, { status: 'ready_for_pickup', at: null }] });
    expect(summary.steps[1]?.date).toBe('2026-10-19T02:00:00Z');
    expect(summary.steps[2]?.date).toBeNull();
    expect(homeTimestamp('invalid')).toBe('Date unavailable');
  });

  it('does not claim a cancelled request completed all steps', () => {
    const summary = homeRequestSummary({ ...request, status: 'cancelled' });
    expect(summary.cancelled).toBe(true);
    expect(summary.stepIndex).toBe(-1);
    expect(summary.statusLabel).toBe('Cancelled');
    expect(summary.steps.map(step => step.reached)).toEqual([true, false, false, false]);
    expect(summary.steps[1]?.detail).toBe('Not recorded');
  });

  it('leaves unknown status/date honest and preserves paid/waived distinctions', () => {
    expect(homeRequestSummary({ ...request, status: 'unexpected', created_at: 'bad' }).statusLabel).toBe('Status unavailable');
    expect(homeRequestSummary({ ...request, status: 'unexpected', created_at: 'bad' }).steps.every(step => !step.reached)).toBe(true);
    for (const payment_status of ['paid', 'waived']) {
      expect(homeRequestSummary({ ...request, status: 'submitted', payment_status }).statusLabel).toBe('Submitted (Paid)');
    }
    expect(homeRequestSummary({ ...request, status: 'submitted', payment_status: 'unpaid' }).statusLabel).toBe('Submitted (Pending Payment)');
    expect(homeRequestSummary({ ...request, status: 'completed' }).stepIndex).toBe(3);
  });

  it('changes greeting at noon and evening boundaries', () => {
    expect([0, 11, 12, 17, 18, 23].map(homeGreeting)).toEqual(['Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good evening']);
  });
});
