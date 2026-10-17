/**
 * Resident-facing classification and wording for the services/request/payment journey
 * (Resident web feedback plan §3, RW-LT-06). Pure functions only: they never fetch,
 * retry, or notify. The screen that awaited the operation decides what to show.
 *
 * Classification reads error structure (HTTP status, error class/name, SQLSTATE or token
 * codes), never free-text message substrings, so a lost response is not reported as a
 * definite failure and a raw database token never reaches the page.
 */

/** True when transport or server failure leaves a write outcome unknown: the
 * server may or may not have applied it. PostgREST reports transport loss as status 0 / an
 * empty error code; Edge Function invokes as a FunctionsFetchError; fetch itself throws a
 * TypeError or AbortError. */
export function isNoAnswer(failure: unknown, status?: number): boolean {
  if (status === 0) return true;
  if (failure instanceof TypeError) return true;
  if (typeof failure !== 'object' || failure === null) return false;
  const { name, code, originalError, context } = failure as { name?: unknown; code?: unknown; originalError?: unknown; context?: unknown };
  if (name === 'AbortError' || name === 'FunctionsFetchError' || name === 'FunctionsRelayError') return true;
  // An Edge Function/gateway can fail after accepting the operation.
  if (context instanceof Response && context.status >= 500) return true;
  // Storage wraps a failed fetch as StorageUnknownError({ originalError: TypeError }).
  if (originalError instanceof TypeError) return true;
  // postgrest-js builds a transport failure with `code: ''`; every server answer carries a
  // non-empty PGRST…/SQLSTATE code.
  return code === '';
}

/** A snake_case token raised by a database function (not meant for residents). */
const isToken = (message: string) => /^[a-z][a-z0-9_]*$/.test(message);

export type SubmissionFailureKind = 'validation' | 'rejected' | 'unconfirmed' | 'session';

export interface SubmissionFailure {
  kind: SubmissionFailureKind;
  /** Plain-language text for the inline notice. */
  message: string;
  /** Short toast title (omitted for inline-only validation). */
  title?: string;
}

/**
 * `phase` says how far the attempt got when it failed: `validate` is anything that
 * stopped before a request was sent (nothing reached the server); `upload` and `submit`
 * are network operations.
 */
export function serviceSubmissionFailure(
  failure: unknown,
  phase: 'validate' | 'upload' | 'submit',
  mapped: string,
): SubmissionFailure {
  if (phase === 'validate') return { kind: 'validation', message: mapped };
  const sessionExpired = /sign in again|account changed/i.test(mapped);
  if (sessionExpired) return { kind: 'session', title: 'Please sign in again.', message: mapped };
  const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null;
  // The shared attempt can resolve the write and then fail to read its reference,
  // or reject a changed retry with a plain Error. Neither proves rejection.
  if (isNoAnswer(failure) || (phase === 'submit' && (typeof code !== 'string' || !code))) {
    return phase === 'upload'
      ? {
          kind: 'rejected',
          title: "Couldn't upload your file.",
          message:
            "We couldn't reach the server while uploading. Your details and files are kept here — check your connection, then submit again.",
        }
      : {
          kind: 'unconfirmed',
          title: "We couldn't confirm your request.",
          message:
            "We couldn't confirm that your request was received. It may already be submitted. Submit again to recover it — it won't create a duplicate — or check My Requests before starting another.",
        };
  }
  if (phase === 'upload') {
    // Storage/provider text is never shown; the files stay selected for another try.
    return {
      kind: 'rejected',
      title: "Couldn't upload your file.",
      message: "We couldn't upload your file. Your details and files are kept here — check the file, then submit again.",
    };
  }
  const text = isToken(mapped) ? "We couldn't submit your request. Please check your details, then try again." : mapped;
  return {
    kind: 'rejected',
    title: "Couldn't submit your request.",
    message: text,
  };
}

/** Maps a function-raised error to resident wording. Free-text exceptions that are
 * already written for people (`this request can no longer be cancelled`) pass through;
 * snake_case tokens and anything unknown become the fallback. */
export function plainFunctionMessage(message: string | undefined, fallback: string): string {
  if (!message || isToken(message)) return fallback;
  return message;
}

export type PickupFailure = { uncertain: boolean; message: string };

export function pickupPaymentFailure(error: { message: string }, status: number): PickupFailure {
  if (isNoAnswer(error, status) || status >= 500) {
    return {
      uncertain: true,
      message:
        "We couldn't confirm your pickup payment was recorded. Try again — it won't create a second record — or open My Request to check.",
    };
  }
  switch (error.message) {
    case 'active_online_payment_exists':
      return {
        uncertain: false,
        message: 'A QR PH payment is already in progress for this request. Continue or cancel it from My Request before choosing pickup.',
      };
    case 'request_not_payable':
      return { uncertain: false, message: "This request can't be paid right now. It may be cancelled, completed, or already paid." };
    case 'confirmed_pickup_amount_required':
    case 'request_amount_unavailable':
      return { uncertain: false, message: 'Could not load the request amount. Refresh payment details and try again.' };
    case 'forbidden':
    case 'authentication_required':
      return { uncertain: false, message: "We couldn't confirm this request belongs to your account. Sign in again, then retry." };
    default:
      return { uncertain: false, message: "We couldn't record your pickup payment. Please try again." };
  }
}

export type PaymentMethodFailure = { uncertain: boolean; title: string; message: string };

export function paymentMethodFailure(error: { message: string; code?: string }, status: number): PaymentMethodFailure {
  if (isNoAnswer(error, status) || status >= 500) {
    return {
      uncertain: true,
      title: "We couldn't confirm your choice.",
      message:
        "We couldn't confirm that your payment method was saved. Nothing was charged. Choose it again, or open My Request to check.",
    };
  }
  const lines: Record<string, string> = {
    payment_method_locked: 'A payment is already in progress. Continue or cancel it before changing methods.',
    active_online_payment_exists: 'A payment is already in progress. Continue or cancel it before changing methods.',
    request_not_payable: "This request can't be paid right now. It may be cancelled, completed, or already paid.",
    request_amount_unavailable: 'Could not load the request amount. Refresh payment details and try again.',
  };
  const hit = Object.entries(lines).find(([token]) => error.message.includes(token));
  return {
    uncertain: false,
    title: "Couldn't save your payment method.",
    message: hit ? hit[1] : "We couldn't save your payment method. Please try again.",
  };
}

export type CancelRequestFailure = { uncertain: boolean; title: string; description: string };

export function cancelRequestFailure(error: { message: string; code?: string }, status: number): CancelRequestFailure {
  if (status === 0) {
    return {
      uncertain: true,
      title: "We couldn't confirm the cancellation.",
      description: 'Your request may or may not have been cancelled. Check its status before trying again.',
    };
  }
  return {
    uncertain: false,
    title: "Couldn't cancel your request.",
    description: plainFunctionMessage(error.message, 'Nothing was changed. Please try again.'),
  };
}

/** PostgREST's `.single()` code for "no rows": the record is missing or not visible to
 * this account (the two are deliberately not distinguished). Any other error is a failed
 * read that is worth retrying. */
export function isMissingRow(error: { code?: string } | null): boolean {
  return error === null || error.code === 'PGRST116';
}
