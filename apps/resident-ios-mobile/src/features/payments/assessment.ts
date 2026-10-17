import { BUSINESS_FEE_DESCRIPTION, formatCentavosAsPHP, requestFeeLabel } from '@barangayan/shared';
import { requestAmount } from '../services/request-tracking';

/** PayMongo's minimum QR PH charge (PHP 1.00); the server repeats the rule. */
export const QR_MINIMUM_CENTAVOS = 100;
export const PAGE_COUNT_MAX = 1_000_000;

export type PaymentRequest = {
  status: string;
  payment_status: string;
  payment_method: string | null;
  contract_version: number;
  fee_assessment_state: string;
  assessed_amount_centavos: number | null;
  legacy_fee_centavos: number | null;
  billable_pages: number | null;
  fee_basis: string | null;
  document_types: { fee_centavos: number; service_kind: string | null } | null;
  payments: readonly { document_fee_centavos: number | null; amount_centavos: number; status: string; method: string }[];
};

export type AssessmentKind = 'paid' | 'waived' | 'free' | 'assessed' | 'pickup_due' | 'page_count_required' | 'pending';

export type Assessment = {
  kind: AssessmentKind;
  /** Committed centavos, or null while the fee is not final. Never a guess. */
  amount: number | null;
  heading: string;
  /** What the resident reads as the amount: a peso value only when it is committed and positive. */
  amountLabel: string;
  basis: string | null;
  billablePages: number | null;
  /** Cancelled or completed requests accept no new payment action. */
  terminal: boolean;
  payable: boolean;
  needsPages: boolean;
  /** Pay at pickup is the only way to pay (business documents and variable tax-code fees). */
  pickupOnly: boolean;
  /** A pickup payment was recorded for this request. */
  pickupRecorded: boolean;
  /** A QR PH attempt is open for this request. */
  qrInProgress: boolean;
};

/**
 * What a request owes, read only from the request's own committed fields and ledger (A15-001,
 * A15-002, A15-014). Pending assessment is never "free" and has no payable amount; a version-2
 * request never takes today's catalogue fee. Residents cannot assess or collect anything here.
 */
export function assess(request: PaymentRequest): Assessment {
  const amount = requestAmount(request);
  const terminal = request.status === 'cancelled' || request.status === 'completed';
  const paid = request.payment_status === 'paid';
  const waived = request.payment_status === 'waived' || request.fee_assessment_state === 'waived';
  let kind: AssessmentKind;
  if (paid) kind = 'paid';
  else if (waived) kind = 'waived';
  else if (request.fee_assessment_state === 'page_count_required') kind = 'page_count_required';
  else if (request.fee_assessment_state === 'pickup_due') kind = 'pickup_due';
  else if (amount === null) kind = 'pending';
  else kind = amount === 0 ? 'free' : 'assessed';

  const headings: Record<AssessmentKind, string> = {
    paid: 'Payment received',
    waived: 'Fee waived — no payment required',
    free: 'No payment required',
    assessed: 'Confirmed amount due',
    pickup_due: 'Fee payable at pickup',
    page_count_required: 'Total pages needed',
    pending: 'Awaiting fee assessment',
  };
  let amountLabel: string;
  if (kind === 'paid' || kind === 'assessed') amountLabel = amount === null ? 'Amount unavailable' : formatCentavosAsPHP(amount);
  else if (kind === 'pickup_due') amountLabel = `${BUSINESS_FEE_DESCRIPTION} — payable at pickup`;
  else if (kind === 'page_count_required') amountLabel = requestFeeLabel(request, null);
  else if (kind === 'pending') amountLabel = 'The barangay has not confirmed the fee for this request yet.';
  else amountLabel = 'No payment required';

  const payable = !terminal && !paid && !waived && request.payment_status !== 'refunded'
    && (kind === 'pickup_due' || (kind === 'assessed' && amount !== null && amount > 0));
  const hasPending = (method: string) => request.payments.some((payment) => payment.status === 'pending' && payment.method === method);
  return {
    kind,
    amount,
    heading: headings[kind],
    amountLabel,
    basis: request.fee_basis?.trim() || null,
    billablePages: request.billable_pages,
    terminal,
    payable,
    needsPages: kind === 'page_count_required' && !terminal,
    pickupOnly: request.document_types?.service_kind === 'business' || kind === 'pickup_due',
    pickupRecorded: request.payment_method === 'pickup' && (hasPending('pickup') || request.fee_assessment_state === 'pickup_due'),
    qrInProgress: hasPending('qrph'),
  };
}

export type QrEligibility = { ok: true } | { ok: false; reason: string };

/** Whether QR PH may be offered (A15-006). The settlement gate is checked by the caller. */
export function qrEligibility(assessment: Assessment): QrEligibility {
  if (!assessment.payable) return { ok: false, reason: 'This request has no payment due.' };
  if (assessment.pickupOnly) return { ok: false, reason: 'This document is paid in cash at pickup.' };
  if (assessment.pickupRecorded) return { ok: false, reason: 'Pay at pickup has been recorded for this request, so QR PH is no longer available for it.' };
  if (assessment.amount === null || assessment.amount < QR_MINIMUM_CENTAVOS) return { ok: false, reason: 'QR PH needs an amount of at least ₱1.00. Pay at pickup instead.' };
  return { ok: true };
}

export type PagesInput = { ok: true; value: number } | { ok: false; message: string };

/** The total page count of a certified copy request (A15, shared limit 1–1,000,000). */
export function parsePageCount(text: string): PagesInput {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: 'Enter a whole number of pages between 1 and 1,000,000.' };
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1 || value > PAGE_COUNT_MAX) return { ok: false, message: 'Enter a whole number of pages between 1 and 1,000,000.' };
  return { ok: true, value };
}

export function paymentMethodName(method: string): string {
  return method === 'qrph' ? 'QR PH' : method === 'pickup' || method === 'cash' ? 'Pay at pickup' : 'Payment';
}
