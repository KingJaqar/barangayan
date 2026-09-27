// Creates a PayMongo QR PH charge for a service_request's fee and stores it on a
// `payments` row. Holds the PayMongo secret key (Edge Function secret, never shipped to
// the mobile app).
//
// QR PH is a PaymentIntent flow, NOT the Sources API. An earlier version of this
// function called POST /v1/sources with type='qrph'; that endpoint only supports
// gcash/grab_pay/paymaya, so PayMongo rejected every request and the app showed
// "Could not start a QR PH payment". The correct three-step flow (see migration 0065):
//   1. POST /v1/payment_intents      payment_method_allowed: ['qrph']
//   2. POST /v1/payment_methods      type: 'qrph'
//   3. POST /v1/payment_intents/{id}/attach  -> next_action.code.image_url
// The function name is kept for continuity with the deployed function + mobile caller.
//
// S0-2: the fee is never trusted from the client. The caller supplies only `requestId`;
// the amount and description are derived server-side from document_types.fee_centavos,
// joined through the service_request. The payments row is inserted with the service_role
// key since residents have no INSERT policy on `payments` (migration 0017) — this
// function is the only writer.
//
// Payment is intentionally allowed as soon as the request exists (any status except
// 'cancelled'/'completed') — no admin review gate. See migration 0064 for why refunds
// exist: a resident can pay before an admin has looked at the request.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

function authHeaders() {
  return {
    Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}`,
    'Content-Type': 'application/json',
  };
}

/** PayMongo errors come back as { errors: [{ detail, code }] }. Flatten to one string so
 * the mobile client can show something actionable instead of "[object Object]". */
function paymongoErrorMessage(body: unknown, fallback: string): string {
  const errors = (body as { errors?: { detail?: string }[] } | null)?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const detail = errors.map((e) => e?.detail).filter(Boolean).join('; ');
    if (detail) return detail;
  }
  return fallback;
}

async function cancelPaymongoIntent(intentId: string): Promise<boolean> {
  try {
    const response = await fetch(`${PAYMONGO_BASE}/payment_intents/${intentId}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        data: { attributes: { cancellation_reason: 'requested_by_customer' } },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const { requestId } = await req.json();
  if (!requestId) {
    return new Response(JSON.stringify({ error: 'Missing requestId' }), { status: 400, headers: corsHeaders });
  }

  // Fee and description are derived server-side — never accepted from the client.
  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select(
      'id, barangay_id, resident_id, status, payment_status, payment_method, reference_number, document_type:document_types(name, fee_centavos)',
    )
    .eq('id', requestId)
    .single();

  // A failed query and a genuine miss are NOT the same thing, and collapsing them into
  // one 404 is what hid this outage: after migration 0082 dropped
  // barangays.shipping_fee_centavos, this select (which still asked for it) failed with
  // PostgREST 42703, and the resident was shown 'Request not found or not yours' — a
  // message that points every investigation at RLS and ownership instead of the schema.
  // PGRST116 is PostgREST's 'no rows for .single()'; anything else is a real fault.
  if (requestError && requestError.code !== 'PGRST116') {
    console.error('service_requests lookup failed', requestError);
    return new Response(
      JSON.stringify({ error: 'Could not load this request. Please try again.' }),
      { status: 500, headers: corsHeaders },
    );
  }
  if (!request || request.resident_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Request not found or not yours' }), { status: 404, headers: corsHeaders });
  }

  // service_role is used only after resident ownership has been established. Besides
  // trusting the fast-glance field, consult the ledger so older inconsistent request
  // rows cannot mint a second payable intent after settlement.
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: paidPayments, error: paidPaymentsError } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('service_request_id', requestId)
    .eq('status', 'paid')
    .limit(1);

  if (paidPaymentsError) {
    console.error('paid payment lookup failed', paidPaymentsError);
    return new Response(JSON.stringify({ error: 'Could not verify payment status. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (request.payment_status === 'paid' || (paidPayments?.length ?? 0) > 0) {
    return new Response(JSON.stringify({ status: 'paid' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // No admin-review gate: a resident can pay as soon as the request exists. Only block
  // terminal states where payment no longer makes sense.
  if (request.status === 'cancelled' || request.status === 'completed') {
    return new Response(JSON.stringify({ error: 'Request is not ready for payment' }), { status: 422, headers: corsHeaders });
  }

  if (request.payment_method !== 'qrph') {
    return new Response(JSON.stringify({ error: 'Select QR Ph for this request before starting a QR payment.' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Resume check: reuse an existing, still-valid pending QR instead of minting a new
  // one. This is what makes the QR "persistent" — reopening this screen (or the app)
  // must show the identical QR and the same countdown, not a fresh 30-minute window.
  const { data: pendingRows, error: pendingError } = await supabaseAdmin
    .from('payments')
    .select(
      'id, status, created_at, qrph_creation_key, paymongo_payment_intent_id, qr_image_url, expires_at, document_fee_centavos, amount_centavos',
    )
    .eq('service_request_id', requestId)
    .eq('method', 'qrph')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (pendingError) {
    console.error('pending payment lookup failed', pendingError);
    return new Response(JSON.stringify({ error: 'Could not load the existing payment. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  const resumable = pendingRows?.find(
    (row) => row.qr_image_url && row.expires_at && new Date(row.expires_at).getTime() > now,
  );

  if (resumable?.qr_image_url && resumable.expires_at) {
    return new Response(
      JSON.stringify({
        paymentId: resumable.id,
        paymentIntentId: resumable.paymongo_payment_intent_id,
        qrImageUrl: resumable.qr_image_url,
        expiresAt: new Date(resumable.expires_at).getTime(),
        documentFeeCentavos: resumable.document_fee_centavos,
        amountCentavos: resumable.amount_centavos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // A reservation with no finished QR means another invocation is preparing one.
  // Do not create another intent. Old reservations are abandoned only after their
  // persisted PayMongo intent has been cancelled (or when no intent was ever saved).
  const creating = pendingRows?.find((row) => row.qrph_creation_key);
  if (creating) {
    const reservationAgeMs = now - new Date(creating.created_at).getTime();
    if (reservationAgeMs < 2 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'A QR Ph payment is being prepared. Please wait a moment and try again.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (creating.paymongo_payment_intent_id) {
      const cancelled = await cancelPaymongoIntent(creating.paymongo_payment_intent_id);
      if (!cancelled) {
        const { data: settledRows } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('service_request_id', requestId)
          .eq('status', 'paid')
          .limit(1);
        if ((settledRows?.length ?? 0) > 0) {
          return new Response(JSON.stringify({ status: 'paid' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'An earlier QR payment could not be safely closed. Please contact the barangay office.' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { error: abandonError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'cancelled', qrph_creation_key: null })
      .eq('id', creating.id)
      .eq('status', 'pending');
    if (abandonError) {
      console.error('stale QR reservation cleanup failed', abandonError);
      return new Response(JSON.stringify({ error: 'Could not safely restart this QR payment. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Retire expired QR rows before creating a replacement. The status predicate keeps
  // a webhook-confirmed payment from being overwritten by this cleanup.
  for (const row of pendingRows ?? []) {
    if (!row.qr_image_url || !row.expires_at || new Date(row.expires_at).getTime() > now) continue;
    await supabaseAdmin
      .from('payments')
      .update({ status: 'expired' })
      .eq('id', row.id)
      .eq('status', 'pending');
  }

  const documentType = request.document_type as unknown as { name: string; fee_centavos: number } | null;
  if (!documentType) {
    return new Response(JSON.stringify({ error: 'Document type not found' }), { status: 404, headers: corsHeaders });
  }

  const documentFeeCentavos = documentType.fee_centavos;
  const amountCentavos = documentFeeCentavos;
  const description = `${documentType.name} — ${request.reference_number}`;

  if (amountCentavos < 100) {
    return new Response(
      JSON.stringify({ error: 'Amount is below the PayMongo minimum (PHP 1.00)' }),
      { status: 422, headers: corsHeaders },
    );
  }

  // Recheck immediately before reserving. The unique reservation index added by
  // migration 0093 serializes competing invocations even when both passed the earlier
  // lookup; an already-paid request never receives a new PayMongo intent.
  const { data: latestRequest, error: latestRequestError } = await supabaseAdmin
    .from('service_requests')
    .select('resident_id, status, payment_status, payment_method')
    .eq('id', requestId)
    .maybeSingle();
  if (latestRequestError || !latestRequest || latestRequest.resident_id !== user.id) {
    console.error('final request eligibility lookup failed', latestRequestError);
    return new Response(JSON.stringify({ error: 'Could not verify this request. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (latestRequest.payment_status === 'paid') {
    return new Response(JSON.stringify({ status: 'paid' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (
    latestRequest.status === 'cancelled' ||
    latestRequest.status === 'completed' ||
    latestRequest.payment_method !== 'qrph'
  ) {
    return new Response(JSON.stringify({ error: 'Request is not eligible for a QR Ph payment.' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from('payments')
    .insert({
      service_request_id: requestId,
      barangay_id: request.barangay_id,
      method: 'qrph',
      amount_centavos: amountCentavos,
      document_fee_centavos: documentFeeCentavos,
      status: 'pending',
      qrph_creation_key: requestId,
    })
    .select('id')
    .single();

  if (reservationError || !reservation) {
    if (reservationError?.code === '23505') {
      const { data: concurrentRows } = await supabaseAdmin
        .from('payments')
        .select('id, paymongo_payment_intent_id, qr_image_url, expires_at, document_fee_centavos, amount_centavos')
        .eq('service_request_id', requestId)
        .eq('method', 'qrph')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      const concurrentQr = concurrentRows?.find(
        (row) => row.qr_image_url && row.expires_at && new Date(row.expires_at).getTime() > Date.now(),
      );
      if (concurrentQr?.qr_image_url && concurrentQr.expires_at) {
        return new Response(
          JSON.stringify({
            paymentId: concurrentQr.id,
            paymentIntentId: concurrentQr.paymongo_payment_intent_id,
            qrImageUrl: concurrentQr.qr_image_url,
            expiresAt: new Date(concurrentQr.expires_at).getTime(),
            documentFeeCentavos: concurrentQr.document_fee_centavos,
            amountCentavos: concurrentQr.amount_centavos,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: 'A QR Ph payment is already being prepared. Please wait and try again.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('QR payment reservation failed', reservationError);
    return new Response(JSON.stringify({ error: 'Could not reserve this payment. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: postReservationRequest, error: postReservationRequestError } = await supabaseAdmin
    .from('service_requests')
    .select('resident_id, payment_status, status, payment_method')
    .eq('id', requestId)
    .maybeSingle();
  const { data: postReservationPaidRows, error: postReservationPaidError } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('service_request_id', requestId)
    .eq('status', 'paid')
    .limit(1);
  if (postReservationRequestError || postReservationPaidError || !postReservationRequest) {
    console.error('post-reservation payment eligibility lookup failed', {
      postReservationRequestError,
      postReservationPaidError,
    });
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', qrph_creation_key: null })
      .eq('id', reservation.id)
      .eq('status', 'pending');
    return new Response(JSON.stringify({ error: 'Could not verify payment eligibility. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (postReservationRequest.resident_id !== user.id) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'cancelled', qrph_creation_key: null })
      .eq('id', reservation.id)
      .eq('status', 'pending');
    return new Response(JSON.stringify({ error: 'Request not found or not yours' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (
    postReservationRequest.payment_status === 'paid' ||
    (postReservationPaidRows?.length ?? 0) > 0
  ) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'cancelled', qrph_creation_key: null })
      .eq('id', reservation.id)
      .eq('status', 'pending');
    return new Response(JSON.stringify({ status: 'paid' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (
    postReservationRequest.status === 'cancelled' ||
    postReservationRequest.status === 'completed' ||
    postReservationRequest.payment_method !== 'qrph'
  ) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'cancelled', qrph_creation_key: null })
      .eq('id', reservation.id)
      .eq('status', 'pending');
    return new Response(JSON.stringify({ error: 'Request is no longer eligible for a QR Ph payment.' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  async function releaseReservation(status: 'failed' | 'cancelled') {
    const { error } = await supabaseAdmin
      .from('payments')
      .update({ status, qrph_creation_key: null })
      .eq('id', reservation.id)
      .eq('status', 'pending');
    if (error) console.error('QR payment reservation cleanup failed', error);
  }

  // ── Step 1: PaymentIntent ────────────────────────────────────────────────────
  const intentResponse = await fetch(`${PAYMONGO_BASE}/payment_intents`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountCentavos,
          currency: 'PHP',
          payment_method_allowed: ['qrph'],
          description,
          metadata: { request_id: requestId, reference_number: request.reference_number },
        },
      },
    }),
  });

  const intent = await intentResponse.json();
  if (!intentResponse.ok) {
    await releaseReservation('failed');
    return new Response(
      JSON.stringify({ error: paymongoErrorMessage(intent, 'PayMongo rejected the payment intent') }),
      { status: 502, headers: corsHeaders },
    );
  }

  const intentId = intent?.data?.id as string | undefined;
  const clientKey = intent?.data?.attributes?.client_key as string | undefined;
  if (!intentId || !clientKey) {
    if (intentId) await cancelPaymongoIntent(intentId);
    await releaseReservation('failed');
    return new Response(JSON.stringify({ error: 'PayMongo returned an unusable payment intent' }), {
      status: 502,
      headers: corsHeaders,
    });
  }

  // Record the intent before attaching a QR. If the function is interrupted later,
  // a retry can close this exact intent before releasing the reservation.
  const { error: intentSaveError } = await supabaseAdmin
    .from('payments')
    .update({ paymongo_payment_intent_id: intentId })
    .eq('id', reservation.id)
    .eq('status', 'pending');
  if (intentSaveError) {
    await cancelPaymongoIntent(intentId);
    await releaseReservation('failed');
    console.error('PayMongo intent persistence failed', intentSaveError);
    return new Response(JSON.stringify({ error: 'Could not safely record the payment. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Step 2: PaymentMethod ────────────────────────────────────────────────────
  const methodResponse = await fetch(`${PAYMONGO_BASE}/payment_methods`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      data: { attributes: { type: 'qrph' } },
    }),
  });

  const method = await methodResponse.json();
  if (!methodResponse.ok) {
    await cancelPaymongoIntent(intentId);
    await releaseReservation('failed');
    return new Response(
      JSON.stringify({ error: paymongoErrorMessage(method, 'PayMongo rejected the payment method') }),
      { status: 502, headers: corsHeaders },
    );
  }

  const methodId = method?.data?.id as string | undefined;
  if (!methodId) {
    await cancelPaymongoIntent(intentId);
    await releaseReservation('failed');
    return new Response(JSON.stringify({ error: 'PayMongo returned an unusable payment method' }), {
      status: 502,
      headers: corsHeaders,
    });
  }

  // ── Step 3: Attach — this is what actually produces the QR image ─────────────
  const attachResponse = await fetch(`${PAYMONGO_BASE}/payment_intents/${intentId}/attach`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      data: { attributes: { payment_method: methodId, client_key: clientKey } },
    }),
  });

  const attached = await attachResponse.json();
  if (!attachResponse.ok) {
    const cancelled = await cancelPaymongoIntent(intentId);
    if (cancelled) await releaseReservation('cancelled');
    return new Response(
      JSON.stringify({ error: paymongoErrorMessage(attached, 'PayMongo could not generate the QR code') }),
      { status: 502, headers: corsHeaders },
    );
  }

  const nextAction = attached?.data?.attributes?.next_action;
  const qrImageUrl = nextAction?.code?.image_url as string | undefined;
  if (!qrImageUrl) {
    const cancelled = await cancelPaymongoIntent(intentId);
    if (cancelled) await releaseReservation('cancelled');
    return new Response(
      JSON.stringify({ error: 'PayMongo did not return a QR code — QR PH may not be activated on this account' }),
      { status: 502, headers: corsHeaders },
    );
  }

  // PayMongo dynamic QR PH codes are single-use and expire 30 minutes after issue. Stored
  // alongside the QR image so the resume check above (and the response below) can both
  // derive from this exact same timestamp — they can never drift apart.
  const expiresAtIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // The reservation row already exists. Fill it only after QR generation succeeds;
  // clearing the unique key releases the next attempt while the pending row itself is
  // reused on screen reopen.
  const { data: paymentRow, error: updateError } = await supabaseAdmin
    .from('payments')
    .update({ qr_image_url: qrImageUrl, expires_at: expiresAtIso, qrph_creation_key: null })
    .eq('id', reservation.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateError || !paymentRow) {
    const { data: currentPayment } = await supabaseAdmin
      .from('payments')
      .select('status, qr_image_url, expires_at')
      .eq('id', reservation.id)
      .maybeSingle();

    if (currentPayment?.status === 'paid') {
      return new Response(JSON.stringify({ status: 'paid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (currentPayment?.qr_image_url && currentPayment.expires_at) {
      return new Response(
        JSON.stringify({
          paymentId: reservation.id,
          paymentIntentId: intentId,
          qrImageUrl: currentPayment.qr_image_url,
          expiresAt: new Date(currentPayment.expires_at).getTime(),
          documentFeeCentavos,
          amountCentavos,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cancelled = await cancelPaymongoIntent(intentId);
    if (cancelled) await releaseReservation('cancelled');
    console.error('QR payment details persistence failed', updateError);
    return new Response(JSON.stringify({ error: 'Failed to record the QR payment. Please reopen this screen.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // paymentId (the payments row's own uuid) is what check-payment-status expects — it's
  // what the client polls with, never the raw PayMongo intent id (see S0-3).
  return new Response(
    JSON.stringify({
      paymentId: paymentRow.id,
      paymentIntentId: intentId,
      qrImageUrl,
      expiresAt: new Date(expiresAtIso).getTime(),
      documentFeeCentavos,
      amountCentavos,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
