/**
 * The three independent Reports signals (A36). Active reports are an operational count that is
 * never "read"; unread resolved reports and unread announcements are content-read counts. The
 * single system badge adds only the two unread counts. This is the contract Home and the later
 * inbox reuse, so it holds no presentation.
 */
export type ReportCounts = { active: number; unreadResolved: number; unreadAnnouncements: number };

const BADGE_CAP = 99;

export function reportsBadgeCount(counts: ReportCounts | null): number {
  return counts ? counts.unreadResolved + counts.unreadAnnouncements : 0;
}

export function badgeText(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(Math.max(Math.trunc(count), 0));
}

export type ReportSignal = { key: keyof ReportCounts; label: string; value: number | null };

/** The labeled counters in their fixed order; a value is null while the counts are unavailable. */
export function reportSignals(counts: ReportCounts | null): ReportSignal[] {
  return [
    { key: 'active', label: 'Active reports', value: counts?.active ?? null },
    { key: 'unreadResolved', label: 'Unread resolved reports', value: counts?.unreadResolved ?? null },
    { key: 'unreadAnnouncements', label: 'Unread announcements', value: counts?.unreadAnnouncements ?? null },
  ];
}
