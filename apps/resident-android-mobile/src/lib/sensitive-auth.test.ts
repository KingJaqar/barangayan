import { describe, expect, it } from 'vitest';
import type { ResidentAccountSetupStatus, ResidentSetupLoad } from '@barangayan/shared';
import { parseGoogleAttempt, type GoogleAttempt } from './google-auth-flow';
import { accountSettingsRows, deletionConfirmation, FRESH_AUTH_WINDOW_MS, passwordMode, reauthenticationState, sessionClaims } from './sensitive-auth';

const now = Date.parse('2026-10-11T08:00:00Z');
const token = (claims: object) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const oauthToken = (at: number, sub = 'a', extra: object = {}) => token({ sub, session_id: 's2', amr: [{ method: 'oauth', timestamp: Math.floor(at / 1000) }], ...extra });
const attempt = (change: Partial<GoogleAttempt> = {}): GoogleAttempt => ({ id: 'r1', intent: 'reauthenticate', purpose: 'set_password', started: now - 30_000, expectedUserId: 'a', userId: 'a', phase: 'complete', ...change });
const state = (a: GoogleAttempt | null, accessToken: string, purpose: 'set_password' | 'delete_account' = 'set_password', userId = 'a') =>
  reauthenticationState({ attempt: a, purpose, accessToken, userId, now });
const ready = (status: Partial<ResidentAccountSetupStatus>): ResidentSetupLoad => ({ state: 'ready', status: { registrationOrigin: 'google', profileComplete: true, passwordSet: false, hasGoogleIdentity: true, ...status } });

describe('fresh same-user Google reauthentication for Settings actions', () => {
  it('reads Auth-issued AMR claims, including non-ASCII metadata, and rejects malformed tokens', () => {
    expect(sessionClaims(token({ sub: 'a', session_id: 's', amr: [{ method: 'password', timestamp: 1 }], user_metadata: { full_name: 'Niño Dela Peña' } })))
      .toEqual({ sub: 'a', sessionId: 's', amr: [{ method: 'password', timestamp: 1 }] });
    for (const bad of [null, '', 'x', 'a.%%%.c', token({ amr: [] }), token({ sub: 'a' })]) expect(sessionClaims(bad)).toBe(null);
  });
  it('accepts only a completed same-purpose attempt plus an oauth sign-in recorded after it began', () => {
    expect(state(attempt(), oauthToken(now - 10_000))).toBe('fresh');
    expect(state(attempt(), oauthToken(now - 10_000), 'delete_account')).toBe('none');
    expect(state(attempt({ phase: 'consumed' }), oauthToken(now - 10_000))).toBe('none');
    expect(state(attempt({ intent: 'sign_in', purpose: null }), oauthToken(now - 10_000))).toBe('none');
    expect(state(null, oauthToken(now - 10_000))).toBe('none');
  });
  it('a local attempt record alone, a password session or an older Google session is not fresh Google proof', () => {
    expect(state(attempt(), token({ sub: 'a', amr: [{ method: 'password', timestamp: Math.floor((now - 5_000) / 1000) }] }))).toBe('expired');
    expect(state(attempt(), oauthToken(now - 30_000 - 3 * 60_000))).toBe('expired');
    expect(state(attempt(), 'not-a-jwt')).toBe('mismatch');
  });
  it('expires after the application window and rejects future-dated evidence', () => {
    expect(state(attempt({ started: now - FRESH_AUTH_WINDOW_MS - 1 }), oauthToken(now - FRESH_AUTH_WINDOW_MS))).toBe('expired');
    expect(state(attempt({ started: now + 1_000 }), oauthToken(now))).toBe('expired');
    expect(state(attempt(), oauthToken(now + 10 * 60_000))).toBe('expired');
  });
  it('rejects a switched account in the session, the attempt owner or the exchanged user', () => {
    expect(state(attempt(), oauthToken(now - 10_000, 'b'))).toBe('mismatch');
    expect(state(attempt({ userId: 'b' }), oauthToken(now - 10_000))).toBe('mismatch');
    expect(state(attempt({ expectedUserId: 'b' }), oauthToken(now - 10_000))).toBe('mismatch');
    expect(state(attempt(), oauthToken(now - 10_000), 'set_password', 'b')).toBe('mismatch');
  });
  it('persists purpose only for reauthentication and refuses a purposeless reauthentication record', () => {
    const issued = { ...attempt(), phase: 'issued', userId: null, started: Date.now() };
    expect(parseGoogleAttempt(JSON.stringify(issued))?.purpose).toBe('set_password');
    expect(parseGoogleAttempt(JSON.stringify({ ...issued, purpose: 'delete_account' }))?.purpose).toBe('delete_account');
    expect(parseGoogleAttempt(JSON.stringify({ ...issued, purpose: undefined }))).toBe(null);
    expect(parseGoogleAttempt(JSON.stringify({ ...issued, purpose: 'change_email' }))).toBe(null);
    expect(parseGoogleAttempt(JSON.stringify({ ...issued, intent: 'sign_in', expectedUserId: null, purpose: 'delete_account' }))?.purpose).toBe(null);
  });
});

describe('authoritative Settings password modes and warnings', () => {
  it('maps true/false/unknown and Google identity without inventing an unset password', () => {
    expect(passwordMode(ready({ passwordSet: true }))).toBe('change');
    expect(passwordMode(ready({ passwordSet: null, registrationOrigin: 'legacy' }))).toBe('manage');
    expect(passwordMode(ready({ passwordSet: false }))).toBe('create_with_google');
    expect(passwordMode(ready({ passwordSet: false, hasGoogleIdentity: false, registrationOrigin: 'legacy' }))).toBe('recover_only');
    expect(passwordMode({ state: 'loading' })).toBe('loading');
    expect(passwordMode({ state: 'error', failure: { kind: 'network', message: 'retry', retryable: true } })).toBe('error');
  });
  it('shows independent personal-details and password warnings only from a ready status', () => {
    expect(accountSettingsRows(ready({ profileComplete: false, passwordSet: false }))).toEqual({
      profile: { title: 'Edit Profile', subtitle: 'Personal details incomplete', warning: true },
      password: { title: 'Set Password', subtitle: 'Password not set', warning: true },
    });
    const done = accountSettingsRows(ready({ passwordSet: true }));
    expect(done.profile.warning || done.password.warning).toBe(false);
    expect(done.password.title).toBe('Change Password');
    expect(accountSettingsRows(ready({ passwordSet: null, registrationOrigin: 'legacy' })).password).toMatchObject({ title: 'Manage Password', warning: false });
    for (const setup of [{ state: 'loading' } as const, { state: 'error', failure: { kind: 'network', message: 'x', retryable: true } } as const]) {
      const rows = accountSettingsRows(setup);
      expect(rows.profile.warning || rows.password.warning).toBe(false);
      expect([rows.profile.subtitle, rows.password.title]).not.toContain('Edit Profile');
      expect(rows.password.title).not.toMatch(/Change|Set|Manage/);
    }
  });
});

describe('Delete My Account confirmation method', () => {
  it('re-enters an existing or unknown password, uses Google for passwordless Google residents, and never guesses while status is unavailable', () => {
    expect(deletionConfirmation(ready({ passwordSet: true }))).toBe('password');
    expect(deletionConfirmation(ready({ passwordSet: null }))).toBe('password');
    expect(deletionConfirmation(ready({ passwordSet: false }))).toBe('google');
    expect(deletionConfirmation(ready({ passwordSet: false, hasGoogleIdentity: false }))).toBe('recover_first');
    expect(deletionConfirmation({ state: 'loading' })).toBe('unavailable');
    expect(deletionConfirmation({ state: 'error', failure: { kind: 'network', message: 'retry', retryable: true } })).toBe('unavailable');
  });
});
