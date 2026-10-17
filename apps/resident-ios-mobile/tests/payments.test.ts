import type { Database } from '@barangayan/shared';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DataError } from '../src/data/outcome';
import { residentApi } from '../src/data/resident-api';
import { paymentAttemptRow, paidReceiptRow, qrAttemptRow } from '../src/data/schemas';
import { assess, parsePageCount, qrEligibility, QR_MINIMUM_CENTAVOS, type PaymentRequest } from '../src/features/payments/assessment';
import { dataUriBytes, MAX_QR_IMAGE_BYTES, saveQrToPhotos, shareReceipt, type SaveDeps, type ShareDeps, type TempFile } from '../src/features/payments/native-actions';
import { parseCancel, parseCheck, parseCreate, qrFailureCode, qrFunctions, qrImageSource } from '../src/features/payments/qr-functions';
import { EXPIRY_GRACE_MS, MAX_CHECK_FAILURES, QrSession, resolveCancel, type QrSessionDeps } from '../src/features/payments/qr-session';
import { escapeHtml, receiptFileName, receiptHtml, receiptLines, toReceipt } from '../src/features/payments/receipt';
import { formatCountdown, secondsRemaining } from '../src/features/payments/countdown';
import { residentError } from '../src/lib/errors';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST = '11111111-1111-4111-8111-111111111111';
const PAYMENT = '33333333-3333-4333-8333-333333333333';
const signal = () => new AbortController().signal;

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 88 }, (_, index) => index)]);
const PNG_BASE64 = Buffer.from(png).toString('base64');
const PNG_DATA_URI = `data:image/png;base64,${PNG_BASE64}`;

type Reply = { status?: number; body?: unknown; json?: boolean } | 'network-error';
function harness(replies: Reply[]) {
  const requests: { url: URL; method: string; body?: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    const reply = replies.shift() ?? { body: [] };
    if (reply === 'network-error') throw new TypeError('Network request failed');
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { api: residentApi(client, TENANT, USER), client, requests };
}

function request(patch: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    status: 'submitted', payment_status: 'pending', payment_method: null, contract_version: 2, fee_assessment_state: 'assessed',
    assessed_amount_centavos: 10000, legacy_fee_centavos: null, billable_pages: null, fee_basis: 'Configured fee at submission',
    document_types: { fee_centavos: 5000, service_kind: 'general' }, payments: [], ...patch,
  };
}

describe('assessment and payment eligibility (A15, F09)', () => {
  it('shows a confirmed amount as payable with its basis', () => {
    const view = assess(request());
    expect(view).toMatchObject({ kind: 'assessed', amount: 10000, heading: 'Confirmed amount due', amountLabel: expect.stringContaining('100.00'), payable: true, pickupOnly: false, needsPages: false, basis: 'Configured fee at submission' });
  });
  it('never treats a version-2 request with no committed amount as free, and ignores today\'s catalogue fee', () => {
    const view = assess(request({ fee_assessment_state: 'pending', assessed_amount_centavos: null }));
    expect(view).toMatchObject({ kind: 'pending', amount: null, payable: false, heading: 'Awaiting fee assessment' });
    expect(view.amountLabel).not.toMatch(/₱|free|no payment/i);
  });
  it('asks for the page count before any payment option and has no payable amount meanwhile', () => {
    const view = assess(request({ fee_assessment_state: 'page_count_required', assessed_amount_centavos: null }));
    expect(view).toMatchObject({ kind: 'page_count_required', amount: null, needsPages: true, payable: false });
  });
  it('treats a variable tax-code fee as payable at pickup only', () => {
    const view = assess(request({ fee_assessment_state: 'pickup_due', assessed_amount_centavos: null, document_types: { fee_centavos: 0, service_kind: 'business' } }));
    expect(view).toMatchObject({ kind: 'pickup_due', payable: true, pickupOnly: true });
    expect(qrEligibility(view)).toEqual({ ok: false, reason: expect.stringContaining('cash at pickup') });
  });
  it('distinguishes waived, free and paid, none of them payable', () => {
    expect(assess(request({ fee_assessment_state: 'waived', assessed_amount_centavos: 0 }))).toMatchObject({ kind: 'waived', payable: false, heading: expect.stringContaining('waived') });
    expect(assess(request({ contract_version: 1, fee_assessment_state: 'legacy', assessed_amount_centavos: null, legacy_fee_centavos: 0 }))).toMatchObject({ kind: 'free', payable: false, amountLabel: 'No payment required' });
    expect(assess(request({ payment_status: 'paid', payments: [{ amount_centavos: 10000, document_fee_centavos: 10000, status: 'paid', method: 'qrph' }] }))).toMatchObject({ kind: 'paid', payable: false, heading: 'Payment received' });
  });
  it('keeps a legacy request on its snapshot and a recorded ledger amount over both', () => {
    expect(assess(request({ contract_version: 1, fee_assessment_state: 'legacy', assessed_amount_centavos: null, legacy_fee_centavos: 7500 })).amount).toBe(7500);
    expect(assess(request({ payments: [{ amount_centavos: 12000, document_fee_centavos: 12000, status: 'pending', method: 'pickup' }] })).amount).toBe(12000);
  });
  it('offers no payment on a cancelled or completed request', () => {
    expect(assess(request({ status: 'cancelled' }))).toMatchObject({ payable: false, terminal: true });
    expect(assess(request({ status: 'completed' }))).toMatchObject({ payable: false, terminal: true });
  });
  it('reads the recorded pickup and open QR attempts', () => {
    expect(assess(request({ payment_method: 'pickup', payments: [{ amount_centavos: 10000, document_fee_centavos: 10000, status: 'pending', method: 'pickup' }] })).pickupRecorded).toBe(true);
    expect(assess(request({ payment_method: 'pickup' })).pickupRecorded).toBe(false);
    expect(assess(request({ payment_method: 'qrph', payments: [{ amount_centavos: 10000, document_fee_centavos: 10000, status: 'pending', method: 'qrph' }] })).qrInProgress).toBe(true);
  });
  it('applies the QR PH minimum and blocks QR once pickup is recorded', () => {
    expect(qrEligibility(assess(request()))).toEqual({ ok: true });
    const small = assess(request({ assessed_amount_centavos: QR_MINIMUM_CENTAVOS - 1 }));
    expect(qrEligibility(small)).toMatchObject({ ok: false });
    expect(qrEligibility(assess(request({ assessed_amount_centavos: QR_MINIMUM_CENTAVOS })))).toEqual({ ok: true });
    const recorded = assess(request({ payment_method: 'pickup', payments: [{ amount_centavos: 10000, document_fee_centavos: 10000, status: 'pending', method: 'pickup' }] }));
    expect(qrEligibility(recorded)).toMatchObject({ ok: false });
  });
  it('validates the certified-copy page count at its boundaries', () => {
    expect(parsePageCount('1')).toEqual({ ok: true, value: 1 });
    expect(parsePageCount(' 1000000 ')).toEqual({ ok: true, value: 1_000_000 });
    for (const bad of ['', '0', '1000001', '1.5', '-3', 'abc', '١٢', '12 3']) expect(parsePageCount(bad).ok).toBe(false);
  });
});

describe('QR PH image handling (A16-003, F06)', () => {
  it('accepts a data URI, bare base64 and https, and refuses anything else', () => {
    expect(qrImageSource(PNG_DATA_URI)).toBe(PNG_DATA_URI);
    expect(qrImageSource(PNG_BASE64)).toBe(PNG_DATA_URI);
    expect(qrImageSource('https://cdn.example.com/qr.png')).toBe('https://cdn.example.com/qr.png');
    for (const bad of ['http://cdn.example.com/qr.png', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html;base64,PGgxPg==', 'short', '']) expect(qrImageSource(bad)).toBeNull();
  });
  it('decodes a data URI to bytes and rejects a malformed payload', () => {
    expect(Array.from(dataUriBytes(PNG_DATA_URI).slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(() => dataUriBytes('data:image/png;base64,@@@')).toThrow();
  });
});

describe('payment function responses and errors (B10)', () => {
  const source = { paymentId: PAYMENT, paymentIntentId: 'pi_123', qrImageUrl: PNG_BASE64, expiresAt: 1_800_000_000_000, documentFeeCentavos: 10000, amountCentavos: 10000 };

  it('parses a created or resumed QR, and falls back to the amount for a missing fee', () => {
    const created = parseCreate(source);
    expect(created).toEqual({ kind: 'source', source: { paymentId: PAYMENT, transactionRef: 'pi_123', qrImage: PNG_DATA_URI, expiresAt: 1_800_000_000_000, documentFeeCentavos: 10000, amountCentavos: 10000 } });
    expect(parseCreate({ ...source, documentFeeCentavos: null, paymentIntentId: null })).toMatchObject({ source: { documentFeeCentavos: 10000, transactionRef: null } });
  });
  it('treats an already-settled request as paid and refuses malformed or unsafe replies', () => {
    expect(parseCreate({ status: 'paid' })).toEqual({ kind: 'paid' });
    for (const bad of [null, {}, { ...source, paymentId: 'x' }, { ...source, amountCentavos: -1 }, { ...source, qrImageUrl: 'javascript:alert(1)' }]) {
      expect(() => parseCreate(bad)).toThrow(DataError);
    }
  });
  it('maps check and cancel statuses', () => {
    expect(parseCheck({ status: 'paid' })).toBe('paid');
    expect(() => parseCheck({ status: 'weird' })).toThrow(DataError);
    expect(parseCancel({ status: 'cancelled' })).toBe('cancelled');
    expect(parseCancel({ status: 'paid' })).toBe('paid');
    expect(parseCancel({ status: 'expired' })).toBe('closed');
    expect(parseCancel({ status: 'pending' })).toBe('pending');
  });
  it('sends only identifiers, never an amount', async () => {
    const { client, requests } = harness([{ body: source }, { body: { status: 'pending' } }, { body: { status: 'cancelled' } }]);
    const functions = qrFunctions(client);
    await functions.create(REQUEST);
    await functions.check(PAYMENT);
    await functions.cancel(PAYMENT);
    expect(requests.map((entry) => entry.url.pathname)).toEqual(['/functions/v1/create-payment-source', '/functions/v1/check-payment-status', '/functions/v1/cancel-payment']);
    expect(requests.map((entry) => JSON.parse(entry.body ?? '{}'))).toEqual([{ requestId: REQUEST }, { paymentId: PAYMENT }, { paymentId: PAYMENT }]);
  });
  it('turns the server messages into stable codes and resident copy', async () => {
    const cases: [number, string, string][] = [
      [422, 'Request is not ready for payment', 'qr_request_closed'],
      [422, 'Pay at Pickup is the only payment method for this document.', 'qr_pickup_only'],
      [422, 'Enter total pages before paying', 'qr_pages_required'],
      [409, 'A QR Ph payment is being prepared. Please wait a moment and try again.', 'qr_preparing'],
      [422, 'Amount is below the PayMongo minimum (PHP 1.00)', 'qr_below_minimum'],
      [502, 'PayMongo did not return a QR code — QR PH may not be activated on this account', 'qr_not_activated'],
      [409, 'This payment already went through — refresh to see it.', 'payment_already_completed'],
    ];
    for (const [status, message, code] of cases) {
      const { client } = harness([{ status, body: { error: message } }]);
      const failure = await qrFunctions(client).create(REQUEST).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(DataError);
      expect((failure as DataError).code).toBe(code);
      expect(residentError(failure)).not.toMatch(/PayMongo|paymongo/);
    }
    expect(qrFailureCode(502, 'anything')).toBe('qr_provider');
    expect(qrFailureCode(500, 'boom')).toBeUndefined();
  });
  it('never repeats raw provider text and classifies status codes', async () => {
    const { client } = harness([{ status: 502, body: { error: 'PayMongo said: card 4242 declined for juan@example.com' } }]);
    const failure = await qrFunctions(client).create(REQUEST).catch((error: unknown) => error);
    expect(residentError(failure)).not.toContain('4242');
    expect(residentError(failure)).not.toContain('juan@');
    const session = harness([{ status: 401, body: { error: 'Unauthorized' } }]);
    expect(((await qrFunctions(session.client).check(PAYMENT).catch((error: unknown) => error)) as DataError).kind).toBe('session');
  });
  it('reports a lost write as unknown-commit and a lost read as offline', async () => {
    const lost = harness(['network-error']);
    expect(((await qrFunctions(lost.client).create(REQUEST).catch((error: unknown) => error)) as DataError).kind).toBe('unknown-commit');
    const cancel = harness(['network-error']);
    expect(((await qrFunctions(cancel.client).cancel(PAYMENT).catch((error: unknown) => error)) as DataError).kind).toBe('unknown-commit');
    const read = harness(['network-error']);
    expect(((await qrFunctions(read.client).check(PAYMENT).catch((error: unknown) => error)) as DataError).kind).toBe('offline');
  });
  it('stops before sending when the caller already aborted', async () => {
    const { client, requests } = harness([{ body: { status: 'paid' } }]);
    const controller = new AbortController();
    controller.abort();
    await expect(qrFunctions(client).check(PAYMENT, controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
    expect(requests).toHaveLength(0);
  });
});

/** A scripted session: every dependency is a queue of outcomes, and `now` is explicit. */
function sessionHarness(options: { now?: number } = {}) {
  const clock = { now: options.now ?? 1_000_000 };
  const calls: string[] = [];
  const queues = {
    create: [] as (() => Promise<unknown>)[], check: [] as (() => Promise<unknown>)[], cancel: [] as (() => Promise<unknown>)[],
    status: [] as (() => Promise<unknown>)[], attempt: [] as (() => Promise<unknown>)[], paid: [] as (() => Promise<unknown>)[],
  };
  const take = (name: keyof typeof queues) => { calls.push(name); const next = queues[name].shift(); if (!next) throw new Error(`unscripted ${name}`); return next(); };
  const deps: QrSessionDeps = {
    functions: {
      create: (() => take('create')) as QrSessionDeps['functions']['create'],
      check: (() => take('check')) as QrSessionDeps['functions']['check'],
      cancel: (() => take('cancel')) as QrSessionDeps['functions']['cancel'],
    },
    reads: {
      openAttempt: (() => take('attempt')) as QrSessionDeps['reads']['openAttempt'],
      status: (() => take('status')) as QrSessionDeps['reads']['status'],
      hasPaid: (() => take('paid')) as QrSessionDeps['reads']['hasPaid'],
    },
    now: () => clock.now,
    describe: (error) => (error instanceof DataError ? `failed:${error.kind}:${error.code ?? ''}` : 'failed'),
  };
  const ok = (value: unknown) => () => Promise.resolve(value);
  const fail = (kind: DataError['kind'], code?: string) => () => Promise.reject(new DataError(kind, undefined, undefined, code));
  const hold = () => {
    let release!: (value: unknown) => void;
    const promise = new Promise((resolve) => { release = resolve; });
    return { run: () => promise, release };
  };
  return { session: new QrSession(deps), queues, calls, clock, ok, fail, hold };
}
const SOURCE = { paymentId: PAYMENT, transactionRef: 'pi_1', qrImage: PNG_DATA_URI, expiresAt: 2_000_000, documentFeeCentavos: 10000, amountCentavos: 10000 };
const created = { kind: 'source' as const, source: SOURCE };
const attemptRow = (patch: Record<string, unknown> = {}) => qrAttemptRow.parse({
  id: PAYMENT, method: 'qrph', status: 'pending', amount_centavos: 10000, document_fee_centavos: 10000, expires_at: new Date(2_000_000).toISOString(),
  paid_at: null, created_at: new Date(900_000).toISOString(), qr_image_url: PNG_BASE64, paymongo_payment_intent_id: 'pi_1', ...patch,
});

describe('QR PH session (A16, F03, F09)', () => {
  it('creates a QR and shows it as pending', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.ok(created));
    await h.session.start();
    expect(h.session.getState()).toMatchObject({ phase: 'pending', source: SOURCE, paidEarlier: false });
  });
  it('reports an already-settled request without creating a second charge', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.ok({ kind: 'paid' }));
    await h.session.start();
    expect(h.session.getState()).toMatchObject({ phase: 'paid', paidEarlier: true, source: null });
  });
  it('shows a definite creation failure with its copy and offers a manual retry only', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.fail('validation', 'qr_request_closed'));
    await h.session.start();
    expect(h.session.getState()).toMatchObject({ phase: 'error', message: 'failed:validation:qr_request_closed' });
    expect(h.calls).toEqual(['create']);
  });
  it('reconciles a lost creation reply from the stored attempt instead of guessing', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.fail('unknown-commit'));
    h.queues.paid.push(h.ok(false));
    h.queues.attempt.push(h.ok(attemptRow()));
    await h.session.start();
    expect(h.session.getState()).toMatchObject({ phase: 'pending', source: { paymentId: PAYMENT, amountCentavos: 10000, qrImage: PNG_DATA_URI, expiresAt: 2_000_000 } });
  });
  it('reconciles a lost creation reply that had settled the request', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.fail('unknown-commit'));
    h.queues.paid.push(h.ok(true));
    await h.session.start();
    expect(h.session.getState()).toMatchObject({ phase: 'paid', paidEarlier: true });
  });
  it('does not claim a QR exists when the lost reply cannot be reconciled, and ignores an expired stored attempt', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.fail('unknown-commit'));
    h.queues.paid.push(h.ok(false));
    h.queues.attempt.push(h.ok(attemptRow({ expires_at: new Date(500_000).toISOString() })));
    await h.session.start();
    expect(h.session.getState()).toMatchObject({ phase: 'error', source: null });
    expect(h.session.getState().message).toContain('could not confirm');
  });
  it('ignores a second start while one is running', async () => {
    const h = sessionHarness();
    const held = h.hold();
    h.queues.create.push(held.run);
    const first = h.session.start();
    await h.session.start();
    held.release(created);
    await first;
    expect(h.calls).toEqual(['create']);
  });
  it('follows the provider to paid, and to expired', async () => {
    const paid = sessionHarness();
    paid.queues.create.push(paid.ok(created));
    paid.queues.check.push(paid.ok('paid'));
    await paid.session.start();
    await paid.session.poll();
    expect(paid.session.getState()).toMatchObject({ phase: 'paid', paidEarlier: false });
    const expired = sessionHarness();
    expired.queues.create.push(expired.ok(created));
    expired.queues.check.push(expired.ok('expired'));
    await expired.session.start();
    await expired.session.poll();
    expect(expired.session.getState().phase).toBe('expired');
  });
  it('keeps a QR open when the device clock is past expiry but the provider still reports it open, until the grace ends', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.ok(created));
    h.queues.check.push(h.ok('pending'), h.ok('pending'));
    await h.session.start();
    h.clock.now = SOURCE.expiresAt + 1000;
    await h.session.poll();
    expect(h.session.getState().phase).toBe('pending');
    h.clock.now = SOURCE.expiresAt + EXPIRY_GRACE_MS + 1;
    await h.session.poll();
    expect(h.session.getState().phase).toBe('expired');
  });
  it('pauses automatic checks after repeated failures and resumes on a manual check', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.ok(created));
    for (let index = 0; index < MAX_CHECK_FAILURES; index += 1) h.queues.check.push(h.fail('offline'));
    await h.session.start();
    for (let index = 0; index < MAX_CHECK_FAILURES; index += 1) await h.session.poll();
    expect(h.session.getState()).toMatchObject({ phase: 'pending', pollingPaused: true });
    const before = h.calls.length;
    await h.session.poll();
    expect(h.calls.length).toBe(before);
    h.queues.check.push(h.ok('paid'));
    await h.session.check(true);
    expect(h.session.getState().phase).toBe('paid');
  });
  it('does not overlap checks', async () => {
    const h = sessionHarness();
    const held = h.hold();
    h.queues.create.push(h.ok(created));
    h.queues.check.push(held.run);
    await h.session.start();
    const first = h.session.poll();
    await h.session.poll();
    held.release('pending');
    await first;
    expect(h.calls.filter((call) => call === 'check')).toHaveLength(1);
  });
  it('follows a realtime change by re-reading the record', async () => {
    const h = sessionHarness();
    h.queues.create.push(h.ok(created));
    h.queues.status.push(h.ok('paid'));
    await h.session.start();
    await h.session.refreshFromRecord();
    expect(h.session.getState().phase).toBe('paid');
  });

  describe('cancelling one payment attempt (A14-007…011)', () => {
    it('cancels and allows a new attempt', async () => {
      const h = sessionHarness();
      h.queues.create.push(h.ok(created), h.ok({ kind: 'source', source: { ...SOURCE, paymentId: '44444444-4444-4444-8444-444444444444' } }));
      h.queues.cancel.push(h.ok('cancelled'));
      await h.session.start();
      expect(await h.session.cancel()).toMatchObject({ kind: 'cancelled' });
      expect(h.session.getState()).toMatchObject({ phase: 'cancelled', cancelling: false });
      await h.session.start();
      expect(h.session.getState()).toMatchObject({ phase: 'pending', source: { paymentId: '44444444-4444-4444-8444-444444444444' } });
    });
    it('reports a payment that settled while cancelling as paid, not cancelled', async () => {
      const h = sessionHarness();
      h.queues.create.push(h.ok(created));
      h.queues.cancel.push(h.ok('paid'));
      await h.session.start();
      expect(await h.session.cancel()).toMatchObject({ kind: 'paid' });
      expect(h.session.getState()).toMatchObject({ phase: 'paid', paidEarlier: false });
    });
    it('reconciles a lost cancel reply with the stored status', async () => {
      const cancelled = sessionHarness();
      cancelled.queues.create.push(cancelled.ok(created));
      cancelled.queues.cancel.push(cancelled.fail('unknown-commit'));
      cancelled.queues.status.push(cancelled.ok('cancelled'));
      await cancelled.session.start();
      expect((await cancelled.session.cancel()).kind).toBe('cancelled');
      const raced = sessionHarness();
      raced.queues.create.push(raced.ok(created));
      raced.queues.cancel.push(raced.fail('unknown-commit'));
      raced.queues.status.push(raced.ok('paid'));
      await raced.session.start();
      expect((await raced.session.cancel()).kind).toBe('paid');
    });
    it('treats the server\'s already-completed answer as a race and reads the record', async () => {
      const h = sessionHarness();
      h.queues.create.push(h.ok(created));
      h.queues.cancel.push(h.fail('conflict', 'payment_already_completed'));
      h.queues.status.push(h.ok('paid'));
      await h.session.start();
      expect((await h.session.cancel()).kind).toBe('paid');
    });
    it('never says cancelled when it cannot tell, and keeps the QR usable', async () => {
      const h = sessionHarness();
      h.queues.create.push(h.ok(created));
      h.queues.cancel.push(h.fail('unknown-commit'));
      h.queues.status.push(h.fail('offline'));
      await h.session.start();
      const result = await h.session.cancel();
      expect(result.kind).toBe('unconfirmed');
      expect(h.session.getState()).toMatchObject({ phase: 'pending', cancelling: false });
      h.queues.check.push(h.ok('pending'));
      await h.session.poll();
      expect(h.calls.filter((call) => call === 'check')).toHaveLength(1);
    });
    it('keeps the QR on a definite cancel failure and shows its copy', async () => {
      const h = sessionHarness();
      h.queues.create.push(h.ok(created));
      h.queues.cancel.push(h.fail('http'));
      await h.session.start();
      expect(await h.session.cancel()).toMatchObject({ kind: 'failed', message: 'failed:http:' });
      expect(h.session.getState().phase).toBe('pending');
    });
    it('drops a poll that was in flight when the cancellation started', async () => {
      const h = sessionHarness();
      const held = h.hold();
      h.queues.create.push(h.ok(created));
      h.queues.check.push(held.run);
      h.queues.cancel.push(h.ok('cancelled'));
      await h.session.start();
      const poll = h.session.poll();
      await Promise.resolve();
      await h.session.cancel();
      held.release('expired');
      await poll;
      expect(h.session.getState().phase).toBe('cancelled');
    });
    it('ignores a second cancel while one is running and outside a pending attempt', async () => {
      const h = sessionHarness();
      const held = h.hold();
      h.queues.create.push(h.ok(created));
      h.queues.cancel.push(held.run);
      await h.session.start();
      const first = h.session.cancel();
      expect((await h.session.cancel()).kind).toBe('ignored');
      held.release('cancelled');
      await first;
      expect((await h.session.cancel()).kind).toBe('ignored');
      expect(h.calls.filter((call) => call === 'cancel')).toHaveLength(1);
    });
    it('resolves a cancel without a session (request screen)', async () => {
      const deps = { functions: { cancel: async () => 'closed' as const }, reads: { status: async () => null }, describe: () => 'x' };
      expect(await resolveCancel(deps, PAYMENT, signal())).toMatchObject({ kind: 'expired' });
    });
  });

  it('drops late replies once closed and can be reopened', async () => {
    const h = sessionHarness();
    const held = h.hold();
    h.queues.create.push(held.run);
    const start = h.session.start();
    h.session.close();
    held.release(created);
    await start;
    expect(h.session.getState().phase).toBe('creating');
    h.session.open();
    h.queues.create.push(h.ok(created));
    await h.session.start();
    expect(h.session.getState().phase).toBe('pending');
  });
});

describe('payment reads and writes (B09)', () => {
  const requestState = (patch: Record<string, unknown> = {}) => ({ payment_method: null, billable_pages: null, fee_assessment_state: 'assessed', payments: [], ...patch });

  it('chooses a method through the RPC with only the request and method', async () => {
    const { api, requests } = harness([{ status: 204 }]);
    await api.setPaymentMethod(REQUEST, 'qrph');
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/set_service_request_payment_method');
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({ p_request_id: REQUEST, p_method: 'qrph' });
  });
  it('rejects a malformed request id before sending anything', async () => {
    const { api, requests } = harness([]);
    await expect(api.setPaymentMethod('not-a-uuid', 'pickup')).rejects.toMatchObject({ kind: 'not-found' });
    await expect(api.startPickupPayment('x')).rejects.toMatchObject({ kind: 'not-found' });
    expect(requests).toHaveLength(0);
  });
  it('turns a locked method into its own message', async () => {
    const { api } = harness([{ status: 400, body: { code: '22023', message: 'payment_method_locked' } }]);
    const failure = await api.setPaymentMethod(REQUEST, 'qrph').catch((error: unknown) => error);
    expect(failure).toMatchObject({ kind: 'validation', code: 'payment_method_locked' });
    expect(residentError(failure)).toContain('payment method can no longer be changed');
  });
  it('reconciles a lost method reply by reading the request, and does not when the method differs', async () => {
    const same = harness(['network-error', { body: requestState({ payment_method: 'qrph' }) }]);
    await expect(same.api.setPaymentMethod(REQUEST, 'qrph')).resolves.toBeUndefined();
    const different = harness(['network-error', { body: requestState({ payment_method: 'pickup' }) }]);
    await expect(different.api.setPaymentMethod(REQUEST, 'qrph')).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('records pickup and reconciles by the pending pickup row or the variable-fee state', async () => {
    const { api, requests } = harness([{ body: PAYMENT }]);
    await api.startPickupPayment(REQUEST);
    expect(requests[0].url.pathname).toBe('/rest/v1/rpc/start_pickup_payment');
    const row = harness(['network-error', { body: requestState({ payment_method: 'pickup', payments: [{ method: 'pickup', status: 'pending' }] }) }]);
    await expect(row.api.startPickupPayment(REQUEST)).resolves.toBeUndefined();
    const variable = harness(['network-error', { body: requestState({ payment_method: 'pickup', fee_assessment_state: 'pickup_due' }) }]);
    await expect(variable.api.startPickupPayment(REQUEST)).resolves.toBeUndefined();
    const nothing = harness(['network-error', { body: requestState({ payment_method: 'pickup' }) }]);
    await expect(nothing.api.startPickupPayment(REQUEST)).rejects.toMatchObject({ kind: 'unknown-commit' });
  });
  it('saves the page count and reconciles a lost reply by the stored count', async () => {
    const { api, requests } = harness([{ status: 204 }]);
    await api.setBillablePages(REQUEST, 12);
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({ p_request_id: REQUEST, p_total_pages: 12 });
    const lost = harness(['network-error', { body: requestState({ billable_pages: 12 }) }]);
    await expect(lost.api.setBillablePages(REQUEST, 12)).resolves.toBeUndefined();
    const locked = harness([{ status: 400, body: { code: '22023', message: 'page_count_locked' } }]);
    await expect(locked.api.setBillablePages(REQUEST, 12)).rejects.toMatchObject({ code: 'page_count_locked' });
  });
  it('reads attempts, the open QR and the receipt scoped to the tenant and owner', async () => {
    const attempt = { id: PAYMENT, method: 'qrph', status: 'pending', amount_centavos: 10000, document_fee_centavos: 10000, expires_at: null, paid_at: null, created_at: '2026-10-16T01:00:00Z' };
    const { api, requests } = harness([{ body: [attempt] }, { body: [{ ...attempt, qr_image_url: PNG_BASE64, paymongo_payment_intent_id: 'pi_1' }] }, { body: [] }]);
    expect(await api.paymentAttempts(REQUEST, signal())).toEqual([paymentAttemptRow.parse(attempt)]);
    expect((await api.openQrAttempt(REQUEST, signal()))?.qr_image_url).toBe(PNG_BASE64);
    expect(await api.paidReceipt(REQUEST, signal())).toBeNull();
    expect(requests[0].url.searchParams.get('service_request_id')).toBe(`eq.${REQUEST}`);
    expect(requests[0].url.searchParams.get('barangay_id')).toBe(`eq.${TENANT}`);
    expect(requests[1].url.searchParams.get('method')).toBe('eq.qrph');
    expect(requests[1].url.searchParams.get('status')).toBe('eq.pending');
    expect(requests[2].url.searchParams.get('status')).toBe('eq.paid');
    expect(requests[2].url.searchParams.get('service_requests.resident_id')).toBe(`eq.${USER}`);
  });
  it('refuses a payment row that does not match the contract', async () => {
    const { api } = harness([{ body: [{ id: PAYMENT, method: 'qrph' }] }]);
    await expect(api.paymentAttempts(REQUEST, signal())).rejects.toMatchObject({ kind: 'schema' });
  });
});

describe('paid receipt (A17, T17)', () => {
  const row = paidReceiptRow.parse({
    id: PAYMENT, method: 'qrph', status: 'paid', amount_centavos: 10000, document_fee_centavos: 10000, expires_at: null,
    paid_at: '2026-10-16T02:30:00Z', created_at: '2026-10-16T02:00:00Z', paymongo_payment_id: 'pay_abc', paymongo_source_id: null, paymongo_payment_intent_id: 'pi_1',
    service_requests: { reference_number: 'REQ-2026-00035', document_types: { name: 'Barangay Clearance' } },
  });

  it('is built from the committed payment and its request only', () => {
    const receipt = toReceipt(row);
    expect(receipt).toMatchObject({ reference: 'REQ-2026-00035', documentName: 'Barangay Clearance', amountCentavos: 10000, method: 'QR PH', transactionRef: 'pay_abc', paidAt: '2026-10-16T02:30:00Z' });
    expect(receiptLines(receipt).map(([label]) => label)).toEqual(['Reference number', 'Document', 'Date and time', 'Payment method', 'Document fee', 'Amount paid', 'Transaction reference']);
  });
  it('falls back to the creation time and the intent reference, and labels cash pickup', () => {
    const receipt = toReceipt({ ...row, paid_at: null, paymongo_payment_id: null, method: 'pickup' });
    expect(receipt).toMatchObject({ paidAt: '2026-10-16T02:00:00Z', transactionRef: 'pi_1', method: 'Pay at pickup' });
    expect(toReceipt({ ...row, paymongo_payment_id: null, paymongo_payment_intent_id: null }).transactionRef).toBeNull();
  });
  it('escapes everything in the PDF document and embeds no image', () => {
    const html = receiptHtml({ ...toReceipt(row), documentName: '<script>alert(1)</script> & "co"', reference: 'A&B' }, new Date('2026-10-16T03:00:00Z'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).not.toMatch(/<img|file:\/\//);
    expect(escapeHtml(`'"<>&`)).toBe('&#39;&quot;&lt;&gt;&amp;');
  });
  it('names the file safely', () => {
    expect(receiptFileName('REQ-2026-00035')).toBe('Barangayan-receipt-REQ-2026-00035.pdf');
    expect(receiptFileName('../../etc/passwd')).toBe('Barangayan-receipt-etc-passwd.pdf');
    expect(receiptFileName('///')).toBe('Barangayan-receipt-payment.pdf');
  });
});

function temp(name: string, removed: string[], failRemove = false): TempFile {
  return { uri: `file:///cache/${name}`, remove() { removed.push(name); if (failRemove) throw new Error('gone'); } };
}

describe('Photos save and receipt share (A16-013…018, A17-010…015)', () => {
  function saveDeps(overrides: Partial<SaveDeps> = {}) {
    const removed: string[] = [];
    const added: string[] = [];
    const written: string[] = [];
    const deps: SaveDeps = {
      requestAccess: async () => ({ granted: true, canAskAgain: true }),
      readImage: async () => png,
      writeTemp: (name) => { written.push(name); return temp(name, removed); },
      addToPhotos: async (uri) => { added.push(uri); },
      ...overrides,
    };
    return { deps, removed, added, written };
  }

  it('saves the QR under its reference, then removes the temporary file', async () => {
    const h = saveDeps();
    expect(await saveQrToPhotos(h.deps, PNG_DATA_URI, 'REQ-2026-00035')).toMatchObject({ status: 'saved' });
    expect(h.written).toEqual(['Barangayan-QR-REQ-2026-00035.png']);
    expect(h.added).toEqual(['file:///cache/Barangayan-QR-REQ-2026-00035.png']);
    expect(h.removed).toEqual(['Barangayan-QR-REQ-2026-00035.png']);
  });
  it('explains denial and a blocked permission, without reading or writing anything', async () => {
    const denied = saveDeps({ requestAccess: async () => ({ granted: false, canAskAgain: true }) });
    expect((await saveQrToPhotos(denied.deps, PNG_DATA_URI, 'R')).status).toBe('denied');
    const blocked = saveDeps({ requestAccess: async () => ({ granted: false, canAskAgain: false }) });
    const outcome = await saveQrToPhotos(blocked.deps, PNG_DATA_URI, 'R');
    expect(outcome.status).toBe('blocked');
    expect(outcome.message).toContain('Settings');
    expect(blocked.written).toEqual([]);
  });
  it('refuses bytes that are not a small image', async () => {
    for (const bytes of [new Uint8Array(0), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), new Uint8Array(MAX_QR_IMAGE_BYTES + 1).fill(0x89)]) {
      const h = saveDeps({ readImage: async () => bytes });
      expect((await saveQrToPhotos(h.deps, PNG_DATA_URI, 'R')).status).toBe('failed');
      expect(h.added).toEqual([]);
    }
  });
  it('removes the temporary file when adding to Photos fails, and survives a failed removal', async () => {
    const h = saveDeps({ addToPhotos: async () => { throw new Error('denied by system'); } });
    const outcome = await saveQrToPhotos(h.deps, PNG_DATA_URI, 'R');
    expect(outcome.status).toBe('failed');
    expect(outcome.message).not.toContain('denied by system');
    expect(h.removed).toHaveLength(1);
    const stuck = await saveQrToPhotos({ ...h.deps, addToPhotos: async () => undefined, writeTemp: (name) => temp(name, [], true) }, PNG_DATA_URI, 'R');
    expect(stuck.status).toBe('saved');
  });

  function shareDeps(overrides: Partial<ShareDeps> = {}) {
    const removed: string[] = [];
    const shared: string[] = [];
    const html: string[] = [];
    const deps: ShareDeps = {
      renderPdf: async (document) => { html.push(document); return temp('rendered.pdf', removed); },
      nameFile: async (_rendered, name) => temp(name, removed),
      canShare: async () => true,
      share: async (uri) => { shared.push(uri); },
      ...overrides,
    };
    return { deps, removed, shared, html };
  }
  const receipt = toReceipt(paidReceiptRow.parse({
    id: PAYMENT, method: 'pickup', status: 'paid', amount_centavos: 5000, document_fee_centavos: 5000, expires_at: null, paid_at: '2026-10-16T02:30:00Z',
    created_at: '2026-10-16T02:00:00Z', paymongo_payment_id: null, paymongo_source_id: null, paymongo_payment_intent_id: null,
    service_requests: { reference_number: 'REQ-1', document_types: null },
  }));

  it('renders the committed receipt, shares it and removes both files', async () => {
    const h = shareDeps();
    const outcome = await shareReceipt(h.deps, receipt, new Date('2026-10-16T03:00:00Z'));
    expect(outcome.status).toBe('opened');
    expect(outcome.message).not.toMatch(/saved to/i);
    expect(h.shared).toEqual(['file:///cache/Barangayan-receipt-REQ-1.pdf']);
    expect(h.html[0]).toContain('REQ-1');
    expect(h.removed.sort()).toEqual(['Barangayan-receipt-REQ-1.pdf', 'rendered.pdf']);
  });
  it('says so when sharing is unavailable and still cleans up', async () => {
    const h = shareDeps({ canShare: async () => false });
    expect((await shareReceipt(h.deps, receipt)).status).toBe('unavailable');
    expect(h.shared).toEqual([]);
    expect(h.removed).toHaveLength(2);
  });
  it('reports a failure to prepare or share without raw error text, and cleans up', async () => {
    const h = shareDeps({ share: async () => { throw new Error('/private/var/secret/path'); } });
    const outcome = await shareReceipt(h.deps, receipt);
    expect(outcome.status).toBe('failed');
    expect(outcome.message).not.toContain('/private');
    expect(h.removed).toHaveLength(2);
    const render = shareDeps({ renderPdf: async () => { throw new Error('print failed'); } });
    expect((await shareReceipt(render.deps, receipt)).status).toBe('failed');
    expect(render.removed).toEqual([]);
  });
});

describe('countdown (A16-005)', () => {
  it('counts whole seconds down and never below zero', () => {
    expect(secondsRemaining(10_000, 0)).toBe(10);
    expect(secondsRemaining(10_000, 9_001)).toBe(1);
    expect(secondsRemaining(10_000, 20_000)).toBe(0);
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
