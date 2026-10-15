import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn(), search: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: fx.getUser }, from: fx.from }) }));
vi.mock('@/lib/search/query', () => ({ queryResidentSearch: fx.search }));
import { GET } from '../src/app/api/search/route';

beforeEach(() => {
  vi.resetAllMocks();
  fx.getUser.mockResolvedValue({ data: { user: { id: 'resident-a' } }, error: null });
  fx.from.mockReturnValue(fx);
  for (const method of ['select', 'eq', 'is', 'abortSignal'] as const) fx[method].mockReturnValue(fx);
  fx.maybeSingle.mockResolvedValue({ data: { barangay_id: 'tenant-a' }, error: null });
  fx.search.mockResolvedValue({ query: 'clearance', groups: [], page: 1, pageSize: 5, isAuthenticated: true });
});

describe('resident search API boundary', () => {
  it('derives tenant/owner from the verified session and sends private no-store responses', async () => {
    const response = await GET(new Request('https://resident.test/api/search?q=clearance&userId=foreign&barangayId=foreign&page=Infinity&category=profiles'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(fx.search).toHaveBeenCalledWith(expect.anything(), { userId: 'resident-a', barangayId: 'tenant-a' }, expect.objectContaining({ category: 'all', page: 1 }));
    expect(fx.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it('fails closed when the profile or auth provider is unavailable', async () => {
    fx.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await GET(new Request('https://resident.test/api/search?q=clearance'))).status).toBe(503);
    expect(fx.search).not.toHaveBeenCalled();
    fx.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError' } });
    expect((await GET(new Request('https://resident.test/api/search?q=clearance'))).status).toBe(503);
  });
  it('allows a missing guest session without inventing a tenant', async () => {
    fx.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError' } });
    expect((await GET(new Request('https://resident.test/api/search?q=clearance'))).status).toBe(200);
    expect(fx.from).not.toHaveBeenCalled();
    expect(fx.search).toHaveBeenCalledWith(expect.anything(), { userId: null, barangayId: null }, expect.anything());
  });
  it('never exposes a database error in the error response', async () => {
    fx.search.mockRejectedValue(new Error('private database details'));
    const response = await GET(new Request('https://resident.test/api/search?q=clearance'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database details');
  });
});
