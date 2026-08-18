export type ResidentRequestStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';

/**
 * Derives the resident-facing status from the two underlying DB columns.
 * service_requests.status alone can't distinguish "submitted, awaiting payment" from
 * "submitted, already paid" — that distinction comes from payment_status.
 */
export function getResidentRequestStatus(status: string, paymentStatus: string): ResidentRequestStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'completed';
  if (status === 'ready_for_pickup') return 'ready_for_pickup';
  if (status === 'in_progress') return 'processing';
  // status === 'submitted'
  return paymentStatus === 'paid' || paymentStatus === 'waived' ? 'paid' : 'pending_payment';
}

export const RESIDENT_STATUS_LABEL: Record<ResidentRequestStatus, string> = {
  pending_payment: 'Submitted (Pending Payment)',
  paid: 'Submitted (Paid)',
  processing: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
