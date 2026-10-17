import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { DataError, type FailureKind } from '../../data/outcome';

/** Stable resident-safe codes for the payment functions; the copy lives in `lib/errors.ts`. */
export type QrFailureCode =
  | 'qr_request_closed' | 'qr_pickup_only' | 'qr_pages_required' | 'qr_unavailable' | 'qr_method_not_selected' | 'qr_preparing'
  | 'qr_below_minimum' | 'qr_close_failed' | 'qr_ineligible' | 'qr_provider' | 'qr_not_activated' | 'payment_already_completed'
  | 'qr_amount_mismatch' | 'qr_not_found';

/** Server messages (the functions are the contract) mapped to codes. Anything else stays generic. */
const MESSAGE_CODES: readonly [pattern: RegExp, code: QrFailureCode][] = [
  [/request is not ready for payment/i, 'qr_request_closed'],
  [/only payment method for this document/i, 'qr_pickup_only'],
  [/enter total pages before paying/i, 'qr_pages_required'],
  [/no qr ph payment available/i, 'qr_unavailable'],
  [/select qr ph for this request/i, 'qr_method_not_selected'],
  [/being prepared|already being prepared/i, 'qr_preparing'],
  [/below the paymongo minimum/i, 'qr_below_minimum'],
  [/could not be safely closed|could not safely restart/i, 'qr_close_failed'],
  [/not eligible for a qr ph|no longer eligible for a qr ph/i, 'qr_ineligible'],
  [/may not be activated on this account/i, 'qr_not_activated'],
  [/already went through/i, 'payment_already_completed'],
  [/provider amount does not match/i, 'qr_amount_mismatch'],
  [/request not found or not yours|payment not found/i, 'qr_not_found'],
];

export function qrFailureCode(status: number | undefined, message: string | null): QrFailureCode | undefined {
  if (message) for (const [pattern, code] of MESSAGE_CODES) if (pattern.test(message)) return code;
  if (status === 502) return 'qr_provider';
  return undefined;
}

function kindFor(status: number): FailureKind {
  if (status === 401) return 'session';
  if (status === 403) return 'authorization';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status === 400 || status === 422) return 'validation';
  return 'http';
}

type FunctionFailure = { name?: unknown; context?: unknown };

/**
 * Converts a supabase-js function error into a `DataError`. An HTTP answer is a definite
 * outcome whose body message is mapped to a stable code; a transport failure of a write means
 * the reply is lost and the function may have run, so it is `unknown-commit` and the caller
 * reconciles with a read.
 */
async function toFailure(error: unknown, write: boolean): Promise<DataError> {
  const failure = error as FunctionFailure;
  if (failure?.name === 'FunctionsHttpError' && failure.context instanceof Response) {
    const status = failure.context.status;
    let message: string | null = null;
    try {
      const body: unknown = await failure.context.json();
      const text = body && typeof body === 'object' && 'error' in body ? (body as { error: unknown }).error : null;
      message = typeof text === 'string' ? text : null;
    } catch { /* not JSON: the status alone classifies it */ }
    return new DataError(kindFor(status), undefined, status, qrFailureCode(status, message));
  }
  return new DataError(write ? 'unknown-commit' : 'offline');
}

async function call(client: SupabaseClient<Database>, name: string, body: Record<string, string>, write: boolean, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new DataError('cancelled');
  let result: { data: unknown; error: unknown };
  try {
    result = await client.functions.invoke(name, { body, signal });
  } catch (thrown) {
    if (signal?.aborted) throw new DataError('cancelled');
    throw await toFailure(thrown, write);
  }
  if (signal?.aborted) throw new DataError('cancelled');
  if (result.error) throw await toFailure(result.error, write);
  return result.data;
}

const BARE_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const IMAGE_DATA_URI = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * PayMongo returns the QR as bare base64, a data URI or an https URL depending on the account.
 * Anything else (another scheme, a malformed payload) is refused rather than rendered.
 */
export function qrImageSource(value: string): string | null {
  const text = value.trim();
  if (IMAGE_DATA_URI.test(text)) return text;
  if (text.length > 100 && BARE_BASE64.test(text)) return `data:image/png;base64,${text}`;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

const centavos = z.number().int().min(0);
const sourceSchema = z.object({
  paymentId: z.string().uuid(),
  paymentIntentId: z.string().min(1).nullable(),
  qrImageUrl: z.string().min(1),
  expiresAt: z.number().int().positive(),
  documentFeeCentavos: centavos.nullable(),
  amountCentavos: centavos,
});
const createSchema = z.union([z.object({ status: z.literal('paid') }), sourceSchema]);

/** A live QR PH attempt as the server reports it. */
export type QrSource = {
  paymentId: string;
  /** The provider's transaction reference, shown as given. */
  transactionRef: string | null;
  qrImage: string;
  expiresAt: number;
  documentFeeCentavos: number;
  amountCentavos: number;
};
export type CreateResult = { kind: 'source'; source: QrSource } | { kind: 'paid' };

export function toQrSource(value: z.infer<typeof sourceSchema>): QrSource {
  const qrImage = qrImageSource(value.qrImageUrl);
  if (!qrImage) throw new DataError('schema', 'The QR image was not in a supported format.');
  return {
    paymentId: value.paymentId,
    transactionRef: value.paymentIntentId,
    qrImage,
    expiresAt: value.expiresAt,
    documentFeeCentavos: value.documentFeeCentavos ?? value.amountCentavos,
    amountCentavos: value.amountCentavos,
  };
}

export function parseCreate(data: unknown): CreateResult {
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) throw new DataError('schema', 'The server response did not match the expected format.');
  return 'status' in parsed.data ? { kind: 'paid' } : { kind: 'source', source: toQrSource(parsed.data) };
}

const checkSchema = z.object({ status: z.enum(['pending', 'paid', 'expired', 'failed']) });
export type CheckStatus = z.infer<typeof checkSchema>['status'];
export function parseCheck(data: unknown): CheckStatus {
  const parsed = checkSchema.safeParse(data);
  if (!parsed.success) throw new DataError('schema', 'The server response did not match the expected format.');
  return parsed.data.status;
}

const cancelSchema = z.object({ status: z.string().min(1) });
export type CancelStatus = 'cancelled' | 'paid' | 'closed' | 'pending';
export function parseCancel(data: unknown): CancelStatus {
  const parsed = cancelSchema.safeParse(data);
  if (!parsed.success) throw new DataError('schema', 'The server response did not match the expected format.');
  const status = parsed.data.status;
  if (status === 'cancelled') return 'cancelled';
  if (status === 'paid' || status === 'refunded') return 'paid';
  // The attempt is already closed server-side (expired or failed): nothing is left to pay.
  if (status === 'expired' || status === 'failed') return 'closed';
  return 'pending';
}

/**
 * The three payment Edge Functions. Only identifiers are sent: the server derives the amount
 * from the request, so a client can never change what is charged. None of these is retried
 * automatically.
 */
export function qrFunctions(client: SupabaseClient<Database>) {
  return {
    /** Creates the QR, or resumes the identical open one; an already-settled request answers `paid`. */
    async create(requestId: string, signal?: AbortSignal): Promise<CreateResult> {
      return parseCreate(await call(client, 'create-payment-source', { requestId }, true, signal));
    },
    async check(paymentId: string, signal?: AbortSignal): Promise<CheckStatus> {
      return parseCheck(await call(client, 'check-payment-status', { paymentId }, false, signal));
    },
    async cancel(paymentId: string): Promise<CancelStatus> {
      return parseCancel(await call(client, 'cancel-payment', { paymentId }, true));
    },
  };
}
export type QrFunctions = ReturnType<typeof qrFunctions>;
