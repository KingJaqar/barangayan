'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { BottomTabBar } from '@/components/shell/bottom-tab-bar';
import { TopNav } from '@/components/shell/top-nav';
import { ProfileMenu } from '@/components/shell/profile-menu';
import { toastAnchorRef } from '@/components/ui/sonner';
import styles from './resident-shell.module.css';

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
  const pathname = usePathname();
  const isSettings = pathname === '/settings' || pathname.startsWith('/settings/');

  return (
    <div className={styles.shell}>
      <header ref={toastAnchorRef} data-toast-anchor className={`${styles.header} ${!isAuthenticated ? styles.guestHeader : ''}`}>
        <div className={styles.headerInner}>
          <Link href="/home" className={styles.brand}>
            <Image
              src="/assets/logo/barangayan-logo-1024.png"
              alt="Barangayan logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <div className={styles.brandCopy}>
              <p className={styles.brandTitle}>Barangayan</p>
              <p className={styles.brandLocality} title={barangayName}>{barangayName}</p>
            </div>
          </Link>

          <TopNav />

          <div className={styles.account}>
            {isAuthenticated ? (
              <>
                <div className={`${styles.residentCopy} text-right`}>
                  <p className={styles.residentName} title={residentName ?? undefined}>{residentName}</p>
                  <p className={styles.accountLabel}>Resident account</p>
                </div>
                <ProfileMenu key={pathname} residentName={residentName} avatarUrl={avatarUrl} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={styles.login}>
                  Log In
                </Link>
                <Link
                  href="/register"
                  className={styles.signup}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`${styles.main} ${pathname === '/home' ? styles.homeMain : ''} ${!isAuthenticated ? styles.guestMain : ''} ${isSettings ? 'lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden' : ''}`}>{children}</main>

      {isAuthenticated ? <BottomTabBar /> : null}
    </div>
  );
}
