'use client';

import { motion } from 'framer-motion';
import { Heart, Home, MapPin, Settings, ClipboardList, Bell, ShieldAlert, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPendingHint } from '@/components/shell/link-pending-hint';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import styles from './resident-shell.module.css';

// `badge` names which live count (from useUnreadCounts) drives this item's badge, if
// any — mirrors bottom-tab-bar.tsx's split: Reports sums the two incident counts,
// Announcements gets its own count.
const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home, exact: true, badge: null },
  { href: '/emergency', label: 'Emergency', icon: ShieldAlert, exact: false, badge: null },
  { href: '/services', label: 'Services', icon: ClipboardList, exact: false, badge: null },
  { href: '/maps', label: 'Maps', icon: MapPin, exact: false, badge: null },
  { href: '/health', label: 'Health', icon: Heart, exact: false, badge: null },
  { href: '/reports', label: 'Reports', icon: TriangleAlert, exact: false, badge: 'reports' },
  { href: '/announcements', label: 'Announcements', icon: Bell, exact: false, badge: 'announcements' },
  { href: '/settings', label: 'Settings', icon: Settings, exact: false, badge: null },
] as const;

/** Share destination styling and behavior between the main and account navigation. */
export function TopNav({ group = 'main' }: { group?: 'main' | 'account' }) {
  const pathname = usePathname();
  const { activeReportsCount, resolvedUnreadCount, announcementsUnreadCount } = useUnreadCounts();
  const reportsBadgeCount = activeReportsCount + resolvedUnreadCount;

  return (
    <nav aria-label={group === 'account' ? 'Account navigation' : 'Main navigation'} className={group === 'account' ? styles.accountNav : styles.nav}>
      {NAV_ITEMS.filter(({ href }) => group === 'main' || href === '/announcements' || href === '/settings').map(({ href, label, icon: Icon, exact, badge }) => {
        const accountDestination = href === '/announcements' || href === '/settings';
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeCount = badge === 'reports' ? reportsBadgeCount : badge === 'announcements' ? announcementsUnreadCount : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-label={badgeCount > 0 ? `${label}, ${badgeCount} ${badge === 'reports' ? 'report updates' : 'unread announcements'}` : label}
            aria-current={active ? 'page' : undefined}
            className={`${styles.navLink} ${group === 'main' && accountDestination ? styles.compactNavLink : ''}`}>
            {active ? (
              <motion.span
                layoutId={`top-nav-pill-${group}`}
                className={styles.navPill}
                transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            ) : null}
            <span aria-hidden className={styles.navContent}>
              <span className={styles.navIcon}>
                <Icon size={36} strokeWidth={1.75} />
                {badgeCount > 0 ? (
                  <span className={styles.navBadge}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null}
              </span>
              <span className={styles.navLabel}>
                <span className={styles.navLabelInner}>
                  <span className={styles.navLabelText}>{label}</span>
                </span>
              </span>
            </span>
            <LinkPendingHint className="bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 text-primary" />
          </Link>
        );
      })}
    </nav>
  );
}
