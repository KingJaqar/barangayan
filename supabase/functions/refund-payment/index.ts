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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

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
    .select('role, barangay_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only admins can issue refunds' }), { status: 403, headers: corsHeaders });
  }

  const body = await req.json();
  const paymentId = body?.paymentId as string | undefined;
  const reason = VALID_REASONS.includes(body?.reason) ? body.reason : 'requested_by_customer';

  if (!paymentId) {
    return new Response(JSON.stringify({ error: 'Missing paymentId' }), { status: 400, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id, barangay_id, method, status, amount_centavos, paymongo_payment_id, refund_status')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment || payment.barangay_id !== profile.barangay_id) {
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

  if (payment.refund_status !== 'none') {
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

  const paymongoResponse = await fetch('https://refunds-api.paymongo.com/v1/refunds', {
    method: 'POST',
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
  });

  const refund = await paymongoResponse.json();

  if (!paymongoResponse.ok) {
    const errors = (refund as { errors?: { detail?: string }[] } | null)?.errors;
    const detail = Array.isArray(errors)
      ? errors.map((e) => e?.detail).filter(Boolean).join('; ')
      : '';
    return new Response(
      JSON.stringify({ error: detail || 'PayMongo rejected the refund' }),
      { status: 502, headers: corsHeaders },
    );
  }

  const refundAttrs = refund?.data?.attributes ?? {};
  // The resident has to open this to actually receive the money — without it a QRPH
  // refund never reaches them, so persist it rather than only returning it.
  const transferLink = refundAttrs.transfer_link ?? null;
  // PayMongo's initial status is 'processing'; the refund.updated webhook advances it.
  const initialStatus = ['processing', 'refunding', 'succeeded', 'failed'].includes(refundAttrs.status)
    ? refundAttrs.status === 'succeeded'
      ? 'refunded'
      : refundAttrs.status
    : 'pending';

  await supabaseAdmin
    .from('payments')
    .update({
      refund_status: initialStatus,
      refund_amount_centavos: payment.amount_centavos,
      refund_reason: reason,
      refund_transfer_link: transferLink,
      refunded_by: user.id,
    })
    .eq('id', payment.id);

  return new Response(
    JSON.stringify({ paymentId: payment.id, transferLink, status: initialStatus }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
