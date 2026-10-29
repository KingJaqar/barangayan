/**
 * The Announcements hub contract (migration 0145): its views, the chips of each view, which hub chip an inbox kind
 * belongs to, and the destination references an inbox row may carry. The kind → chip table mirrors the database's
 * `notification_kind_filter`; the server applies it for counts, pages and bulk reads, and this copy only presents rows.
 */

export const HUB_VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'barangay', label: 'Barangay' },
  { key: 'account', label: 'Account' },
  { key: 'system', label: 'System' },
] as const;
export type HubView = (typeof HUB_VIEWS)[number]['key'];

const BARANGAY_CHIPS = [
  { key: 'general', label: 'General' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'health', label: 'Health' },
  { key: 'events', label: 'Events' },
] as const;
const ACCOUNT_CHIPS = [
  { key: 'document_requests', label: 'Document Requests' },
  { key: 'incident_reports', label: 'Incident Reports' },
  { key: 'verification', label: 'Verification' },
  { key: 'security', label: 'Security' },
  { key: 'profile', label: 'Profile' },
] as const;
const SYSTEM_CHIPS = [
  { key: 'service_status', label: 'Service Status' },
  { key: 'app_updates', label: 'App Updates' },
  { key: 'policies', label: 'Policies' },
] as const;
const ALL_CHIP = { key: 'all', label: 'All' } as const;

/** Chips in display order; every view starts with All (plan §2.1). */
export const HUB_CHIPS = {
  all: [ALL_CHIP, ...BARANGAY_CHIPS, { key: 'account', label: 'Account' }, { key: 'system', label: 'System' }],
  barangay: [ALL_CHIP, ...BARANGAY_CHIPS],
  account: [ALL_CHIP, ...ACCOUNT_CHIPS],
  system: [ALL_CHIP, ...SYSTEM_CHIPS],
} as const;
export type HubChip<V extends HubView = HubView> = (typeof HUB_CHIPS)[V][number]['key'];

export type InboxSource = 'account' | 'system';
export type InboxFilter = (typeof ACCOUNT_CHIPS)[number]['key'] | (typeof SYSTEM_CHIPS)[number]['key'];

const KIND_FILTERS: ReadonlyMap<string, InboxFilter> = new Map<string, InboxFilter>([
  ['request_status', 'document_requests'],
  ['payment', 'document_requests'],
  ['incident_status', 'incident_reports'],
  ['account_verification', 'verification'],
  ['account_security', 'security'],
  ['account_profile', 'profile'],
  ['system_service', 'service_status'],
  ['system_update', 'app_updates'],
  ['system_policy', 'policies'],
]);
const SYSTEM_FILTERS: ReadonlySet<InboxFilter> = new Set(SYSTEM_CHIPS.map((chip) => chip.key));

/** Null for kinds the hub does not list as inbox rows (the announcement mirror, Health) and for unknown kinds. */
export function inboxFilter(kind: string): InboxFilter | null {
  return KIND_FILTERS.get(kind) ?? null;
}

export function inboxSource(kind: string): InboxSource | null {
  const filter = inboxFilter(kind);
  if (!filter) return null;
  return SYSTEM_FILTERS.has(filter) ? 'system' : 'account';
}

const ACCOUNT_SCREENS =['settings', 'profile', 'valid_id', 'email_verification', 'change_password'] as const;
export type AccountScreen = (typeof ACCOUNT_SCREENS)[number];
const V1_KINDS = ['request', 'incident', 'announcement', 'drive', 'registration'] as const;

/**
 * A versioned reference to what an inbox row is about. It never holds a URL or a route; the screen that opens it
 * re-reads the record, so authorization is never decided here.
 */
export type NotificationDestination =
  | { v: 1; kind: (typeof V1_KINDS)[number]; id: string }
  | { v: 2; kind: 'notice'; id: string }
  | { v: 2; kind: 'account'; screen: AccountScreen };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const includes = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Null for anything that is not exactly one of the three shapes the database accepts. */
export function parseNotificationDestination(input: unknown): NotificationDestination | null {
  if (!isRecord(input) || Object.keys(input).length !== 3) return null;
  const { v, kind } = input;
  if ((v === 1 || v === '1') && includes(V1_KINDS, kind) && isUuid(input.id)) return { v: 1, kind, id: input.id };
  if (v !== 2) return null;
  if (kind === 'notice' && isUuid(input.id)) return { v: 2, kind, id: input.id };
  if (kind === 'account' && includes(ACCOUNT_SCREENS, input.screen)) return { v: 2, kind, screen: input.screen };
  return null;
}

export type HubSource = 'barangay' | 'account' | 'system';

/** The sources a view/chip pair lists, in group order (plan §2.1): Barangay, then Account, then System. */
export function hubSources(view: HubView, chip: string): readonly HubSource[] {
  if (view !== 'all') return [view];
  if (chip === 'all') return ['barangay', 'account', 'system'];
  return [chip === 'account' || chip === 'system' ? chip : 'barangay'];
}

/** Guests have no private inbox and no read state: only the public announcement list remains (D21). */
export function visibleHubSources(sources: readonly HubSource[], signedIn: boolean): readonly HubSource[] {
  return signedIn ? sources : sources.filter((source) => source === 'barangay');
}

/** Counts of one source; null means the caller has no such data (never zero). */
export interface SourceCounts { total: number | null; unread: number | null; scopeTotal: number | null; scopeUnread: number | null }
export type HubSummary = Record<HubSource, SourceCounts>;
export type HubSummaryRow = { source: string; total: number | null; unread: number | null; scope_total: number | null; scope_unread: number | null };

const UNKNOWN: SourceCounts = { total: null, unread: null, scopeTotal: null, scopeUnread: null };

export function toHubSummary(rows: readonly HubSummaryRow[]): HubSummary {
  const summary: HubSummary = { barangay: UNKNOWN, account: UNKNOWN, system: UNKNOWN };
  for (const row of rows) {
    if (row.source === 'barangay' || row.source === 'account' || row.source === 'system') {
      summary[row.source] = { total: row.total, unread: row.unread, scopeTotal: row.scope_total, scopeUnread: row.scope_unread };
    }
  }
  return summary;
}

/** Unread across every source the server could count; null when none could be counted. */
export function totalUnread(summary: HubSummary): number | null {
  const known = Object.values(summary).flatMap((counts) => (counts.unread === null ? [] : [counts.unread]));
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

/** Unread of the selected view/chip; null as soon as one listed source has no count. */
export function scopeUnread(summary: HubSummary, sources: readonly HubSource[]): number | null {
  let sum = 0;
  for (const source of sources) {
    const value = summary[source].scopeUnread;
    if (value === null) return null;
    sum += value;
  }
  return sum;
}

/** The card's unread badge: the whole category (not the chip) for a source card, every source for All. */
export function cardUnread(summary: HubSummary, view: HubView): number | null {
  return view === 'all' ? totalUnread(summary) : summary[view].unread;
}

/** Presentation of an inbox kind; the filter chip and source come from `inboxFilter`/`inboxSource`. */
export const INBOX_KIND_META: Readonly<Record<string, { label: string; icon: string }>> = {
  request_status: { label: 'Document request', icon: 'document-text-outline' },
  payment: { label: 'Payment', icon: 'card-outline' },
  incident_status: { label: 'Incident report', icon: 'alert-circle-outline' },
  account_verification: { label: 'Verification', icon: 'shield-checkmark-outline' },
  account_security: { label: 'Security', icon: 'lock-closed-outline' },
  account_profile: { label: 'Profile', icon: 'person-outline' },
  system_service: { label: 'Service status', icon: 'pulse-outline' },
  system_update: { label: 'App update', icon: 'phone-portrait-outline' },
  system_policy: { label: 'Policy', icon: 'document-text-outline' },
};

const ACCOUNT_SCREEN_ROUTES: Readonly<Record<AccountScreen, string>> = {
  settings: '/settings',
  profile: '/settings/profile',
  valid_id: '/settings/valid-id',
  email_verification: '/settings/email-verification',
  change_password: '/settings/change-password',
};
const NOTICE_ACTIONS =['services', 'reports', 'health', 'maps', 'emergency_info', 'email_verification', 'terms_privacy'] as const;
export type NoticeAction = (typeof NOTICE_ACTIONS)[number];
const NOTICE_ACTION_ROUTES: Readonly<Record<NoticeAction, { route: string; label: string }>> = {
  services: { route: '/services', label: 'Open Services' },
  reports: { route: '/reports', label: 'Open Reports' },
  health: { route: '/health', label: 'Open Health' },
  maps: { route: '/maps', label: 'Open Maps' },
  emergency_info: { route: '/home/emergency-info', label: 'Open Emergency Info' },
  email_verification: { route: '/settings/email-verification', label: 'Verify email' },
  terms_privacy: { route: '/settings/terms-privacy', label: 'Read Terms and Privacy' },
};
const ACCOUNT_SCREEN_LABELS: Readonly<Record<AccountScreen, string>> = {
  settings: 'Open Settings', profile: 'Open Profile', valid_id: 'Open Valid ID', email_verification: 'Verify email', change_password: 'Open Change Password',
};

/** What opening an inbox row does. The route always comes from this allowlist and an id the owner's own row carries. */
export type NotificationOpen =
  | { type: 'announcement'; id: string }
  | { type: 'record'; route: string }
  | { type: 'detail'; noticeId: string | null; action: { route: string; label: string } | null };

export function notificationOpen(destination: unknown): NotificationOpen {
  const parsed = parseNotificationDestination(destination);
  if (!parsed) return { type: 'detail', noticeId: null, action: null };
  if (parsed.v === 2) {
    if (parsed.kind === 'notice') return { type: 'detail', noticeId: parsed.id, action: null };
    return { type: 'detail', noticeId: null, action: { route: ACCOUNT_SCREEN_ROUTES[parsed.screen], label: ACCOUNT_SCREEN_LABELS[parsed.screen] } };
  }
  if (parsed.kind === 'announcement') return { type: 'announcement', id: parsed.id };
  if (parsed.kind === 'request') return { type: 'record', route: `/services/requests/${parsed.id}` };
  if (parsed.kind === 'incident') return { type: 'record', route: `/reports/${parsed.id}` };
  return { type: 'detail', noticeId: null, action: null };
}

/** A notice's supported action, or null once the notice is resolved/cancelled or names no supported action. */
export function noticeAction(state: string, action: string | null): { route: string; label: string } | null {
  if (state !== 'published' || !includes(NOTICE_ACTIONS, action)) return null;
  return NOTICE_ACTION_ROUTES[action];
}
