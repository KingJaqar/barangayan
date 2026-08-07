// Creates a PayMongo QR Ph source for a service_request's fee and stores its id on a
// `payments` row. Holds the PayMongo secret key (Edge Function secret, never shipped to
// the mobile app) — see the plan's Part G for the full setup guide. Only ever called from
// use-paymongo-source.ts, itself only mounted once EXPO_PUBLIC_QRPH_SETTLEMENT_READY is
// true on the client — this function works in PayMongo sandbox regardless of that flag,
// so it can be exercised end-to-end before the real cutover.
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

  // Caller's own JWT, not service_role — RLS still applies to the payments insert below,
  // so this can only ever act on a service_request the caller actually owns.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { requestId, amountCentavos, description } = await req.json();

  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select('id, barangay_id, resident_id')
    .eq('id', requestId)
    .single();

  if (requestError || !request || request.resident_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Request not found or not yours' }), { status: 404 });
  }

  const paymongoResponse = await fetch('https://api.paymongo.com/v1/sources', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountCentavos,
          currency: 'PHP',
          type: 'qrph',
          redirect: {
            success: `barangayan://payment/success?requestId=${requestId}`,
            failed: `barangayan://payment/failed?requestId=${requestId}`,
          },
          description,
          billing: { name: 'Barangayan Resident' },
        },
      },
    }),
  });

  const source = await paymongoResponse.json();

  if (!paymongoResponse.ok) {
    return new Response(JSON.stringify({ error: source }), { status: 502 });
  }

  await supabase.from('payments').insert({
    service_request_id: requestId,
    barangay_id: request.barangay_id,
    method: 'qrph',
    amount_centavos: amountCentavos,
    status: 'pending',
    paymongo_source_id: source.data.id,
  });

  return new Response(JSON.stringify(source), {
    headers: { 'Content-Type': 'application/json' },
  });
});
