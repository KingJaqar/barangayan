// Receives PayMongo webhook events and settles the matching `payments` row. Uses the
// service_role key — the only Edge Function in this set that needs to, since there's no
// caller JWT on a webhook — so RLS never gates this write; that's exactly why the
// signature check below isn't optional.
//
// Events to register in the PayMongo dashboard for this endpoint:
//   payment.paid     — QR Ph payment succeeded. Carries the real Payment id (pay_...),
//                      which is the only id the Refunds API accepts.
//   payment.failed   — payment attempt rejected.
//   qrph.expired     — the QR lapsed unscanned (30-minute window).
//   refund.updated   — refunds settle asynchronously; this confirms succeeded/failed.
//
// `source.chargeable` is deliberately NOT part of this set: it belongs to the Sources
// API, which does not support QR Ph at all (see migration 0065). An earlier version of
// this function only handled that event, so no QR Ph payment could ever have been marked
// paid by webhook.
//
// PHASE BOUNDARY: settlement into the barangay's registered bank account happens on
// PayMongo's own T+1/T+3 schedule, outside this app. Do NOT add a disbursement/transfer
// call here for Phase 1.
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

const ack = () =>
  new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

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
  const resource = event?.data?.attributes?.data;
  const attrs = resource?.attributes ?? {};
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  /** Resolves our payments row from whichever PayMongo id this event carries. QR Ph
   * events reference the PaymentIntent; older Sources-era rows are matched by source id
   * so historical data still reconciles. */
  async function findPayment(): Promise<{ id: string; status: string } | null> {
    const intentId = attrs.payment_intent_id ?? resource?.payment_intent_id;
    if (intentId) {
      const { data } = await supabase
        .from('payments')
        .select('id, status')
        .eq('paymongo_payment_intent_id', intentId)
        .maybeSingle();
      if (data) return data;
    }

    const sourceId = attrs.source?.id;
    if (sourceId) {
      const { data } = await supabase
        .from('payments')
        .select('id, status')
        .eq('paymongo_source_id', sourceId)
        .maybeSingle();
      if (data) return data;
    }

    return null;
  }

  if (eventType === 'payment.paid') {
    const payment = await findPayment();
    if (!payment) return ack(); // Not one of ours — acknowledge so PayMongo stops retrying.

    await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        // resource.id is the Payment id (pay_...) — the only id the Refunds API accepts.
        paymongo_payment_id: resource?.id ?? null,
      })
      .eq('id', payment.id);

    return ack();
  }

  if (eventType === 'payment.failed') {
    const payment = await findPayment();
    if (!payment) return ack();

    // Never downgrade an already-settled row: a later failed attempt on the same intent
    // must not undo a successful payment.
    if (payment.status !== 'paid' && payment.status !== 'refunded') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
    }
    return ack();
  }

  if (eventType === 'qrph.expired') {
    const payment = await findPayment();
    if (!payment) return ack();

    if (payment.status === 'pending') {
      await supabase.from('payments').update({ status: 'expired' }).eq('id', payment.id);
    }
    return ack();
  }

  if (eventType === 'refund.updated') {
    const paymongoPaymentId = attrs.payment_id;
    if (!paymongoPaymentId) return ack();

    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('paymongo_payment_id', paymongoPaymentId)
      .maybeSingle();

    if (!payment) return ack();

    // QRPH refunds report processing -> refunding -> succeeded/failed (migration 0065).
    const refundStatus = attrs.status as string | undefined;

    if (refundStatus === 'succeeded') {
      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          refund_status: 'refunded',
          refunded_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
    } else if (refundStatus === 'failed') {
      await supabase.from('payments').update({ refund_status: 'failed' }).eq('id', payment.id);
    } else if (refundStatus === 'processing' || refundStatus === 'refunding') {
      await supabase.from('payments').update({ refund_status: refundStatus }).eq('id', payment.id);
    }

    return ack();
  }

  // Acknowledge and ignore any other event type — PayMongo may send others to the same
  // endpoint depending on dashboard config.
  return ack();
});
