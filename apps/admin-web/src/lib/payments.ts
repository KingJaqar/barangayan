import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type BrowserSupabase = SupabaseClient<Database>;

interface MarkPaymentCollectedResult {
  error: string | null;
  /** The affected payments row's id, so a caller can log a meaningful `entityId`. Null
   * when the call failed before an id was known. */
  paymentId: string | null;
  /** True when this call inserted a brand-new payments row (the edge case below) rather
   * than updating an existing pending one — lets a caller log `create` vs `status_change`. */
  wasCreate: boolean;
}

/** Marks a request's pickup payment as collected. Extracted out of
 * RequestStatusActions so the admin Transactions screen's "Mark as paid" inline edit can
 * call the exact same upsert-like logic (existing pending row -> update; no row yet ->
 * build one from the document type's fee) instead of duplicating it. */
export async function markPaymentCollected(
  supabase: BrowserSupabase,
  requestId: string,
): Promise<MarkPaymentCollectedResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing, error: lookupError } = await supabase
    .from('payments')
    .select('id')
    .eq('service_request_id', requestId)
    .maybeSingle();

  if (lookupError) return { error: lookupError.message, paymentId: null, wasCreate: false };

  if (existing) {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), collected_by: user?.id })
      .eq('id', existing.id);
    return { error: error?.message ?? null, paymentId: existing.id, wasCreate: false };
  }

  // Edge case: a resident never visited the pickup-payment confirmation screen (which
  // normally creates this row) but an admin is marking payment collected anyway — build
  // the payments row here instead of failing.
  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select('barangay_id, document_types(fee_centavos)')
    .eq('id', requestId)
    .single();

  if (requestError || !request) {
    return { error: requestError?.message ?? 'Request not found', paymentId: null, wasCreate: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('payments')
    .insert({
      service_request_id: requestId,
      barangay_id: request.barangay_id,
      method: 'pickup',
      amount_centavos: request.document_types?.fee_centavos ?? 0,
      status: 'paid',
      paid_at: new Date().toISOString(),
      collected_by: user?.id,
    })
    .select('id')
    .single();

  return { error: insertError?.message ?? null, paymentId: inserted?.id ?? null, wasCreate: true };
}
