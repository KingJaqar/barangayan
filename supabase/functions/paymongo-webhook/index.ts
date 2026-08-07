// Subscribed to `source.chargeable` in the PayMongo dashboard (Part G, Step 7). Verifies
// the Paymongo-Signature header, marks the matching `payments` row paid, and lets the
// sync_payments_to_service_request trigger (0007 migration) mirror that onto
// service_requests.payment_status. Uses the service_role key — the only Edge Function in
// this set that needs to, since there's no caller JWT on a webhook — so RLS never gates
// this write; that's exactly why the signature check below isn't optional.
//
// PHASE BOUNDARY (see the plan's Part G2): settlement into the barangay's registered
// bank account happens on PayMongo's own T+1/T+3 schedule, outside this app. Do NOT add
// a disbursement/transfer call here for Phase 1. When Phase 2/3 is ready, the only change
// needed is appending a disbursement API call right after the `paid_at` update below.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAYMONGO_WEBHOOK_SECRET = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function verifySignature(payload: string, signatureHeader: string): Promise<boolean> {
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')));
  const timestamp = parts.t;
  // 'te' is the test-mode signature, 'li' is live-mode — accept whichever PayMongo sent.
  const providedSignature = parts.te ?? parts.li;
  if (!timestamp || !providedSignature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PAYMONGO_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expectedSignature === providedSignature;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('Paymongo-Signature');

  if (!signatureHeader || !(await verifySignature(rawBody, signatureHeader))) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event?.data?.attributes?.type;

  if (eventType !== 'source.chargeable') {
    // Acknowledge and ignore — this function only subscribes to source.chargeable, but
    // PayMongo may send others to the same endpoint depending on dashboard config.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const sourceId = event.data.attributes.data.id;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: payment } = await supabase
    .from('payments')
    .select('id, service_request_id')
    .eq('paymongo_source_id', sourceId)
    .single();

  if (!payment) {
    return new Response(JSON.stringify({ error: 'No matching payment for source' }), { status: 404 });
  }

  await supabase
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payment.id);

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
