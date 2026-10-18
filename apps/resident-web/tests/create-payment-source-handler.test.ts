import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Run the real deployed handler code with isolated database/provider boundaries.
// These tests never create real charges or modify hosted payment records.
const source = fs.readFileSync(new URL('../../../supabase/functions/create-payment-source/index.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source.replace("import { createClient } from 'jsr:@supabase/supabase-js@2';", ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
type Row = Record<string, unknown>;
type Scenario = { owner?: string; authorized?: boolean; paid?: boolean; method?: string; rows?: Row[]; conflict?: Row; providerFailure?: boolean; holdIntent?: boolean };

function fixture(scenario: Scenario = {}) {
  const request = { id: 'request', resident_id: scenario.owner ?? 'owner', barangay_id: 'barangay', status: 'submitted',
    reference_number: 'REQ-FIXTURE', payment_status: scenario.paid ? 'paid' : 'pending', payment_method: scenario.method ?? 'qrph',
    contract_version: 2, fee_assessment_state: 'assessed', assessed_amount_centavos: 10000,
    document_type: { name: 'Indigency', fee_centavos: 99999, service_kind: 'indigency' } };
  const rows = scenario.rows ?? [];
  const calls = { intents: 0, methods: 0, attaches: 0, cancels: 0, inserts: 0, amounts: [] as number[] };
  let releaseIntent: () => void = () => {};
  const intentGate = new Promise<void>((resolve) => { releaseIntent = resolve; });
  let intentStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => { intentStarted = resolve; });
  function createClient(_url: string, key: string) {
    return {
      auth: { getUser: async () => ({ data: { user: scenario.authorized === false ? null : { id: 'owner' } } }) },
      from(table: string) {
        let operation = 'select';
        let value: Row = {};
        let one = false;
        let limit = Infinity;
        const filters: ((row: Row) => boolean)[] = [];
        const execute = async () => {
          if (table === 'service_requests') return { data: request, error: null };
          expect(table).toBe('payments');
          if (operation === 'insert') {
            expect(key).toBe('service');
            calls.inserts++;
            if (scenario.conflict) { rows.push(scenario.conflict); scenario.conflict = undefined; }
            if (rows.some((row) => ['pending', 'paid'].includes(String(row.status)))) {
              return { data: null, error: { code: '23505', message: 'active_payment_already_exists' } };
            }
            const row = { id: 'payment', created_at: new Date().toISOString(), paymongo_payment_intent_id: null,
              qr_image_url: null, expires_at: null, ...value };
            rows.push(row);
            return { data: one ? row : [row], error: null };
          }
          const found = rows.filter((row) => filters.every((filter) => filter(row))).slice(0, limit);
          if (operation === 'update') {
            expect(key).toBe('service');
            found.forEach((row) => Object.assign(row, value));
          }
          return { data: one ? found[0] ?? null : found, error: null };
        };
        const query = {
          select() { return query; },
          eq(field: string, expected: unknown) { filters.push((row) => row[field] === expected); return query; },
          in(field: string, expected: unknown[]) { filters.push((row) => expected.includes(row[field])); return query; },
          order() { return query; },
          limit(count: number) { limit = count; return query; },
          insert(row: Row) { operation = 'insert'; value = row; return query; },
          update(row: Row) { operation = 'update'; value = row; return query; },
          single() { one = true; return execute(); },
          maybeSingle() { one = true; return execute(); },
          then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) { return execute().then(resolve, reject); },
        };
        return query;
      },
    };
  }
  let handler!: (req: Request) => Promise<Response>;
  vm.runInNewContext(script, {
    createClient, Request, Response, btoa, console,
    Deno: { env: { get: (name: string) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'fixture' },
      serve: (callback: typeof handler) => { handler = callback; } },
    fetch: async (url: string, options: RequestInit) => {
      expect(rows.filter((row) => row.status === 'pending')).toHaveLength(1);
      const payload = JSON.parse(String(options.body));
      if (url.endsWith('/payment_intents')) {
        calls.intents++;
        calls.amounts.push(payload.data.attributes.amount);
        intentStarted();
        if (scenario.holdIntent) await intentGate;
        if (scenario.providerFailure) return new Response(JSON.stringify({ errors: [{ detail: 'Provider unavailable' }] }), { status: 503 });
        return Response.json({ data: { id: 'pi_fixture', attributes: { client_key: 'client_fixture' } } });
      }
      if (url.endsWith('/payment_methods')) { calls.methods++; return Response.json({ data: { id: 'pm_fixture' } }); }
      if (url.endsWith('/attach')) { calls.attaches++; return Response.json({ data: { attributes: { next_action: { code: { image_url: 'data:image/png;base64,fixture' } } } } }); }
      if (url.endsWith('/cancel')) { calls.cancels++; return Response.json({}); }
      throw new Error(`Unexpected provider call: ${url}`);
    },
  });
  const invoke = () => handler(new Request('http://fixture/create-payment-source', {
    method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify({ requestId: 'request' }),
  }));
  return { invoke, rows, calls, started, releaseIntent };
}

function readyRow(overrides: Row = {}): Row {
  return { id: 'existing', service_request_id: 'request', method: 'qrph', status: 'pending',
    document_fee_centavos: 10000, amount_centavos: 10000, qrph_creation_key: null,
    paymongo_payment_intent_id: 'pi_existing', qr_image_url: 'existing-qr',
    created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), ...overrides };
}

describe('QR PH setup and reservation', () => {
  it('generates once using the confirmed amount and resumes the same payment', async () => {
    const f = fixture();
    const first = await f.invoke();
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body).toMatchObject({ paymentId: 'payment', qrImageUrl: 'data:image/png;base64,fixture', amountCentavos: 10000 });
    expect(await (await f.invoke()).json()).toEqual(body);
    expect(f.calls).toMatchObject({ intents: 1, methods: 1, attaches: 1, inserts: 1, amounts: [10000] });
    expect(f.rows[0].qrph_creation_key).toBeNull();
  });

  it('serializes simultaneous attempts before either can create a provider charge', async () => {
    const f = fixture({ holdIntent: true });
    const attempts = [f.invoke(), f.invoke()];
    await f.started;
    const waiting = await Promise.race(attempts);
    expect(waiting.status).toBe(202);
    expect(await waiting.clone().json()).toEqual({ status: 'preparing' });
    expect(f.calls.intents).toBe(1);
    f.releaseIntent();
    const responses = await Promise.all(attempts);
    const ready = responses.find((response) => response.status === 200)!;
    const body = await ready.json();
    expect(await (await f.invoke()).json()).toEqual(body);
    expect(f.rows).toHaveLength(1);
    expect(f.calls.intents).toBe(1);
  });

  it('reports an existing unfinished reservation as preparing without another charge', async () => {
    const f = fixture({ rows: [readyRow({ qr_image_url: null, expires_at: null, qrph_creation_key: 'request' })] });
    const response = await f.invoke();
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'preparing' });
    expect(f.calls.intents).toBe(0);
  });

  it('returns the winning QR when another caller finishes just before reservation', async () => {
    const f = fixture({ conflict: readyRow() });
    expect(await (await f.invoke()).json()).toMatchObject({ paymentId: 'existing', qrImageUrl: 'existing-qr' });
    expect(f.calls.intents).toBe(0);
  });

  it('recognizes a settled payment that wins the reservation race', async () => {
    const f = fixture({ conflict: readyRow({ status: 'paid' }) });
    expect(await (await f.invoke()).json()).toEqual({ status: 'paid' });
    expect(f.calls.intents).toBe(0);
  });

  it('does not treat a pickup payment as a QR reservation', async () => {
    const f = fixture({ conflict: readyRow({ method: 'pickup', qr_image_url: null }) });
    const response = await f.invoke();
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty('status', 'preparing');
    expect(f.calls.intents).toBe(0);
  });

  it('blocks unauthorized, foreign-owned, paid, and pickup requests before provider calls', async () => {
    for (const scenario of [{ authorized: false }, { owner: 'other' }, { paid: true }, { method: 'pickup' }]) {
      const f = fixture(scenario);
      const response = await f.invoke();
      expect([200, 401, 404, 409]).toContain(response.status);
      expect(f.calls.intents).toBe(0);
      expect(f.calls.inserts).toBe(0);
    }
  });

  it('releases an uncharged reservation after an explicit provider rejection', async () => {
    const f = fixture({ providerFailure: true });
    expect((await f.invoke()).status).toBe(502);
    expect(f.rows[0]).toMatchObject({ status: 'failed', qrph_creation_key: null });
    expect(f.calls.attaches).toBe(0);
  });
});
