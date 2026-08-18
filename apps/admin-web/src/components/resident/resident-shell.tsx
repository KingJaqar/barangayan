'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Inbox, LogOut, TriangleAlert, User } from 'lucide-react';
import type { ReactNode } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ResidentShellProps {
  barangayName: string;
  residentName: string;
  avatarUrl: string | null;
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: '/resident', label: 'Home', icon: Home, exact: true },
  { href: '/resident/requests', label: 'My Requests', icon: Inbox, exact: false },
  { href: '/resident/reports', label: 'My Reports', icon: TriangleAlert, exact: false },
  { href: '/resident/profile', label: 'Profile', icon: User, exact: false },
] as const;

/**
 * Web counterpart of the mobile app's tab bar — same four destinations
 * (Home / Requests / Reports / Profile) reached from a top nav instead of
 * bottom tabs, since this is a desktop-first surface. Deliberately lighter
 * than AdminShell (no sidebar, no notification bell) — residents have a much
 * smaller surface area than the admin panel.
 */
export function ResidentShell({ barangayName, residentName, avatarUrl, children }: ResidentShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-3 dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo/barangayan-logo-1024.png"
            alt="Barangayan logo"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <div>
            <p className="text-sm font-bold leading-tight">Barangayan</p>
            <p className="text-xs leading-tight text-zinc-500">{barangayName}</p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}>
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{residentName}</p>
          </div>
          {avatarUrl ? (
            <Image src={avatarUrl} alt={residentName} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-bold text-[var(--accent)]">
              {residentName.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Log out"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* Mobile-width bottom tab bar, mirroring the app's own tab layout. */}
      <nav className="flex items-center justify-around border-b border-black/10 bg-white py-2 sm:hidden dark:border-white/10 dark:bg-zinc-900">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 text-[11px] font-medium ${
                active ? 'text-[var(--accent)]' : 'text-zinc-500'
              }`}>
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto bg-zinc-50 p-6 dark:bg-black sm:p-8">{children}</main>
    </div>
  );
}
