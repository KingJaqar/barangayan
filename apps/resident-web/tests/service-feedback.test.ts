import { describe, expect, it } from 'vitest';
import { isNoAnswer, paymentMethodFailure, pickupPaymentFailure, serviceSubmissionFailure } from '../src/lib/service-feedback';

describe('request outcome after a potentially accepted submission', () => {
  it('keeps a failed reference read uncertain and points to the same attempt', () => {
    const result = serviceSubmissionFailure(new Error('Reference read unavailable'), 'submit', 'Internal detail');
    expect(result.kind).toBe('unconfirmed');
    expect(result.message).toContain("won't create a duplicate");
    expect(result.message).not.toContain('Internal detail');
  });

  it('distinguishes structured rejection from a changed, unresolved retry', () => {
    expect(serviceSubmissionFailure({ code: '42501', message: 'forbidden' }, 'submit', 'forbidden').kind).toBe('rejected');
    expect(serviceSubmissionFailure(new Error('Changed retry'), 'submit', 'Changed retry').kind).toBe('unconfirmed');
  });

  it('preserves session guidance before a write and inline validation', () => {
    expect(serviceSubmissionFailure(new Error('Session'), 'submit', 'Sign in again before submitting.').kind).toBe('session');
    expect(serviceSubmissionFailure({ issues: [] }, 'validate', 'Choose a purpose.').kind).toBe('validation');
  });

  it('does not call gateway failures a confirmed payment-choice rejection', () => {
    expect(paymentMethodFailure({ message: '', code: '' }, 502).uncertain).toBe(true);
    expect(pickupPaymentFailure({ message: '' }, 503).uncertain).toBe(true);
    expect(paymentMethodFailure({ message: 'request_not_payable', code: '22023' }, 400).uncertain).toBe(false);
  });

  it('treats function server and relay failures as uncertain, preserving caller refusals', () => {
    expect(isNoAnswer({ name: 'FunctionsHttpError', context: new Response('{}', { status: 503 }) })).toBe(true);
    expect(isNoAnswer({ name: 'FunctionsRelayError' })).toBe(true);
    expect(isNoAnswer({ name: 'FunctionsHttpError', context: new Response('{}', { status: 403 }) })).toBe(false);
  });
});
