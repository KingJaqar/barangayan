import type { IconName } from '@expo/ui';
import type { Href } from 'expo-router';
import { formatDate } from '@barangayan/shared';
import type { SetupLoad } from '../../auth/setup-status';
import { isSameLocalDay } from '../../lib/format';
import { badgeText } from '../../data/report-signals';

export type QuickAction = { key: string; label: string; hint: string; icon: IconName; href: Href };

/** The four Android quick actions. Each opens a working flow; the destination itself asks a guest to sign in where an account is needed. */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  { key: 'request', label: 'Request document', hint: 'Browse documents and start a request', icon: 'doc.text', href: '/services' },
  { key: 'report', label: 'Report issue', hint: 'Send a concern to your barangay', icon: 'megaphone', href: '/reports/new' },
  { key: 'emergency', label: 'Emergency info', hint: 'Hotlines, guidelines and alerts', icon: 'exclamationmark.triangle', href: '/emergency' },
  { key: 'medical', label: 'Medical info', hint: 'Medical drives and your registrations', icon: 'cross.case', href: '/health' },
];

export function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function displayName(fullName: string | null | undefined, firstName: string | null | undefined): string {
  return firstName?.trim() || fullName?.trim().split(/\s+/)[0] || 'Resident';
}

/** A same-day announcement reads TODAY; any other day shows its calendar date. */
export function announcementStamp(iso: string, now: Date = new Date()): string {
  if (Number.isNaN(new Date(iso).getTime())) return 'Date unavailable';
  return isSameLocalDay(iso, now) ? 'TODAY' : formatDate(iso);
}

/** The banner is shown only when the server says the profile is incomplete; an unknown status shows nothing rather than a guess. */
export function showsProfileBanner(setup: SetupLoad): boolean {
  return setup.state === 'ready' && !setup.status.profileComplete;
}

/** The announcement bell's spoken label, with its own unread count when one is known. */
export function bellLabel(unread: number | null): string {
  if (unread === null || unread === 0) return 'Announcements';
  return `Announcements, ${unread === 1 ? '1 unread' : `${badgeText(unread)} unread`}`;
}
