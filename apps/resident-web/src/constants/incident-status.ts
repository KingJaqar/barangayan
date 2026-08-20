/**
 * Incident status metadata for resident-web — parallel to mobile's
 * constants/incident-status.ts, adapted to use Tailwind class names and lucide icon names
 * instead of RN StyleSheet and Ionicons.
 */

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'withdrawn';

export const INCIDENT_STATUSES: IncidentStatus[] = ['open', 'in_progress', 'resolved', 'withdrawn'];

interface IncidentStatusMeta {
  label: string;
  /** Short label used in filter chips. */
  filterLabel: string;
  /** Tailwind classes for the pill. */
  className: string;
}

export const INCIDENT_STATUS_META: Record<IncidentStatus, IncidentStatusMeta> = {
  open: {
    label: 'Open',
    filterLabel: 'Open',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  in_progress: {
    label: 'In Progress',
    filterLabel: 'In Progress',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  resolved: {
    label: 'Resolved',
    filterLabel: 'Resolved',
    className: 'bg-[var(--accent)]/15 text-[var(--accent)]',
  },
  withdrawn: {
    label: 'Withdrawn',
    filterLabel: 'Withdrawn',
    className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  },
};

export function incidentStatusMeta(status: string): IncidentStatusMeta {
  return (
    INCIDENT_STATUS_META[status as IncidentStatus] ?? {
      label: status,
      filterLabel: status,
      className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
    }
  );
}
