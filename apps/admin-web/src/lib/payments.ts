import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type BrowserSupabase = SupabaseClient<Database>;

/** Marks a request's pickup payment as collected. Extracted out of
 * RequestStatusActions so the admin Transactions screen's "Mark as paid" inline edit can
 * call the exact same upsert-like logic (existing pending row -> update; no row yet ->
 * build one from the document type's fee) instead of duplicating it. */
export async function markPaymentCollected(
  supabase: BrowserSupabase,
  requestId: string,
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing, error: lookupError } = await supabase
    .from('payments')
    .select('id')
    .eq('service_request_id', requestId)
    .maybeSingle();

  if (lookupError) return { error: lookupError.message };

  if (existing) {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), collected_by: user?.id })
      .eq('id', existing.id);
    return { error: error?.message ?? null };
  }

  // Edge case: a resident never visited the pickup-payment confirmation screen (which
  // normally creates this row) but an admin is marking payment collected anyway — build
  // the payments row here instead of failing.
  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select('barangay_id, document_types(fee_centavos)')
    .eq('id', requestId)
    .single();

  if (requestError || !request) return { error: requestError?.message ?? 'Request not found' };

  const { error: insertError } = await supabase.from('payments').insert({
    service_request_id: requestId,
    barangay_id: request.barangay_id,
    method: 'pickup',
    amount_centavos: request.document_types?.fee_centavos ?? 0,
    status: 'paid',
    paid_at: new Date().toISOString(),
    collected_by: user?.id,
  });

  return { error: insertError?.message ?? null };
}
