'use client';

import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Heart,
  Info,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  QrCode,
  ReceiptText,
  ScrollText,
  Settings,
  Sun,
  TriangleAlert,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { NOTIFICATION_CATEGORY_LABELS, useAdminAuditNotifications } from '@/hooks/use-admin-audit-notifications';

import type { AdminAuditLogCategory } from '@barangayan/shared';

type NotificationFilter = 'all' | 'unread' | keyof AdminAuditLogCategory;

const ICON_STROKE = { strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const SECTION_LABELS: Record<string, { icon: LucideIcon; label: string }> = {
  '/dashboard': { icon: LayoutDashboard, label: 'Dashboard' },
  '/theme': { icon: Sun, label: 'Theme' },
  '/services': { icon: FileText, label: 'Services' },
  '/announcements': { icon: Megaphone, label: 'Announcements' },
  '/requests': { icon: Mail, label: 'Requests' },
  '/transactions': { icon: ReceiptText, label: 'Transactions' },
  '/residents': { icon: UsersRound, label: 'Resident Directory' },
  '/incident-reports': { icon: TriangleAlert, label: 'Incident Reports' },
  '/incident-map': { icon: MapPin, label: 'Incident Map' },
  '/health': { icon: Heart, label: 'Health' },
  '/staff': { icon: CalendarDays, label: 'Staff Member' },
  '/faq': { icon: CircleHelp, label: 'FAQ Content' },
  '/terms-privacy': { icon: ScrollText, label: 'Terms & Privacy' },
  '/about-us': { icon: Info, label: 'About Us' },
  '/settings': { icon: Settings, label: 'Settings' },
  '/hub': { icon: Building2, label: 'Hub' },
  '/evacuation-centers': { icon: MapPin, label: 'Evacuation Centers' },
  '/emergency-qr': { icon: QrCode, label: 'Emergency QR' },
  '/households-residents': { icon: Users, label: 'Households & Residents' },
};

interface SearchResult {
  href: string;
  primary: string;
  secondary: string;
}

interface HeaderProps {
  barangayName: string;
  adminName: string;
  barangayId: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function Header({ barangayName, adminName, barangayId, onToggleSidebar, onLogout }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('all');

  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, loading: notifLoading, markAsRead, markAllAsRead } =
    useAdminAuditNotifications(barangayId);

  const section = Object.entries(SECTION_LABELS).find(([href]) => pathname?.startsWith(href))?.[1];

  // Close profile menu on outside click.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search.
  useEffect(() => {
    const timeout = setTimeout(async () => {
      // Clearing happens on the same debounce tick as searching, so an emptied box drops
      // its stale results without setState running synchronously in the effect body.
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const supabase = createSupabaseBrowserClient();
      const needle = `%${query}%`;

      const [{ data: requests }, { data: residents }] = await Promise.all([
        supabase
          .from('service_requests')
          .select('id, reference_number')
          .ilike('reference_number', needle)
          .is('deleted_at', null)
          .limit(5),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'resident')
          .ilike('full_name', needle)
          .is('deleted_at', null)
          .limit(5),
      ]);

      setResults([
        ...(requests ?? []).map((r) => ({ href: `/requests/${r.id}`, primary: `#${r.reference_number}`, secondary: 'Request' })),
        ...(residents ?? []).map((r) => ({ href: `/residents?q=${encodeURIComponent(r.full_name)}`, primary: r.full_name, secondary: 'Resident' })),
      ]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleNotificationClick(id: string, href: string | null) {
    await markAsRead(id);
    setShowNotifications(false);
    if (href) router.push(href);
  }

  // Badge label — cap at 99+.
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  // Category chips only for categories actually present in the current page of
  // notifications — avoids a wall of empty filters on a quiet barangay.
  const presentCategories = Array.from(new Set(notifications.map((n) => n.category)));

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'all') return true;
    if (notifFilter === 'unread') return !n.is_read;
    return n.category === notifFilter;
  });

  return (
    <header className="flex items-center gap-4 border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950">
      <button onClick={onToggleSidebar} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Toggle sidebar">
        <Menu className="size-5" {...ICON_STROKE} />
      </button>

      <div className="flex items-center gap-2">
        <Image
          src="/assets/logo/barangayan-logo-1024.png"
          alt="Barangayan logo"
          width={36}
          height={36}
          className="rounded-full object-cover"
          priority
        />
        <div>
          <p className="font-serif text-sm font-bold leading-tight">Barangayan</p>
          <p className="text-xs leading-tight text-zinc-500">{barangayName} admin</p>
        </div>
      </div>

      {section ? (
        <div className="ml-4 hidden items-center gap-1.5 text-sm font-semibold text-[var(--accent)] md:flex">
          <section.icon className="size-4" {...ICON_STROKE} />
          <span>{section.label}</span>
        </div>
      ) : null}

      <div className="relative ml-4 flex-1 max-w-xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search residents, requests, incidents..."
          className="w-full rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-900"
        />
        {query.trim() && results.length > 0 ? (
          <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900">
            {results.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                onClick={() => setQuery('')}
                className="flex items-center justify-between px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <span>{r.primary}</span>
                <span className="text-xs text-zinc-400">{r.secondary}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {/* Notification bell */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotifications((v) => !v)}
          className="relative rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Notifications"
        >
          <Bell className="size-5" {...ICON_STROKE} />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 py-px text-[10px] font-bold leading-none text-white">
              {badgeLabel}
            </span>
          ) : null}
        </button>

        {showNotifications ? (
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900">
            {/* Header */}
            <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 ? (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                  >
                    <Check className="size-3" />
                    Mark all as read
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                Shared with every admin in {barangayName} — actions from any admin account appear here.
              </p>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-black/10 px-3 py-2 dark:border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip active={notifFilter === 'all'} onClick={() => setNotifFilter('all')}>
                All
              </FilterChip>
              <FilterChip active={notifFilter === 'unread'} onClick={() => setNotifFilter('unread')}>
                Unread
              </FilterChip>
              {presentCategories.map((cat) => (
                <FilterChip key={cat} active={notifFilter === cat} onClick={() => setNotifFilter(cat)}>
                  {NOTIFICATION_CATEGORY_LABELS[cat]}
                </FilterChip>
              ))}
            </div>

            {/* List — themed thin scrollbar + edge fade so the cut-off blends into the card */}
            <div
              className="max-h-96 overflow-y-auto [scrollbar-color:theme(colors.zinc.300)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:theme(colors.zinc.700)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-400 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 dark:[&::-webkit-scrollbar-thumb:hover]:bg-zinc-600"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
              }}
            >
              {notifLoading ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">Loading…</p>
              ) : filteredNotifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">
                  {notifications.length === 0 ? 'No notifications' : 'No notifications match this filter'}
                </p>
              ) : (
                filteredNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.href)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      !n.is_read ? 'bg-[var(--accent)]/5 dark:bg-[var(--accent)]/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`flex-1 leading-snug ${!n.is_read ? 'font-medium' : 'text-zinc-500'}`}>
                        {n.displayLabel}
                      </span>
                      {!n.is_read ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                      ) : null}
                    </div>
                    <span className="text-xs text-zinc-400">{n.relativeTime}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Profile menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowProfileMenu((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold dark:bg-zinc-700">
            {adminName.charAt(0).toUpperCase() || 'A'}
          </span>
          <span className="hidden sm:inline">{adminName}</span>
          <ChevronDown className="size-3.5 text-zinc-400" {...ICON_STROKE} />
        </button>

        {showProfileMenu ? (
          <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <Link href="/theme" onClick={() => setShowProfileMenu(false)} className="block px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Theme
            </Link>
            <button
              onClick={onLogout}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}
