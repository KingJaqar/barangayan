import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';

/**
 * The Reports views and filters (A32, A35). A view and a filter are plain descriptions that the
 * data layer turns into a server-side restriction, so paging and counts stay correct. The
 * Android source offers category chips for announcements and status chips for the resident's
 * own reports; it has no date or search filter, so none exists here either.
 */
export const INCIDENT_STATUSES = ['open', 'in_progress', 'resolved', 'withdrawn', 'unresolved'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export type ReportsView = 'incidents' | 'active' | 'resolved' | 'announcements';
export type IncidentFilter = 'all' | IncidentStatus;
export type AnnouncementFilter = 'all' | AnnouncementCategory;

export const VIEW_OPTIONS: readonly { value: ReportsView; label: string }[] = [
  { value: 'incidents', label: 'Incidents' }, { value: 'active', label: 'Active' }, { value: 'resolved', label: 'Resolved' }, { value: 'announcements', label: 'Announcements' },
];
/** A guest has no reports of their own, so the Active and Resolved views are not offered. */
export const GUEST_VIEW_OPTIONS: readonly { value: ReportsView; label: string }[] = VIEW_OPTIONS.filter((option) => option.value === 'incidents' || option.value === 'announcements');

/** The resident-facing wording; `open` is shown as "Submitted". */
export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Submitted', in_progress: 'In Progress', resolved: 'Resolved', withdrawn: 'Withdrawn', unresolved: 'Unresolved',
};
export const INCIDENT_FILTER_OPTIONS: readonly { value: IncidentFilter; label: string }[] = [
  { value: 'all', label: 'All' }, ...INCIDENT_STATUSES.map((status) => ({ value: status, label: INCIDENT_STATUS_LABEL[status] })),
];
export const ANNOUNCEMENT_FILTER_OPTIONS: readonly { value: AnnouncementFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(ANNOUNCEMENT_CATEGORY_META) as AnnouncementCategory[]).map((category) => ({ value: category, label: ANNOUNCEMENT_CATEGORY_META[category].label })),
];

export function incidentStatusLabel(status: string): string {
  return (INCIDENT_STATUSES as readonly string[]).includes(status) ? INCIDENT_STATUS_LABEL[status as IncidentStatus] : 'Unknown';
}

/** Android route values map onto the iOS view names; anything else is not a view. */
const VIEW_ALIASES: Record<string, ReportsView> = {
  incidents: 'incidents', 'incident-reports': 'incidents', active: 'active', resolved: 'resolved', announcements: 'announcements',
};

function single(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first : undefined;
}

/**
 * The view named by the route. `segment` is the iOS parameter and `tab` the Android one. An
 * unknown value falls back to Incidents, and a guest never lands on a view that needs an account.
 */
export function resolveView(segment: unknown, tab: unknown, signedIn: boolean): ReportsView {
  const requested = VIEW_ALIASES[single(segment) ?? single(tab) ?? ''] ?? 'incidents';
  return !signedIn && (requested === 'active' || requested === 'resolved') ? 'incidents' : requested;
}

/** Status restriction of an own-report view: Active is Submitted + In Progress, Resolved is resolved; null means every status. */
export function incidentStatuses(view: ReportsView, filter: IncidentFilter): readonly IncidentStatus[] | null {
  if (view === 'active') return ['open', 'in_progress'];
  if (view === 'resolved') return ['resolved'];
  if (view === 'incidents' && filter !== 'all') return [filter];
  return null;
}
