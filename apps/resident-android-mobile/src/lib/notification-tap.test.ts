import { describe, expect, it } from 'vitest';

import { createReplayGuard, createTapIntent, pushInboxId, type TapContext } from './notification-tap';

const INBOX = '33333333-3333-4333-8333-333333333333';
const RECORD = '44444444-4444-4444-8444-444444444444';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('pushInboxId', () => {
  it('accepts exactly what the sender attaches: a version 1 record, a notice or an account screen, plus the inbox row', () => {
    expect(pushInboxId({ v: 1, kind: 'request', id: RECORD, inbox: INBOX })).toBe(INBOX);
    expect(pushInboxId({ v: 1, kind: 'announcement', id: RECORD, inbox: INBOX })).toBe(INBOX);
    expect(pushInboxId({ v: 2, kind: 'notice', id: RECORD, inbox: INBOX })).toBe(INBOX);
    expect(pushInboxId({ v: 2, kind: 'account', screen: 'valid_id', inbox: INBOX })).toBe(INBOX);
  });

  it('ignores a key the provider adds', () => {
    expect(pushInboxId({ v: 1, kind: 'incident', id: RECORD, inbox: INBOX, scopeKey: 'x', projectId: 'y' })).toBe(INBOX);
  });

  it('rejects local alerts, forged and unknown payloads', () => {
    for (const bad of [
      undefined, null, 'text', 5, [], {}, { url: 'https://example.com' },
      { v: 1, kind: 'request', id: RECORD },
      { v: 1, kind: 'request', id: RECORD, inbox: 'not-a-uuid' },
      { v: 1, kind: 'request', id: RECORD, inbox: 7 },
      { v: 1, kind: 'request', id: 'not-a-uuid', inbox: INBOX },
      { v: 1, kind: 'route', id: RECORD, inbox: INBOX },
      { v: 1, kind: '/settings', id: RECORD, inbox: INBOX },
      { v: 3, kind: 'notice', id: RECORD, inbox: INBOX },
      { v: 2, kind: 'notice', id: 'x', inbox: INBOX },
      { v: 2, kind: 'account', screen: '/settings/profile', inbox: INBOX },
      { v: 2, kind: 'account', screen: 'unknown', inbox: INBOX },
      { v: 2, kind: 'url', id: RECORD, inbox: INBOX },
    ]) expect(pushInboxId(bad)).toBeNull();
  });
});

describe('createReplayGuard', () => {
  it('reports a response once and forgets the oldest past its limit', () => {
    const guard = createReplayGuard(2);
    expect(guard.handled('a')).toBe(false);
    expect(guard.handled('a')).toBe(true);
    guard.handled('b'); guard.handled('c');
    expect(guard.handled('a')).toBe(false);
    expect(guard.handled('c')).toBe(true);
  });
});

const ready = (userId: string | null = USER): TapContext => ({ restoring: false, userId, reachable: true });

describe('createTapIntent', () => {
  it('opens a warm tap once for the signed-in account', () => {
    const intent = createTapIntent();
    expect(intent.settle(ready())).toEqual({ type: 'idle' });
    intent.receive(INBOX, ready());
    expect(intent.settle(ready())).toEqual({ type: 'open', inboxId: INBOX });
    expect(intent.settle(ready())).toEqual({ type: 'idle' });
  });

  it('holds a cold tap through session restoration and setup loading, then opens it for the restored account', () => {
    const intent = createTapIntent();
    intent.receive(INBOX, { restoring: true, userId: null });
    expect(intent.settle({ restoring: true, userId: null, reachable: false })).toEqual({ type: 'wait' });
    expect(intent.settle({ restoring: false, userId: USER, reachable: null })).toEqual({ type: 'wait' });
    expect(intent.settle({ restoring: false, userId: USER, reachable: true })).toEqual({ type: 'open', inboxId: INBOX });
  });

  it('drops a tap received signed out, so a later sign-in never inherits it', () => {
    const intent = createTapIntent();
    intent.receive(INBOX, { restoring: false, userId: null });
    expect(intent.settle({ restoring: false, userId: null, reachable: false })).toEqual({ type: 'drop' });
    expect(intent.settle(ready())).toEqual({ type: 'idle' });
  });

  it('drops a tap when the account changed before it could open', () => {
    const intent = createTapIntent();
    intent.receive(INBOX, ready(USER));
    expect(intent.settle({ restoring: false, userId: USER, reachable: null })).toEqual({ type: 'wait' });
    expect(intent.settle({ restoring: false, userId: OTHER, reachable: true })).toEqual({ type: 'drop' });
    expect(intent.settle(ready(OTHER))).toEqual({ type: 'idle' });
  });

  it('drops a cold tap once the restored session is gone', () => {
    const intent = createTapIntent();
    intent.receive(INBOX, { restoring: true, userId: null });
    expect(intent.settle({ restoring: false, userId: null, reachable: false })).toEqual({ type: 'drop' });
  });

  it('drops a tap the app cannot open (setup incomplete, password recovery)', () => {
    const intent = createTapIntent();
    intent.receive(INBOX, ready());
    expect(intent.settle({ restoring: false, userId: USER, reachable: false })).toEqual({ type: 'drop' });
    expect(intent.settle(ready())).toEqual({ type: 'idle' });
  });

  it('keeps only the newest pending tap', () => {
    const intent = createTapIntent();
    intent.receive(INBOX, ready());
    intent.receive(RECORD, ready());
    expect(intent.settle(ready())).toEqual({ type: 'open', inboxId: RECORD });
    expect(intent.settle(ready())).toEqual({ type: 'idle' });
  });
});
