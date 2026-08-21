import type { Tables } from '@barangayan/shared';

export type DocumentType = Tables<'document_types'>;

/**
 * One route through the modal per the "whole flow happens in the panel" requirement:
 * browse requirements → fill the request form → pick a payment method → the
 * method-specific confirmation/QR screen → a success recap. `pickup` and `qrph` are
 * siblings (only one is reached, chosen in `payment-method`), and only `qrph` ever
 * reaches `success` — Pay at Pickup's confirmation step is itself the terminal screen,
 * same as the standalone /services/payment/pickup/[requestId] route it's ported from.
 */
export type ModalStep = 'details' | 'form' | 'payment-method' | 'pickup' | 'qrph' | 'success';

export interface SuccessPayload {
  amountCentavos: number;
  documentFeeCentavos: number;
  method: string;
  sourceId: string | null;
}
