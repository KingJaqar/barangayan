import { describe, expect, it } from 'vitest';
import type { SetupLoad } from '../src/auth/setup-status';
import { announcementStamp, bellLabel, displayName, greeting, QUICK_ACTIONS, showsProfileBanner } from '../src/features/home/home-model';
import { isSameLocalDay } from '../src/lib/format';

const ready = (profileComplete: boolean): SetupLoad => ({
  state: 'ready',
  status: { contractVersion: 2, registrationOrigin: 'email_otp', profileComplete, passwordSet: true, identityProviders: [], hasGoogleIdentity: false, hasAppleIdentity: false, emailIsPrivateRelay: false },
});

describe('Home model (A08)', () => {
  it('greets by the hour of the day', () => {
    expect(greeting(0)).toBe('Good morning');
    expect(greeting(11)).toBe('Good morning');
    expect(greeting(12)).toBe('Good afternoon');
    expect(greeting(17)).toBe('Good afternoon');
    expect(greeting(18)).toBe('Good evening');
    expect(greeting(23)).toBe('Good evening');
  });

  it('names the resident by first name, then by the first word of the full name, then neutrally', () => {
    expect(displayName('Maria Santos', 'Maria')).toBe('Maria');
    expect(displayName('Maria Clara Santos', null)).toBe('Maria');
    expect(displayName('  ', '')).toBe('Resident');
    expect(displayName(null, undefined)).toBe('Resident');
  });

  it('labels a same-calendar-day announcement TODAY and any other day by its date', () => {
    const now = new Date(2026, 9, 21, 15, 0, 0);
    expect(announcementStamp(new Date(2026, 9, 21, 0, 5, 0).toISOString(), now)).toBe('TODAY');
    expect(announcementStamp(new Date(2026, 9, 21, 23, 59, 0).toISOString(), now)).toBe('TODAY');
    // One minute before local midnight is the previous day even though it is under 24 hours ago.
    const yesterday = announcementStamp(new Date(2026, 9, 20, 23, 59, 0).toISOString(), now);
    expect(yesterday).not.toBe('TODAY');
    expect(yesterday).toMatch(/2026/);
    expect(announcementStamp('not a date', now)).toBe('Date unavailable');
  });

  it('compares calendar days in the device zone, not 24-hour windows', () => {
    const now = new Date(2026, 0, 1, 0, 1, 0);
    expect(isSameLocalDay(new Date(2025, 11, 31, 23, 59, 0).toISOString(), now)).toBe(false);
    expect(isSameLocalDay(new Date(2026, 0, 1, 0, 0, 0).toISOString(), now)).toBe(true);
    expect(isSameLocalDay('', now)).toBe(false);
  });

  it('shows the profile banner only when the server says the profile is incomplete', () => {
    expect(showsProfileBanner(ready(false))).toBe(true);
    expect(showsProfileBanner(ready(true))).toBe(false);
    // An unknown status is never guessed into a warning.
    expect(showsProfileBanner({ state: 'loading' })).toBe(false);
    expect(showsProfileBanner({ state: 'error', failure: { kind: 'network', message: 'offline' } as never })).toBe(false);
  });

  it('speaks the bell with its own unread announcement count only when known and non-zero', () => {
    expect(bellLabel(null)).toBe('Announcements');
    expect(bellLabel(0)).toBe('Announcements');
    expect(bellLabel(1)).toBe('Announcements, 1 unread');
    expect(bellLabel(7)).toBe('Announcements, 7 unread');
    expect(bellLabel(250)).toBe('Announcements, 99+ unread');
  });

  it('offers the four Android quick actions, each to a distinct working route', () => {
    expect(QUICK_ACTIONS.map((action) => action.label)).toEqual(['Request document', 'Report issue', 'Emergency info', 'Medical info']);
    expect(QUICK_ACTIONS.map((action) => action.href)).toEqual(['/services', '/reports/new', '/emergency', '/health']);
    expect(new Set(QUICK_ACTIONS.map((action) => action.key)).size).toBe(4);
  });
});
