'use client';

import {
  Bell,
  BookOpen,
  Download,
  FileText,
  HelpCircle,
  Info,
  KeyRound,
  LogOut,
  Palette,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  destructive?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Grouped the same way the original mobile-style settings page grouped its sections
// (Account / Preferences / Privacy & Data / About) — carried over here as the sidebar's
// group headers, matching admin-web's SidebarNav grouping convention.
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Account',
    items: [
      { href: '/settings/profile', icon: User, label: 'Profile' },
      { href: '/settings/change-password', icon: KeyRound, label: 'Change Password' },
      { href: '/settings/notifications', icon: Bell, label: 'Notifications' },
    ],
  },
  {
    title: 'Preferences',
    items: [{ href: '/settings/theme', icon: Palette, label: 'Theme & Appearance' }],
  },
  {
    title: 'Privacy & Data',
    items: [
      { href: '/settings/download-data', icon: Download, label: 'Download My Data' },
      { href: '/settings/delete-account', icon: Trash2, label: 'Delete My Account', destructive: true },
    ],
  },
  {
    title: 'About',
    items: [
      { href: '/settings/help', icon: HelpCircle, label: 'Help Center' },
      { href: '/settings/terms-privacy', icon: FileText, label: 'Terms & Privacy Policy' },
      { href: '/settings/about', icon: Info, label: 'About Us' },
    ],
  },
];

interface SettingsSidebarProps {
  /** Server action wired to a <form>, rendered as the trailing "Log out" row. */
  logoutAction: () => void | Promise<void>;
  /** Drives the green-check/yellow-! badge on the Profile row (email_verification_status === 'verified'). */
  emailVerified: boolean;
}

/**
 * Left-hand navigation for /settings — deliberately reuses admin-web's SidebarNav
 * (apps/admin-web/src/components/admin/sidebar-nav.tsx) styling verbatim: same
 * 285px width, same 49px/rounded-2xl/13px-bold rows, same accent-filled active pill
 * + shadow, same size-5/1.75-stroke icons, same group-title treatment. The one
 * structural difference is unavoidable: admin's <aside> is edge-to-edge in a
 * dedicated app shell with its own `overflow-y-auto`, while this sidebar lives
 * inset inside resident-web's shared page shell (site header + max-width content),
 * so it's a bordered panel (all four sides, rounded) instead of a border-r cut
 * against the viewport edge, and stays in view via `sticky` rather than an
 * independent scroll region. Below `lg` there's no room for a fixed 285px column,
 * so it collapses to an icon-only horizontal strip instead.
 */
export function SettingsSidebar({ logoutAction, emailVerified }: SettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <aside aria-label="Settings" className="shrink-0 lg:w-[285px]">
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e5e7eb] bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-6 lg:flex-col lg:gap-[16px] lg:overflow-visible lg:p-[13px] lg:py-[26px]">
        <nav className="flex gap-1 lg:contents" aria-label="Settings">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="contents lg:flex lg:flex-col lg:gap-[6px]">
              <p className="hidden px-[6px] text-[13px] font-medium leading-5 text-[#1d2635] lg:block dark:text-zinc-300">
                {group.title}
              </p>
              <div className="contents lg:flex lg:flex-col lg:gap-[4px]">
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
                      badge={item.href === '/settings/profile' ? (emailVerified ? 'verified' : 'unverified') : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="my-1 hidden h-px shrink-0 bg-[#e5e7eb] lg:block dark:bg-zinc-800" />

        <InfoRow icon={BookOpen} label="App Version" value="1.0.0" />
        <form action={logoutAction} className="contents">
          <button
            type="submit"
            className="flex h-[49px] shrink-0 items-center gap-[13px] whitespace-nowrap rounded-2xl px-[13px] text-left text-[13px] font-bold text-[#df2d2d] transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
            <LogOut className="size-5 shrink-0" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
            <span className="hidden lg:inline">Log out</span>
          </button>
        </form>
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
    ? 'bg-red-50 text-[#df2d2d] dark:bg-red-950/30 dark:text-red-400'
    : 'bg-[var(--accent)] text-white shadow-[0_1px_2px_var(--accent-shadow)]';
  const idleClasses = destructive
    ? 'text-[#df2d2d] hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20'
    : 'text-[#151b2b] hover:bg-[#f3f5f7] dark:text-zinc-100 dark:hover:bg-zinc-900';

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[49px] shrink-0 items-center gap-[13px] whitespace-nowrap rounded-2xl px-[13px] text-[13px] font-bold transition-colors ${
        active ? activeClasses : idleClasses
      }`}>
      <span className="relative shrink-0">
        <Icon className="size-5" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        {badge ? (
          <span
            title={badge === 'verified' ? 'Email verified' : 'Email not verified'}
            className={`absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black leading-none text-white ring-2 ring-white dark:ring-zinc-900 ${
              badge === 'verified' ? 'bg-green-500' : 'bg-amber-400'
            }`}>
            {badge === 'verified' ? '✓' : '!'}
          </span>
        ) : null}
      </span>
      <span className="hidden flex-1 truncate lg:inline">{label}</span>
    </Link>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: ReactNode }) {
  return (
    <div className="hidden h-[49px] shrink-0 items-center gap-[13px] whitespace-nowrap rounded-2xl px-[13px] text-[13px] font-medium text-zinc-500 lg:flex dark:text-zinc-400">
      <Icon className="size-5 shrink-0" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <span className="flex-1">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
