/* global __dirname */
// Provider-contract verification: production handlers + real local Auth/DB.
// Only PayMongo HTTP is stubbed. No real charge, credentials or external settlement.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'),
  { randomUUID, createHmac } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..'),
  output = path.join(root, 'plans/evidence/phase4', `provider-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
const status = spawnSync(
  'wsl.exe',
  [
    '--distribution',
    'barangayan-phase1',
    '--user',
    'root',
    '--cd',
    '/mnt/c/Users/User/barangayan',
    '--exec',
    '/opt/barangayan-tools/supabase',
    'status',
    '--output',
    'json',
  ],
  { encoding: 'utf8' },
);
assert.equal(status.status, 0);
const config = JSON.parse(status.stdout);
assert.equal(config.API_URL, 'http://127.0.0.1:54321');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'dist/phase4-tools/ui-users.json')));
const realFetch = global.fetch,
  report = { passed: false, providerMode: 'stubbed PayMongo only; real local Auth/DB', assertions: [] };
const prove = (condition, label) => {
  assert.ok(condition, label);
  report.assertions.push(label);
};
const make = (key) =>
  createClient(config.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const trusted = make(config.SERVICE_ROLE_KEY),
  resident = make(config.ANON_KEY),
  admin = make(config.ANON_KEY);
const env = {
  SUPABASE_URL: config.API_URL,
  SUPABASE_ANON_KEY: config.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
  PAYMONGO_SECRET_KEY: 'synthetic-provider-key',
  PAYMONGO_WEBHOOK_SECRET: 'synthetic-webhook-secret',
};
function load(name) {
  let handler;
  global.Deno = {
    env: { get: (key) => env[key] },
    serve: (value) => {
      handler = value;
    },
  };
  const file = path.join(root, `dist/phase4-tools/${name}.cjs`);
  require('esbuild').buildSync({
    entryPoints: [path.join(root, `supabase/functions/${name}/index.ts`)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: file,
    alias: { 'jsr:@supabase/supabase-js@2': '@supabase/supabase-js' },
  });
  require(file);
  assert.ok(handler);
  return handler;
}
let calls = [],
  intents = new Map(),
  failure = false,
  mismatch = false;
global.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith('https://api.paymongo.com/v1/')) return realFetch(input, init);
  calls.push(url);
  const body = init?.body ? JSON.parse(init.body) : null;
  let data;
  if (url.endsWith('/payment_intents')) {
    if (failure)
      return Response.json({ errors: [{ detail: 'Synthetic temporary provider failure' }] }, { status: 502 });
    const id = 'pi_' + randomUUID();
    const amount = body.data.attributes.amount;
    prove(
      amount === 4000 && body.data.attributes.currency === 'PHP',
      'Outgoing provider charge uses confirmed request amount and PHP',
    );
    intents.set(id, { amount, status: 'awaiting_next_action' });
    data = { id, attributes: { client_key: id + '_client' } };
  } else if (url.endsWith('/payment_methods')) data = { id: 'pm_' + randomUUID() };
  else if (url.endsWith('/attach'))
    data = { attributes: { next_action: { code: { image_url: 'https://provider.test/synthetic-qr.png' } } } };
  else if (url.endsWith('/cancel')) {
    intents.get(url.split('/').at(-2)).status = 'cancelled';
    data = {};
  } else {
    const id = url.split('/').at(-1),
      intent = intents.get(id);
    data = {
      id,
      attributes: {
        ...intent,
        amount: mismatch ? intent.amount + 1 : intent.amount,
        currency: 'PHP',
        payments: [{ id: 'pay_' + id }],
      },
    };
  }
  return Response.json({ data });
};
async function main() {
  assert.ifError((await resident.auth.signInWithPassword(fixtures.resident)).error);
  assert.ifError((await admin.auth.signInWithPassword(fixtures.admin)).error);
  const token = (await resident.auth.getSession()).data.session.access_token;
  const request = (handler, body) =>
    handler(
      new Request('http://local.test/function', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const create = load('create-payment-source'),
    check = load('check-payment-status'),
    webhook = load('paymongo-webhook');
  const requestId = fixtures.requests.find((row) => row.kind === 'certified_true_copy').id;
  let result = await request(create, { requestId });
  prove(result.status === 422 && calls.length === 0, 'Pending assessment makes no provider call');
  assert.ifError(
    (
      await admin.rpc('assess_service_request_fee', {
        p_input: {
          requestId,
          state: 'assessed',
          amountCentavos: 4000,
          billablePages: 4,
          basis: 'Four total billable pages across three copies',
        },
      })
    ).error,
  );
  assert.ifError(
    (await resident.rpc('set_service_request_payment_method', { p_request_id: requestId, p_method: 'qrph' }))
      .error,
  );
  failure = true;
  result = await request(create, { requestId });
  prove(result.status === 502, 'Provider failure is visible and recoverable');
  failure = false;
  const failed = await trusted.from('payments').select('*').eq('service_request_id', requestId);
  prove(
    failed.data.length === 1 && failed.data[0].status === 'failed',
    'Failed provider attempt leaves an auditable ledger entry',
  );
  const reassessment = await admin.rpc('assess_service_request_fee', {
    p_input: {
      requestId,
      state: 'assessed',
      amountCentavos: 5000,
      billablePages: 5,
      basis: 'Changed after a failed payment attempt',
    },
  });
  prove(!!reassessment.error, 'Any existing payment record freezes assessment');
  const responses = await Promise.all(Array.from({ length: 4 }, () => request(create, { requestId })));
  prove(
    responses.some((response) => response.ok) &&
      responses.every((response) => response.ok || response.status === 409),
    'Concurrent QR creation returns one charge or retryable reservation conflict',
  );
  const prepared = await request(create, { requestId });
  const source = await prepared.json();
  prove(
    prepared.ok && source.amountCentavos === 4000 && source.documentFeeCentavos === 4000,
    'Retry resumes confirmed amount',
  );
  const before = calls.length;
  const resumed = await request(create, { requestId });
  prove(
    (await resumed.json()).paymentId === source.paymentId && calls.length === before,
    'Reopening QR resumes same ledger without another provider charge',
  );
  const ledger = await trusted
    .from('payments')
    .select('*')
    .eq('service_request_id', requestId)
    .eq('status', 'pending');
  prove(
    ledger.data.length === 1 && ledger.data[0].amount_centavos === 4000,
    'One active provider payment with immutable amount',
  );
  intents.get(source.paymentIntentId).status = 'succeeded';
  mismatch = true;
  result = await request(check, { paymentId: source.paymentId });
  prove(result.status === 409, 'Mismatched provider amount cannot settle');
  mismatch = false;
  const settled = await Promise.all([
    request(check, { paymentId: source.paymentId }),
    request(check, { paymentId: source.paymentId }),
  ]);
  prove(
    settled.every((response) => response.ok),
    'Concurrent poll settlement is safe',
  );
  const paid = await trusted.from('payments').select('*').eq('id', source.paymentId).single();
  prove(
    paid.data.status === 'paid' && paid.data.amount_centavos === 4000,
    'Successful provider poll records exact payment',
  );
  const row = await trusted.from('service_requests').select('payment_status').eq('id', requestId).single();
  prove(row.data.payment_status === 'paid', 'Payment settlement reaches request consumers');
  const event = (amount) =>
    JSON.stringify({
      data: {
        attributes: {
          type: 'payment.paid',
          data: {
            id: 'pay_' + source.paymentIntentId,
            attributes: { amount, currency: 'PHP', payment_intent_id: source.paymentIntentId },
          },
        },
      },
    });
  const deliver = (body) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', env.PAYMONGO_WEBHOOK_SECRET)
      .update(timestamp + '.' + body)
      .digest('hex');
    return webhook(
      new Request('http://local.test/webhook', {
        method: 'POST',
        headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature}` },
        body,
      }),
    );
  };
  prove((await deliver(event(4001))).status === 409, 'Signed webhook still enforces recorded amount');
  prove(
    (await deliver(event(4000))).ok && (await deliver(event(4000))).ok,
    'Duplicate signed payment webhooks are idempotent',
  );
  const invalid = await webhook(
    new Request('http://local.test/webhook', { method: 'POST', body: event(4000) }),
  );
  prove(invalid.status === 401, 'Unsigned webhook denied');
  const noCharge = calls.length;
  result = await request(create, { requestId });
  prove(
    (await result.json()).status === 'paid' && calls.length === noCharge,
    'Already-paid retry never creates another charge',
  );
  const retriedPayment = await trusted.from('payments').select('paid_at').eq('id', source.paymentId).single();
  prove(
    retriedPayment.data.paid_at === paid.data.paid_at,
    'Duplicate settlements preserve the original recorded payment time',
  );
  assert.ifError(
    (
      await trusted
        .from('payments')
        .update({
          status: 'refunded',
          refund_status: 'refunded',
          refund_amount_centavos: 4000,
          refunded_at: new Date().toISOString(),
        })
        .eq('id', source.paymentId)
    ).error,
  );
  prove(
    (await deliver(event(4000))).ok &&
      (await trusted.from('payments').select('status').eq('id', source.paymentId).single()).data.status ===
        'refunded',
    'A delayed paid webhook cannot undo a recorded refund',
  );
  report.passed = true;
}
main()
  .catch((error) => {
    report.error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = realFetch;
    delete global.Deno;
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        passed: report.passed,
        assertions: report.assertions.length,
        evidence: path.relative(root, output),
      }),
    );
  });
