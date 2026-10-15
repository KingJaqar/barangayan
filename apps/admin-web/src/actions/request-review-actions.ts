'use server';

import type { Tables } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'requirements' | 'fee_centavos'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name' | 'mobile_number' | 'home_address'> | null;
};

export async function loadRequestReview(requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error('Invalid request.');
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Your session expired. Sign in again.');
  const { data: actor } = await supabase.from('profiles').select('role,deleted_at').eq('id', user.id).single();
  if (actor?.role !== 'admin' || actor.deleted_at) throw new Error('An active administrator account is required.');

  const { data, error: requestError } = await supabase
    .from('service_requests')
    .select('*, document_types(name, requirements, fee_centavos), profiles!service_requests_resident_id_fkey(full_name, mobile_number, home_address)')
    .eq('id', requestId)
    .is('deleted_at', null)
    .maybeSingle();

  if (requestError) throw new Error('Could not load request review. Please retry.');
  if (!data) return null;

  const request = data as unknown as ServiceRequest;
  const [{ data: evidence, error: evidenceError }, { data: attachments, error: attachmentsError }] = await Promise.all([
    request.approved_id_submission_id ? supabase.from('id_submissions').select('*').eq('id', request.approved_id_submission_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from('request_attachments').select('*').eq('request_id', request.id),
  ]);
  if (evidenceError || attachmentsError) throw new Error('Could not load request evidence. Please retry.');
  const evidenceImages = evidence ? await Promise.all([evidence.front_path, evidence.back_path].filter((path): path is string => !!path).map(async path => {
    const { data: signed, error } = await supabase.storage.from('id-documents').createSignedUrl(path, 600);
    return { url: signed?.signedUrl, error: error?.message };
  })) : [];
  const files = await Promise.all((attachments ?? []).map(async file => {
    const { data: signed, error } = await supabase.storage.from('request-attachments').createSignedUrl(file.object_path, 600);
    return { ...file, url: signed?.signedUrl, error: error?.message };
  }));

  // Refund action needs the actual payments row (id, refund_status) — a request only
  // ever has one, since create-payment-source/the COD screen are idempotent about it.
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select(
      'id, method, status, amount_centavos, document_fee_centavos, refund_status, refund_transfer_link',
    )
    .eq('service_request_id', requestId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) throw new Error('Could not load payment details. Please retry.');
  return { request, evidence, evidenceImages, files, payment };
}
