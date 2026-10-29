import type { Tables } from '../types/database';

export type HomeRequestAction = 'collect' | 'enter_pages' | 'review_requirements' | 'choose_payment' | 'pay';

/** Read-only projection from resident_home_requests; no resident ID is accepted by the RPC. */
export type HomeRequestRow = Pick<Tables<'service_requests'>,
  'id' | 'reference_number' | 'status' | 'payment_status' | 'payment_method' | 'created_at' |
  'updated_at' | 'status_history' | 'cancelled_at' | 'contract_version' | 'fee_assessment_state' |
  'assessed_amount_centavos' | 'legacy_fee_centavos' | 'sla_state'> & {
    document_name: string | null;
    service_kind: string | null;
    resolved_fee_centavos: number | null;
    next_action: HomeRequestAction | null;
  };

/** Keep in parity with migration 0148. Capability ranks presentation only; it never authorizes payment. */
export function homeRequestAttention(request: Pick<HomeRequestRow,
  'status' | 'payment_status' | 'payment_method' | 'fee_assessment_state' | 'sla_state' | 'resolved_fee_centavos'>,
  qrphSettlementReady: boolean,
): HomeRequestAction | null {
  if (!['submitted', 'in_progress', 'ready_for_pickup'].includes(request.status)) return null;
  if (request.status === 'ready_for_pickup') return 'collect';
  if (request.fee_assessment_state === 'page_count_required' && request.payment_status === 'pending') return 'enter_pages';
  if (request.sla_state === 'paused') return 'review_requirements';
  const fee = request.resolved_fee_centavos;
  if (['paid', 'waived', 'refunded'].includes(request.payment_status) || fee === null || !Number.isFinite(fee) || fee <= 0) return null;
  if (request.payment_method === null) return 'choose_payment';
  if (request.payment_method === 'qrph' && qrphSettlementReady && fee >= 100) return 'pay';
  return null;
}
