import { requestRecordHref } from '../request-record-link';

export const SEARCH_CATEGORIES = [
  { id: 'residents', label: 'Residents', path: '/residents' },
  { id: 'requests', label: 'Requests', path: '/requests' },
  { id: 'incidents', label: 'Incidents', path: '/incident-reports' },
  { id: 'transactions', label: 'Transactions', path: '/transactions' },
  { id: 'health', label: 'Health drives', path: '/health' },
  { id: 'applicants', label: 'Medical applicants', path: '/health/applicants' },
  { id: 'households', label: 'Household members', path: '/households-residents' },
  { id: 'staff', label: 'Staff', path: '/staff' },
  { id: 'announcements', label: 'Announcements', path: '/announcements' },
  { id: 'services', label: 'Document services', path: '/services' },
  { id: 'emergency', label: 'Emergency information', path: '/hub' },
  { id: 'centers', label: 'Evacuation centers', path: '/evacuation-centers' },
  { id: 'faq', label: 'Help articles', path: '/faq' },
  { id: 'zones', label: 'Waste zones', path: '/waste-management' },
  { id: 'schedules', label: 'Collection schedules', path: '/waste-management' },
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number]['id'];
export type SearchFilter = 'all' | SearchCategory;
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 120;
export const PAGE_SIZE = 10;
export function normalizeQuery(value: string) { return value.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH); }
export function searchFilter(value: string | null): SearchFilter {
  return SEARCH_CATEGORIES.some(category => category.id === value) ? value as SearchCategory : 'all';
}
export function searchPage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000) : 1;
}
export function searchUrl(query: string, category: SearchFilter = 'all', page = 1) {
  const params = new URLSearchParams({ q: normalizeQuery(query) });
  if (category !== 'all') params.set('category', category);
  if (page > 1) params.set('page', String(page));
  return `/search?${params}`;
}
export interface SearchHit {
  id: string; category: SearchCategory; title: string; preview: string; meta: string; href: string;
}
export interface SearchGroup {
  category: SearchCategory; total: number; hits: SearchHit[]; unavailable: boolean; page: number;
}
export interface SearchResponse {
  query: string; category: SearchFilter; page: number; pageSize: number;
  groups: SearchGroup[]; total: number; hasMore: boolean; countsExact: boolean;
}

/** PostgreSQL regex AND PostgREST quoted-value escaping. Wildcards are literal. */
export function literalSearchPattern(value: string, mode: 'contains' | 'prefix' = 'contains') {
  const escaped = value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `"${mode === 'prefix' ? '^' : ''}${escaped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
export function rankedSuggestions(groups: SearchGroup[], query: string): SearchHit[] {
  const needle = normalizeQuery(query).toLowerCase();
  const tokens = needle.split(' ');
  const rank = (hit: SearchHit) => {
    const title = hit.title.replace(/\s+/g, ' ').trim().toLowerCase();
    return title === needle ? 0 : title.startsWith(needle) ? 1 : tokens.every(token => title.includes(token)) ? 2 : 3;
  };
  const categoryOrder = new Map(SEARCH_CATEGORIES.map((category, index) => [category.id, index]));
  return groups.flatMap(group => group.hits).sort((left, right) => rank(left) - rank(right)
    || categoryOrder.get(left.category)! - categoryOrder.get(right.category)!
    || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)).slice(0, 8);
}
/** A bad transport response must produce retry UI, never a render exception. */
export function isSearchResponse(value: unknown): value is SearchResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as SearchResponse;
  const nonnegative = (number: unknown) => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0;
  if (typeof response.query !== 'string' || response.query.length > MAX_QUERY_LENGTH || searchFilter(response.category) !== response.category
    || !nonnegative(response.total) || !nonnegative(response.page) || response.page < 1 || response.page > 1000
    || response.pageSize !== PAGE_SIZE || typeof response.hasMore !== 'boolean' || typeof response.countsExact !== 'boolean'
    || !Array.isArray(response.groups) || response.groups.length > SEARCH_CATEGORIES.length) return false;
  const seen = new Set<string>();
  return response.groups.every(group => {
    if (!group || searchFilter(group.category) === 'all' || seen.has(group.category) || !nonnegative(group.total)
      || !nonnegative(group.page) || group.page < 1 || typeof group.unavailable !== 'boolean' || !Array.isArray(group.hits) || group.hits.length > PAGE_SIZE) return false;
    seen.add(group.category);
    return group.hits.every(hit => hit && hit.category === group.category && typeof hit.id === 'string' && hit.id.length <= 64
      && typeof hit.title === 'string' && hit.title.length <= 240 && typeof hit.preview === 'string' && hit.preview.length <= 200
      && typeof hit.meta === 'string' && hit.meta.length <= 300 && typeof hit.href === 'string'
      && (hit.category === 'requests' ? hit.href === requestRecordHref(hit.id) : hit.href.startsWith(`/search/${hit.category}/`)));
  });
}
export type SearchRow = Record<string, unknown>;
export function valueAt(row: SearchRow, path: string): string {
  const value = path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as SearchRow)[key] : undefined, row);
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item && typeof item === 'object'
    ? [valueAt(item as SearchRow, 'label'), valueAt(item as SearchRow, 'number')].filter(Boolean).join(' — ') : '').filter(Boolean).join(', ');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : '';
}
const PRESENTATION: Record<SearchCategory, { title: string; preview: string[]; meta: string[] }> = {
  residents: { title: 'full_name', preview: ['home_address', 'street', 'email'], meta: ['email_verification_status'] },
  requests: { title: 'reference_number', preview: ['profiles.full_name', 'document_types.name'], meta: ['status'] },
  incidents: { title: 'title', preview: ['description', 'address'], meta: ['status', 'incident_categories.name'] },
  transactions: { title: 'service_requests.reference_number', preview: ['service_requests.profiles.full_name', 'service_requests.document_types.name'], meta: ['status', 'method'] },
  health: { title: 'title', preview: ['location', 'eligible_criteria'], meta: ['type', 'drive_date'] },
  applicants: { title: 'applicant_number', preview: ['profiles.full_name', 'medical_drives.title'], meta: ['status'] },
  households: { title: 'name', preview: ['profiles.full_name'], meta: ['relation', 'role'] },
  staff: { title: 'profile.full_name', preview: ['profile.email'], meta: ['official_role'] },
  announcements: { title: 'title', preview: ['body', 'detailed_description'], meta: ['category'] },
  services: { title: 'name', preview: ['description'], meta: ['is_active'] },
  emergency: { title: 'title', preview: ['body'], meta: ['category'] },
  centers: { title: 'name', preview: ['address'], meta: ['capacity'] },
  faq: { title: 'question', preview: ['answer'], meta: ['category'] },
  zones: { title: 'name', preview: ['description'], meta: [] },
  schedules: { title: 'waste_type', preview: ['waste_zones.name', 'notes'], meta: ['start_time', 'end_time'] },
};
export function plainPreview(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/(^|\s)#{1,6}\s/g, '$1').replace(/\s+/g, ' ').trim();
}
export function makeHit(category: SearchCategory, row: SearchRow, query = ''): SearchHit {
  const config = PRESENTATION[category];
  const text = plainPreview(config.preview.map(path => valueAt(row, path)).filter(Boolean).join(' · '));
  const positions = query.toLowerCase().split(' ').filter(Boolean).map(token => text.toLowerCase().indexOf(token)).filter(index => index >= 0);
  const index = positions.length ? Math.min(...positions) : 0;
  const start = index > 70 ? index - 45 : 0;
  const preview = (start ? '…' : '') + text.slice(start, start + 180) + (text.length > start + 180 ? '…' : '');
  const id = String(row.id);
  const title = valueAt(row, config.title) || SEARCH_CATEGORIES.find(item => item.id === category)!.label;
  return { id, category, title: title.length > 220 ? `${title.slice(0, 219)}…` : title,
    preview, meta: config.meta.map(path => {
      const value = valueAt(row, path).replaceAll('_', ' ');
      return !value ? '' : path === 'email_verification_status' ? `Email ${value}`
        : path === 'is_active' ? (row.is_active ? 'Active' : 'Inactive') : path === 'capacity' ? `Capacity: ${value}` : value;
    }).filter(Boolean).join(' · '),
    href: category === 'requests' ? requestRecordHref(id) : `/search/${category}/${encodeURIComponent(id)}${query ? `?${new URLSearchParams({ q: query })}` : ''}` };
}

// Only these human-readable fields can leave the server on a record detail page.
export const DETAIL_FIELDS: Record<SearchCategory, string[]> = {
  residents: ['email', 'mobile_number', 'home_address', 'house_no', 'street', 'city', 'occupation', 'email_verification_status', 'id_verification_status'],
  requests: ['reference_number', 'profiles.full_name', 'document_types.name', 'status', 'requester_notes'],
  incidents: ['description', 'address', 'specific_area_details', 'status', 'incident_categories.name', 'profiles.full_name'],
  transactions: ['service_requests.reference_number', 'service_requests.profiles.full_name', 'status', 'method', 'amount_centavos', 'paid_at'],
  health: ['location', 'type', 'drive_date', 'time_start', 'time_end', 'eligible_criteria', 'stock_remaining', 'is_active'],
  applicants: ['profiles.full_name', 'medical_drives.title', 'status', 'age', 'comorbidities'],
  households: ['profiles.full_name', 'relation', 'role', 'is_checked_in'],
  staff: ['profile.email', 'profile.mobile_number', 'official_role'],
  announcements: ['body', 'detailed_description', 'category', 'published_at'],
  services: ['description', 'fee_centavos', 'is_active'],
  emergency: ['body', 'content', 'category'], centers: ['address', 'capacity', 'current_occupancy', 'contact_number', 'facilities', 'availability', 'is_active'],
  faq: ['answer', 'category', 'is_active'], zones: ['description'],
  schedules: ['waste_zones.name', 'notes', 'day_of_week', 'start_time', 'end_time', 'is_active'],
};
