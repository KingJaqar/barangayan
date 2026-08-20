import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * supabase.functions.invoke() surfaces a non-2xx response as a generic
 * FunctionsHttpError ("Edge Function returned a non-2xx status code") — the
 * actual `{ error: "..." }` body our edge functions send (e.g. export's
 * rate-limit message, delete's failure reasons) only lives on error.context,
 * the raw Response. Unwrap it so the UI shows the real message instead of a
 * useless generic one. Ported from resident-android-mobile's settings screen.
 */
export async function toEdgeFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return new Error(body.error);
    } catch {
      // Response wasn't JSON (or already consumed) — fall through to the generic error.
    }
  }
  return error instanceof Error ? error : new Error('Something went wrong. Please try again.');
}
