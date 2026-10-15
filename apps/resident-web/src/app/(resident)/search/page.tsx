import { SearchResults } from '@/components/search/search-results';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { normalizeSearchQuery, searchFilter, searchPage } from '@/lib/search/types';

export const metadata = { title: 'Search your barangay' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const [params, { user }] = await Promise.all([searchParams, getOptionalUser()]);
  const query = normalizeSearchQuery(typeof params.q === 'string' ? params.q : '');
  const category = searchFilter(typeof params.category === 'string' ? params.category : 'all');
  const page = searchPage(params.page);
  return <SearchResults key={JSON.stringify([query, category, page])} query={query} category={category} page={page} isAuthenticated={user !== null} />;
}
