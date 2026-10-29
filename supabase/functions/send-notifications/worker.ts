// The notification sender's logic (Resident iOS Phase 17, P17-T02), kept free of Deno and
// network globals so the same code runs in the Edge Function and in the repository's tests.
//
// One run: claim due outbox rows (the database applies each resident's preferences at that
// moment), send them to Expo Push in batches, record the tickets, check the receipts that
// are due, purge expired rows and report operational counts. Nothing here logs or returns a
// push token, a ticket id or message text.

export const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Expo accepts at most 100 messages per send request and 1000 ids per receipts request. */
export const SEND_BATCH = 100;
export const RECEIPT_BATCH = 1000;
const CLAIM_LIMIT = 100;
/** System notices published and delivered per run; the database also caps a call at 100 and resumes from its cursor. */
const NOTICE_LIMIT = 100;
const RECEIPT_LIMIT = 300;
/** A message not delivered within a day is no longer news (the database also skips such rows). */
const TTL_SECONDS = 86_400;
const REQUEST_ATTEMPTS = 3;
const REQUEST_BACKOFF_MS = [500, 2000];
const REQUEST_TIMEOUT_MS = 15_000;

export type RpcResult = { data: unknown; error: { message: string } | null };
export type Rpc = (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
export type Fetcher = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

export type WorkerDeps = {
  rpc: Rpc;
  fetch: Fetcher;
  /** Optional Expo access token (enhanced push security). */
  accessToken?: string;
  sleep?: (ms: number) => Promise<void>;
};

/** What a notification is about: version 1 is a record reference; version 2 is a System notice or an Account screen. Never a URL. */
export type Destination =
  | { v: 1; kind: string; id: string }
  | { v: 2; kind: 'notice'; id: string }
  | { v: 2; kind: 'account'; screen: string };
export type Claimed = { outbox_id: string; inbox_id: string; kind: string; title: string; body: string; destination: Destination; tokens: string[]; attempt: number };
type Ticket = { token: string; status: 'ok' | 'error'; id?: string; error?: string };

export type RunSummary = {
  claimed: number;
  sent: number;
  retried: number;
  dead: number;
  skipped: number;
  receiptsChecked: number;
  receiptsRecorded: number;
  purged: { inbox: number; outbox: number; events: number } | null;
  health: Record<string, number> | null;
  /** The due-notice step: notices published, inbox rows written and notices still waiting. Null when it returned nothing usable. */
  notices: { published: number; delivered: number; pending: number } | null;
  errors: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Mirrors valid_notification_destination (migration 0145) and the Android parser. */
const ACCOUNT_SCREENS = ['settings', 'profile', 'valid_id', 'email_verification', 'change_password'];

function parseDestination(destination: Record<string, unknown>): Destination | null {
  if (destination.v === 1 && typeof destination.kind === 'string' && typeof destination.id === 'string') return { v: 1, kind: destination.kind, id: destination.id };
  if (destination.v !== 2 || Object.keys(destination).length !== 3) return null;
  if (destination.kind === 'notice' && typeof destination.id === 'string' && UUID.test(destination.id)) return { v: 2, kind: 'notice', id: destination.id };
  if (destination.kind === 'account' && typeof destination.screen === 'string' && ACCOUNT_SCREENS.includes(destination.screen)) return { v: 2, kind: 'account', screen: destination.screen };
  return null;
}

export function parseClaimed(data: unknown): Claimed[] {
  if (!Array.isArray(data)) throw new Error('claim_malformed');
  return data.map((row): Claimed => {
    if (!isRecord(row)) throw new Error('claim_malformed');
    const destination = row.destination;
    if (typeof row.outbox_id !== 'string' || !UUID.test(row.outbox_id) || typeof row.inbox_id !== 'string' || !UUID.test(row.inbox_id)
      || typeof row.kind !== 'string' || typeof row.title !== 'string' || typeof row.body !== 'string'
      || !isRecord(destination) || !Array.isArray(row.tokens) || !row.tokens.length || !row.tokens.every((token) => typeof token === 'string')
      || typeof row.attempt !== 'number') throw new Error('claim_malformed');
    const parsed = parseDestination(destination);
    if (!parsed) throw new Error('claim_malformed');
    return { outbox_id: row.outbox_id, inbox_id: row.inbox_id, kind: row.kind, title: row.title, body: row.body, destination: parsed, tokens: row.tokens as string[], attempt: row.attempt };
  });
}

/** The push payload: generic text and a versioned reference. `data` carries no record content. */
export function buildMessage(row: Claimed, token: string) {
  return {
    to: token,
    title: row.title,
    body: row.body,
    sound: 'default',
    ttl: TTL_SECONDS,
    data: { ...row.destination, inbox: row.inbox_id },
  };
}

async function postJson(deps: WorkerDeps, url: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let last: { status: number; body: unknown } = { status: 0, body: null };
  for (let attempt = 0; attempt < REQUEST_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await deps.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(deps.accessToken ? { Authorization: `Bearer ${deps.accessToken}` } : {}) },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      last = { status: response.status, body };
      // Only rate limiting and server errors are worth repeating; a 4xx means the request itself is wrong.
      if (response.status !== 429 && response.status < 500) return last;
    } catch {
      last = { status: 0, body: null };
    } finally {
      clearTimeout(timer);
    }
    if (attempt < REQUEST_ATTEMPTS - 1) await sleep(REQUEST_BACKOFF_MS[attempt] ?? 2000);
  }
  return last;
}

type ProviderTicket = { status: 'ok'; id: string } | { status: 'error'; error: string };

function parseTickets(body: unknown, expected: number): ProviderTicket[] | null {
  if (!isRecord(body) || !Array.isArray(body.data) || body.data.length !== expected) return null;
  const tickets: ProviderTicket[] = [];
  for (const item of body.data) {
    if (!isRecord(item)) return null;
    if (item.status === 'ok' && typeof item.id === 'string') tickets.push({ status: 'ok', id: item.id });
    else if (item.status === 'error') {
      const details = isRecord(item.details) ? item.details : {};
      tickets.push({ status: 'error', error: typeof details.error === 'string' ? details.error.slice(0, 60) : 'unknown' });
    } else return null;
  }
  return tickets;
}

async function call(deps: WorkerDeps, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const result = await deps.rpc(name, args);
  if (result.error) throw new Error(`${name}_failed`);
  return result.data;
}

export async function runWorker(deps: WorkerDeps): Promise<RunSummary> {
  const summary: RunSummary = { claimed: 0, sent: 0, retried: 0, dead: 0, skipped: 0, receiptsChecked: 0, receiptsRecorded: 0, purged: null, health: null, notices: null, errors: [] };
  const note = (error: unknown) => { summary.errors.push(error instanceof Error ? error.message.slice(0, 80) : 'unknown'); };
  const tally = (state: unknown) => {
    if (state === 'sent') summary.sent++;
    else if (state === 'skipped') summary.skipped++;
    else if (state === 'dead') summary.dead++;
    else summary.retried++;
  };

  // Publish due scheduled notices and deliver pending revisions first, so their alerts are claimable in this same run.
  // A failure here must not hold back the alerts that are already due.
  try {
    const due = await call(deps, 'notification_publish_due_notices', { p_limit: NOTICE_LIMIT });
    const row = Array.isArray(due) ? due[0] : due;
    if (isRecord(row)) summary.notices = { published: Number(row.published) || 0, delivered: Number(row.delivered) || 0, pending: Number(row.pending_notices) || 0 };
  } catch (error) { note(error); }

  try {
    const rows = parseClaimed(await call(deps, 'notification_worker_claim', { p_limit: CLAIM_LIMIT }));
    summary.claimed = rows.length;
    const outbound = rows.flatMap((row) => row.tokens.map((token) => ({ row, token })));
    const tickets = new Map<string, Ticket[]>();
    const failed = new Map<string, string>();
    for (let start = 0; start < outbound.length; start += SEND_BATCH) {
      const batch = outbound.slice(start, start + SEND_BATCH);
      const { status, body } = await postJson(deps, EXPO_SEND_URL, batch.map(({ row, token }) => buildMessage(row, token)));
      const parsed = status === 200 ? parseTickets(body, batch.length) : null;
      if (!parsed) {
        const reason = status === 200 ? 'provider_malformed' : status === 0 ? 'provider_unreachable' : `provider_http_${status}`;
        for (const { row } of batch) failed.set(row.outbox_id, reason);
        continue;
      }
      batch.forEach(({ row, token }, index) => {
        const ticket = parsed[index];
        const list = tickets.get(row.outbox_id) ?? [];
        list.push(ticket.status === 'ok' ? { token, status: 'ok', id: ticket.id } : { token, status: 'error', error: ticket.error });
        tickets.set(row.outbox_id, list);
      });
    }
    for (const row of rows) {
      try {
        const reason = failed.get(row.outbox_id);
        if (reason || !tickets.has(row.outbox_id)) tally(await call(deps, 'notification_worker_fail', { p_outbox_id: row.outbox_id, p_error: reason ?? 'provider_incomplete' }));
        else tally(await call(deps, 'notification_worker_record_tickets', { p_outbox_id: row.outbox_id, p_tickets: tickets.get(row.outbox_id) }));
      } catch (error) { note(error); }
    }
  } catch (error) { note(error); }

  try {
    const due = await call(deps, 'notification_worker_due_receipts', { p_limit: RECEIPT_LIMIT });
    if (!Array.isArray(due)) throw new Error('receipts_malformed');
    const pending = due.filter((item): item is { delivery_id: string; ticket_id: string } => isRecord(item) && typeof item.delivery_id === 'string' && typeof item.ticket_id === 'string');
    summary.receiptsChecked = pending.length;
    for (let start = 0; start < pending.length; start += RECEIPT_BATCH) {
      const batch = pending.slice(start, start + RECEIPT_BATCH);
      const { status, body } = await postJson(deps, EXPO_RECEIPTS_URL, { ids: batch.map((item) => item.ticket_id) });
      if (status !== 200 || !isRecord(body) || !isRecord(body.data)) { note(new Error(status === 200 ? 'receipts_malformed' : `receipts_http_${status}`)); continue; }
      const receipts = body.data;
      const results = batch.flatMap((item) => {
        const receipt = receipts[item.ticket_id];
        if (!isRecord(receipt)) return [];
        if (receipt.status === 'ok') return [{ delivery_id: item.delivery_id, status: 'ok' }];
        const details = isRecord(receipt.details) ? receipt.details : {};
        return [{ delivery_id: item.delivery_id, status: 'error', error: typeof details.error === 'string' ? details.error.slice(0, 60) : 'unknown' }];
      });
      if (results.length) {
        const recorded = await call(deps, 'notification_worker_record_receipts', { p_receipts: results });
        if (typeof recorded === 'number') summary.receiptsRecorded += recorded;
      }
    }
  } catch (error) { note(error); }

  try {
    const purged = await call(deps, 'notification_worker_purge');
    const row = Array.isArray(purged) ? purged[0] : purged;
    if (isRecord(row)) summary.purged = { inbox: Number(row.inbox_deleted) || 0, outbox: Number(row.outbox_deleted) || 0, events: Number(row.events_deleted) || 0 };
  } catch (error) { note(error); }

  try {
    const health = await call(deps, 'notification_worker_health');
    const row = Array.isArray(health) ? health[0] : health;
    if (isRecord(row)) summary.health = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0]));
  } catch (error) { note(error); }

  return summary;
}
