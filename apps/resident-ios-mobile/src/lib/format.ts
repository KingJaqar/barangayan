import { formatDate } from '@barangayan/shared';

/** Relative announcement timestamp; older than a week falls back to the calendar date. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return 'Date unavailable';
  const minutes = Math.floor((now.getTime() - time) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
  return formatDate(iso);
}

/** True when both instants fall on the same calendar day in the device's time zone (date-only boundary, not a 24-hour window). */
export function isSameLocalDay(iso: string, now: Date = new Date()): boolean {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
