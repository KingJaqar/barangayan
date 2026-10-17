import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { createSupabaseServerClient } from '../../supabase/server';
import { parseBrowseState, pageRange, queryIdentity, type BrowseResult, type BrowseState } from '../browse-state';
import { TABLE_CONFIGS, TABLE_SUMMARY_KEYS, type TableName } from '../table-configs';
import type { AdminBrowseDatabase } from './schema';
import type { AdminRecordDatabase } from '../record-schema';
import type { ServiceRequest } from '../../../app/(admin)/requests/page';
import type { Payment } from '../../../app/(admin)/transactions/transactions-table';
import type { ResidentRow } from '../../../app/(admin)/residents/page';
import type { IncidentRow } from '../../../app/(admin)/incident-reports/page';
import type { DriveRow } from '../../../app/(admin)/health/page';
import type { ApplicantRow } from '../../../app/(admin)/health/applicants/page';
import type { HouseholdMemberRow } from '../../../app/(admin)/households-residents/page';
import type { OfficialWithProfile } from '../../../app/(admin)/staff/page';

export interface TableRows {
  requests: ServiceRequest; transactions: Payment;
  residents: ResidentRow & { updated_at: string };
  incidents: IncidentRow; health: DriveRow; applicants: ApplicantRow;
  households: HouseholdMemberRow & { updated_at: string }; staff: OfficialWithProfile;
}
export type QueryOutcome<T> = { status: 'success'; value: T }
  | { status: 'error'; code: 'query-failed' | 'results-changed' | 'access-denied'; message: string };
export type Summary = Record<string, number>;
const SEARCH_COLUMNS: Record<TableName, number> = { requests: 3, transactions: 4, residents: 12,
  incidents: 5, health: 4, applicants: 3, households: 4, staff: 5 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_STATUS_BY_TAB: Record<string, string> = {
  active: 'submitted', processing: 'in_progress', pickup: 'ready_for_pickup', completed: 'completed', cancelled: 'cancelled',
};

export function parseTableState(name: TableName, params: Pick<URLSearchParams, 'get'>): BrowseState {
  const config = TABLE_CONFIGS[name];
  const dynamicKey = name === 'requests' ? 'doc' : name === 'incidents' ? 'category' : null;
  const dynamicValue = dynamicKey ? params.get(dynamicKey) : null;
  const state = parseBrowseState(params, dynamicKey ? { ...config, filters: { ...config.filters,
    [dynamicKey]: { values: ['', ...(dynamicValue && UUID.test(dynamicValue) ? [dynamicValue] : [])], defaultValue: '' } } } : config);
  // Six routes already trim searches. Requests and Transactions intentionally do not.
  if (name !== 'requests' && name !== 'transactions') state.q = state.q.trim();
  return state;
}

export function manilaDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Escape a literal PostgreSQL regex, then PostgREST's quoted-value grammar.
 * MATCH avoids LIKE's unconditional '*' -> '%' alias conversion. The escaped
 * regex has no user-controlled operators and retains substring semantics. */
export function literalPattern(value: string) {
  const literal = value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `"${literal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function validated(name: TableName, state: BrowseState) {
  return parseTableState(name, new URLSearchParams({ ...state.filters, q: state.q,
    page: String(state.page), pageSize: String(state.pageSize), sort: state.sort, dir: state.dir }));
}
function error(code: 'query-failed' | 'results-changed' | 'access-denied', message: string) {
  return { status: 'error', code, message } as const;
}

// One deadline covers the initial read AND the sole allowed corrective read.
// Disabling SDK retries prevents Retry-After from extending that deadline.
export async function browseTable<K extends TableName>(name: K, requested: BrowseState,
  client?: SupabaseClient<Database>, signal = AbortSignal.timeout(15000), now = new Date(), archived = false): Promise<QueryOutcome<BrowseResult<TableRows[K]>>> {
  const state = validated(name, requested);
  const db = (client ?? await createSupabaseServerClient()) as unknown as SupabaseClient<AdminRecordDatabase>;
  async function read(page?: number, ids?: string[]) {
    const view: `admin_${TableName}_browse` | `admin_${TableName}_records` = archived ? `admin_${name as TableName}_records` : `admin_${name as TableName}_browse`;
    let query = db.from(view).select('id,row', { count: ids ? undefined : 'exact', head: page === undefined && !ids });
    // Override the selected shape below without a dynamic PostgREST type parser.
    if (!ids) query = query.select('id');
    if (archived) query = query.eq('f_archived', true);
    const f = state.filters;
    const tab = f.tab;
    if (name === 'requests' && tab !== 'all') query = query.eq('f_status', REQUEST_STATUS_BY_TAB[tab]);
    if (['transactions', 'incidents', 'applicants'].includes(name) && tab !== 'all') query = query.eq('f_status', tab);
    if (name === 'residents') {
      if (tab === 'verified' || tab === 'unverified') query = query.eq('f_email_verified', tab === 'verified');
      if (tab === 'id_verified') query = query.eq('f_id_status', 'verified');
      // Include residents without a submitted ID as well as pending/failed IDs.
      if (tab === 'id_unverified') query = query.or('f_id_status.is.null,f_id_status.neq.verified');
    }
    if (name === 'residents' && f.verification) query = query.eq('f_with_id', f.verification === 'with_id');
    if (name === 'households' && tab !== 'all') query = query.eq('f_checked_in', tab === 'checked_in');
    if (name === 'staff' && tab === 'admin') query = query.eq('f_role', 'admin');
    if (name === 'staff' && tab === 'staff') query = query.neq('f_role', 'admin');
    if (name === 'health' && tab !== 'all') {
      query = query.eq('f_active', tab !== 'inactive');
      const today = manilaDay(now);
      if (tab === 'upcoming') query = query.gte('f_drive_date', today);
      if (tab === 'today') query = query.eq('f_drive_date', today);
      if (tab === 'past') query = query.lt('f_drive_date', today);
    }
    for (const key of ['doc', 'method', 'category', 'type', 'relation', 'role']) {
      if (f[key]) query = query.eq(`f_${key}`, f[key]);
    }
    if (state.q) query = query.or(Array.from({ length: SEARCH_COLUMNS[name] }, (_, i) => `x${i}.match.${literalPattern(state.q)}`).join(','));
    // Only allowlisted projection columns can be ordered. Nulls remain last in
    // BOTH directions; a base ID always breaks primary ties ascending.
    query = query.order(`s_${state.sort}`, { ascending: state.dir === 'asc', nullsFirst: false }).order('id', { ascending: true });
    if (ids) query = query.in('id', ids);
    if (page !== undefined && !ids) {
      const start = (page - 1) * state.pageSize;
      if (!Number.isSafeInteger(start + state.pageSize)) throw new Error('Page offset exceeds the safe range.');
      query = query.range(start, start + state.pageSize - 1);
    }
    return query.retry(false).abortSignal(signal);
  }
  try {
    const unsafeOffset = !Number.isSafeInteger(state.page * state.pageSize);
    let result = await read(unsafeOffset ? undefined : state.page);
    // The SDK discards Content-Range on 416. One HEAD retrieves the exact
    // count before the sole corrective page read; no error-text parsing.
    if (result.error && result.error.code !== 'PGRST103') return error('query-failed', 'Could not load table results. Retry this query.');
    if (result.error?.code === 'PGRST103') result = await read();
    if (result.error) return error('query-failed', 'Could not count table results. Retry this query.');
    if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) return error('query-failed', 'An exact result count is unavailable. Retry this query.');
    const effective = pageRange(result.count, state.page, state.pageSize).page;
    if (effective !== state.page || unsafeOffset) {
      result = await read(effective);
      if (result.error && result.error.code !== 'PGRST103') return error('query-failed', 'Could not load table results. Retry this query.');
      if (result.error?.code === 'PGRST103') return error('results-changed', 'Results changed while paging. Retry this query.');
      if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) return error('query-failed', 'An exact result count is unavailable. Retry this query.');
      if (pageRange(result.count, effective, state.pageSize).page !== effective) return error('results-changed', 'Results changed while paging. Retry this query.');
      state.page = effective;
    } else if (result.error) return error('results-changed', 'Results changed while paging. Retry this query.');
    const pageIds = (result.data ?? []).map(item => item.id as string);
    // Fetch payloads only for the bounded authoritative ID page. This avoids
    // building joined JSON for every candidate/deep-page offset. Apply the same
    // filters again; a deletion or membership change is a recoverable failure.
    const payload = pageIds.length ? await read(undefined, pageIds) : null;
    if (payload?.error) return error('query-failed', 'Could not load table rows. Retry this query.');
    const payloadRows = new Map((payload?.data ?? []).map(item => [item.id, item.row]));
    if (payloadRows.size !== pageIds.length || pageIds.some(id => !payloadRows.has(id))) return error('results-changed', 'Results changed while paging. Retry this query.');
    // Restore database ID order, never sort values from a limited page locally.
    const rows = pageIds.map(id => payloadRows.get(id) as unknown as TableRows[K]);
    const expected = Math.min(state.pageSize, Math.max(0, result.count - (state.page - 1) * state.pageSize));
    if (rows.length !== expected) return error('results-changed', 'Results changed while paging. Retry this query.');
    return { status: 'success', value: { rows, total: result.count, state, queryIdentity: queryIdentity(state) } };
  } catch {
    return error('query-failed', 'Could not load table results within the request deadline. Retry this query.');
  }
}

export async function tableSummary(name: TableName, client?: SupabaseClient<Database>, signal = AbortSignal.timeout(15000)): Promise<QueryOutcome<Summary>> {
  const db = (client ?? await createSupabaseServerClient()) as unknown as SupabaseClient<AdminBrowseDatabase>;
  try {
    const { data, error: failure } = await db.from(`admin_${name}_summary`).select('summary').retry(false).abortSignal(signal).maybeSingle();
    if (failure) return error('query-failed', 'Could not load summary totals. Retry the summary.');
    if (!data) return error('access-denied', 'An active administrator account is required.');
    const summary = data.summary;
    if (!summary || Array.isArray(summary) || typeof summary !== 'object' || !TABLE_SUMMARY_KEYS[name].every(key => {
      const value = summary[key];
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    })) {
      return error('query-failed', 'Summary totals are unavailable. Retry the summary.');
    }
    return { status: 'success', value: summary as Summary };
  } catch { return error('query-failed', 'Could not load summary totals within the request deadline.'); }
}

/** Independent outcomes: a failed summary never becomes zero, and a failed
 * table never becomes an empty success. Later routes can retry each separately. */
export async function loadTable<K extends TableName>(name: K, params: Pick<URLSearchParams, 'get'>, client?: SupabaseClient<Database>) {
  const db = client ?? await createSupabaseServerClient();
  const state = parseTableState(name, params);
  const signal = AbortSignal.timeout(15000);
  const [table, summary] = await Promise.all([browseTable(name, state, db, signal), tableSummary(name, db, signal)]);
  if (summary.status === 'error' && summary.code === 'access-denied') {
    return { table: error('access-denied', summary.message), summary };
  }
  return { table, summary };
}

