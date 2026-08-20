'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';

import { useUnreadCounts } from '@/hooks/use-unread-counts';

/**
 * Badge sourced from the same useUnreadCounts() the Reports tab's badges read —
 * announcementsUnreadCount is "the" bell count (see the plan's Phase 1 note: Home's
 * bell and Reports' announcement badge are the same number, same source of truth).
 * Links to /announcements, a top-level nav destination (not nested under Reports, per
 * request) — currently a placeholder screen.
 */
export function NotificationBell() {
  const { announcementsUnreadCount } = useUnreadCounts();

  return (
    <Link
      href="/announcements"
      aria-label={announcementsUnreadCount > 0 ? `${announcementsUnreadCount} unread announcements` : 'Announcements'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-foreground">
      <Bell size={18} strokeWidth={1.75} />
      {announcementsUnreadCount > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error px-1 text-[10px] font-bold leading-none text-white">
          {announcementsUnreadCount > 9 ? '9+' : announcementsUnreadCount}
        </span>
      ) : null}
    </Link>
  );
}
