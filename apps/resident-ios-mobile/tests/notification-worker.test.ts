import { describe, expect, it } from 'vitest';
import { buildMessage, EXPO_RECEIPTS_URL, EXPO_SEND_URL, parseClaimed, runWorker, SEND_BATCH, type Claimed, type Fetcher, type Rpc, type RpcResult } from '../../../supabase/functions/send-notifications/worker';

const uuidFor = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const token = (index: number) => `ExponentPushToken[device-${index}]`;
const claimedRow = (index: number, tokens = [token(index)]): Claimed => ({
  outbox_id: uuidFor(index), inbox_id: uuidFor(100 + index), kind: 'request_status', title: 'Request update', body: 'Your document request is complete.',
  destination: { v: 1, kind: 'request', id: uuidFor(200 + index) }, tokens, attempt: 1,
});

type Call = { name: string; args: Record<string, unknown> };
/** Scripted database: functions the worker calls, with the answers each returns. */
function database(answers: Partial<Record<string, (args: Record<string, unknown>) => RpcResult['data'] | Error>>) {
  const calls: Call[] = [];
  const rpc: Rpc = async (name, args = {}) => {
    calls.push({ name, args });
    const answer = answers[name]?.(args);
    if (answer instanceof Error) return { data: null, error: { message: answer.message } };
    return { data: answer ?? null, error: null };
  };
  return { rpc, calls, of: (name: string) => calls.filter((call) => call.name === name) };
}
type Sent = { url: string; headers: Record<string, string>; body: unknown };
/** Scripted push provider: one reply per request, recording what was sent. */
function provider(replies: ({ status: number; body?: unknown } | 'network-error' | ((request: Sent) => { status: number; body?: unknown }))[]) {
  const sent: Sent[] = [];
  const fetch: Fetcher = async (url, init) => {
    const request = { url, headers: init.headers, body: JSON.parse(init.body) as unknown };
    sent.push(request);
    const reply = replies.shift() ?? { status: 200, body: { data: [] } };
    if (reply === 'network-error') throw new TypeError('network');
    const resolved = typeof reply === 'function' ? reply(request) : reply;
    return { status: resolved.status, json: async () => resolved.body };
  };
  return { fetch, sent };
}
const okTickets = (count: number) => ({ status: 200, body: { data: Array.from({ length: count }, (_, index) => ({ status: 'ok', id: `ticket-${index}` })) } });
const noSleep = async () => undefined;
const emptyAnswers = {
  notification_worker_due_receipts: () => [],
  notification_worker_purge: () => [{ inbox_deleted: 0, outbox_deleted: 0, events_deleted: 0 }],
  notification_worker_health: () => [{ pending_total: 0, oldest_pending_seconds: 0, dead_last_24h: 0, ticket_errors_last_24h: 0, unreceipted_over_1h: 0 }],
};

describe('claimed rows and messages (P17-T02)', () => {
  it('accepts exactly the claim shape the database returns', () => {
    expect(parseClaimed([claimedRow(1)])).toEqual([claimedRow(1)]);
    expect(parseClaimed([])).toEqual([]);
    for (const bad of [null, {}, [null], [{ ...claimedRow(1), tokens: [] }], [{ ...claimedRow(1), outbox_id: 'x' }], [{ ...claimedRow(1), destination: { v: 2, kind: 'request', id: 'x' } }], [{ ...claimedRow(1), tokens: [3] }], [{ ...claimedRow(1), attempt: '1' }]]) {
      expect(() => parseClaimed(bad)).toThrow('claim_malformed');
    }
  });
  it('builds a generic message whose data is only a versioned pointer', () => {
    const message = buildMessage(claimedRow(1), token(1));
    expect(message).toEqual({
      to: token(1), title: 'Request update', body: 'Your document request is complete.', sound: 'default', ttl: 86_400,
      data: { v: 1, kind: 'request', id: uuidFor(201), inbox: uuidFor(101) },
    });
    expect(JSON.stringify(message).length).toBeLessThan(1024);
  });
});

describe('the sender run (G13, F11)', () => {
  it('sends one message per token, records each resident\'s tickets and counts the result', async () => {
    const db = database({
      ...emptyAnswers,
      notification_worker_claim: () => [claimedRow(1, [token(1), token(2)]), claimedRow(3)],
      notification_worker_record_tickets: () => 'sent',
    });
    const push = provider([okTickets(3)]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0].url).toBe(EXPO_SEND_URL);
    expect((push.sent[0].body as unknown[]).map((message) => (message as { to: string }).to)).toEqual([token(1), token(2), token(3)]);
    expect(db.of('notification_worker_record_tickets')).toHaveLength(2);
    expect(db.of('notification_worker_record_tickets')[0].args).toEqual({
      p_outbox_id: uuidFor(1),
      p_tickets: [{ token: token(1), status: 'ok', id: 'ticket-0' }, { token: token(2), status: 'ok', id: 'ticket-1' }],
    });
    expect(summary).toMatchObject({ claimed: 2, sent: 2, retried: 0, dead: 0, errors: [] });
    expect(summary.health).toMatchObject({ pending_total: 0 });
  });
  it('splits large batches at the provider\'s limit', async () => {
    const count = SEND_BATCH + 20;
    const db = database({ ...emptyAnswers, notification_worker_claim: () => Array.from({ length: count }, (_, index) => claimedRow(index + 1)), notification_worker_record_tickets: () => 'sent' });
    const push = provider([okTickets(SEND_BATCH), okTickets(20)]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent.map((request) => (request.body as unknown[]).length)).toEqual([SEND_BATCH, 20]);
    expect(summary.sent).toBe(count);
  });
  it('passes provider errors per token to the database, which removes dead tokens', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1, [token(1), token(2)])], notification_worker_record_tickets: () => 'sent' });
    const push = provider([{ status: 200, body: { data: [{ status: 'ok', id: 't1' }, { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }] } }]);
    await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(db.of('notification_worker_record_tickets')[0].args.p_tickets).toEqual([{ token: token(1), status: 'ok', id: 't1' }, { token: token(2), status: 'error', error: 'DeviceNotRegistered' }]);
  });
  it('sends the access token only when one is configured', async () => {
    const answers = { ...emptyAnswers, notification_worker_claim: () => [claimedRow(1)], notification_worker_record_tickets: () => 'sent' };
    const without = provider([okTickets(1)]);
    await runWorker({ rpc: database(answers).rpc, fetch: without.fetch, sleep: noSleep });
    expect(without.sent[0].headers.Authorization).toBeUndefined();
    const withToken = provider([okTickets(1)]);
    await runWorker({ rpc: database(answers).rpc, fetch: withToken.fetch, sleep: noSleep, accessToken: 'expo-access' });
    expect(withToken.sent[0].headers.Authorization).toBe('Bearer expo-access');
  });
  it('retries rate limiting and server errors, then succeeds', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1)], notification_worker_record_tickets: () => 'sent' });
    const push = provider([{ status: 429 }, { status: 503 }, okTickets(1)]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent).toHaveLength(3);
    expect(summary.sent).toBe(1);
    expect(db.of('notification_worker_fail')).toHaveLength(0);
  });
  it('hands the whole batch back for backoff when the provider stays down, never sending a ticket', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1), claimedRow(2)], notification_worker_fail: () => 'pending' });
    const push = provider([{ status: 503 }, { status: 503 }, { status: 503 }]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(db.of('notification_worker_fail').map((call) => call.args)).toEqual([
      { p_outbox_id: uuidFor(1), p_error: 'provider_http_503' }, { p_outbox_id: uuidFor(2), p_error: 'provider_http_503' },
    ]);
    expect(db.of('notification_worker_record_tickets')).toHaveLength(0);
    expect(summary).toMatchObject({ claimed: 2, retried: 2, sent: 0 });
  });
  it('does not repeat a request the provider rejected as invalid', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1)], notification_worker_fail: () => 'pending' });
    const push = provider([{ status: 400, body: { errors: [{ code: 'VALIDATION_ERROR' }] } }]);
    await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent).toHaveLength(1);
    expect(db.of('notification_worker_fail')[0].args.p_error).toBe('provider_http_400');
  });
  it('treats a network failure and a malformed answer as failures to retry', async () => {
    const unreachable = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1)], notification_worker_fail: () => 'pending' });
    await runWorker({ rpc: unreachable.rpc, fetch: provider(['network-error', 'network-error', 'network-error']).fetch, sleep: noSleep });
    expect(unreachable.of('notification_worker_fail')[0].args.p_error).toBe('provider_unreachable');
    const malformed = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1)], notification_worker_fail: () => 'pending' });
    await runWorker({ rpc: malformed.rpc, fetch: provider([{ status: 200, body: { data: [{ status: 'surprise' }] } }]).fetch, sleep: noSleep });
    expect(malformed.of('notification_worker_fail')[0].args.p_error).toBe('provider_malformed');
    const short = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1), claimedRow(2)], notification_worker_fail: () => 'pending' });
    await runWorker({ rpc: short.rpc, fetch: provider([okTickets(1)]).fetch, sleep: noSleep });
    expect(short.of('notification_worker_fail')).toHaveLength(2);
  });
  it('counts a row that reached its last attempt as dead and a skipped one as skipped', async () => {
    const states = ['dead', 'skipped'];
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1), claimedRow(2)], notification_worker_record_tickets: () => states.shift() });
    const summary = await runWorker({ rpc: db.rpc, fetch: provider([okTickets(2)]).fetch, sleep: noSleep });
    expect(summary).toMatchObject({ dead: 1, skipped: 1, sent: 0 });
  });
  it('sends nothing and still checks receipts, purges and reports health when nothing is due', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [] });
    const push = provider([]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent).toHaveLength(0);
    expect(summary).toMatchObject({ claimed: 0, purged: { inbox: 0, outbox: 0, events: 0 } });
    expect(db.calls.map((call) => call.name)).toEqual(['notification_worker_claim', 'notification_worker_due_receipts', 'notification_worker_purge', 'notification_worker_health']);
  });
  it('keeps going and reports an error when one database step fails', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => new Error('permission denied') });
    const summary = await runWorker({ rpc: db.rpc, fetch: provider([]).fetch, sleep: noSleep });
    expect(summary.errors).toEqual(['notification_worker_claim_failed']);
    expect(summary.health).not.toBeNull();
  });
  it('reports a claim in an unknown shape instead of sending it', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [{ nope: true }] });
    const push = provider([]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent).toHaveLength(0);
    expect(summary.errors).toEqual(['claim_malformed']);
  });
  it('keeps one row\'s database failure from stopping the others', async () => {
    let first = true;
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1), claimedRow(2)], notification_worker_record_tickets: () => { if (first) { first = false; return new Error('deadlock'); } return 'sent'; } });
    const summary = await runWorker({ rpc: db.rpc, fetch: provider([okTickets(2)]).fetch, sleep: noSleep });
    expect(summary.sent).toBe(1);
    expect(summary.errors).toEqual(['notification_worker_record_tickets_failed']);
  });
});

describe('receipts (G13, G20)', () => {
  it('asks Expo for the due receipts and records ok and error outcomes, leaving missing ones for later', async () => {
    const due = [
      { delivery_id: uuidFor(1), ticket_id: 'ticket-a' }, { delivery_id: uuidFor(2), ticket_id: 'ticket-b' }, { delivery_id: uuidFor(3), ticket_id: 'ticket-c' },
    ];
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [], notification_worker_due_receipts: () => due, notification_worker_record_receipts: () => 2 });
    const push = provider([{ status: 200, body: { data: { 'ticket-a': { status: 'ok' }, 'ticket-b': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } } } }]);
    const summary = await runWorker({ rpc: db.rpc, fetch: push.fetch, sleep: noSleep });
    expect(push.sent[0].url).toBe(EXPO_RECEIPTS_URL);
    expect(push.sent[0].body).toEqual({ ids: ['ticket-a', 'ticket-b', 'ticket-c'] });
    expect(db.of('notification_worker_record_receipts')[0].args.p_receipts).toEqual([
      { delivery_id: uuidFor(1), status: 'ok' }, { delivery_id: uuidFor(2), status: 'error', error: 'DeviceNotRegistered' },
    ]);
    expect(summary).toMatchObject({ receiptsChecked: 3, receiptsRecorded: 2, errors: [] });
  });
  it('reports a receipts failure without losing the run', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [], notification_worker_due_receipts: () => [{ delivery_id: uuidFor(1), ticket_id: 'ticket-a' }] });
    const summary = await runWorker({ rpc: db.rpc, fetch: provider([{ status: 500 }, { status: 500 }, { status: 500 }]).fetch, sleep: noSleep });
    expect(summary.errors).toEqual(['receipts_http_500']);
    expect(db.of('notification_worker_record_receipts')).toHaveLength(0);
    expect(summary.health).not.toBeNull();
  });
});

describe('what the sender discloses', () => {
  it('never puts a token, ticket or message text in its summary', async () => {
    const db = database({ ...emptyAnswers, notification_worker_claim: () => [claimedRow(1)], notification_worker_fail: () => 'pending' });
    const summary = await runWorker({ rpc: db.rpc, fetch: provider([{ status: 503 }, { status: 503 }, { status: 503 }]).fetch, sleep: noSleep });
    const text = JSON.stringify(summary);
    expect(text).not.toContain('ExponentPushToken');
    expect(text).not.toContain('Your document request');
    expect(text).not.toContain('ticket-');
  });
});
