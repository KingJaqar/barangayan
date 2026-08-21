'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

import { BottomTabBar } from '@/components/shell/bottom-tab-bar';
import { TopNav } from '@/components/shell/top-nav';
import { useResetPreferencesOnLogout } from '@/components/theme/use-reset-preferences';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ResidentShellProps {
  barangayName: string;
  residentName: string | null;
  avatarUrl: string | null;
  /** True once a resident session is confirmed — /home renders this shell for guests
   * too (getOptionalUser()), so the header/nav must degrade gracefully without one. */
  isAuthenticated: boolean;
  children: ReactNode;
}

/**
 * Web counterpart of the mobile app's 6-tab bottom bar — migrated + rewritten from
 * admin-web's ResidentShell (4 destinations -> 6, top nav for desktop + real fixed
 * bottom tab bar for mobile, notification bell, Framer Motion active-pill). See the
 * plan's Phase 0 step 4.
 */
export function ResidentShell({ barangayName, residentName, avatarUrl, isAuthenticated, children }: ResidentShellProps) {
  const router = useRouter();
  const resetPreferences = useResetPreferencesOnLogout();

  async function handleLogout() {
    // Clear theme/accent/font before signing out — see use-reset-preferences.ts's doc
    // comment for why (otherwise guest mode inherits this resident's appearance).
    resetPreferences();
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link href="/home" className="flex items-center gap-3">
          <Image
            src="/assets/logo/barangayan-logo-1024.png"
            alt="Barangayan logo"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <div>
            <p className="text-sm font-bold leading-tight">Barangayan</p>
            <p className="text-xs leading-tight text-muted-foreground">{barangayName}</p>
          </div>
        </Link>

        <TopNav />

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight">{residentName}</p>
              </div>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={residentName ?? ''} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {(residentName ?? '?').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={handleLogout}
                title="Log out"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                <LogOut size={16} strokeWidth={1.75} />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-4 py-1.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-accent sm:inline-block">
                Log In
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-background px-4 pb-20 pt-4 sm:px-8 sm:pb-8 sm:pt-6">{children}</main>

      {isAuthenticated ? <BottomTabBar /> : null}
    </div>
  );
}
