'use client';

import {
  Bell,
  BookOpen,
  Download,
  FileText,
  HelpCircle,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  MailCheck,
  Palette,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { LinkPendingHint } from '@/components/shell/link-pending-hint';
import { LoadingStatus, PendingText } from '@/components/shared/loading-status';
import { Spinner } from '@/components/ui/loading';
import { useSignOut } from '@/hooks/use-sign-out';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  destructive?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  /** Account/Privacy & Data groups need a real session underneath (profile row,
   * password, exportable data) — hidden entirely for guests, same "don't show a
   * reachable-but-gated control" call ServicesSegmentNav makes for Requests/Logs.
   * Preferences and About need nothing but public/local data, so guests keep both. */
  guestAccessible: boolean;
}

// Grouped the same way the original mobile-style settings page grouped its sections
// (Account / Preferences / Privacy & Data / About) — carried over here as the sidebar's
// group headers, matching admin-web's SidebarNav grouping convention.
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Account',
    guestAccessible: false,
    items: [
      { href: '/settings/profile', icon: User, label: 'Profile' },
      { href: '/settings/email-verification', icon: MailCheck, label: 'Email Verification' },
      { href: '/settings/location-verification', icon: MapPin, label: 'Location Verification' },
      { href: '/settings/change-password', icon: KeyRound, label: 'Change Password' },
      { href: '/settings/notifications', icon: Bell, label: 'Notifications' },
    ],
  },
  {
    title: 'Preferences',
    guestAccessible: true,
    items: [{ href: '/settings/theme', icon: Palette, label: 'Theme & Appearance' }],
  },
  {
    title: 'Privacy & Data',
    guestAccessible: false,
    items: [
      { href: '/settings/download-data', icon: Download, label: 'Download My Data' },
      { href: '/settings/delete-account', icon: Trash2, label: 'Delete My Account', destructive: true },
    ],
  },
  {
    title: 'About',
    guestAccessible: true,
    items: [
      { href: '/settings/help', icon: HelpCircle, label: 'Help Center' },
      { href: '/settings/terms-privacy', icon: FileText, label: 'Terms & Privacy Policy' },
      { href: '/settings/about', icon: Info, label: 'About Us' },
    ],
  },
];

interface SettingsSidebarProps {
  /** Drives the green-check/yellow-! badge on the Email Verification row. */
  emailVerified: boolean;
  /** Drives the same badge on the Location Verification row (profiles.verified_location is set). */
  locationVerified: boolean;
  /** Hides the Account/Privacy & Data groups and swaps the footer's "Log out" row for
   * Log In / Sign Up links — there's no session to sign out of. */
  isAuthenticated: boolean;
}

/**
 * Settings navigation with a quiet gray surface and white selected rows.
 * Its independent scroll region remains mounted between settings pages.
 * Below `lg`, navigation uses the existing icon-only horizontal strip.
 */
export function SettingsSidebar({ emailVerified, locationVerified, isAuthenticated }: SettingsSidebarProps) {
  const pathname = usePathname();
  const { signOut, pending: signingOut } = useSignOut();
  const visibleGroups = isAuthenticated ? NAV_GROUPS : NAV_GROUPS.filter((g) => g.guestAccessible);

  return (
    <aside aria-label="Settings" className="shrink-0 lg:h-full lg:min-h-0 lg:w-[285px]">
      <div
        className="flex gap-1 overflow-x-auto rounded-[20px] border border-black/[0.04] bg-[#f4f4f3] p-2 dark:border-white/[0.06] dark:bg-zinc-900 lg:h-full lg:flex-col lg:gap-6 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:p-3 lg:py-5 lg:[scrollbar-gutter:stable] lg:[scrollbar-width:thin]">
        <nav className="flex gap-1 lg:contents" aria-label="Settings">
          {visibleGroups.map((group) => (
            <div key={group.title} className="contents lg:flex lg:shrink-0 lg:flex-col lg:gap-2">
              <p className="hidden px-3 text-[11px] font-medium leading-5 tracking-[0.02em] text-zinc-500 lg:block dark:text-zinc-400">
                {group.title}
              </p>
              <div className="contents lg:flex lg:flex-col lg:gap-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <NavRow
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={!!active}
                      destructive={item.destructive}
                      badge={
                        item.href === '/settings/email-verification'
                          ? emailVerified
                            ? 'verified'
                            : 'unverified'
                          : item.href === '/settings/location-verification'
                            ? locationVerified
                              ? 'verified'
                              : 'unverified'
                            : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden h-px shrink-0 bg-black/[0.06] lg:mt-auto lg:block dark:bg-white/[0.08]" />

        <InfoRow icon={BookOpen} label="App Version" value="1.0.0" />
        {isAuthenticated ? (
          // Same sign-out as the header (useSignOut): preferences reset and /login only
          // after the sign-out succeeds; a failure keeps the resident here with one error.
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-busy={signingOut || undefined}
            // The text label is hidden below lg, so the name can't depend on it.
            aria-label={signingOut ? 'Logging out…' : 'Log out'}
            className="flex h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:pointer-events-none dark:text-red-400 dark:hover:bg-red-950/30">
            <span className="relative flex size-5 shrink-0 items-center justify-center">
              <LogOut aria-hidden className={`size-5 ${signingOut ? 'rw-hint-out' : ''}`} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
              {signingOut ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Spinner />
                </span>
              ) : null}
            </span>
            <span aria-hidden className="hidden lg:inline">
              {signingOut ? <PendingText label="Logging out…" slowLabel="Still logging out…" /> : 'Log out'}
            </span>
          </button>
        ) : (
          <Link
            href="/login"
            className="flex h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] dark:text-zinc-200 dark:hover:bg-zinc-800">
            <LogIn className="size-5 shrink-0" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
            <span className="hidden lg:inline">Log In</span>
          </Link>
        )}
        {isAuthenticated ? <LoadingStatus active={signingOut} label="Logging out…" className="sr-only" /> : null}
      </div>
    </aside>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  active,
  destructive,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  destructive?: boolean;
  badge?: 'verified' | 'unverified';
}) {
  const activeClasses = destructive
    ? 'bg-white text-red-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] dark:bg-zinc-800 dark:text-red-400 dark:ring-white/[0.06]'
    : 'bg-white text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] dark:bg-zinc-800 dark:text-white dark:ring-white/[0.06]';
  const idleClasses = destructive
    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20'
    : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-white';

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        active ? activeClasses : idleClasses
      }`}>
      <span className="relative shrink-0">
        <Icon aria-hidden className="size-5 lg:size-[18px]" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </span>
      <span className="hidden flex-1 truncate lg:inline">{label}</span>
      {badge ? (
          <span
            title={badge === 'verified' ? 'Verified' : 'Not verified'}
            aria-label={badge === 'verified' ? 'Verified' : 'Not verified'}
            className={`absolute left-6 top-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold leading-none ring-2 ring-[#f4f4f3] lg:static lg:size-4 lg:ring-0 dark:ring-zinc-900 ${
              badge === 'verified' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
            {badge === 'verified' ? '✓' : '!'}
          </span>
        ) : null}
      <LinkPendingHint className="bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2" />
    </Link>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: ReactNode }) {
  return (
    <div className="hidden h-9 shrink-0 items-center gap-3 whitespace-nowrap px-3 text-xs font-normal text-zinc-500 lg:flex dark:text-zinc-400">
      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <span className="flex-1">{label}</span>
      <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/[0.06]">{value}</span>
    </div>
  );
}
