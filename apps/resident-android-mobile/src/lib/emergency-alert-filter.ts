export type AlertPeriod = 'all' | 'today' | 'lastWeek' | 'lastMonth' | 'lastYear';
export type AlertDateFilter = { month: string; day: string; year: string };
export const EMPTY_ALERT_DATE: AlertDateFilter = { month: '', day: '', year: '' };
export const ALERT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const ALERT_PERIODS: { key: AlertPeriod; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'today', label: 'Today' },
  { key: 'lastWeek', label: 'Last Week' }, { key: 'lastMonth', label: 'Last Month' }, { key: 'lastYear', label: 'Last Year' },
];

/** Existing local-calendar predicates: each date part AND the rolling period. */
export function matchesEmergencyAlert(publishedAt: string, period: AlertPeriod, filter: AlertDateFilter, now: Date): boolean {
  const published = new Date(publishedAt);
  const monthIndex = ALERT_MONTHS.findIndex(month => month.toLowerCase() === filter.month.toLowerCase().trim());
  const day = parseInt(filter.day, 10);
  const year = parseInt(filter.year, 10);
  if (monthIndex >= 0 && published.getMonth() !== monthIndex) return false;
  if (!Number.isNaN(day) && published.getDate() !== day) return false;
  if (!Number.isNaN(year) && published.getFullYear() !== year) return false;
  if (period === 'today') return published.getFullYear() === now.getFullYear()
    && published.getMonth() === now.getMonth() && published.getDate() === now.getDate();
  if (period === 'all') return true;
  const lower = new Date(now);
  lower.setDate(lower.getDate() - (period === 'lastWeek' ? 7 : period === 'lastMonth' ? 30 : 365));
  return published >= lower;
}

export function alertDateLabel(filter: AlertDateFilter): string {
  return [filter.month ? filter.month.slice(0, 3) : 'Any month', filter.day || 'Any day', filter.year || 'Any year'].join(' · ');
}

/** Calendar years become selectable as they arrive; Any keeps date parts independent. */
export function alertYearOptions(currentYear = new Date().getFullYear()): string[] {
  const lastYear = Math.max(2026, currentYear);
  return ['', ...Array.from({ length: lastYear - 2026 + 1 }, (_, index) => String(2026 + index))];
}
