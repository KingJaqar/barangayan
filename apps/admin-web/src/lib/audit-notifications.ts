import { entityTypeToCategory, type AdminAuditLogCategory, type AdminAuditLogRow, type AdminEntityType } from '@barangayan/shared';

// ---------------------------------------------------------------------------
// Module concept — finer-grained than the 9-category settings toggle, used
// only to drive the notification bell/drawer filters (one bucket per admin
// nav section). Deliberately separate from `AdminAuditLogCategory`: that one
// stays coarse (it's what admins opt in/out of in Settings), this one is for
// "show me exactly what happened in Requests vs Transactions vs Services".
// ---------------------------------------------------------------------------

export type ModuleKey =
  | 'services'
  | 'announcements'
  | 'requests'
  | 'transactions'
  | 'residents'
  | 'incident-reports'
  | 'health'
  | 'health-applicants'
  | 'waste-management'
  | 'hub'
  | 'evacuation-centers'
  | 'emergency-qr'
  | 'households-residents'
  | 'staff'
  | 'faq'
  | 'terms-privacy'
  | 'about-us'
  | 'settings'
  | 'system';

interface ModuleInfo {
  label: string;
  /** null = not linkable (system/auth events have no page to jump to). */
  href: string | null;
  icon: string;
}

/** Display order for filter chips — mirrors the admin sidebar's module order,
 * with "System (Login/Logout)" appended last since it wasn't one of the
 * named modules but still needs a home for auth events. */
export const MODULE_ORDER: ModuleKey[] = [
  'services',
  'announcements',
  'requests',
  'transactions',
  'residents',
  'incident-reports',
  'health',
  'health-applicants',
  'waste-management',
  'hub',
  'evacuation-centers',
  'emergency-qr',
  'households-residents',
  'staff',
  'faq',
  'terms-privacy',
  'about-us',
  'settings',
  'system',
];

export const MODULE_META: Record<ModuleKey, ModuleInfo> = {
  services: { label: 'Services', href: '/services', icon: '📄' },
  announcements: { label: 'Announcements', href: '/announcements', icon: '📢' },
  requests: { label: 'Requests', href: '/requests', icon: '📋' },
  transactions: { label: 'Transactions', href: '/transactions', icon: '💳' },
  residents: { label: 'Resident Directory', href: '/residents', icon: '👤' },
  'incident-reports': { label: 'Incident Reports', href: '/incident-reports', icon: '⚠️' },
  health: { label: 'Health', href: '/health', icon: '🏥' },
  'health-applicants': { label: 'Medical Applicants', href: '/health', icon: '🩺' },
  'waste-management': { label: 'Waste Management', href: '/waste-management', icon: '♻️' },
  hub: { label: 'Hub', href: '/hub', icon: '🚨' },
  'evacuation-centers': { label: 'Evacuation Centers', href: '/evacuation-centers', icon: '🏠' },
  'emergency-qr': { label: 'Emergency QR', href: '/emergency-qr', icon: '🆔' },
  'households-residents': { label: 'Households & Residents', href: '/households-residents', icon: '🏘️' },
  staff: { label: 'Staff Member', href: '/staff', icon: '👔' },
  faq: { label: 'FAQ Content', href: '/faq', icon: '❓' },
  'terms-privacy': { label: 'Terms & Privacy', href: '/terms-privacy', icon: '📜' },
  'about-us': { label: 'About Us', href: '/about-us', icon: 'ℹ️' },
  settings: { label: 'Settings', href: '/settings', icon: '⚙️' },
  system: { label: 'System (Login/Logout)', href: null, icon: '🔒' },
};

/**
 * Reverse of `entityTypeToModule` — which entity types feed a given module's
 * filter. `incident` deliberately appears under both `incident-reports` and
 * `waste-management` (same table, disambiguated by `metadata.source` at query
 * time — see `use-audit-log-browser.ts`), so a plain `.in('entity_type', …)`
 * lookup alone can't fully separate the two; callers needing that precision
 * layer on the `metadata->>source` check themselves.
 */
export const MODULE_ENTITY_TYPES: Record<ModuleKey, AdminEntityType[]> = {
  services: ['document_type'],
  announcements: ['announcement'],
  requests: ['service_request'],
  transactions: ['payment'],
  residents: ['resident'],
  'incident-reports': ['incident'],
  health: ['medical_drive'],
  'health-applicants': ['drive_registration'],
  'waste-management': ['waste_zone', 'waste_schedule', 'incident'],
  hub: ['emergency_information'],
  'evacuation-centers': ['evacuation_center'],
  'emergency-qr': ['emergency_qr'],
  'households-residents': ['household'],
  staff: ['staff'],
  faq: ['faq_article'],
  'terms-privacy': ['site_content'],
  'about-us': ['about_us', 'developer_profile'],
  settings: ['settings'],
  system: ['system'],
};

/**
 * Maps an audit-log row to the module it should file under. Nearly all
 * entity types map 1:1; `incident` is the one ambiguous case (logged both
 * from Incident Reports and from Waste Management's dumping-incident table,
 * same underlying `incidents` row) — callers logging from the waste side
 * must pass `metadata: { source: 'waste_management' }` for this to resolve
 * correctly.
 *
 * Written as an exhaustive switch on purpose: the `never` default branch
 * means adding a new `AdminEntityType` to the shared schema without adding
 * a case here fails the build, instead of silently defaulting into the
 * wrong filter bucket.
 */
export function entityTypeToModule(row: Pick<AdminAuditLogRow, 'entity_type' | 'metadata'>): ModuleKey {
  const entityType = row.entity_type as AdminEntityType;
  switch (entityType) {
    case 'service_request':
      return 'requests';
    case 'payment':
      return 'transactions';
    case 'document_type':
      return 'services';
    case 'announcement':
      return 'announcements';
    case 'resident':
      return 'residents';
    case 'incident': {
      const source = (row.metadata as Record<string, unknown> | null)?.source;
      return source === 'waste_management' ? 'waste-management' : 'incident-reports';
    }
    case 'medical_drive':
      return 'health';
    case 'drive_registration':
      return 'health-applicants';
    case 'waste_zone':
    case 'waste_schedule':
      return 'waste-management';
    case 'emergency_information':
      return 'hub';
    case 'evacuation_center':
      return 'evacuation-centers';
    case 'emergency_qr':
      return 'emergency-qr';
    case 'household':
      return 'households-residents';
    case 'staff':
      return 'staff';
    case 'faq_article':
      return 'faq';
    case 'site_content':
      return 'terms-privacy';
    case 'about_us':
    case 'developer_profile':
      return 'about-us';
    case 'settings':
      return 'settings';
    case 'system':
      return 'system';
    default: {
      const exhaustiveCheck: never = entityType;
      return exhaustiveCheck;
    }
  }
}

// ---------------------------------------------------------------------------
// Category labels (the coarse 9-bucket Settings on/off toggle) — consolidated
// here so the audit preferences form and any notification UI share one list
// instead of two independently hand-maintained copies.
// ---------------------------------------------------------------------------

export const CATEGORY_ORDER: (keyof AdminAuditLogCategory)[] = [
  'service_requests',
  'announcements',
  'incidents',
  'residents',
  'waste_management',
  'health',
  'evacuation_centers',
  'staff',
  'system',
];

export const CATEGORY_LABELS: Record<keyof AdminAuditLogCategory, string> = {
  service_requests: 'Service Requests',
  announcements: 'Announcements',
  incidents: 'Incident Reports',
  residents: 'Residents',
  waste_management: 'Waste Management',
  health: 'Health Drives',
  evacuation_centers: 'Evacuation Centers',
  staff: 'Staff',
  system: 'System (Login/Logout)',
};

// ---------------------------------------------------------------------------
// Display helpers (presentation layer — emoji/labels stay here, not in the DB)
// ---------------------------------------------------------------------------

export const ENTITY_ICONS: Record<string, string> = {
  service_request: '📋',
  announcement: '📢',
  incident: '⚠️',
  resident: '👤',
  waste_zone: '♻️',
  waste_schedule: '♻️',
  medical_drive: '🏥',
  drive_registration: '🩺',
  evacuation_center: '🏠',
  document_type: '📄',
  faq_article: '❓',
  emergency_information: '🚨',
  payment: '💳',
  staff: '👔',
  system: '🔒',
  site_content: '📜',
  about_us: 'ℹ️',
  developer_profile: 'ℹ️',
  household: '🏘️',
  emergency_qr: '🆔',
  settings: '⚙️',
};

export const ACTION_VERBS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status changed',
  login: 'Logged in',
  logout: 'Logged out',
};

export interface AdminAuditNotification extends AdminAuditLogRow {
  /** Formatted label for display, e.g. "📋 Created: Request #REQ-001" */
  displayLabel: string;
  /** Relative time string, e.g. "3 minutes ago" */
  relativeTime: string;
  /** Absolute time string, e.g. "Aug 7, 2026, 9:00 AM" */
  absoluteTime: string;
  /** Route to navigate to when clicked (null for non-linkable events) */
  href: string | null;
  /** Notification-preferences category this entity_type rolls up to (coarse — Settings toggle) */
  category: keyof AdminAuditLogCategory;
  /** Fine-grained module this entity_type/metadata resolves to (drives filter chips) */
  module: ModuleKey;
}

export function buildDisplayLabel(row: AdminAuditLogRow): string {
  const icon = ENTITY_ICONS[row.entity_type] ?? '📝';
  const verb = ACTION_VERBS[row.action] ?? row.action;
  const label = row.entity_label ?? row.entity_type;
  const adminName = (row.metadata as Record<string, unknown> | null)?.admin_name as string | undefined;
  const byLine = adminName ? ` — ${adminName}` : '';
  return `${icon} ${verb}: ${label}${byLine}`;
}

/** Derives the click-through href from the row's module, with a couple of
 * id-specific overrides for entity types whose module page supports deep
 * links to the specific record. */
export function buildHref(row: AdminAuditLogRow): string | null {
  const moduleKey = entityTypeToModule(row);
  const meta = MODULE_META[moduleKey];
  if (!meta.href) return null;

  const id = row.entity_id;
  if (row.entity_type === 'service_request') return id ? `/requests/${id}` : meta.href;
  if (row.entity_type === 'resident') return id ? `/residents?q=${id}` : meta.href;
  return meta.href;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelativeTime(dateStr: string): string {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  return rtf.format(diffDay, 'day');
}

/** Absolute timestamp for the drawer/detail panel, e.g. "Aug 7, 2026, 9:00 AM". */
export function formatAbsoluteTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr));
}

// `admin_name` is already folded into `buildDisplayLabel`'s byline, so it's
// hidden from the generic metadata listing to avoid showing it twice.
const METADATA_HIDDEN_KEYS = new Set(['admin_name']);

/** Turns a row's `metadata` JSON into a flat list of {key, value} pairs for
 * display, skipping keys already surfaced elsewhere. */
export function formatMetadataEntries(metadata: Record<string, unknown> | null | undefined): { key: string; value: string }[] {
  if (!metadata) return [];
  return Object.entries(metadata)
    .filter(([key]) => !METADATA_HIDDEN_KEYS.has(key))
    .map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }));
}

/** Turns a row's `changes` (before/after) into a list of only the fields that
 * actually differ, each stringified for display. */
export function formatChangesDiff(
  changes: { before: Record<string, unknown>; after: Record<string, unknown> } | null | undefined,
): { key: string; before: string; after: string }[] {
  if (!changes) return [];
  const stringify = (v: unknown) => (v === undefined || v === null ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
  const keys = new Set([...Object.keys(changes.before ?? {}), ...Object.keys(changes.after ?? {})]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(changes.before?.[key]) !== JSON.stringify(changes.after?.[key]))
    .map((key) => ({ key, before: stringify(changes.before?.[key]), after: stringify(changes.after?.[key]) }));
}

export function toNotification(row: AdminAuditLogRow): AdminAuditNotification {
  return {
    ...row,
    displayLabel: buildDisplayLabel(row),
    relativeTime: formatRelativeTime(row.created_at),
    absoluteTime: formatAbsoluteTime(row.created_at),
    href: buildHref(row),
    category: entityTypeToCategory(row.entity_type),
    module: entityTypeToModule(row),
  };
}
