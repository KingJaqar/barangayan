import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

const fixture = vi.hoisted(() => ({
  getUser: vi.fn(), single: vi.fn(), signOut: vi.fn(), audit: vi.fn(),
  query: { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() },
  onLogout: undefined as undefined | (() => void), replace: vi.fn(), refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  useRouter: () => ({ replace: fixture.replace, refresh: fixture.refresh }), usePathname: () => '/resident',
}));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: fixture.getUser }, from: () => fixture.query }) }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: fixture.signOut } }) }));
vi.mock('@/actions/admin-audit-actions', () => ({ logAdminLogout: fixture.audit }));
vi.mock('@/components/admin/header', () => ({ Header: (props: { onLogout: () => void }) => { fixture.onLogout = props.onLogout; return null; } }));
vi.mock('@/components/admin/sidebar-nav', () => ({ SidebarNav: () => null }));
vi.mock('@/components/admin/profile-navigation-guard', () => ({
  ProfileNavigationGuard: ({ children }: { children: ReactNode }) => children,
  useProfileNavigation: () => ({ requestLeave: (action: () => void) => action() }),
}));

import AdminLayout from '../../src/app/(admin)/layout';
import ResidentLayout from '../../src/app/resident/layout';
import { AdminShell } from '../../src/components/admin/admin-shell';

beforeEach(() => {
  vi.resetAllMocks(); fixture.onLogout = undefined;
  fixture.getUser.mockResolvedValue({ data: { user: { id: 'account' } } });
  for (const method of ['select', 'eq', 'is'] as const) fixture.query[method].mockReturnValue(fixture.query);
  fixture.query.single.mockResolvedValue({ data: { role: 'admin', full_name: 'Admin', barangay_id: 'barangay', barangays: { name: 'Barangay' } } });
  fixture.audit.mockResolvedValue(undefined); fixture.signOut.mockResolvedValue({ error: null });
});

describe('existing admin application role boundaries', () => {
  it('admits an admin and retains the active-profile filter', async () => {
    expect((await AdminLayout({ children: 'protected' })).type).toBe(AdminShell);
    expect(fixture.query.eq).toHaveBeenCalledWith('id', 'account');
    expect(fixture.query.is).toHaveBeenCalledWith('deleted_at', null);
  });
  it.each([null, { role: 'resident' }, { role: 'staff' }])('rejects a missing or non-admin profile: %j', async profile => {
    fixture.query.single.mockResolvedValue({ data: profile });
    await expect(AdminLayout({ children: 'protected' })).rejects.toThrow('redirect:/login');
  });
  it('requires a session on both protected route groups', async () => {
    fixture.getUser.mockResolvedValue({ data: { user: null } });
    for (const layout of [AdminLayout, ResidentLayout]) await expect(layout({ children: 'protected' })).rejects.toThrow('redirect:/login');
    expect(fixture.query.select).not.toHaveBeenCalled();
  });
  it('retains the legacy resident route redirect for admins', async () => {
    await expect(ResidentLayout({ children: 'protected' })).rejects.toThrow('redirect:/dashboard');
  });
  it('audits ordinary admin logout before revoking only the admin session', async () => {
    renderToStaticMarkup(<AdminShell barangayName="Barangay" adminName="Admin" barangayId="barangay">content</AdminShell>);
    fixture.onLogout!();
    await vi.waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1));
    expect(fixture.audit).toHaveBeenCalledTimes(1);
    expect(fixture.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(fixture.audit.mock.invocationCallOrder[0]).toBeLessThan(fixture.signOut.mock.invocationCallOrder[0]);
    expect(fixture.replace).toHaveBeenCalledExactlyOnceWith('/login');
  });
});
