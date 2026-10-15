import { createSupabaseServerClient } from '@/lib/supabase/server';
import { queryResidentSearch } from '@/lib/search/query';
import { normalizeSearchQuery, searchFilter, searchPage } from '@/lib/search/types';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = normalizeSearchQuery(params.get('q') ?? '');
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
    let barangayId: string | null = null;
    if (user) {
      const { data, error } = await client.from('profiles').select('barangay_id').eq('id', user.id).is('deleted_at', null).abortSignal(signal).maybeSingle();
      if (error || !data) throw new Error('Search profile unavailable');
      barangayId = data.barangay_id;
    }
    const response = await queryResidentSearch(client, { userId: user?.id ?? null, barangayId }, {
      query,
      category: searchFilter(params.get('category')),
      page: searchPage(params.get('page')),
      suggestions: params.get('suggestions') === '1',
      signal,
    });
    return Response.json(response, { headers });
  } catch {
    return Response.json({ error: "We couldn't search right now. Please try again." }, { status: 503, headers });
  }
}
