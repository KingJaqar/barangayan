import { describe, expect, it } from 'vitest';
import { buildExport, cooldownSeconds, EXPORT_COOLDOWN_MS, PAGE_SIZE, readHouseholdAttendanceExport, REQUIRED_SECTIONS, residentHistory, type Query, type Reader } from '../../../supabase/functions/export-my-data/export-v2';
import { EXPORT_SECTIONS, validateExport } from '../src/features/privacy/export-contract';

const USER = '11111111-1111-4111-8111-111111111111';
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** An in-memory PostgREST stand-in: ownership and soft-delete filters, the keyset `or()` the module builds, two-column order and limit. */
function reader(tables: Tables, options: { failTable?: string; failAfterPages?: Record<string, number> } = {}): Reader & { calls: string[] } {
  const calls: string[] = [];
  const pagesRead: Record<string, number> = {};
  const from = (table: string) => ({
    select(columns: string): Query {
      calls.push(`${table}:${columns.split(',')[0]}`);
      const filters: ((row: Row) => boolean)[] = [];
      let order: string[] = [];
      let max = Infinity;
      let single = false;
      const run = () => {
        pagesRead[table] = (pagesRead[table] ?? 0) + 1;
        if (options.failTable === table) return { data: null, error: { message: 'read failed' } };
        if (options.failAfterPages?.[table] !== undefined && pagesRead[table] > options.failAfterPages[table]) return { data: null, error: { message: 'later page failed' } };
        let rows = (tables[table] ?? []).filter((row) => filters.every((test) => test(row)));
        rows = [...rows].sort((a, b) => order.reduce((result, column) => result || String(a[column]).localeCompare(String(b[column])), 0));
        rows = rows.slice(0, max);
        return { data: single ? rows[0] ?? null : rows, error: null };
      };
      const query: Query = {
        eq(column, value) { filters.push((row) => row[column.replace('service_requests.', '')] === value || (column.startsWith('service_requests.') && (row.service_requests as Row | undefined)?.resident_id === value)); return query; },
        is(column) { filters.push((row) => row[column] === null || row[column] === undefined); return query; },
        or(expression) {
          const match = /^(\w+)\.gt\."(.*?)",and\(\1\.eq\."\2",(\w+)\.gt\."(.*?)"\)$/.exec(expression);
          if (!match) throw new Error(`unexpected filter ${expression}`);
          const [, primary, first, tiebreak, second] = match;
          filters.push((row) => String(row[primary]) > first || (String(row[primary]) === first && String(row[tiebreak]) > second));
          return query;
        },
        order(column) { order = [...order, column]; return query; },
        limit(count) { max = count; return query; },
        maybeSingle() { single = true; return query; },
        then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
      };
      return query;
    },
  });
  return { from, calls };
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stamp = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();

describe('export function v2: reading every section', () => {
  it('reads past the 500-row page and returns every row once, in order', async () => {
    const requests: Row[] = Array.from({ length: PAGE_SIZE * 2 + 37 }, (_, n) => ({ id: id(n), resident_id: USER, deleted_at: null, created_at: stamp(Math.floor(n / 3)), reference_number: `REQ-${n}` }));
    const outcome = await buildExport(reader({ profiles: [{ id: USER, full_name: 'M' }], service_requests: requests }), { id: USER, email: 'm@example.com' }, new Date('2026-10-21T00:00:00Z'));
    expect(outcome.complete).toBe(true);
    if (!outcome.complete) return;
    const section = outcome.envelope.sections.service_requests;
    expect(section.status).toBe('complete');
    if (section.status !== 'complete') return;
    expect(section.rowCount).toBe(requests.length);
    expect(new Set(section.rows.map((row) => (row as Row).id)).size).toBe(requests.length);
  });

  it('includes rows that share the timestamp at a page boundary', async () => {
    const same = Array.from({ length: PAGE_SIZE + 5 }, (_, n) => ({ id: id(n), resident_id: USER, deleted_at: null, created_at: stamp(1) }));
    const outcome = await buildExport(reader({ profiles: [{ id: USER }], service_requests: same }), { id: USER, email: null }, new Date());
    expect(outcome.complete && (outcome.envelope.sections.service_requests as { rowCount: number }).rowCount).toBe(PAGE_SIZE + 5);
  });

  it('produces an envelope the app accepts, with every required section and only this resident rows', async () => {
    const outcome = await buildExport(reader({
      profiles: [{ id: USER, full_name: 'M' }, { id: id(9), full_name: 'Other' }],
      service_requests: [{ id: id(1), resident_id: USER, deleted_at: null, created_at: stamp(1) }, { id: id(2), resident_id: id(9), deleted_at: null, created_at: stamp(2) }],
      payments: [{ id: id(3), created_at: stamp(3), deleted_at: null, service_requests: { resident_id: USER } }, { id: id(4), created_at: stamp(4), deleted_at: null, service_requests: { resident_id: id(9) } }],
    }), { id: USER, email: 'm@example.com' }, new Date('2026-10-21T00:00:00Z'));
    expect(outcome.complete).toBe(true);
    if (!outcome.complete) return;
    expect(Object.keys(outcome.envelope.sections)).toEqual(EXPORT_SECTIONS.map((entry) => entry.name));
    expect((outcome.envelope.sections.service_requests as { rows: Row[] }).rows.map((row) => row.id)).toEqual([id(1)]);
    const payments = (outcome.envelope.sections.payments as { rows: Row[] }).rows;
    expect(payments.map((row) => row.id)).toEqual([id(3)]);
    expect(payments[0]).not.toHaveProperty('service_requests');
    expect(validateExport(JSON.parse(JSON.stringify(outcome.envelope)), USER).ok).toBe(true);
  });

  it('fails the whole export when any required section cannot be read, naming it', async () => {
    const outcome = await buildExport(reader({ profiles: [{ id: USER }] }, { failTable: 'payments' }), { id: USER, email: null }, new Date());
    expect(outcome).toMatchObject({ complete: false, failedSections: ['payments'] });
  });

  it('fails a section whose later page cannot be read instead of returning the first pages as complete', async () => {
    const rows = Array.from({ length: PAGE_SIZE + 10 }, (_, n) => ({ id: id(n), resident_id: USER, deleted_at: null, created_at: stamp(n) }));
    const outcome = await buildExport(reader({ profiles: [{ id: USER }], service_requests: rows }, { failAfterPages: { service_requests: 1 } }), { id: USER, email: null }, new Date());
    expect(outcome).toMatchObject({ complete: false, failedSections: ['service_requests'] });
  });

  it('treats a missing profile as a failure the app also refuses', async () => {
    const outcome = await buildExport(reader({}), { id: USER, email: null }, new Date());
    expect(outcome.complete).toBe(true);
    if (outcome.complete) expect(validateExport(JSON.parse(JSON.stringify(outcome.envelope)), USER)).toMatchObject({ ok: false, reason: 'incomplete', sections: ['Profile'] });
  });

  it('reports a section too large to export as failed, not cut short', async () => {
    const rows = Array.from({ length: 25 }, (_, n) => ({ id: id(n), resident_id: USER, deleted_at: null, created_at: stamp(n) }));
    const limited = await buildExport(reader({ profiles: [{ id: USER }], service_requests: rows }), { id: USER, email: null }, new Date(), { pageSize: 10, maxPages: 2 });
    expect(limited).toMatchObject({ complete: false, failedSections: ['service_requests'] });
    const enough = await buildExport(reader({ profiles: [{ id: USER }], service_requests: rows }), { id: USER, email: null }, new Date(), { pageSize: 10, maxPages: 3 });
    expect(enough.complete).toBe(true);
  });
});

describe('export function v2: what is selected', () => {
  const selects = REQUIRED_SECTIONS.map((spec) => spec.select).join(',');
  it('never selects staff identities, secrets, storage paths or provider internals', () => {
    for (const forbidden of ['reviewed_by', 'assessed_by', 'collected_by', 'refunded_by', 'fee_assessed_by', 'requirements_reviewed_by', 'personal_appearance_recorded_by', 'expo_push_token', 'idempotency_key', 'submission_payload', 'object_path', 'front_path', 'back_path', 'id_photo_urls', 'id_document_path', 'qr_image_url', 'photo_urls', 'destination']) {
      expect(selects, forbidden).not.toContain(forbidden);
    }
  });

  it('never selects with a wildcard', () => {
    expect(selects).not.toContain('*');
  });

  it('covers the sections the plan requires', () => {
    expect(REQUIRED_SECTIONS.map((spec) => spec.name)).toEqual(EXPORT_SECTIONS.map((entry) => entry.name));
  });

  it('reduces stored status history to what the resident already sees', () => {
    expect(residentHistory([{ status: 'in_progress', at: '2026-01-01T00:00:00Z', note: 'Ready soon', changed_by: id(1) }, { status: 1 }, null, 'x'])).toEqual([{ status: 'in_progress', at: '2026-01-01T00:00:00Z', note: 'Ready soon' }]);
    expect(residentHistory(undefined)).toEqual([]);
  });
});

describe('household attendance exports', () => {
  const stays = Array.from({ length: 7 }, (_, n) => ({ id: id(n), household_profile_id: USER, checked_in_at: stamp(1) }));
  // Different staff can reuse a request UUID, even at the same timestamp.
  const receipts = Array.from({ length: 7 }, (_, n) => ({ id: id(n), request_id: id(1), household_profile_id: USER, created_at: stamp(1) }));
  const tables = { profiles: [{ id: USER }], household_attendance: stays,
    household_attendance_receipt_exports: [...receipts, { id: id(90), request_id: id(1), household_profile_id: id(90), created_at: stamp(1) }] };

  it('paginates both new sections, including timestamp ties, for v1 and v2', async () => {
    const legacy = await readHouseholdAttendanceExport(reader(tables), USER, { pageSize: 3, maxPages: 5 });
    const current = await buildExport(reader(tables), { id: USER, email: null }, new Date(), { pageSize: 3, maxPages: 5 });
    expect(legacy.household_attendance).toMatchObject({ status: 'complete', rowCount: 7, rows: stays });
    expect(legacy.household_attendance_receipts).toMatchObject({ status: 'complete', rowCount: 7, rows: receipts });
    expect(current.complete && current.envelope.sections.household_attendance).toEqual(legacy.household_attendance);
    expect(current.complete && current.envelope.sections.household_attendance_receipts).toEqual(legacy.household_attendance_receipts);
  });

  it('fails a later attendance or receipt page without claiming a complete export', async () => {
    for (const table of ['household_attendance', 'household_attendance_receipt_exports']) {
      const sections = await readHouseholdAttendanceExport(reader(tables, { failAfterPages: { [table]: 1 } }), USER, { pageSize: 3, maxPages: 5 });
      const section = table === 'household_attendance' ? 'household_attendance' : 'household_attendance_receipts';
      expect(sections[section]).toMatchObject({ status: 'failed', rowCount: 0 });
      const result = await buildExport(reader(tables, { failAfterPages: { [table]: 1 } }), { id: USER, email: null }, new Date(), { pageSize: 3, maxPages: 5 });
      expect(result).toMatchObject({ complete: false, failedSections: [section] });
    }
  });
});

describe('export function v2: cooldown', () => {
  const now = new Date('2026-10-21T00:10:00Z');
  it('asks for the remaining seconds within a minute of the last export', () => {
    expect(cooldownSeconds(new Date(now.getTime() - 20_000).toISOString(), now)).toBe(40);
    expect(cooldownSeconds(new Date(now.getTime() - EXPORT_COOLDOWN_MS).toISOString(), now)).toBe(0);
  });
  it('does not lock the resident out for a missing, unreadable or future timestamp', () => {
    expect(cooldownSeconds(null, now)).toBe(0);
    expect(cooldownSeconds('nonsense', now)).toBe(0);
    expect(cooldownSeconds(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe(0);
  });
});
