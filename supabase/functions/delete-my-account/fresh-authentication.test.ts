import { describe, expect, it } from 'vitest';
import { FRESH_AUTHENTICATION_WINDOW_SECONDS, hasFreshAuthentication, latestAuthenticationTime } from './fresh-authentication';

const now = 1_800_000_000;
function token(claims: unknown) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

describe('delete-account fresh authentication', () => {
  it('uses the most recent amr timestamp', () => {
    const jwt = token({ amr: [{ method: 'password', timestamp: now - 5000 }, { method: 'oauth', timestamp: now - 30 }] });
    expect(latestAuthenticationTime(jwt)).toBe(now - 30);
    expect(hasFreshAuthentication(jwt, now)).toBe(true);
  });

  it('rejects a session whose latest authentication is older than the window', () => {
    const jwt = token({ amr: [{ method: 'password', timestamp: now - FRESH_AUTHENTICATION_WINDOW_SECONDS - 1 }] });
    expect(hasFreshAuthentication(jwt, now)).toBe(false);
  });

  it('accepts the window boundary and small forward clock skew', () => {
    expect(hasFreshAuthentication(token({ amr: [{ method: 'password', timestamp: now - FRESH_AUTHENTICATION_WINDOW_SECONDS }] }), now)).toBe(true);
    expect(hasFreshAuthentication(token({ amr: [{ method: 'password', timestamp: now + 30 }] }), now)).toBe(true);
    expect(hasFreshAuthentication(token({ amr: [{ method: 'password', timestamp: now + 600 }] }), now)).toBe(false);
  });

  it('treats missing, malformed or non-numeric evidence as not fresh', () => {
    expect(hasFreshAuthentication(token({}), now)).toBe(false);
    expect(hasFreshAuthentication(token({ amr: 'password' }), now)).toBe(false);
    expect(hasFreshAuthentication(token({ amr: [{ method: 'password', timestamp: '1799999990' }, { method: 'otp' }, null] }), now)).toBe(false);
    expect(hasFreshAuthentication('not-a-jwt', now)).toBe(false);
    expect(hasFreshAuthentication('a.%%%.c', now)).toBe(false);
    expect(hasFreshAuthentication('', now)).toBe(false);
  });
});
