'use client';

import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  CircleHelp,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Moon,
  ReceiptText,
  Settings,
  Sun,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useThemeController } from '@/components/ui/theme-controller';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Operations',
    items: [
      { href: '/services', label: 'Services', icon: FileText },
      { href: '/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/requests', label: 'Requests', icon: Mail },
      { href: '/transactions', label: 'Transactions', icon: ReceiptText },
    ],
  },
  {
    title: 'Directories & Mapping',
    items: [
      { href: '/residents', label: 'Resident directory', icon: UsersRound },
      { href: '/incident-reports', label: 'Incident reports', icon: TriangleAlert },
      { href: '/incident-map', label: 'Incident map', icon: MapPin },
      { href: '/health', label: 'Health', icon: Heart },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/staff', label: 'Staff member', icon: CalendarDays },
      { href: '/faq', label: 'FAQ content', icon: CircleHelp },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function ThemeRow({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { theme, setTheme } = useThemeController();
  const isThemePage = pathname === '/theme';

  return (
    <div className="flex items-center gap-[10px] px-[10px] py-[8px]">
      <Link
        href="/theme"
        title={collapsed ? 'Theme' : undefined}
        className={`flex min-w-0 flex-1 items-center gap-[13px] rounded-xl text-[13px] font-semibold transition-colors ${
          isThemePage ? 'text-[#147b68]' : 'text-[#151b2b] dark:text-zinc-100'
        }`}>
        <Sun className="size-5 shrink-0 text-[#778191]" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        {!collapsed ? <span>Theme</span> : null}
      </Link>
      {!collapsed ? (
        <button
          type="button"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="relative flex h-8 w-[81px] shrink-0 items-center justify-between rounded-full border border-[#e3e7ed] bg-[#f5f6f8] px-[9px] transition-colors dark:border-zinc-700 dark:bg-zinc-800">
          {/* Sliding knob — sits behind the icons */}
          <span
            aria-hidden
            className={`absolute left-[4px] size-[25px] rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-zinc-700 ${
              theme === 'dark' ? 'translate-x-[48px]' : 'translate-x-0'
            }`}
          />
          {/* Sun always on left */}
          <Sun
            className={`relative z-10 size-4 transition-colors ${
              theme === 'light' ? 'text-[#374151] dark:text-zinc-200' : 'text-[#a0aab8]'
            }`}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Moon always on right */}
          <Moon
            className={`relative z-10 size-4 transition-colors ${
              theme === 'dark' ? 'text-[#374151] dark:text-zinc-200' : 'text-[#a0aab8]'
            }`}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </button>
      ) : null}
    </div>
  );
}

export function SidebarNav({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex min-h-0 shrink-0 flex-col overflow-y-auto border-r border-[#e5e7eb] bg-white py-[26px] transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
        collapsed ? 'w-[61px] px-[6px]' : 'w-[285px] px-[13px]'
      }`}>
      <nav className="flex flex-col gap-[16px]" aria-label="Admin navigation">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.title} className="space-y-[6px]">
            {!collapsed ? (
              <p className="px-[6px] text-[13px] font-medium leading-5 text-[#1d2635] dark:text-zinc-300">{group.title}</p>
            ) : null}
            <div className="space-y-[4px]">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex h-[49px] items-center gap-[13px] rounded-2xl px-[13px] text-[13px] font-bold transition-colors ${
                      isActive
                        ? 'bg-[#147b68] text-white shadow-[0_1px_2px_rgba(20,123,104,0.16)]'
                        : 'text-[#151b2b] hover:bg-[#f3f5f7] dark:text-zinc-100 dark:hover:bg-zinc-900'
                    }`}>
                    <Icon
                      className="size-5 shrink-0"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
              {groupIndex === 0 ? <ThemeRow collapsed={collapsed} /> : null}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          className="flex h-[49px] items-center gap-[13px] rounded-2xl px-[13px] text-left text-[13px] font-bold text-[#df2d2d] transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
          <LogOut
            className="size-5 shrink-0"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {!collapsed ? <span>Logout</span> : null}
        </button>
      </nav>
    </aside>
  );
}
