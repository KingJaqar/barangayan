import {
  BUSINESS_FEE_DESCRIPTION, calculateAgencySla, estimateLabel, formatCentavosAsPHP, getResidentRequestStatus, progressFraction, projectSlaTime, requestFee, requestFeeLabel,
  RESIDENT_STATUS_LABEL, type SlaPause, type SlaRequest,
} from '@barangayan/shared';
import type { z } from 'zod';
import type { slaTrackingRow } from '../../data/schemas';

export type HistoryEntry = { status: string; at: string; note: string | null };

/** Reads the status history leniently: a malformed entry is skipped, never rendered as a guess. */
export function parseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): HistoryEntry[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.status !== 'string' || typeof record.at !== 'string' || Number.isNaN(new Date(record.at).getTime())) return [];
    return [{ status: record.status, at: record.at, note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : null }];
  });
}

const STAGES = [
  { status: 'submitted', label: 'Request submitted' },
  { status: 'in_progress', label: 'Processing' },
  { status: 'ready_for_pickup', label: 'Ready for pickup' },
  { status: 'completed', label: 'Completed' },
] as const;

export type StageView = { status: string; label: string; state: 'done' | 'current' | 'pending'; at: string | null; note: string | null };

/**
 * The four fulfilment stages with the recorded time and staff note of each. A stage is done
 * when the request has reached or passed it; a cancelled request has no completed stages
 * (its recorded entries keep their times), and the cancellation is reported separately.
 */
export function buildStages(status: string, history: readonly HistoryEntry[]): StageView[] {
  const current = STAGES.findIndex((stage) => stage.status === status);
  return STAGES.map((stage, index) => {
    const entry = [...history].reverse().find((item) => item.status === stage.status);
    const state: StageView['state'] = status === 'cancelled' ? 'pending' : index < current ? 'done' : index === current ? 'current' : 'pending';
    return { status: stage.status, label: stage.label, state, at: entry?.at ?? null, note: entry?.note ?? null };
  });
}

export function cancellation(status: string, history: readonly HistoryEntry[]): { at: string | null; note: string | null } | null {
  if (status !== 'cancelled') return null;
  const entry = [...history].reverse().find((item) => item.status === 'cancelled');
  return { at: entry?.at ?? null, note: entry?.note ?? null };
}

export type CancelEligibility = 'eligible' | 'payment-in-progress' | 'ineligible';
type CancelInput = { status: string; payment_status: string; payments: readonly { status: string; method: string }[] };

/**
 * Whether the resident may cancel the request itself (A14-006). Delivery that has advanced, a
 * cleared payment or a closed request hide it; a pending QR attempt is cancelled first, as its
 * own operation, so the two are never offered together. The server repeats every rule.
 */
export function cancelEligibility(request: CancelInput): CancelEligibility {
  if (['ready_for_pickup', 'completed', 'cancelled'].includes(request.status) || request.payment_status === 'paid') return 'ineligible';
  return request.payments.some((payment) => payment.status === 'pending' && payment.method === 'qrph') ? 'payment-in-progress' : 'eligible';
}

type FeeInput = Parameters<typeof requestFee>[0] & { document_types: { fee_centavos: number } | null; payments: readonly { document_fee_centavos: number | null; amount_centavos: number; status: string }[] };

/**
 * The committed amount of a request in centavos, or null while it is not final. A recorded
 * paid (or pending) payment wins; otherwise a version-2 request shows only its committed
 * assessment and never today's catalogue fee, while a legacy request keeps its snapshot.
 */
export function requestAmount(request: FeeInput): number | null {
  const recorded = request.payments.find((payment) => payment.status === 'paid') ?? request.payments.find((payment) => payment.status === 'pending');
  return requestFee(request, request.document_types?.fee_centavos ?? 0, recorded ? recorded.document_fee_centavos ?? recorded.amount_centavos : null);
}

/** The amount line of a request. A fee that is not final is named, never shown as zero. */
export function feeLine(request: FeeInput): string {
  const amount = requestAmount(request);
  if (amount !== null) return amount === 0 ? 'No payment required' : formatCentavosAsPHP(amount);
  if (request.fee_assessment_state === 'page_count_required') return requestFeeLabel(request, null);
  if (request.fee_assessment_state === 'pickup_due') return `${BUSINESS_FEE_DESCRIPTION} — payable at pickup`;
  return 'Awaiting fee assessment';
}

export function paymentMethodLabel(method: string | null): string {
  return method === 'pickup' ? 'Pay at pickup' : method === 'qrph' ? 'QR PH' : 'Not yet selected';
}
export function paymentStatusLabel(paymentStatus: string): string {
  switch (paymentStatus) {
    case 'paid': return 'Paid';
    case 'waived': return 'Waived';
    case 'refunded': return 'Refunded';
    default: return 'Pending';
  }
}
export const requestStatusLabel = (status: string, paymentStatus: string) => RESIDENT_STATUS_LABEL[getResidentRequestStatus(status, paymentStatus)];

/** Progress and estimate of a request on the previous (hours-based) timing model. */
export function legacyProgress(status: string, createdAt: string, targetHours: number) {
  if (status === 'cancelled') return null;
  const fraction = progressFraction(status, createdAt, targetHours);
  return { fraction, percent: Math.round(fraction * 100), estimate: status === 'completed' ? 'Completed' : `Estimated completion — ${estimateLabel(createdAt, targetHours)}` };
}

export type SlaSnapshot = z.infer<typeof slaTrackingRow>;

/**
 * The current clock values: the server's evaluation instant plus the monotonic time elapsed
 * on this device since the snapshot arrived. The device wall clock is never used, so a wrong
 * or changed device date cannot move the displayed times.
 */
export function projectClock(snapshot: SlaSnapshot, elapsedMilliseconds: number) {
  const request: SlaRequest = snapshot.request;
  const pauses: SlaPause[] = snapshot.pauses;
  return calculateAgencySla(request, pauses, projectSlaTime(snapshot.evaluated_at, elapsedMilliseconds));
}

/** Agency time against its target as a 0–1 bar; capped, because "full" must not read as "done". */
export function agencyProgress(agencySeconds: number, targetSeconds: number): number {
  return targetSeconds > 0 ? Math.min(Math.max(agencySeconds / targetSeconds, 0), 1) : 0;
}

/** True once neither agency time nor turnaround can change, so a screen can stop refreshing. */
export function clockSettled(request: Pick<SlaSnapshot['request'], 'released_at' | 'cancelled_at'>): boolean {
  return request.released_at !== null || request.cancelled_at !== null;
}
