import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';

// Execute the production Edge Function without Deno or real provider requests.
const source = readFileSync(new URL('../../../../supabase/functions/refund-payment/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*jsr:.*;\r?\n/m, '');
const compiled = transformSync(source, { loader: 'ts', target: 'es2022' }).code;
function fixture(options: { refundStatus?: string; deleted?: boolean; inactive?: boolean; foreign?: boolean;
  claimFails?: boolean; saveFails?: boolean; providerStatus?: number; transportFails?: boolean;
  malformedProvider?: boolean; settledEarly?: boolean } = {}) {
  const payment: Record<string, unknown> = { id: 'e1150000-0000-0000-0000-000000000001', barangay_id: 'tenant-a',
    method: 'qrph', status: 'paid', amount_centavos: 5000, paymongo_payment_id: 'pay_fixture',
    refund_status: options.refundStatus ?? 'none', deleted_at: options.deleted ? '2026-10-13' : null };
  const profile = { id: 'admin-a', role: 'admin', barangay_id: options.foreign ? 'tenant-b' : 'tenant-a', deleted_at: options.inactive ? '2026-10-13' : null };
  const writes: Record<string, unknown>[] = [];
  function from(table: string) {
    let patch: Record<string, unknown> | undefined;
    const filters: [string, unknown][] = [];
    const execute = () => {
      const row = table === 'profiles' ? profile : payment;
      if (!filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value)) return { data: null, error: null };
      if (patch) {
        if (options.claimFails && patch.refund_status === 'pending') return { data: null, error: { message: 'Claim denied' } };
        if (options.saveFails && patch.refund_status === 'processing') return { data: null, error: { message: 'Save denied' } };
        writes.push(patch); Object.assign(payment, patch);
      }
      return { data: structuredClone(row), error: null };
    };
    return { select() { return this; }, eq(key: string, value: unknown) { filters.push([key,value]); return this; },
      is(key: string, value: unknown) { filters.push([key,value]); return this; },
      update(value: Record<string, unknown>) { patch = value; return this; },
      async single() { return execute(); }, async maybeSingle() { return execute(); },
      then(resolve: (value: ReturnType<typeof execute>) => unknown) { return Promise.resolve(execute()).then(resolve); } };
  }
  const provider = vi.fn(async () => {
    if (options.transportFails) throw new TypeError('Connection lost');
    if (options.settledEarly) Object.assign(payment, { refund_status: 'refunded', status: 'refunded' });
    return new Response(options.malformedProvider ? 'invalid JSON' : JSON.stringify(options.providerStatus ? { errors: [{ detail: 'Provider rejection' }] }
      : { data: { id: 'ref_fixture', attributes: { status: 'processing', transfer_link: 'https://transfer.paymongo.test/claim' } } }),
    { status: options.providerStatus ?? 200 });
  });
  let handler!: (request: Request) => Promise<Response>;
  runInNewContext(compiled, { createClient: () => ({ from, auth: { async getUser() { return { data: { user: { id: 'admin-a' } } }; } } }),
    Deno: { env: { get: () => 'configured' }, serve(fn: typeof handler) { handler = fn; } },
    Request, Response, AbortSignal, fetch: provider, btoa, Date, JSON });
  const request = (body = JSON.stringify({ paymentId: payment.id, reason: 'requested_by_customer' })) =>
    new Request('http://local/refund-payment', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body });
  return { handler, request, payment, provider, writes };
}

describe('production refund endpoint', () => {
  it.each(['none','failed'])('submits a %s refund and persists its claim link', async refundStatus => {
    const f = fixture({ refundStatus }); const response = await f.handler(f.request());
    expect(response.status).toBe(200); expect(f.provider).toHaveBeenCalledTimes(1);
    expect(f.payment.refund_status).toBe('processing'); expect(f.payment.refund_transfer_link).toContain('/claim');
    expect(f.writes[0].refund_status).toBe('pending');
  });
  it.each(['pending','processing','refunding','refunded'])('rejects a duplicate %s refund before contacting the provider', async refundStatus => {
    const f = fixture({ refundStatus }); expect((await f.handler(f.request())).status).toBe(422);
    expect(f.provider).not.toHaveBeenCalled();
  });
  it.each([{ inactive:true },{ foreign:true },{ deleted:true }])('rejects unavailable accounts/payments', async options => {
    const f = fixture(options); expect((await f.handler(f.request())).status).toBeGreaterThanOrEqual(400);
    expect(f.provider).not.toHaveBeenCalled();
  });
  it('handles malformed request JSON', async () => {
    const f = fixture(); expect((await f.handler(f.request('invalid'))).status).toBe(400); expect(f.provider).not.toHaveBeenCalled();
  });
  it('rejects an amount below the provider minimum before contacting PayMongo', async () => {
    const f = fixture(); f.payment.amount_centavos = 50;
    expect((await f.handler(f.request())).status).toBe(422); expect(f.provider).not.toHaveBeenCalled();
  });
  it('does not contact PayMongo when the database claim fails', async () => {
    const f = fixture({ claimFails:true }); expect((await f.handler(f.request())).status).toBe(503); expect(f.provider).not.toHaveBeenCalled();
  });
  it('allows only one provider request from simultaneous submissions', async () => {
    const f = fixture(); const responses = await Promise.all([f.handler(f.request()),f.handler(f.request())]);
    expect(responses.map(r => r.status).sort()).toEqual([200,409]); expect(f.provider).toHaveBeenCalledTimes(1);
  });
  it('releases a claim after an explicit provider rejection', async () => {
    const f = fixture({ refundStatus:'failed',providerStatus:422 }); expect((await f.handler(f.request())).status).toBe(502);
    expect(f.payment.refund_status).toBe('failed');
  });
  it.each([{ transportFails:true },{ malformedProvider:true },{ providerStatus:500 }])('retains uncertain attempts to prevent duplicate refunds', async options => {
    const f = fixture(options); expect((await f.handler(f.request())).status).toBe(502); expect(f.payment.refund_status).toBe('pending');
    expect((await f.handler(f.request())).status).toBe(422); expect(f.provider).toHaveBeenCalledTimes(1);
  });
  it('reports persistence failure instead of reporting success', async () => {
    const f = fixture({ saveFails:true }); expect((await f.handler(f.request())).status).toBe(503); expect(f.payment.refund_status).toBe('pending');
  });
  it('does not overwrite settlement that arrives before the API response', async () => {
    const f = fixture({ settledEarly:true }); const response = await f.handler(f.request());
    expect(response.status).toBe(200); expect((await response.json()).status).toBe('refunded'); expect(f.payment.status).toBe('refunded');
  });
});
