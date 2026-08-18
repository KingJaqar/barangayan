// Polled every 5s by use-paymongo-source.ts while a QR PH payment is pending, as a
// fallback beside the Realtime subscription on `payments`. Read-only lookup against
// PayMongo's PaymentIntents API — the secret key stays server-side here, same boundary
// as create-payment-source.
//
// QR PH is a PaymentIntent flow, not a Source (see migration 0065) — this used to GET
// /v1/sources/{id}, which could never have resolved a QR PH payment.
//
// S0-3: requires the caller's JWT and verifies they own the payment before looking
// anything up. Accepts `paymentId` (the payments row's uuid) rather than a raw PayMongo
// id — the stored paymongo_payment_intent_id is what's actually queried, so a caller can
// never probe PayMongo state for an intent they don't already have a payments row for.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** PaymentIntent status -> the vocabulary use-paymongo-source.ts already speaks. */
function mapIntentStatus(intentStatus: string): 'pending' | 'paid' | 'expired' | 'failed' {
  switch (intentStatus) {
    case 'succeeded':
      return 'paid';
    case 'cancelled':
      return 'expired';
    case 'awaiting_payment_method':
      // The attach failed or the QR lapsed and PayMongo reset the intent — from the
      // resident's point of view the code they're looking at is no longer usable.
      return 'expired';
    default:
      // awaiting_next_action / processing — the QR is live and unscanned/settling.
      return 'pending';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { paymentId } = await req.json();
  if (!paymentId) {
    return new Response(JSON.stringify({ error: 'paymentId is required' }), { status: 400 });
  }

  // RLS on payments (residents can read payments on their own requests) already scopes
  // this, but resolve ownership explicitly so a wrong-owner request gets a clear 403
  // rather than an ambiguous "not found".
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, paymongo_payment_intent_id, status, service_request:service_requests(resident_id)')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
  }

  const serviceRequest = payment.service_request as unknown as { resident_id: string } | null;
  if (!serviceRequest || serviceRequest.resident_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Already settled by the webhook — no need to spend a PayMongo call confirming it.
  if (payment.status === 'paid' || payment.status === 'refunded') {
    return new Response(JSON.stringify({ status: 'paid' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The resident (or create-payment-source) voided this payment — tell the client it's
  // gone so polling stops, instead of querying PayMongo for an intent we already know we
  // cancelled.
  if (payment.status === 'cancelled') {
    return new Response(JSON.stringify({ status: 'expired' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payment.paymongo_payment_intent_id) {
    return new Response(JSON.stringify({ error: 'Payment has no PayMongo intent yet' }), { status: 422 });
  }

  const response = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${payment.paymongo_payment_intent_id}`,
    { headers: { Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}` } },
  );

  const intent = await response.json();
  if (!response.ok) {
    return new Response(JSON.stringify({ error: intent }), { status: 502 });
  }

  const status = mapIntentStatus(intent?.data?.attributes?.status ?? '');

  // Poll-driven settlement: if PayMongo says succeeded but the webhook hasn't landed
  // (or was never delivered), write it here so the payments row — and, through the
  // 0007/0064 sync trigger, service_requests.payment_status — still reach 'paid'.
  // service_role because residents have no UPDATE policy on payments.
  if (status === 'paid' && payment.status !== 'paid') {
    const paymentsPayload = intent?.data?.attributes?.payments;
    const paymongoPaymentId = Array.isArray(paymentsPayload) ? paymentsPayload[0]?.id : undefined;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        ...(paymongoPaymentId ? { paymongo_payment_id: paymongoPaymentId } : {}),
      })
      .eq('id', payment.id);
  }

  return new Response(JSON.stringify({ status }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
