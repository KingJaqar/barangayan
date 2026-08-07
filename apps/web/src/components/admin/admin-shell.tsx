'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { Header } from './header';
import { SidebarNav } from './sidebar-nav';

interface AdminShellProps {
  barangayName: string;
  adminName: string;
  children: ReactNode;
}

/** Holds the hamburger's sidebar-collapse state (v1: not persisted, resets on reload —
 * per the plan's §1.1 scope call). Wraps Header + SidebarNav + page content. */
export function AdminShell({ barangayName, adminName, children }: AdminShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <Header barangayName={barangayName} adminName={adminName} onToggleSidebar={() => setCollapsed((v) => !v)} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarNav collapsed={collapsed} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto overflow-x-auto bg-zinc-50 p-8 dark:bg-black">{children}</main>
      </div>
    </div>
  );
}
