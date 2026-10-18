'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { beginAttempt, notify, setNotificationSession } from '@/lib/notify';

import { logAdminLogout } from '@/actions/admin-audit-actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

import { Header } from './header';
import { SidebarNav } from './sidebar-nav';
import { ProfileNavigationGuard, useProfileNavigation } from './profile-navigation-guard';

interface AdminShellProps {
  barangayName: string;
  adminName: string;
  adminAvatarUrl?: string | null;
  barangayId: string;
  children: ReactNode;
}

/** Holds the hamburger's sidebar-collapse state (v1: not persisted, resets on reload —
 * per the plan's §1.1 scope call). Wraps Header + SidebarNav + page content. */
export function AdminShell({ barangayName, adminName, adminAvatarUrl, barangayId, children }: AdminShellProps) {
  return <ProfileNavigationGuard><GuardedAdminShell barangayName={barangayName} adminName={adminName} adminAvatarUrl={adminAvatarUrl} barangayId={barangayId}>{children}</GuardedAdminShell></ProfileNavigationGuard>;
}

function GuardedAdminShell({ barangayName, adminName, adminAvatarUrl, barangayId, children }: AdminShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { requestLeave } = useProfileNavigation();
  const loggingOut = useRef(false);

  useEffect(() => {
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      setNotificationSession(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      // Log the logout event before the session is destroyed.
      await logAdminLogout();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        notify.warning("We couldn't confirm logout. Check your sign-in state before trying again.");
        return;
      }
      setNotificationSession(null);
      notify.success('Logged out', { id: beginAttempt('admin-logout'), keepOnSessionChange: true });
      router.replace('/login');
      router.refresh();
    } catch {
      notify.warning("We couldn't confirm logout. Check your sign-in state before trying again.");
    } finally { loggingOut.current = false; }
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        barangayName={barangayName}
        adminName={adminName}
        adminAvatarUrl={adminAvatarUrl}
        barangayId={barangayId}
        sidebarCollapsed={collapsed}
        onToggleSidebar={() => setCollapsed((v) => !v)}
        onLogout={() => requestLeave(() => { void handleLogout(); })}
      />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <SidebarNav collapsed={collapsed} onLogout={() => requestLeave(() => { void handleLogout(); })} />
        <main data-admin-viewport className="min-w-0 flex-1 overflow-y-auto overflow-x-auto bg-zinc-50 p-8 dark:bg-black">{children}</main>
      </div>
    </div>
  );
}
