import { describe, expect, it } from 'vitest';

import {
  HUB_CHIPS, HUB_VIEWS, cardUnread, hubSources, inboxFilter, inboxSource, noticeAction, notificationOpen, parseNotificationDestination,
  scopeUnread, toHubSummary, totalUnread, visibleHubSources,
} from './notification-hub';

const ID = 'd1450000-0000-0000-0000-000000000001';

describe('hub views and chips', () => {
  it('lists the four cards in order', () => {
    expect(HUB_VIEWS.map((view) => view.label)).toEqual(['All', 'Barangay', 'Account', 'System']);
  });

  it('uses the fixed chip order of each view', () => {
    expect(HUB_CHIPS.all.map((chip) => chip.label)).toEqual(['All', 'General', 'Emergency', 'Health', 'Events', 'Account', 'System']);
    expect(HUB_CHIPS.barangay.map((chip) => chip.label)).toEqual(['All', 'General', 'Emergency', 'Health', 'Events']);
    expect(HUB_CHIPS.account.map((chip) => chip.label)).toEqual(['All', 'Document Requests', 'Incident Reports', 'Verification', 'Security', 'Profile']);
    expect(HUB_CHIPS.system.map((chip) => chip.label)).toEqual(['All', 'Service Status', 'App Updates', 'Policies']);
  });

  it('keeps chip keys aligned with the server scope names', () => {
    expect(HUB_CHIPS.account.map((chip) => chip.key)).toEqual(['all', 'document_requests', 'incident_reports', 'verification', 'security', 'profile']);
    expect(HUB_CHIPS.system.map((chip) => chip.key)).toEqual(['all', 'service_status', 'app_updates', 'policies']);
  });
});

describe('inbox kind registry', () => {
  it('maps every Account and System kind to its chip and source', () => {
    const rows = ['request_status', 'payment', 'incident_status', 'account_verification', 'account_security', 'account_profile', 'system_service', 'system_update', 'system_policy']
      .map((kind) => [kind, inboxFilter(kind), inboxSource(kind)]);
    expect(rows).toEqual([
      ['request_status', 'document_requests', 'account'],
      ['payment', 'document_requests', 'account'],
      ['incident_status', 'incident_reports', 'account'],
      ['account_verification', 'verification', 'account'],
      ['account_security', 'security', 'account'],
      ['account_profile', 'profile', 'account'],
      ['system_service', 'service_status', 'system'],
      ['system_update', 'app_updates', 'system'],
      ['system_policy', 'policies', 'system'],
    ]);
  });

  it('keeps the announcement mirror, Health and unknown kinds out of the inbox views', () => {
    for (const kind of ['announcement', 'medical_drive', 'health_registration', 'future_kind', 'toString', '__proto__']) {
      expect(inboxFilter(kind)).toBeNull();
      expect(inboxSource(kind)).toBeNull();
    }
  });
});

describe('parseNotificationDestination', () => {
  it('accepts every version-1 reference unchanged', () => {
    for (const kind of ['request', 'incident', 'announcement', 'drive', 'registration']) {
      expect(parseNotificationDestination({ v: 1, kind, id: ID })).toEqual({ v: 1, kind, id: ID });
    }
    expect(parseNotificationDestination({ v: '1', kind: 'request', id: ID })).toEqual({ v: 1, kind: 'request', id: ID });
  });

  it('accepts the version-2 notice and account references', () => {
    expect(parseNotificationDestination({ v: 2, kind: 'notice', id: ID })).toEqual({ v: 2, kind: 'notice', id: ID });
    expect(parseNotificationDestination({ v: 2, kind: 'account', screen: 'valid_id' })).toEqual({ v: 2, kind: 'account', screen: 'valid_id' });
  });

  it('rejects malformed, foreign and URL-bearing input', () => {
    const rejected: unknown[] = [
      null, undefined, 'request', 42, [1, 2, 3], {},
      { v: 1, kind: 'request' },
      { v: 1, kind: 'request', id: ID, url: 'https://example.com' },
      { v: 1, kind: 'route', id: '/settings' },
      { v: 1, kind: 'request', id: 'not-a-uuid' },
      { v: 1, kind: 'request', id: ID.toUpperCase() },
      { v: '2', kind: 'notice', id: ID },
      { v: 3, kind: 'notice', id: ID },
      { v: 2, kind: 'notice', screen: 'profile' },
      { v: 2, kind: 'account', screen: 'admin' },
      { v: 2, kind: 'account', screen: 'https://example.com' },
      { v: 2, kind: 'account', id: ID },
      { v: 2, kind: 'request', id: ID },
      { a: 1, b: 2, c: 3 },
    ];
    for (const input of rejected) expect(parseNotificationDestination(input)).toBeNull();
  });
});

describe('listed sources', () => {
  it('lists the three groups in order only for All / All', () => {
    expect(hubSources('all', 'all')).toEqual(['barangay', 'account', 'system']);
  });

  it('narrows All chips to the one source they name', () => {
    expect(hubSources('all', 'account')).toEqual(['account']);
    expect(hubSources('all', 'system')).toEqual(['system']);
    for (const chip of ['general', 'emergency', 'health', 'events']) expect(hubSources('all', chip)).toEqual(['barangay']);
  });

  it('lists exactly the source of a category view', () => {
    expect(hubSources('barangay', 'events')).toEqual(['barangay']);
    expect(hubSources('account', 'profile')).toEqual(['account']);
    expect(hubSources('system', 'policies')).toEqual(['system']);
  });

  it('shows guests only the public announcement list', () => {
    expect(visibleHubSources(['barangay', 'account', 'system'], false)).toEqual(['barangay']);
    expect(visibleHubSources(['account'], false)).toEqual([]);
    expect(visibleHubSources(['account', 'system'], true)).toEqual(['account', 'system']);
  });
});

describe('summary counts', () => {
  const rows = [
    { source: 'barangay', total: 30, unread: 4, scope_total: 30, scope_unread: 4 },
    { source: 'account', total: 5, unread: 2, scope_total: 5, scope_unread: 2 },
    { source: 'system', total: 1, unread: 0, scope_total: 1, scope_unread: 0 },
  ];

  it('totals every source for the All card and one source for its card', () => {
    const summary = toHubSummary(rows);
    expect(cardUnread(summary, 'all')).toBe(6);
    expect(cardUnread(summary, 'account')).toBe(2);
    expect(cardUnread(summary, 'system')).toBe(0);
  });

  it('sums the scope only over the listed sources', () => {
    const summary = toHubSummary(rows);
    expect(scopeUnread(summary, ['barangay', 'account', 'system'])).toBe(6);
    expect(scopeUnread(summary, ['account'])).toBe(2);
  });

  it('keeps unknown unknown instead of zero', () => {
    const unknown = toHubSummary([{ source: 'barangay', total: 3, unread: null, scope_total: 3, scope_unread: null },
      { source: 'account', total: null, unread: null, scope_total: null, scope_unread: null }]);
    expect(totalUnread(unknown)).toBeNull();
    expect(cardUnread(unknown, 'account')).toBeNull();
    expect(scopeUnread(unknown, ['barangay'])).toBeNull();
    expect(scopeUnread(unknown, ['system'])).toBeNull();
    const partial = toHubSummary([...rows.slice(0, 2), { source: 'system', total: null, unread: null, scope_total: null, scope_unread: null }]);
    expect(totalUnread(partial)).toBe(6);
    expect(scopeUnread(partial, ['barangay', 'system'])).toBeNull();
  });

  it('ignores a source it does not know', () => {
    expect(totalUnread(toHubSummary([{ source: 'other', total: 9, unread: 9, scope_total: 9, scope_unread: 9 }]))).toBeNull();
  });
});

describe('opening a row', () => {
  it('opens request and incident rows at their existing authorized record', () => {
    expect(notificationOpen({ v: 1, kind: 'request', id: ID })).toEqual({ type: 'record', route: `/services/requests/${ID}` });
    expect(notificationOpen({ v: 1, kind: 'incident', id: ID })).toEqual({ type: 'record', route: `/reports/${ID}` });
  });

  it('opens an announcement reference as the announcement', () => {
    expect(notificationOpen({ v: 1, kind: 'announcement', id: ID })).toEqual({ type: 'announcement', id: ID });
  });

  it('gives account events one allowlisted screen action', () => {
    expect(notificationOpen({ v: 2, kind: 'account', screen: 'valid_id' })).toEqual({
      type: 'detail', noticeId: null, action: { route: '/settings/valid-id', label: 'Open Valid ID' },
    });
  });

  it('defers a notice action to the re-read notice', () => {
    expect(notificationOpen({ v: 2, kind: 'notice', id: ID })).toEqual({ type: 'detail', noticeId: ID, action: null });
  });

  it('falls back to a plain detail for unsupported or malformed references', () => {
    const plain = { type: 'detail', noticeId: null, action: null };
    expect(notificationOpen({ v: 1, kind: 'drive', id: ID })).toEqual(plain);
    expect(notificationOpen({ v: 1, kind: 'route', id: '/settings' })).toEqual(plain);
    expect(notificationOpen(null)).toEqual(plain);
  });

  it('offers a notice action only while the notice is published and names a supported one', () => {
    expect(noticeAction('published', 'terms_privacy')).toEqual({ route: '/settings/terms-privacy', label: 'Read Terms and Privacy' });
    expect(noticeAction('resolved', 'services')).toBeNull();
    expect(noticeAction('cancelled', 'services')).toBeNull();
    expect(noticeAction('published', null)).toBeNull();
    expect(noticeAction('published', 'https://example.com')).toBeNull();
  });
});
