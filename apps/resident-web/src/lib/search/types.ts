export const SEARCH_CATEGORIES = [
  { key: 'documents', label: 'Documents & services' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'health', label: 'Medical drives' },
  { key: 'help', label: 'Help articles' },
  { key: 'requests', label: 'My requests' },
  { key: 'reports', label: 'My reports' },
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number]['key'];
export type SearchFilter = SearchCategory | 'all';
export type SearchResult = {
  id: string;
  category: SearchCategory;
  title: string;
  preview: string;
  meta: string;
  href: string;
};
export type SearchGroup = { category: SearchCategory; results: SearchResult[]; count: number; failed: boolean };
export type SearchResponse = { query: string; groups: SearchGroup[]; page: number; pageSize: number; isAuthenticated: boolean };

/** Guard the fetch boundary so a malformed response becomes a retryable error. */
export function isSearchResponse(value: unknown): value is SearchResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as SearchResponse;
  return typeof response.query === 'string' && typeof response.isAuthenticated === 'boolean'
    && Number.isInteger(response.page) && response.page > 0 && Number.isInteger(response.pageSize) && response.pageSize > 0
    && Array.isArray(response.groups) && response.groups.every(group => group && SEARCH_CATEGORIES.some(category => category.key === group.category)
      && typeof group.failed === 'boolean' && Number.isInteger(group.count) && group.count >= 0 && Array.isArray(group.results)
      && group.results.length <= response.pageSize && group.results.every(result => result && result.category === group.category
        && ['id', 'title', 'preview', 'meta', 'href'].every(key => typeof result[key as keyof SearchResult] === 'string')
        && /^\/(services\/[^/]+|services\/requests\/[^/]+|announcements\/[^/]+|health\/drives\/[^/]+|settings\/help\/[^/]+|reports\/[^/]+)$/.test(result.href)));
}

export function normalizeSearchQuery(value: string) {
  return value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 120).trim();
}

export function searchTerms(query: string) {
  return [...new Set(query.toLocaleLowerCase().split(' ').filter(term => /[\p{L}\p{N}]/u.test(term)))];
}

export function searchPage(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(1000, Math.floor(number))) : 1;
}

export function resultRelevance(result: SearchResult, query: string) {
  const title = result.title.toLocaleLowerCase();
  const terms = searchTerms(query);
  if (title === query.toLocaleLowerCase()) return 4;
  if (title.startsWith(query.toLocaleLowerCase())) return 3;
  if (title.includes(query.toLocaleLowerCase())) return 2;
  return terms.length && terms.every(term => title.includes(term)) ? 1 : 0;
}

export function searchFilter(value: string | undefined | null): SearchFilter {
  return SEARCH_CATEGORIES.some(({ key }) => key === value) ? value as SearchCategory : 'all';
}

export function searchHref(query: string, category: SearchFilter = 'all', page = 1) {
  const params = new URLSearchParams({ q: normalizeSearchQuery(query) });
  if (category !== 'all') params.set('category', category);
  if (page > 1) params.set('page', String(page));
  return `/search?${params}`;
}

/** Plain text only, with the matching passage kept in view for long content. */
export function searchPreview(value: string | null | undefined, query: string) {
  const plain = (value ?? '').replace(/<[^>]*>/g, ' ').replace(/[#*_`\[\]]/g, '').replace(/\s+/g, ' ').trim();
  const normalized = plain.toLocaleLowerCase();
  const phraseMatch = normalized.indexOf(query.toLocaleLowerCase());
  const positions = searchTerms(query).map(term => normalized.indexOf(term)).filter(position => position >= 0);
  const match = phraseMatch >= 0 ? phraseMatch : positions.length ? Math.min(...positions) : -1;
  const start = match > 65 ? match - 55 : 0;
  return `${start ? '…' : ''}${plain.slice(start, start + 190)}${plain.length > start + 190 ? '…' : ''}`;
}
