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
export function normalizeSearchQuery(value: string) { return value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 120).trim(); }

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

/** Caller-session client only: RLS plus explicit tenant and personal-owner filters. */
export async function queryResidentSearch(client: SupabaseClient<Database>, scope: { userId: string | null; barangayId: string | null }, input: string, signal: AbortSignal): Promise<SearchGroup[]> {
  const query = normalizeSearchQuery(input);
  if (!/[\p{L}\p{N}]/u.test(query)) return [];
  if (scope.userId && !scope.barangayId) throw new Error('Search profile unavailable');
  const categories = (Object.keys(SEARCH_SOURCES) as SearchCategory[]).filter(key => scope.userId || (key !== 'requests' && key !== 'reports'));
  return Promise.all(categories.map(async category => {
    try {
      const source = SEARCH_SOURCES[category];
      let request = client.from(source.table).select(source.select).is('deleted_at', null).or(searchExpression(source.columns, query));
      if (source.active) request = request.filter('is_active', 'eq', true);
      if (scope.barangayId) request = request.eq('barangay_id', scope.barangayId);
      if (category === 'requests') request = request.filter('resident_id', 'eq', scope.userId!);
      if (category === 'reports') request = request.filter('reporter_id', 'eq', scope.userId!);
      const { data, error } = await request.order(source.order, { ascending: category === 'documents' || category === 'help' || category === 'health' }).order('id').limit(21).abortSignal(signal);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return { category, failed: false, more: rows.length > 20, results: rows.slice(0, 20).map(row => ({
        id: text(row, 'id'), category, title: text(row, source.title), date: text(row, 'drive_date'),
        preview: text(row, source.body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 190),
      })) };
    } catch {
      if (signal.aborted) throw new Error('Search cancelled');
      return { category, results: [], more: false, failed: true };
    }
  }));
}
