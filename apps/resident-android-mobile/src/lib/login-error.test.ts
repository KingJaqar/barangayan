import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './login-error';

describe('login error feedback', () => {
  it('uses accurate combined feedback for invalid credentials', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe('Email or password is incorrect.');
  });
  it('explains when email verification is required', () => {
    expect(loginErrorMessage({ code: 'email_not_confirmed' })).toBe('Verify your email before logging in.');
  });
  it.each([{ status: 429 }, { code: 'over_request_rate_limit' }])('explains rate limiting', cause => {
    expect(loginErrorMessage(cause)).toBe('Too many login attempts. Please wait and try again.');
  });
  it.each(['AuthRetryableFetchError', 'TypeError', 'AbortError'])('explains connection failure %s', name => {
    expect(loginErrorMessage({ name })).toBe('Unable to connect. Check your internet connection and try again.');
  });
  it.each([null, undefined, 'failure', { message: 'private backend details' }, { status: 500 }])('uses a login-specific fallback', cause => {
    expect(loginErrorMessage(cause)).toBe('Unable to log in right now. Please try again.');
  });
});
