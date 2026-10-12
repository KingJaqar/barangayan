'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

import { BottomTabBar } from '@/components/shell/bottom-tab-bar';
import { TopNav } from '@/components/shell/top-nav';
import { LoadingStatus, PendingText } from '@/components/shared/loading-status';
import { Spinner } from '@/components/ui/loading';
import { toastAnchorRef } from '@/components/ui/sonner';
import { useSignOut } from '@/hooks/use-sign-out';

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
  const { signOut, pending: signingOut } = useSignOut();
  const pathname = usePathname();
  const isSettings = pathname === '/settings' || pathname.startsWith('/settings/');

  return (
    <div className={`flex min-h-full flex-col ${isSettings ? 'lg:h-full lg:min-h-0' : ''}`}>
      <header ref={toastAnchorRef} data-toast-anchor className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
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
              <span className="relative flex">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                aria-busy={signingOut || undefined}
                aria-label="Log out"
                title="Log out"
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none">
                {/* Pending: the icon cross-fades to a spinner after 120 ms (same as Button). */}
                <LogOut aria-hidden size={16} strokeWidth={1.75} className={signingOut ? 'rw-hint-out' : undefined} />
                {signingOut ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Spinner />
                  </span>
                ) : null}
              </button>
              {signingOut ? (
                <PendingText
                  label={null}
                  slowLabel={
                    <span aria-hidden className="absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Taking longer than usual…
                    </span>
                  }
                />
              ) : null}
              </span>
              <LoadingStatus active={signingOut} label="Logging out…" className="sr-only" />
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

      <main className={`flex-1 overflow-y-auto bg-background px-4 pb-20 pt-4 sm:px-8 sm:pb-8 sm:pt-6 ${isSettings ? 'lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden' : ''}`}>{children}</main>

      {isAuthenticated ? <BottomTabBar /> : null}
    </div>
  );
}
