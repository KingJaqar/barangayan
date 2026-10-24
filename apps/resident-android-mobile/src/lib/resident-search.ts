import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';

export const SEARCH_SOURCES = {
  documents: { label: 'Documents & services', table: 'document_types', select: 'id,name,description', columns: ['name', 'description'], title: 'name', body: 'description', active: true, order: 'name' },
  announcements: { label: 'Announcements', table: 'announcements', select: 'id,title,body,detailed_description', columns: ['title', 'body', 'detailed_description'], title: 'title', body: 'body', active: false, order: 'published_at' },
  health: { label: 'Medical drives', table: 'medical_drives', select: 'id,title,eligible_criteria,location,drive_date', columns: ['title', 'eligible_criteria', 'location'], title: 'title', body: 'eligible_criteria', active: true, order: 'drive_date' },
  help: { label: 'Help articles', table: 'faq_articles', select: 'id,question,answer', columns: ['question', 'answer'], title: 'question', body: 'answer', active: true, order: 'question' },
  requests: { label: 'My requests', table: 'service_requests', select: 'id,reference_number,requester_notes,status', columns: ['reference_number', 'requester_notes', 'status'], title: 'reference_number', body: 'requester_notes', active: false, order: 'created_at' },
  reports: { label: 'My reports', table: 'incidents', select: 'id,title,description,status', columns: ['title', 'description', 'status'], title: 'title', body: 'description', active: false, order: 'created_at' },
} as const;

export type SearchCategory = keyof typeof SEARCH_SOURCES;
export type SearchResult = { id: string; category: SearchCategory; title: string; preview: string; date?: string };
export type SearchGroup = { category: SearchCategory; results: SearchResult[]; more: boolean; failed: boolean };
export type SearchScope = { userId: string | null; barangayId: string | null };
export type SearchPage = { results: SearchResult[]; more: boolean };
export type SearchFailure = 'denied' | 'offline' | 'timeout' | 'unavailable';
const SEARCH_PAGE_SIZE = 20;
export const SEARCH_DEADLINE_MS = 12000;
/** A source request that failed for a reason the UI can explain; cancellation is never one. */
export class SearchError extends Error {
  constructor(readonly failure: SearchFailure, message = `Search ${failure}`) { super(message); }
}
export function normalizeSearchQuery(value: string) { return value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 120).trim(); }
/** Whitespace- or punctuation-only input is never searched, saved or submitted. */
export function isSearchableQuery(value: string) { return /[\p{L}\p{N}]/u.test(normalizeSearchQuery(value)); }

// Match the web app's escaped PostgREST filter syntax. User input is always a
// quoted value; percent/underscore cannot turn a search into a catalog download.
export function searchPattern(query: string) {
  const literal = query.replace(/[*]/g, ' ').replace(/\s+/g, ' ').trim();
  return `"%${literal.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&').replace(/[\\"]/g, '\\$&')}%"`;
}
export function searchExpression(columns: readonly string[], query: string) {
  const terms = [...new Set(query.toLocaleLowerCase().split(' ').filter(term => /[\p{L}\p{N}]/u.test(term)))];
  return `and(${terms.map(term => `or(${columns.map(column => `${column}.ilike.${searchPattern(term)}`).join(',')})`).join(',')})`;
}
function text(row: Record<string, unknown>, key: string) { return typeof row[key] === 'string' ? row[key] as string : ''; }
// PostgREST answers 401/403, 42501 or PGRST3xx (JWT) for refused reads, and postgrest-js reports a failed fetch as status 0.
function failureOf(error: { code?: string }, status: number): SearchFailure {
  if (status === 401 || status === 403 || error.code === '42501' || error.code?.startsWith('PGRST3')) return 'denied';
  return status === 0 ? 'offline' : 'unavailable';
}

/** Guests never query personal sources. */
export function searchCategories(scope: SearchScope) {
  return (Object.keys(SEARCH_SOURCES) as SearchCategory[]).filter(key => scope.userId || (key !== 'requests' && key !== 'reports'));
}

/**
 * One category page in the existing order: rows offset…offset+19 plus one probe row for `more`.
 * Caller-session client only: RLS plus explicit tenant and personal-owner filters. postgrest-js retries
 * GETs by default; retries stay explicit, so they are turned off here.
 */
export async function queryResidentSearchPage(client: SupabaseClient<Database>, scope: SearchScope, category: SearchCategory, input: string, offset: number, signal: AbortSignal): Promise<SearchPage> {
  const query = normalizeSearchQuery(input);
  if (!isSearchableQuery(query)) return { results: [], more: false };
  if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('Invalid search page offset');
  if (scope.userId && !scope.barangayId) throw new SearchError('unavailable', 'Search profile unavailable');
  if (!searchCategories(scope).includes(category)) throw new SearchError('denied');
  const source = SEARCH_SOURCES[category];
  let request = client.from(source.table).select(source.select).is('deleted_at', null).or(searchExpression(source.columns, query));
  if (source.active) request = request.filter('is_active', 'eq', true);
  if (scope.barangayId) request = request.eq('barangay_id', scope.barangayId);
  if (category === 'requests') request = request.filter('resident_id', 'eq', scope.userId!);
  if (category === 'reports') request = request.filter('reporter_id', 'eq', scope.userId!);
  let response;
  try {
    response = await request.order(source.order, { ascending: category === 'documents' || category === 'help' || category === 'health' }).order('id')
      .range(offset, offset + SEARCH_PAGE_SIZE).retry(false).abortSignal(signal);
  } catch {
    if (signal.aborted) throw new Error('Search cancelled');
    throw new SearchError('unavailable');
  }
  if (signal.aborted) throw new Error('Search cancelled');
  if (response.error) throw new SearchError(failureOf(response.error, response.status));
  const rows = (response.data ?? []) as unknown as Record<string, unknown>[];
  return { more: rows.length > SEARCH_PAGE_SIZE, results: rows.slice(0, SEARCH_PAGE_SIZE).map(row => ({
    id: text(row, 'id'), category, title: text(row, source.title), date: text(row, 'drive_date'),
    preview: text(row, source.body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 190),
  })) };
}

/** First page of every eligible source; a failed source is marked, cancellation rejects. */
export async function queryResidentSearch(client: SupabaseClient<Database>, scope: SearchScope, input: string, signal: AbortSignal): Promise<SearchGroup[]> {
  if (!isSearchableQuery(input)) return [];
  if (scope.userId && !scope.barangayId) throw new SearchError('unavailable', 'Search profile unavailable');
  return Promise.all(searchCategories(scope).map(async category => {
    try {
      return { category, failed: false, ...await queryResidentSearchPage(client, scope, category, input, 0, signal) };
    } catch {
      if (signal.aborted) throw new Error('Search cancelled');
      return { category, results: [], more: false, failed: true };
    }
  }));
}
