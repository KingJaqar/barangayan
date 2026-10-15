import { SearchResults } from '@/components/admin/search/search-results';
import { normalizeQuery, searchFilter, searchPage } from '@/lib/search/model';

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const first = (key: string) => typeof params[key] === 'string' ? params[key] as string : null;
  const query = normalizeQuery(first('q') ?? '');
  const category = searchFilter(first('category'));
  const page = category === 'all' ? 1 : searchPage(first('page'));
  return <SearchResults key={`${query}:${category}:${page}`} query={query} category={category} page={page} />;
}
