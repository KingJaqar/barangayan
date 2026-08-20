// Lets a resident cancel their own pending QR PH payment attempt — e.g. they opened
// the QR screen but changed their mind, or want to retry with a fresh code. Only
// 'pending' payments can be cancelled; anything already paid/expired/failed/cancelled
// is left alone.
//
// Mirrors check-payment-status.ts's auth/ownership shape: caller's own JWT resolves
// identity and (via RLS) read access, service_role is only used for the actual write
// since residents have no UPDATE policy on payments (migration 0007).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const { paymentId } = await req.json();
  if (!paymentId) {
    return new Response(JSON.stringify({ error: 'paymentId is required' }), { status: 400, headers: corsHeaders });
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, status, paymongo_payment_intent_id, service_request:service_requests(resident_id)')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: corsHeaders });
  }

  const serviceRequest = payment.service_request as unknown as { resident_id: string } | null;
  if (!serviceRequest || serviceRequest.resident_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  // Already settled/terminal — nothing to cancel. Treat as a no-op success rather than
  // an error so a resident who taps "Cancel" right as the QR is scanned just sees the
  // real (paid) state on next screen refresh instead of a confusing failure.
  if (payment.status !== 'pending') {
    return new Response(JSON.stringify({ status: payment.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Best-effort: void the PaymentIntent on PayMongo's side too, so the QR the resident
  // was shown stops being scannable. If PayMongo refuses (e.g. it already succeeded a
  // moment ago), fall through and let check-payment-status/the webhook be the source of
  // truth instead of cancelling a payment that actually went through.
  if (payment.paymongo_payment_intent_id) {
    const cancelResponse = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${payment.paymongo_payment_intent_id}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { attributes: { cancellation_reason: 'requested_by_customer' } } }),
      },
    );

    if (!cancelResponse.ok) {
      const body = await cancelResponse.json().catch(() => null);
      const status = body?.data?.attributes?.status;
      // "already succeeded" is the one failure mode that means don't cancel locally —
      // any other rejection (already cancelled, already expired) is fine to mirror.
      if (status === 'succeeded') {
        return new Response(
          JSON.stringify({ error: 'This payment already went through — refresh to see it.' }),
          { status: 409, headers: corsHeaders },
        );
      }
    }
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('id', paymentId)
    .eq('status', 'pending');

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to cancel payment' }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ status: 'cancelled' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
