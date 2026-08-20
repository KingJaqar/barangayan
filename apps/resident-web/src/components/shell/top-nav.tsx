'use client';

import { motion } from 'framer-motion';
import { Heart, Home, MapPin, Settings, ClipboardList, Bell, ShieldAlert, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUnreadCounts } from '@/hooks/use-unread-counts';

// `badge` names which live count (from useUnreadCounts) drives this item's badge, if
// any — mirrors bottom-tab-bar.tsx's split: Reports sums the two incident counts,
// Announcements gets its own count.
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

/** Desktop-width top nav — same 8 destinations as bottom-tab-bar.tsx, shown at sm+
 * widths instead of the fixed bottom bar. Emergency is a website-only addition (not in
 * the mobile app's tab set, which folds it into "Maps") — placed right after Home per
 * request, since it's the one destination worth surfacing before anything else.
 * Announcements is likewise website-only (mobile nests it as a sub-tab of Reports) —
 * placed right after Reports per request. */
export function TopNav() {
  const pathname = usePathname();
  const { activeReportsCount, resolvedUnreadCount, announcementsUnreadCount } = useUnreadCounts();
  const reportsBadgeCount = activeReportsCount + resolvedUnreadCount;

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeCount = badge === 'reports' ? reportsBadgeCount : badge === 'announcements' ? announcementsUnreadCount : 0;
        return (
          <Link
            key={href}
            href={href}
            className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
            {active ? (
              <motion.span
                layoutId="top-nav-pill"
                className="absolute inset-0 rounded-full bg-primary/15"
                transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            ) : null}
            <span className={`relative flex items-center gap-1.5 ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <span className="relative flex items-center justify-center">
                <Icon size={16} strokeWidth={1.75} />
                {badgeCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-status-error px-1 text-[9px] font-bold leading-none text-white">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null}
              </span>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
