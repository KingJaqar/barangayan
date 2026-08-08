// Creates a PayMongo QR Ph source for a service_request's fee and stores its id on a
// `payments` row. Holds the PayMongo secret key (Edge Function secret, never shipped to
// the mobile app) — see the plan's Part G for the full setup guide. Only ever called from
// use-paymongo-source.ts, itself only mounted once EXPO_PUBLIC_QRPH_SETTLEMENT_READY is
// true on the client — this function works in PayMongo sandbox regardless of that flag,
// so it can be exercised end-to-end before the real cutover.
//
// S0-2: the fee is never trusted from the client. The caller supplies only `requestId`;
// the amount and description are derived server-side from document_types.fee_centavos
// joined through the service_request, and the request must already be `in_progress`.
// The payments row is inserted with the service_role key since residents no longer have
// an INSERT policy on `payments` (see migration 0017) — this function is the only writer.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  // Caller's own JWT, not service_role — used only to resolve identity and to read the
  // service_request under RLS, so this can only ever act on a request the caller owns.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { requestId } = await req.json();
  if (!requestId) {
    return new Response(JSON.stringify({ error: 'Missing requestId' }), { status: 400 });
  }

  // Fee and description are derived server-side — never accepted from the client.
  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select('id, barangay_id, resident_id, status, document_type:document_types(name, fee_centavos)')
    .eq('id', requestId)
    .single();

  if (requestError || !request || request.resident_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Request not found or not yours' }), { status: 404 });
  }

  if (request.status !== 'in_progress') {
    return new Response(JSON.stringify({ error: 'Request is not ready for payment' }), { status: 422 });
  }

  const documentType = request.document_type as unknown as { name: string; fee_centavos: number } | null;
  if (!documentType) {
    return new Response(JSON.stringify({ error: 'Document type not found' }), { status: 404 });
  }

  const amountCentavos = documentType.fee_centavos;
  const description = documentType.name;

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

  // service_role required: residents have no INSERT policy on payments (migration 0017).
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: paymentRow, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert({
      service_request_id: requestId,
      barangay_id: request.barangay_id,
      method: 'qrph',
      amount_centavos: amountCentavos,
      status: 'pending',
      paymongo_source_id: source.data.id,
    })
    .select('id')
    .single();

  if (insertError || !paymentRow) {
    return new Response(JSON.stringify({ error: 'Failed to record payment' }), { status: 500 });
  }

  // paymentId (the payments row's own uuid) is what check-payment-status expects —
  // it's what the client polls with, never the raw PayMongo sourceId (see S0-3).
  return new Response(JSON.stringify({ ...source, paymentId: paymentRow.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
