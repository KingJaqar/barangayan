import type { SortDescriptor, SortDirection } from './sort-definitions';

export const PAGE_SIZES = [10, 20, 30, 50, 100] as const;
export type PageSize = typeof PAGE_SIZES[number];
export interface BrowseState {
  q: string;
  filters: Record<string, string>;
  page: number;
  pageSize: PageSize;
  sort: string;
  dir: SortDirection;
}
export interface BrowseConfig {
  sorts: readonly SortDescriptor[];
  defaultSort: string;
  filters: Record<string, { values: readonly string[]; defaultValue: string }>;
}
export interface BrowseResult<T> {
  rows: T[];
  total: number;
  state: BrowseState;
  queryIdentity: string;
}

function positiveInteger(value: string | null, fallback: number) {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function parseBrowseState(params: Pick<URLSearchParams, 'get'>, config: BrowseConfig): BrowseState {
  const sort = config.sorts.find(item => item.key === params.get('sort'))
    ?? config.sorts.find(item => item.key === config.defaultSort);
  if (!sort) throw new Error('Browse config requires a valid default sort.');
  const candidate = params.get('dir') as SortDirection;
  const size = positiveInteger(params.get('pageSize'), 10);
  return {
    q: params.get('q') ?? '',
    filters: Object.fromEntries(Object.entries(config.filters).map(([key, rule]) => {
      const value = params.get(key);
      return [key, value !== null && rule.values.includes(value) ? value : rule.defaultValue];
    })),
    page: positiveInteger(params.get('page'), 1),
    pageSize: PAGE_SIZES.includes(size as PageSize) ? size as PageSize : 10,
    sort: sort.key,
    dir: sort.directions.includes(candidate) ? candidate : sort.initialDirection,
  };
}

export type BrowseChange = Partial<Omit<BrowseState, 'filters'>> & { filters?: Record<string, string> };
export function changeBrowseState(state: BrowseState, change: BrowseChange, config: BrowseConfig): BrowseState {
  const next = { ...state, ...change, filters: { ...state.filters, ...change.filters } };
  if (change.sort !== undefined && change.sort !== state.sort && change.dir === undefined) {
    next.dir = config.sorts.find(item => item.key === change.sort)?.initialDirection ?? state.dir;
  }
  if (Object.keys(change).some(key => key !== 'page')) next.page = 1;
  return parseBrowseState(new URLSearchParams({ ...next.filters, q: next.q, page: String(next.page),
    pageSize: String(next.pageSize), sort: next.sort, dir: next.dir }), config);
}

/** Unknown query parameters are retained; only allowlisted browsing keys are written. */
export function browseUrl(pathname: string, current: string, state: BrowseState, config: BrowseConfig) {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('?') || pathname.includes('#')) {
    throw new Error('Expected a local pathname.');
  }
  const params = new URLSearchParams(current);
  const validated = changeBrowseState(state, {}, config);
  for (const [key, value] of Object.entries({ ...validated.filters, q: validated.q,
    page: String(validated.page), pageSize: String(validated.pageSize), sort: validated.sort, dir: validated.dir })) {
    if (value === '') params.delete(key); else params.set(key, value);
  }
  params.sort();
  return `${pathname}?${params.toString()}`;
}

export function queryIdentity(state: BrowseState) {
  return JSON.stringify([state.q, Object.entries(state.filters).sort(([a], [b]) => a.localeCompare(b)),
    state.page, state.pageSize, state.sort, state.dir]);
}

export function pageRange(total: number, page: number, size: PageSize) {
  const pages = Math.max(1, Math.ceil(total / size));
  const effectivePage = Math.min(Math.max(1, page), pages);
  return { page: effectivePage, pages, start: total === 0 ? 0 : (effectivePage - 1) * size + 1,
    end: Math.min(total, effectivePage * size) };
}
