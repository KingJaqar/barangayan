import { getResidentRequestStatus, RESIDENT_STATUS_LABEL, type Tables } from '@barangayan/shared';

export type HomeRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
};

const STEPS = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'in_progress', label: 'Processing' },
  { status: 'ready_for_pickup', label: 'Ready for pickup' },
  { status: 'completed', label: 'Completed' },
] as const;

function validDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

/** Home has no processing-target join. Never infer dates or estimates from a status. */
export function homeRequestSummary(request: Pick<HomeRequest, 'status' | 'payment_status' | 'created_at' | 'status_history'>) {
  const stepIndex = STEPS.findIndex(step => step.status === request.status);
  const cancelled = request.status === 'cancelled';
  const history = Array.isArray(request.status_history) ? request.status_history : [];
  const statusLabel = stepIndex < 0 && !cancelled ? 'Status unavailable'
    : RESIDENT_STATUS_LABEL[getResidentRequestStatus(request.status, request.payment_status)];
  const steps = STEPS.map((step, index) => {
    const entry = history.find(item => item !== null && typeof item === 'object' && !Array.isArray(item)
      && item.status === step.status && validDate(item.at));
    const recordedAt = entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? validDate(entry.at) : null;
    const date = recordedAt ?? (index === 0 ? validDate(request.created_at) : null);
    const reached = Boolean(date) || (stepIndex >= index && !cancelled);
    return { ...step, date, reached, current: index === stepIndex,
      detail: date ? null : reached ? 'Date unavailable' : cancelled || stepIndex < 0 ? 'Not recorded' : 'Pending' };
  });
  return { stepIndex, cancelled, statusLabel, steps };
}

export function homeGreeting(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function homeTimestamp(value: string): string {
  if (!validDate(value)) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
