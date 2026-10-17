import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Execute the real Edge handler with isolated SDK/provider boundaries. These are
// deterministic contract tests, not evidence of a live provider or database run.
const source = fs.readFileSync(new URL('../../../supabase/functions/cancel-payment/index.ts', import.meta.url), 'utf8');
const sdkImport = "import { createClient } from 'jsr:@supabase/supabase-js@2';";
if (!source.includes(sdkImport)) throw new Error('Review the cancellation handler import before running its fixture.');
const script = ts.transpileModule(source.replace(sdkImport, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const paymentId = 'b1180000-0000-4000-8000-000000000046';
type Scenario = {
  initial?: string;
  winner?: string;
  provider?: number | 'throw';
  authorized?: boolean;
  owner?: boolean;
  missing?: boolean;
  updateError?: boolean;
  rereadError?: boolean;
  noUpdatedRow?: boolean;
  body?: string;
};

async function cancel(scenario: Scenario = {}) {
  const calls = { provider: 0, writes: 0, rereads: 0, filters: [] as string[] };
  let state = scenario.initial ?? 'pending';
  const runtime: { handler?: (req: Request) => Promise<Response> } = {};
  function createClient(_url: string, key: string) {
    const admin = key === 'service';
    return {
      auth: { getUser: async () => ({ data: { user: scenario.authorized === false ? null : { id: 'owner' } } }) },
      from(table: string) {
        expect(table).toBe('payments');
        let selecting = '';
        const query = {
          select(fields: string) { selecting = fields; return query; },
          eq(field: string, value: string) { calls.filters.push(`${admin ? 'admin' : 'caller'}:${field}=${value}`); return query; },
          update(value: { status: string }) {
            expect(admin).toBe(true);
            expect(value).toEqual({ status: 'cancelled' });
            calls.writes++;
            if (scenario.winner) state = scenario.winner;
            return query;
          },
          async single() {
            expect(admin).toBe(false);
            if (selecting === 'status') {
              calls.rereads++;
              return { data: scenario.rereadError ? null : { status: state }, error: scenario.rereadError ? { code: '42501' } : null };
            }
            return {
              data: scenario.missing ? null : { id: paymentId, status: state, paymongo_payment_intent_id: 'pi_fixture', service_request: { resident_id: scenario.owner === false ? 'other' : 'owner' } },
              error: null,
            };
          },
          async maybeSingle() {
            expect(admin).toBe(true);
            expect(selecting).toBe('id, status');
            if (scenario.updateError) return { data: null, error: { code: '08006' } };
            if (state !== 'pending' || scenario.noUpdatedRow) return { data: null, error: null };
            state = 'cancelled';
            return { data: { id: paymentId, status: state }, error: null };
          },
        };
        return query;
      },
    };
  }
  vm.runInNewContext(script, {
    createClient, Response, Request, AbortSignal, btoa,
    Deno: { env: { get: (key: string) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'fixture' }, serve: (handler: (req: Request) => Promise<Response>) => { runtime.handler = handler; } },
    fetch: async (url: string, options: RequestInit) => {
      calls.provider++;
      expect(url).toBe('https://api.paymongo.com/v1/payment_intents/pi_fixture/cancel');
      expect(options.method).toBe('POST');
      expect(options.signal).toBeInstanceOf(AbortSignal);
      if (scenario.provider === 'throw') throw new TypeError('Injected transport failure');
      return new Response('{}', { status: scenario.provider ?? 200 });
    },
  });
  if (!runtime.handler) throw new Error('Cancellation handler was not registered.');
  const response = await runtime.handler(new Request('http://fixture/cancel-payment', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: scenario.body ?? JSON.stringify({ paymentId }) }));
  return { http: response.status, body: await response.json(), calls, state };
}

describe('cancel-payment authoritative outcome', () => {
  it('requires the caller identity and ownership before provider or privileged writes', async () => {
    for (const scenario of [{ authorized: false }, { owner: false }, { missing: true }]) {
      const result = await cancel(scenario);
      expect([401, 403, 404]).toContain(result.http);
      expect(result.calls.provider).toBe(0);
      expect(result.calls.writes).toBe(0);
    }
  });

  it('returns an already paid row without attempting cancellation', async () => {
    const result = await cancel({ initial: 'paid' });
    expect(result.body).toEqual({ status: 'paid' });
    expect(result.calls.provider).toBe(0);
    expect(result.calls.writes).toBe(0);
  });

  it.each([202, 400, 500, 'throw'] as const)('never cancels locally without provider confirmation %s', async (provider) => {
    const result = await cancel({ provider });
    expect(result.http).toBe(503);
    expect(result.body.status).toBeUndefined();
    expect(result.calls.writes).toBe(0);
    expect(result.state).toBe('pending');
  });

  it.each(['{', 'null', '{}', '{"paymentId":42}', '{"paymentId":"invalid"}'])('rejects malformed input before accessing payments: %s', async (body) => {
    const result = await cancel({ body });
    expect(result.http).toBe(400);
    expect(result.calls.provider).toBe(0);
    expect(result.calls.writes).toBe(0);
    expect(result.calls.filters).toEqual([]);
  });

  it('confirms the conditional updated row before reporting cancellation', async () => {
    const result = await cancel();
    expect(result.http).toBe(200);
    expect(result.body).toEqual({ status: 'cancelled' });
    expect(result.calls.filters).toContain('admin:id=' + paymentId);
    expect(result.calls.filters).toContain('admin:status=pending');
    expect(result.calls.rereads).toBe(0);
  });

  it.each(['paid', 'expired', 'cancelled', 'refunded'])('returns the actual %s winner after a zero-row update', async (winner) => {
    const result = await cancel({ winner });
    expect(result.body).toEqual({ status: winner === 'refunded' ? 'paid' : winner });
    expect(result.calls.rereads).toBe(1);
    expect(result.calls.filters).toContain('caller:id=' + paymentId);
    expect(result.state).toBe(winner);
  });

  it.each([{ updateError: true }, { winner: 'paid', rereadError: true }, { noUpdatedRow: true }])('does not fabricate cancellation after an unavailable write result %j', async (scenario) => {
    const result = await cancel(scenario);
    expect(result.http).toBeGreaterThanOrEqual(500);
    expect(result.body.status).toBeUndefined();
  });
});
