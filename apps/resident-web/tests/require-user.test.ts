import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  pathname: '/settings/profile' as string | null,
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  needsProfile: vi.fn(),
  query: { select: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn() },
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers(fixture.pathname ? { 'x-pathname': fixture.pathname } : {}) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock('@barangayan/shared', () => ({
  ensureGoogleResidentProfile: fixture.ensureProfile,
  needsResidentProfile: fixture.needsProfile,
  residentCompletionDestination: (path: string) => `/complete-profile?next=${encodeURIComponent(path)}`,
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: fixture.getUser }, from: () => fixture.query }),
}));

import { requireUser } from '../src/lib/auth/require-user';

const user = { id: 'resident', email: 'resident@example.test' };
const incompleteProfile = {
  id: user.id, role: 'resident', full_name: '', barangay_id: 'barangay', avatar_url: null,
  barangays: { name: 'Barangay' },
};

beforeEach(() => {
  vi.resetAllMocks();
  fixture.pathname = '/settings/profile';
  fixture.getUser.mockResolvedValue({ data: { user } });
  fixture.needsProfile.mockResolvedValue(true);
  fixture.query.select.mockReturnValue(fixture.query);
  fixture.query.eq.mockReturnValue(fixture.query);
  fixture.query.single.mockResolvedValue({ data: incompleteProfile });
  fixture.query.maybeSingle.mockResolvedValue({ data: { display_name: 'Resident locality' } });
});

describe('resident Settings access before profile completion', () => {
  it.each([
    '/settings', '/settings/profile', '/settings/valid-id', '/settings/email-verification',
    '/settings/location-verification', '/settings/change-password', '/settings/notifications',
    '/settings/download-data', '/settings/delete-account', '/settings/theme', '/settings/help',
    '/settings/help/article', '/settings/terms-privacy', '/settings/about',
  ])('admits an incomplete signed-in profile at %s', async pathname => {
    fixture.pathname = pathname;
    const account = await requireUser();
    expect(account.user).toEqual(user);
    expect(account.profile).toMatchObject({ id: user.id, full_name: '', barangayName: 'Resident locality' });
    expect(fixture.ensureProfile).toHaveBeenCalled();
    expect(fixture.needsProfile).not.toHaveBeenCalled();
  });

  it.each(['/settings/profile', '/settings/change-password', '/settings/delete-account'])('requires sign-in at %s', async pathname => {
    fixture.pathname = pathname;
    fixture.getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireUser()).rejects.toThrow(`redirect:/login?next=${encodeURIComponent(pathname)}`);
    expect(fixture.query.select).not.toHaveBeenCalled();
  });

  it.each(['/services/requests', '/services/requests/new/document', '/health/register/drive', '/reports/new', '/settings-other'])('still requires profile completion at %s', async pathname => {
    fixture.pathname = pathname;
    await expect(requireUser()).rejects.toThrow(`redirect:/complete-profile?next=${encodeURIComponent(pathname)}`);
  });

  it('admits completed profiles to resident services', async () => {
    fixture.pathname = '/services/requests';
    fixture.needsProfile.mockResolvedValue(false);
    expect((await requireUser()).user).toEqual(user);
  });

  it('retains the profile-row requirement for account pages', async () => {
    fixture.query.single.mockResolvedValue({ data: null });
    await expect(requireUser()).rejects.toThrow('redirect:/login');
  });

  it('keeps profile completion required when the pathname is unavailable', async () => {
    fixture.pathname = null;
    await expect(requireUser()).rejects.toThrow('redirect:/complete-profile?next=%2Fhome');
  });
});
