// Polled every 5s by use-paymongo-source.ts while a QR Ph payment is pending. Read-only
// lookup against PayMongo's Sources API — the secret key stays server-side here, same
// boundary as create-payment-source.
//
// S0-3: requires the caller's JWT and verifies they own the payment before looking
// anything up. Accepts `paymentId` (the payments row's uuid) instead of a raw PayMongo
// sourceId — the stored paymongo_source_id is what's actually queried, so a caller can
// never probe PayMongo state for a source they don't already have a payments row for.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    .select('id, paymongo_source_id, status, service_request:service_requests(resident_id)')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
  }

  const serviceRequest = payment.service_request as unknown as { resident_id: string } | null;
  if (!serviceRequest || serviceRequest.resident_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (!payment.paymongo_source_id) {
    return new Response(JSON.stringify({ error: 'Payment has no source yet' }), { status: 422 });
  }

  const response = await fetch(`https://api.paymongo.com/v1/sources/${payment.paymongo_source_id}`, {
    headers: { Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}` },
  });

  const source = await response.json();
  if (!response.ok) {
    return new Response(JSON.stringify({ error: source }), { status: 502 });
  }

  return new Response(JSON.stringify({ status: source.data.attributes.status }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
