'use client';

import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileText,
  Heart,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  QrCode,
  ReceiptText,
  Settings,
  Sun,
  TriangleAlert,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
  onToggleSidebar: () => void;
}

export function Header({ barangayName, adminName, onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const section = Object.entries(SECTION_LABELS).find(([href]) => pathname?.startsWith(href))?.[1];

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setNotifCount(count ?? 0));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // v1 scope (see the plan's §1.1): only Requests (by reference number) and Resident
  // Directory (by name) have real data to search against. Debounced to avoid a query per
  // keystroke.
  useEffect(() => {
    if (!query.trim()) return;
    const timeout = setTimeout(async () => {
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

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

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
        <div className="ml-4 hidden items-center gap-1.5 text-sm font-semibold text-[#0F6E5B] md:flex">
          <section.icon className="size-4" {...ICON_STROKE} />
          <span>{section.label}</span>
        </div>
      ) : null}

      <div className="relative ml-4 flex-1 max-w-xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search residents, requests, incidents..."
          className="w-full rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-900"
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

      <button className="relative rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Notifications">
        <Bell className="size-5" {...ICON_STROKE} />
        {notifCount > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        ) : null}
      </button>

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
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
