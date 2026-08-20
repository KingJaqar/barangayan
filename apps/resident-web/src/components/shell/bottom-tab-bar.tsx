'use client';

import { motion } from 'framer-motion';
import { Heart, Home, MapPin, Settings, ClipboardList, Bell, ShieldAlert, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUnreadCounts } from '@/hooks/use-unread-counts';

// Icon mapping confirmed 1:1 against apps/resident-android-mobile/src/components/app-
// tabs.tsx's TabIcon set (home/clipboard/location/heart/notifications/settings) — see
// the plan's Phase 0 step 4 note. Emergency is a website-only 8th addition, not in
// mobile's tab set (which folds it into "Maps") — placed right after Home per request.
// Announcements is likewise website-only (mobile nests it as a sub-tab of Reports) —
// placed right after Reports, matching top-nav.tsx. `badge` names which live count
// (from useUnreadCounts) drives this item's badge, if any.
const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home, exact: true, badge: null },
  { href: '/emergency', label: 'Emergency', icon: ShieldAlert, exact: false, badge: null },
  { href: '/services', label: 'Services', icon: ClipboardList, exact: false, badge: null },
  { href: '/maps', label: 'Maps', icon: MapPin, exact: false, badge: null },
  { href: '/health', label: 'Health', icon: Heart, exact: false, badge: null },
  { href: '/reports', label: 'Reports', icon: Bell, exact: false, badge: 'reports' },
  { href: '/announcements', label: 'Announcements', icon: Newspaper, exact: false, badge: 'announcements' },
  { href: '/settings', label: 'Settings', icon: Settings, exact: false, badge: null },
] as const;

/**
 * Mobile-width bottom tab bar — mirrors the app's own tab layout (app-tabs.tsx), plus
 * the website-only Emergency addition. Fixed to the viewport bottom (real fix vs.
 * admin-web's ResidentShell, whose mobile <nav> was `sm:hidden` only, not actually
 * pinned — see the plan's Phase 0 bug-fix note); `main` carries matching bottom
 * padding so content never sits under it.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const { activeReportsCount, resolvedUnreadCount, announcementsUnreadCount } = useUnreadCounts();
  // Split by destination: Reports sums the two incident counts, Announcements gets its
  // own count — no more double-counting announcements into the Reports badge.
  const reportsBadgeCount = activeReportsCount + resolvedUnreadCount;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 py-1.5 backdrop-blur-sm sm:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeCount = badge === 'reports' ? reportsBadgeCount : badge === 'announcements' ? announcementsUnreadCount : 0;
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-medium">
            <span className="relative flex h-7 w-9 items-center justify-center">
              {active ? (
                <motion.span
                  layoutId="bottom-tab-pill"
                  className="absolute inset-0 rounded-full bg-primary/15"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
                />
              ) : null}
              <Icon size={19} strokeWidth={1.75} className={active ? 'text-primary' : 'text-muted-foreground'} />
              {badgeCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-status-error px-1 text-[9px] font-bold leading-none text-white">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              ) : null}
            </span>
            <span className={active ? 'text-primary' : 'text-muted-foreground'}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
