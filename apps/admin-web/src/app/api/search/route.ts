import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeQuery, searchFilter, searchPage } from '@/lib/search/model';
import { authorizeSearch, runSearch, SearchAccessError } from '@/lib/search/server';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(12000)]);
    const db = await createSupabaseServerClient();
    const tenant = await authorizeSearch(db, signal);
    const params = new URL(request.url).searchParams;
    const response = await runSearch(db, tenant, normalizeQuery(params.get('q') ?? ''),
      searchFilter(params.get('category')), searchPage(params.get('page')), params.get('mode') === 'suggestions', signal);
    return Response.json(response, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof SearchAccessError ? error.message : 'Search could not load. Please retry.' },
      { status: error instanceof SearchAccessError ? error.status : 503, headers });
  }
}
