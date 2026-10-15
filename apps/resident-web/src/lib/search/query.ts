import type { SupabaseClient } from '@supabase/supabase-js';
import { servicePriceLabel, serviceProcessingLabel, type Database, type Tables } from '@barangayan/shared';
import { normalizeSearchQuery, SEARCH_CATEGORIES, searchPage, searchTerms, searchPreview, type SearchCategory, type SearchFilter, type SearchGroup, type SearchResponse, type SearchResult } from './types';

export type SearchScope = { userId: string | null; barangayId: string | null };
type SearchRow = Record<string, unknown>;
const sources = {
  documents: { table: 'document_types', select: 'id,name,description,fee_centavos,processing_target_hours,contract_version,pricing_mode,processing_target_minutes', columns: ['name', 'description'], title: 'name', body: 'description', active: true, order: 'name' },
  announcements: { table: 'announcements', select: 'id,title,body,detailed_description,category,published_at', columns: ['title', 'body', 'detailed_description'], title: 'title', body: 'body', active: false, order: 'published_at' },
  health: { table: 'medical_drives', select: 'id,title,eligible_criteria,location,drive_date,time_start,time_end,type', columns: ['title', 'eligible_criteria', 'location'], title: 'title', body: 'eligible_criteria', active: true, order: 'drive_date' },
  help: { table: 'faq_articles', select: 'id,question,answer,category', columns: ['question', 'answer'], title: 'question', body: 'answer', active: true, order: 'question' },
  requests: { table: 'service_requests', select: 'id,reference_number,status,requester_notes,document_types(name)', columns: ['reference_number', 'requester_notes', 'status'], title: 'reference_number', body: 'requester_notes', active: false, order: 'created_at' },
  reports: { table: 'incidents', select: 'id,title,description,status,created_at', columns: ['title', 'description', 'status'], title: 'title', body: 'description', active: false, order: 'created_at' },
} as const;

// Quote PostgREST values independently of its expression grammar. Escape SQL LIKE
// wildcards too, so percent/underscore input cannot turn into a catalog dump.
export function searchPattern(query: string) {
  const literal = query.replace(/[*]/g, ' ').replace(/\s+/g, ' ').trim();
  return `"%${literal.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&').replace(/[\\"]/g, '\\$&')}%"`;
}

export function searchExpression(columns: readonly string[], query: string) {
  const expressions = searchTerms(query).map(term => columns.map(column => `${column}.ilike.${searchPattern(term)}`).join(','));
  return expressions.length === 1 ? expressions[0] : `and(${expressions.map(expression => `or(${expression})`).join(',')})`;
}

function text(row: SearchRow, key: string) { return typeof row[key] === 'string' ? row[key] as string : ''; }
function label(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function resultFor(category: SearchCategory, row: SearchRow, query: string): SearchResult {
  const source = sources[category];
  const id = text(row, 'id');
  let title = text(row, source.title);
  let body = text(row, source.body);
  let meta = '';
  let href = '';
  switch (category) {
    case 'documents': {
      // Selected fields cover both shared label helpers, including assessed/per-page
      // pricing and the current charter's processing minutes.
      const document = row as unknown as Tables<'document_types'>;
      meta = `${servicePriceLabel(document)} · ${serviceProcessingLabel(document)}`;
      href = `/services/${id}`;
      break;
    }
    case 'announcements':
      body = searchTerms(query).some(term => body.toLocaleLowerCase().includes(term)) ? body : text(row, 'detailed_description') || body;
      meta = `${label(text(row, 'category'))} · ${new Date(text(row, 'published_at')).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}`;
      href = `/announcements/${id}`;
      break;
    case 'health':
      meta = `${text(row, 'drive_date')} · ${text(row, 'time_start').slice(0, 5)}–${text(row, 'time_end').slice(0, 5)} · ${text(row, 'location')}`;
      href = `/health/drives/${id}`;
      break;
    case 'help':
      meta = label(text(row, 'category'));
      href = `/settings/help/${id}`;
      break;
    case 'requests': {
      const document = row.document_types as { name?: string } | null;
      title = document?.name ? `${document.name} · ${title}` : title;
      meta = label(text(row, 'status'));
      href = `/services/requests/${id}`;
      break;
    }
    case 'reports':
      meta = label(text(row, 'status'));
      href = `/reports/${id}`;
  }
  return { id, category, title, preview: searchPreview(body, query), meta, href };
}

/** Only use a caller-session client. RLS remains active; explicit tenant/owner
 * filters also protect personal results when the caller is an administrator. */
export async function queryResidentSearch(client: SupabaseClient<Database>, scope: SearchScope, options: { query: string; category?: SearchFilter; page?: number; suggestions?: boolean; signal?: AbortSignal }): Promise<SearchResponse> {
  const query = normalizeSearchQuery(options.query);
  const category = options.category ?? 'all';
  const page = category === 'all' || options.suggestions ? 1 : searchPage(options.page);
  const pageSize = options.suggestions ? 3 : category === 'all' ? 5 : 20;
  const response: SearchResponse = { query, groups: [], page, pageSize, isAuthenticated: scope.userId !== null };
  if (!query || !/[\p{L}\p{N}]/u.test(query)) return response;
  if (scope.userId && !scope.barangayId) throw new Error('Search profile unavailable');
  const categories = SEARCH_CATEGORIES.filter(({ key }) => (category === 'all' || category === key) && (scope.userId || (key !== 'requests' && key !== 'reports')));
  response.groups = await Promise.all(categories.map(async ({ key }): Promise<SearchGroup> => {
    try {
      const source = sources[key];
      let expression = searchExpression(source.columns, query);
      let titleExpression = searchExpression([source.title], query);
      if (key === 'requests') {
        // One bounded lookup supplies service names for every search term, including
        // mixed searches such as a document name plus a request reference.
        const terms = searchTerms(query);
        let documents = client.from('document_types').select('id,name').eq('barangay_id', scope.barangayId!).or(terms.map(term => `name.ilike.${searchPattern(term)}`).join(',')).limit(1001);
        if (options.signal) documents = documents.abortSignal(options.signal);
        const { data, error } = await documents;
        if (error) throw error;
        if (data && data.length > 1000) throw new Error('Service lookup too broad');
        const clauses = terms.map(term => {
          const documentIds = (data ?? []).filter(row => row.name.toLocaleLowerCase().includes(term)).map(row => row.id);
          const documentClause = documentIds.length ? `,document_type_id.in.(${documentIds.join(',')})` : '';
          return { broad: `or(${source.columns.map(column => `${column}.ilike.${searchPattern(term)}`).join(',')}${documentClause})`, title: `or(reference_number.ilike.${searchPattern(term)}${documentClause})` };
        });
        expression = `and(${clauses.map(clause => clause.broad).join(',')})`;
        titleExpression = `and(${clauses.map(clause => clause.title).join(',')})`;
      }
      // Disjoint title/body buckets rank across the entire match set, before
      // pagination. No catalog download or in-memory sorting of thousands of rows.
      const otherExpression = `and(or(${expression}),not.or(${titleExpression}))`;
      const build = (filter: string, head = false) => {
        let request = client.from(source.table).select(source.select, { count: 'exact', head }).is('deleted_at', null).or(filter);
        if (source.active) request = request.filter('is_active', 'eq', true);
        if (scope.barangayId) request = request.eq('barangay_id', scope.barangayId);
        if (key === 'requests') request = request.filter('resident_id', 'eq', scope.userId!);
        if (key === 'reports') request = request.filter('reporter_id', 'eq', scope.userId!);
        if (options.signal) request = request.abortSignal(options.signal);
        return request.order(source.order, { ascending: key === 'documents' || key === 'help' || key === 'health' }).order('id');
      };
      const [titles, others] = await Promise.all([
        page === 1 ? build(titleExpression).range(0, pageSize - 1) : build(titleExpression, true),
        page === 1 ? build(otherExpression).range(0, pageSize - 1) : build(otherExpression, true),
      ]);
      if (titles.error) throw titles.error;
      if (others.error) throw others.error;
      const titleCount = titles.count ?? 0;
      const count = titleCount + (others.count ?? 0);
      const actualPage = Math.min(page, Math.max(1, Math.ceil(count / pageSize)));
      if (category !== 'all') response.page = actualPage;
      let rows: SearchRow[];
      if (page === 1) {
        rows = [...(titles.data ?? []), ...(others.data ?? [])] as unknown as SearchRow[];
      } else {
        const offset = (actualPage - 1) * pageSize;
        const titleLimit = Math.max(0, Math.min(pageSize, titleCount - offset));
        const otherOffset = Math.max(0, offset - titleCount);
        const otherLimit = Math.max(0, Math.min(pageSize - titleLimit, count - Math.max(titleCount, offset)));
        const parts = await Promise.all([
          titleLimit ? build(titleExpression).range(offset, offset + titleLimit - 1) : Promise.resolve({ data: [], error: null }),
          otherLimit ? build(otherExpression).range(otherOffset, otherOffset + otherLimit - 1) : Promise.resolve({ data: [], error: null }),
        ]);
        for (const part of parts) if (part.error) throw part.error;
        rows = parts.flatMap(part => part.data ?? []) as unknown as SearchRow[];
      }
      return { category: key, results: rows.slice(0, pageSize).map(row => resultFor(key, row, query)), count, failed: false };
    } catch {
      return { category: key, results: [], count: 0, failed: true };
    }
  }));
  return response;
}
