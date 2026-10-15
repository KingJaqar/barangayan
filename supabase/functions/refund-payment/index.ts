// Admin-triggered full-amount refund of a paid QR PH transaction, via PayMongo's
// Refunds API. Part of the "instant payment + refunds" plan: since create-payment-source
// no longer gates on admin review (see that function's comment), a resident can pay
// before a request is rejected/cancelled — this is how staff undo that.
//
// Full-amount only (no partial refunds) per the plan. Refunds settle asynchronously on
// PayMongo's side; this function only submits the request and marks refund_status
// 'pending' — the paymongo-webhook function's `refund.updated` handler is what confirms
// 'refunded'/'failed' once PayMongo actually processes it.
//
// QRPH refunds use a SEPARATE host (refunds-api.paymongo.com), not the main api. host,
// and they are not credited back silently: PayMongo returns a `transfer_link` the payer
// must open to claim the money (valid ~3 days). That link is stored on the payments row
// so staff can hand it to the resident — a refund is not "done" when this returns.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_REASONS = ['duplicate', 'fraudulent', 'requested_by_customer', 'others'];
const reply = (error: string, status: number) => new Response(JSON.stringify({ error }), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
  }

  // Caller's own JWT — used only to resolve identity/role, never service_role, so this
  // can never be invoked as anyone but the authenticated caller themselves.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // profiles RLS ("residents can read their own profile") allows any authenticated user
  // — admin or not — to read their own row, which is all this needs.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, barangay_id, deleted_at')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || profile.deleted_at) {
    return new Response(JSON.stringify({ error: 'Only admins can issue refunds' }), { status: 403, headers: corsHeaders });
  }

  let body;
  try { body = await req.json(); }
  catch { return reply('Enter a valid refund request.', 400); }
  const paymentId = body?.paymentId as string | undefined;
  const reason = VALID_REASONS.includes(body?.reason) ? body.reason : 'requested_by_customer';

  if (typeof paymentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
    return new Response(JSON.stringify({ error: 'Missing paymentId' }), { status: 400, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id, barangay_id, method, status, amount_centavos, paymongo_payment_id, refund_status, deleted_at')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment || payment.deleted_at || payment.barangay_id !== profile.barangay_id) {
    return new Response(JSON.stringify({ error: 'Payment not found in your barangay' }), { status: 404, headers: corsHeaders });
  }

  if (payment.method !== 'qrph') {
    return new Response(
      JSON.stringify({ error: 'Only QR PH payments can be refunded through PayMongo' }),
      { status: 422, headers: corsHeaders },
    );
  }

  if (payment.status !== 'paid') {
    return new Response(JSON.stringify({ error: 'Only a paid payment can be refunded' }), { status: 422, headers: corsHeaders });
  }
  if (!Number.isSafeInteger(payment.amount_centavos) || payment.amount_centavos < 100) {
    return reply('The minimum refundable payment is PHP 1.00.', 422);
  }

  if (!['none', 'failed'].includes(payment.refund_status)) {
    return new Response(JSON.stringify({ error: 'This payment already has a refund on record' }), {
      status: 422,
      headers: corsHeaders,
    });
  }

  if (!payment.paymongo_payment_id) {
    // Missing because the payment.paid webhook event hasn't landed yet (or wasn't
    // registered in the PayMongo dashboard) — source.chargeable alone never gives us a
    // refundable payment id.
    return new Response(
      JSON.stringify({
        error:
          'No PayMongo payment id on record yet for this transaction — refunds are not possible until the payment.paid webhook event has been received. Try again shortly, or check the webhook configuration.',
      }),
      { status: 422, headers: corsHeaders },
    );
  }

  // Claim the attempt before contacting PayMongo. Simultaneous clicks from other
  // tabs/admins cannot issue a second refund for the same payment.
  const { data: claimed, error: claimError } = await supabaseAdmin.from('payments')
    .update({ refund_status: 'pending', refunded_by: user.id, refund_reason: reason,
      refund_amount_centavos: payment.amount_centavos })
    .eq('id', payment.id).eq('status', 'paid').eq('refund_status', payment.refund_status)
    .is('deleted_at', null).select('id').maybeSingle();
  if (claimError) return reply('Could not start the refund. Please retry.', 503);
  if (!claimed) return reply('This payment changed or a refund is already in progress. Refresh the table.', 409);

  let paymongoResponse;
  try { paymongoResponse = await fetch('https://refunds-api.paymongo.com/v1/refunds', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          payment_id: payment.paymongo_payment_id,
          amount: payment.amount_centavos,
          reason,
          notes: `Barangayan refund for payment ${payment.id}`,
        },
      },
    }),
  }); } catch {
    // No response does not prove that PayMongo rejected the attempt. Preserve the
    // pending claim so retrying cannot issue another refund with an unknown outcome.
    return reply('Refund submission could not be confirmed. Check the payment status before retrying.', 502);
  }

  let refund;
  try { refund = await paymongoResponse.json(); }
  catch { return reply('Refund submission could not be confirmed. Check the payment status before retrying.', 502); }

  if (!paymongoResponse.ok) {
    // An explicit rejection may be retried. Server failures have an uncertain
    // outcome, so keep their pending claim until reconciliation confirms it.
    if (paymongoResponse.status < 500) {
      const { error: releaseError } = await supabaseAdmin.from('payments')
        .update({ refund_status: payment.refund_status }).eq('id', payment.id).eq('refund_status', 'pending');
      if (releaseError) return reply('The refund was rejected, but its status could not be refreshed. Check the payment before retrying.', 503);
    }
    const errors = (refund as { errors?: { detail?: string }[] } | null)?.errors;
    const detail = Array.isArray(errors)
      ? errors.map((e) => e?.detail).filter(Boolean).join('; ')
      : '';
    return new Response(
      JSON.stringify({ error: detail || 'PayMongo rejected the refund' }),
      { status: 502, headers: corsHeaders },
    );
  }

  const refundAttrs = refund?.data?.attributes;
  if (!refund?.data?.id || !refundAttrs) return reply('Refund submission could not be confirmed. Check the payment status before retrying.', 502);
  // The resident has to open this to actually receive the money — without it a QRPH
  // refund never reaches them, so persist it rather than only returning it.
  const transferLink = refundAttrs.transfer_link ?? null;
  // PayMongo's initial status is 'processing'; the refund.updated webhook advances it.
  const initialStatus = ['processing', 'refunding', 'succeeded', 'failed'].includes(refundAttrs.status)
    ? refundAttrs.status === 'succeeded'
      ? 'refunded'
      : refundAttrs.status
    : 'pending';

  const { data: saved, error: saveError } = await supabaseAdmin
    .from('payments')
    .update({
      refund_status: initialStatus,
      refund_amount_centavos: payment.amount_centavos,
      refund_reason: reason,
      refund_transfer_link: transferLink,
      refunded_by: user.id,
      ...(initialStatus === 'refunded' ? { status: 'refunded', refunded_at: new Date().toISOString() } : {}),
    })
    .eq('id', payment.id).eq('refund_status', 'pending').select('id,refund_status,refund_transfer_link').maybeSingle();
  if (saveError) return reply('PayMongo accepted the refund, but its details could not be saved. Check the payment status before retrying.', 503);
  if (!saved) {
    // A webhook may settle the payment before the API response arrives. Never
    // overwrite that newer status with the response's initial status.
    const { data: settled, error: settledError } = await supabaseAdmin.from('payments')
      .select('id,refund_status,refund_transfer_link').eq('id', payment.id).maybeSingle();
    if (settledError || !settled) return reply('PayMongo accepted the refund, but the payment could not be confirmed. Check its status before retrying.', 503);
    return new Response(JSON.stringify({ paymentId: payment.id, transferLink: settled.refund_transfer_link, status: settled.refund_status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(
    JSON.stringify({ paymentId: payment.id, transferLink, status: initialStatus }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
  } catch {
    return reply('The refund could not be completed. Check the payment status before retrying.', 503);
  }
});
