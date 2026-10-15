import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { contentArchiveConfig, type ContentArchiveRow, type ContentArchiveSection } from '../archive-sections';
import { pageRange, parseBrowseState, queryIdentity, type BrowseResult, type BrowseState } from '../browse-state';
import { literalPattern, type QueryOutcome } from './browse';

const SOURCES = {
  services: { table: 'document_types', title: 'name', text: ['name', 'description'] },
  announcements: { table: 'announcements', title: 'title', text: ['title', 'body'] },
  hub: { table: 'emergency_information', title: 'title', text: ['title', 'body'] },
  'evacuation-centers': { table: 'evacuation_centers', title: 'name', text: ['name', 'address'] },
  zones: { table: 'waste_zones', title: 'name', text: ['name', 'description'] },
  schedules: { table: 'waste_collection_schedules', title: 'waste_type', text: ['waste_type', 'notes'] },
  incidents: { table: 'incidents', title: 'title', text: ['title', 'description', 'address'] },
} as const;

/** Session client, explicit barangay scope, and RLS apply to every archive read. */
export async function browseContentArchive(name: ContentArchiveSection, requested: BrowseState,
  db: SupabaseClient<Database>, barangayId: string, signal = AbortSignal.timeout(15000)):
  Promise<QueryOutcome<BrowseResult<ContentArchiveRow>>> {
  const state = parseBrowseState(new URLSearchParams({ ...requested.filters, q: requested.q,
    page: String(requested.page), pageSize: String(requested.pageSize), sort: requested.sort, dir: requested.dir }), contentArchiveConfig(name));
  state.q = state.q.trim();
  const kind = name === 'waste-management' ? state.filters.kind as 'zones' | 'schedules' | 'incidents' : name;
  const source = SOURCES[kind];
  function read(page?: number) {
    const select = kind === 'incidents' ? '*, incident_categories!inner(name,is_trash_related)'
      : kind === 'schedules' ? '*, waste_zones(name)' : '*';
    let query = db.from(source.table).select(select, { count: 'exact', head: page === undefined })
      .eq('barangay_id', barangayId).not('deleted_at', 'is', null);
    if (kind === 'incidents') query = query.eq('incident_categories.is_trash_related', true);
    if (state.q) query = query.or(source.text.map(column => `${column}.imatch.${literalPattern(state.q)}`).join(','));
    query = query.order('deleted_at', { ascending: state.dir === 'asc' }).order('id', { ascending: true });
    if (page !== undefined) {
      const start = (page - 1) * state.pageSize;
      query = query.range(start, start + state.pageSize - 1);
    }
    return query.retry(false).abortSignal(signal);
  }
  const failure = { status: 'error', code: 'query-failed', message: 'Could not load archived records. Retry this query.' } as const;
  try {
    let result = await read(Number.isSafeInteger(state.page * state.pageSize) ? state.page : undefined);
    if (result.error?.code === 'PGRST103') result = await read();
    if (result.error || result.count === null) return failure;
    const effective = pageRange(result.count, state.page, state.pageSize).page;
    if (effective !== state.page || !Number.isSafeInteger(state.page * state.pageSize)) {
      result = await read(effective);
      if (result.error || result.count === null) return failure;
      state.page = effective;
    }
    if (pageRange(result.count!, state.page, state.pageSize).page !== state.page) return failure;
    const raw = (result.data ?? []) as unknown as Record<string, unknown>[];
    if (raw.length !== Math.min(state.pageSize, Math.max(0, result.count! - (state.page - 1) * state.pageSize))) return failure;
    const rows = raw.map(row => ({
      id: String(row.id), title: kind === 'schedules'
        ? `${(row.waste_zones as { name?: string } | null)?.name ?? 'Collection schedule'} · ${row.waste_type}` : String(row[source.title]),
      description: String(row.description ?? row.body ?? row.address ?? row.notes ?? ''),
      archivedAt: String(row.deleted_at), details: row,
    }));
    return { status: 'success', value: { rows, total: result.count!, state, queryIdentity: queryIdentity(state) } };
  } catch { return failure; }
}
