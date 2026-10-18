type RequestState = { status?: unknown; sla_state?: unknown };
const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'Processing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Offer transitions supported by the authoritative SLA workflow. */
export function requestStatusOptions(row: RequestState, cancellation = true) {
  const state = row.sla_state ?? ({ submitted: 'pre_processing', in_progress: 'running', ready_for_pickup: 'ready' }[String(row.status)]);
  const next = state === 'pre_processing' ? 'in_progress' : state === 'running' ? 'ready_for_pickup' : state === 'ready' ? 'completed' : null;
  const canCancel = cancellation && ['pre_processing', 'running', 'paused', 'ready'].includes(String(state));
  return STATUS_OPTIONS.filter(option => option.value === row.status || option.value === next || (canCancel && option.value === 'cancelled'));
}
