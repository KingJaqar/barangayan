import { homeRequestAttention, type HomeRequestAction, type HomeRequestRow } from '@barangayan/shared';

import { PAYMENT_SETTLEMENT_READY } from '../constants/payment';

export type HomeRequest = HomeRequestRow;

const STEPS = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'in_progress', label: 'Processing' },
  { status: 'ready_for_pickup', label: 'Ready for pickup' },
  { status: 'completed', label: 'Completed' },
] as const;
const ACTIONS: Record<HomeRequestAction, string> = {
  collect: 'Collect your document', enter_pages: 'Enter the total pages',
  review_requirements: 'Review the requirements', choose_payment: 'Choose a payment method', pay: 'Continue payment',
};
const SHORT_TITLES = new Map([
  ['business', 'Business Clearance'], ['certified_true_copy', 'Certified True Copy'],
  ['first_time_job_seeker', 'First Time Job Seeker Certificate'],
]);

function validDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

export function homeRequestTitle(request: Pick<HomeRequest, 'service_kind' | 'document_name'>): string {
  return SHORT_TITLES.get(request.service_kind ?? '') ?? request.document_name ?? 'Document request';
}

/** Only the owner's status-history event notes are resident-readable; never use generic notes. */
export function homeRequestSummary(request: HomeRequest) {
  const stepIndex = STEPS.findIndex(step => step.status === request.status);
  const cancelled = request.status === 'cancelled';
  const history = Array.isArray(request.status_history) ? request.status_history : [];
  const events = history.flatMap(item => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? [{ status: item.status, at: validDate(item.at), note: item.note }] : []);
  const cancellation = events.filter(item => item.status === 'cancelled' && validDate(item.at))
    .reverse()
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))[0];
  const cancelledAt = validDate(request.cancelled_at) ?? validDate(cancellation?.at);
  const cancellationNote = typeof cancellation?.note === 'string' ? cancellation.note.trim() || null : null;
  const stage = STEPS[stepIndex]?.label ?? null;
  const statusLabel = cancelled ? 'Cancelled' : stage ?? 'Status unavailable';
  const steps = STEPS.map((step, index) => {
    const entry = events.filter(item => item.status === step.status && validDate(item.at))
      .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))[0];
    const date = validDate(entry?.at) ?? (index === 0 ? validDate(request.created_at) : null);
    const reached = stepIndex >= index && !cancelled;
    return { ...step, date: reached ? date : null, reached, current: index === stepIndex,
      detail: reached ? date ? null : 'Date unavailable' : cancelled || stepIndex < 0 ? 'Not recorded' : 'Pending' };
  });
  const fee = request.resolved_fee_centavos;
  const paymentLabel = request.payment_status === 'waived' ? 'Fee waived'
    : request.payment_status === 'refunded' ? 'Payment refunded'
    : request.payment_status === 'paid' ? 'Paid'
    : fee === 0 ? 'No payment required'
    : fee === null || !Number.isFinite(fee) || fee < 0 ? 'Fee not yet assessed' : 'Payment pending';
  // Recheck the same predicate used by SQL; a malformed/stale action never creates a payment prompt.
  const action = homeRequestAttention(request, PAYMENT_SETTLEMENT_READY);
  const nextAction = action && action === request.next_action ? ACTIONS[action] : null;
  return { stepIndex, cancelled, statusLabel, steps, paymentLabel, nextAction,
    progressLabel: stage ? `Step ${stepIndex + 1} of 4 · ${stage}` : null,
    updatedLabel: validDate(request.updated_at) ? `Updated ${homeTimestamp(request.updated_at)}` : 'Update time unavailable',
    cancellationLabel: cancelledAt ? `Cancelled ${homeTimestamp(cancelledAt)}` : 'Cancellation date unavailable', cancellationNote };
}

export function homeTimestamp(value: string): string {
  if (!validDate(value)) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
