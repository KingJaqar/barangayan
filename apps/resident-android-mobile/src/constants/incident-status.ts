/**
 * The five-stage incident status model (migration 0026_incident_report_workflow.sql).
 *
 *   open        → resident submitted, not yet picked up   ("Submitted" to the resident)
 *   in_progress → barangay staff are working on it
 *   resolved    → closed successfully                     (terminal)
 *   withdrawn   → the reporter withdrew it within 24 h    (terminal)
 *   unresolved  → staff closed it without a resolution    (terminal)
 *
 * Kept in one place so the incident card, the detail screen, and the Reports filter
 * chips can never drift apart. Before this existed the mobile app only knew the first
 * three, so a withdrawn report rendered as a raw grey `withdrawn` pill — which is why
 * withdrawing appeared to do nothing.
 */
export const INCIDENT_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'withdrawn',
  'unresolved',
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IncidentStatusMeta {
  /** Wording shown to the resident (not the raw DB value). */
  label: string;
  /** Shorter wording for the filter chips, where horizontal space is tight. */
  filterLabel: string;
  /** Badge background. */
  bg: string;
  /** Badge foreground — also the filter chip's fill/outline colour. */
  fg: string;
  icon: string;
}

export const INCIDENT_STATUS_META: Record<IncidentStatus, IncidentStatusMeta> = {
  open: {
    label: 'Submitted',
    filterLabel: 'Submitted',
    bg: '#DBEAFE',
    fg: '#2563EB',
    icon: 'time-outline',
  },
  in_progress: {
    label: 'In Progress',
    filterLabel: 'Progress',
    bg: '#FEF3C7',
    fg: '#D97706',
    icon: 'sync-outline',
  },
  resolved: {
    label: 'Resolved',
    filterLabel: 'Resolved',
    bg: '#D1FAE5',
    fg: '#059669',
    icon: 'checkmark-circle-outline',
  },
  withdrawn: {
    label: 'Withdrawn',
    filterLabel: 'Withdrawn',
    bg: '#E4E4E7',
    fg: '#52525B',
    icon: 'close-circle-outline',
  },
  unresolved: {
    label: 'Unresolved',
    filterLabel: 'Unresolved',
    bg: '#FEE2E2',
    fg: '#DC2626',
    icon: 'alert-circle-outline',
  },
};

const FALLBACK_META: IncidentStatusMeta = {
  label: 'Unknown',
  filterLabel: 'Unknown',
  bg: '#F3F4F6',
  fg: '#6B7280',
  icon: 'help-circle-outline',
};

/** Never throws — an unrecognised status from the DB degrades to a neutral grey pill. */
export function incidentStatusMeta(status: string): IncidentStatusMeta {
  return INCIDENT_STATUS_META[status as IncidentStatus] ?? { ...FALLBACK_META, label: status };
}
