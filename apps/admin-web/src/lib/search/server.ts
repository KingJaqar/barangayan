import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import type { AdminBrowseDatabase } from '@/lib/admin-tables/queries/schema';
import { DETAIL_FIELDS, MIN_QUERY_LENGTH, PAGE_SIZE, SEARCH_CATEGORIES, literalSearchPattern, makeHit, valueAt,
  type SearchCategory, type SearchFilter, type SearchGroup, type SearchResponse, type SearchRow } from './model';

export class SearchAccessError extends Error {
  constructor(public status: 401 | 403) { super(status === 401 ? 'Please sign in again to search.' : 'An active administrator account is required.'); }
}
export async function authorizeSearch(db: SupabaseClient<Database>, signal = AbortSignal.timeout(12000)) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 400 && error.status !== 401 && error.status !== 403) {
    throw new Error('Could not verify the session. Please retry.');
  }
  if (error || !user) throw new SearchAccessError(401);
  const actor = await db.from('profiles').select('role,barangay_id,deleted_at').eq('id', user.id).retry(false).abortSignal(signal).maybeSingle();
  if (actor.error) throw new Error('Could not verify search access. Please retry.');
  if (!actor.data || actor.data.role !== 'admin' || actor.data.deleted_at || !actor.data.barangay_id) throw new SearchAccessError(403);
  return actor.data.barangay_id;
}
const VIEWS = {
  residents: 12, requests: 3, incidents: 5, transactions: 4, health: 4, applicants: 3, households: 4, staff: 5,
} as const;
const CONTENT = {
  announcements: { table: 'announcements', columns: ['title', 'body', 'detailed_description'] },
  services: { table: 'document_types', columns: ['name', 'description'] },
  emergency: { table: 'emergency_information', columns: ['title', 'body'] },
  centers: { table: 'evacuation_centers', columns: ['name', 'address'] },
  faq: { table: 'faq_articles', columns: ['question', 'answer'] },
  zones: { table: 'waste_zones', columns: ['name', 'description'] },
  schedules: { table: 'waste_collection_schedules', columns: ['waste_type', 'notes'] },
} as const;
function isView(category: SearchCategory): category is keyof typeof VIEWS { return category in VIEWS; }

function sourceQuery(db: SupabaseClient<Database>, tenant: string, category: SearchCategory, payload = false, head = false) {
  if (isView(category)) {
    const views = db as unknown as SupabaseClient<AdminBrowseDatabase>;
    return views.from(`admin_${category}_browse`).select(payload ? 'id,row' : 'id', { count: payload ? undefined : 'exact', head })
      .eq('tenant_id', tenant);
  }
  return db.from(CONTENT[category].table).select(payload ? category === 'schedules' ? '*,waste_zones(name)' : '*' : 'id', { count: payload ? undefined : 'exact', head })
    .eq('barangay_id', tenant).is('deleted_at', null);
}
function columns(category: SearchCategory) {
  return isView(category) ? Array.from({ length: VIEWS[category] }, (_, i) => `x${i}`) : [...CONTENT[category].columns];
}
const VIEW_ORDER = { residents: 's_name', requests: 's_reference', incidents: 's_title', transactions: 's_reference',
  health: 's_title', applicants: 's_number', households: 's_name', staff: 's_name' } as const;
function orderColumn(category: SearchCategory) { return isView(category) ? VIEW_ORDER[category] : CONTENT[category].columns[0]; }
function reportFailure(category: SearchCategory, failure: unknown, signal: AbortSignal) {
  if (signal.aborted) return;
  const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : 'query-failed';
  // No query text, tenant IDs, or record data enter server diagnostics.
  console.warn('[admin-search] Category unavailable', { category, code });
}
async function readSuggestionGroup(db: SupabaseClient<Database>, tenant: string, category: SearchCategory,
  query: string, signal: AbortSignal): Promise<SearchGroup> {
  try {
    const primary = columns(category)[0];
    const operator = isView(category) ? 'match' : 'imatch';
    const prefix = literalSearchPattern(query, 'prefix');
    const read = (preferred: boolean, limit: number) => {
      let builder = sourceQuery(db, tenant, category, true);
      for (const token of query.split(' ')) builder = builder.or(columns(category).map(column => `${column}.${operator}.${literalSearchPattern(token)}`).join(','));
      // Quoted patterns belong to PostgREST's logic grammar, so keep the
      // prefix inside OR syntax rather than passing quotes as a column value.
      builder = preferred ? builder.or(`${primary}.${operator}.${prefix}`) : builder.or(`${primary}.is.null,${primary}.not.${operator}.${prefix}`);
      return builder.order(orderColumn(category), { nullsFirst: false }).order('id').limit(limit).retry(false).abortSignal(signal);
    };
    // No exact counts and no full matching-set payloads on the typing path.
    // A prefix match is preferred; only missing slots require a fallback read.
    const preferred = await read(true, 2);
    if (preferred.error) throw preferred.error;
    let data = (preferred.data ?? []) as unknown as SearchRow[];
    if (data.length < 2) {
      const fallback = await read(false, 2 - data.length);
      if (fallback.error) throw fallback.error;
      data = [...data, ...(fallback.data ?? []) as unknown as SearchRow[]];
    }
    const hits = Array.from(new Map(data.map(item => {
      const raw = item as unknown as SearchRow;
      return [String(raw.id), makeHit(category, (isView(category) ? raw.row : raw) as SearchRow, query)];
    })).values());
    return { category, total: hits.length, hits, unavailable: false, page: 1 };
  } catch (failure) {
    reportFailure(category, failure, signal);
    return { category, total: 0, hits: [], unavailable: true, page: 1 };
  }
}
async function readGroup(db: SupabaseClient<Database>, tenant: string, category: SearchCategory, query: string,
  limit: number, offset: number, signal: AbortSignal): Promise<SearchGroup> {
  function filtered(payload = false, head = false) {
    let read = sourceQuery(db, tenant, category, payload, head);
    for (const token of query.split(' ')) read = read.or(columns(category).map(column => `${column}.${isView(category) ? 'match' : 'imatch'}.${literalSearchPattern(token)}`).join(','));
    return read;
  }
  try {
    // Counts for unselected filters return no record payloads. A count also
    // clamps deep-page URLs before requesting a range outside the table.
    if (!limit || offset > 0) {
      const count = await filtered(false, true).retry(false).abortSignal(signal);
      if (count.error) throw count.error;
      if (count.count === null) throw new Error('Count unavailable');
      if (!limit) return { category, total: count.count, hits: [], unavailable: false, page: 1 };
      offset = Math.min(offset, Math.max(0, Math.ceil(count.count / limit) - 1) * limit);
    }
    // Fetch IDs/count first; joined JSON is read only for the bounded result page.
    const result = await filtered().order(orderColumn(category), { nullsFirst: false }).order('id').range(offset, offset + limit - 1).retry(false).abortSignal(signal);
    if (result.error) throw result.error;
    if (result.count === null) throw new Error('Search count unavailable');
    const ids = (result.data ?? []).map(row => String((row as unknown as SearchRow).id));
    const page = Math.floor(offset / limit) + 1;
    if (!ids.length) return { category, total: result.count, hits: [], unavailable: false, page };
    const payload = await filtered(true).in('id', ids).retry(false).abortSignal(signal);
    if (payload.error) throw payload.error;
    if (payload.data?.length !== ids.length) throw new Error('Results changed');
    const rows = new Map((payload.data ?? []).map(item => {
      const raw = item as unknown as SearchRow;
      return [String(raw.id), (isView(category) ? raw.row : raw) as SearchRow];
    }));
    return { category, total: result.count, hits: ids.map(id => makeHit(category, rows.get(id)!, query)), unavailable: false, page };
  } catch (failure) { reportFailure(category, failure, signal); return { category, total: 0, hits: [], unavailable: true, page: 1 }; }
}
export async function runSearch(db: SupabaseClient<Database>, tenant: string, query: string, category: SearchFilter,
  page: number, suggestions = false, signal = AbortSignal.timeout(12000)): Promise<SearchResponse> {
  const result: SearchResponse = { query, category, page, pageSize: PAGE_SIZE, total: 0, groups: [], hasMore: false, countsExact: !suggestions };
  if (query.length < MIN_QUERY_LENGTH) return result;
  result.groups = await Promise.all(SEARCH_CATEGORIES.map(item => suggestions ? readSuggestionGroup(db, tenant, item.id, query, signal)
    : readGroup(db, tenant, item.id, query, category === 'all' ? 3 : category === item.id ? PAGE_SIZE : 0,
      category === item.id ? (page - 1) * PAGE_SIZE : 0, signal)));
  if (result.groups.every(group => group.unavailable)) throw new Error('Search is temporarily unavailable. Please retry.');
  result.total = result.groups.reduce((total, group) => total + group.total, 0);
  const selected = result.groups.find(group => group.category === category);
  result.page = selected?.page ?? 1;
  result.hasMore = !!selected && result.page * PAGE_SIZE < selected.total;
  if (category !== 'all') {
    for (const group of result.groups) for (const hit of group.hits) {
      if (hit.category === 'requests') continue;
      const params = new URLSearchParams({ q: query, returnCategory: category, returnPage: String(result.page) });
      hit.href = `${hit.href.split('?')[0]}?${params}`;
    }
  }
  return result;
}
export async function readSearchRecord(db: SupabaseClient<Database>, tenant: string, category: SearchCategory, id: string) {
  const result = await sourceQuery(db, tenant, category, true).eq('id', id).retry(false).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
  if (result.error) throw new Error('Could not load this record. Please retry.');
  if (!result.data) return null;
  const raw = result.data as unknown as SearchRow;
  const row = (isView(category) ? raw.row : raw) as SearchRow;
  return { hit: makeHit(category, row), fields: DETAIL_FIELDS[category].map(key => ({ key, value: valueAt(row, key) })).filter(field => field.value !== '') };
}
