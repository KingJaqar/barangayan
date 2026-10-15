'use client';

import Image from 'next/image';
import styles from './admin-navigation.module.css';
import { Bell, Check, ChevronDown, Menu, Palette, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { AdminActionMenu } from './dropdown/admin-action-menu';
import { DropdownSurface } from './dropdown/dropdown-surface';
import dropdown from './dropdown/dropdown.module.css';

import { useAdminAuditNotifications } from '@/hooks/use-admin-audit-notifications';
import { MODULE_META, MODULE_ORDER, type ModuleKey } from '@/lib/audit-notifications';
import { THEMED_SCROLLBAR_CLASS } from '@/lib/scrollbar';

import { NotificationsDrawer } from './notifications-drawer';
import { NotificationIcon, NotificationIconBadge } from './notification-icon';
import { ScrollableChipRow } from './scrollable-chip-row';
import { Spinner } from '@/components/loading/spinner';
import { NavbarSearch } from './search/navbar-search';
import { useProfileNavigation } from './profile-navigation-guard';

type NotificationFilter = 'all' | 'unread' | ModuleKey;

const ICON_STROKE = { strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

interface HeaderProps {
  barangayName: string;
  adminName: string;
  barangayId: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function Header({ barangayName, adminName, barangayId, sidebarCollapsed, onToggleSidebar, onLogout }: HeaderProps) {
  const router = useRouter();
  const { requestLeave } = useProfileNavigation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('all');
  // Split in two so the drawer can play its exit animation before actually
  // leaving the DOM: `drawerOpen` is the target visual state (flip false to
  // start the close animation), `drawerMounted` stays true until the drawer
  // itself reports the exit transition finished.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);

  const accountTrigger = useRef<HTMLButtonElement>(null);
  const notifTrigger = useRef<HTMLButtonElement>(null);
  const closeAccount = useCallback(() => setShowProfileMenu(false), []);
  const closeNotifications = useCallback(() => setShowNotifications(false), []);

  const { notifications, unreadCount, loading: notifLoading, markAsRead, markAllAsRead, refetch: refetchNotifications } =
    useAdminAuditNotifications(barangayId);

  async function handleNotificationClick(id: string, href: string | null) {
    await markAsRead(id);
    setShowNotifications(false);
    if (href) requestLeave(() => router.push(href));
  }

  // Badge label — cap at 99+.
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'all') return true;
    if (notifFilter === 'unread') return !n.is_read;
    return n.module === notifFilter;
  });

  function openDrawer() {
    setShowNotifications(false);
    setDrawerMounted(true);
    setDrawerOpen(true);
  }

  return (
    <header className={`flex items-center border-b ${styles.header}`}>
      <button onClick={onToggleSidebar} className={styles.menuButton} aria-label="Toggle sidebar" aria-expanded={!sidebarCollapsed} aria-controls="admin-sidebar">
        <Menu className="size-5" {...ICON_STROKE} />
      </button>

      <div className={styles.brand}>
        <Image
          src="/assets/logo/barangayan-logo-1024.png"
          alt="Barangayan logo"
          width={36}
          height={36}
          className="rounded-full object-cover"
          priority
        />
        <div>
          <p className={styles.brandName}>Barangayan</p>
          <p className={styles.brandDetail}>{barangayName} admin</p>
        </div>
      </div>

      <NavbarSearch className={styles.search} barangayId={barangayId} />

      {/* Notification bell */}
      <div className="relative">
        <button
          ref={notifTrigger}
          onClick={() => setShowNotifications((v) => !v)}
          className={`relative rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 ${styles.bell}`}
          aria-expanded={showNotifications}
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
          <DropdownSurface anchor={notifTrigger} onDismiss={closeNotifications} width={416} role="region" aria-label="Notifications"
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeNotifications(); notifTrigger.current?.focus({ preventScroll: true }); }
              if (event.key === 'Tab') {
                const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
                if (document.activeElement === (event.shiftKey ? controls[0] : controls[controls.length - 1])) { closeNotifications(); notifTrigger.current?.focus({ preventScroll: true }); }
              }
            }}>
            {/* Header */}
            <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Notifications</span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 ? (
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                    >
                      <Check className="size-3" />
                      Mark all as read
                    </button>
                  ) : null}
                  <button
                    autoFocus
                    onClick={openDrawer}
                    className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-[var(--accent)] dark:text-zinc-400"
                  >
                    More
                  </button>
                </div>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                Shared with every admin in {barangayName} — actions from any admin account appear here.
              </p>
            </div>

            {/* Filter chips — every module, always shown, horizontally scrollable */}
            <div className="border-b border-black/10 px-2 py-2 dark:border-white/10">
              <ScrollableChipRow className="px-1" edgeFromClassName="from-white dark:from-zinc-900">
                <FilterChip active={notifFilter === 'all'} onClick={() => setNotifFilter('all')}>
                  All
                </FilterChip>
                <FilterChip active={notifFilter === 'unread'} onClick={() => setNotifFilter('unread')}>
                  Unread
                </FilterChip>
                {MODULE_ORDER.map((key) => (
                  <FilterChip key={key} active={notifFilter === key} onClick={() => setNotifFilter(key)}>
                    <NotificationIcon module={key} />
                    {MODULE_META[key].label}
                  </FilterChip>
                ))}
              </ScrollableChipRow>
            </div>

            {/* List — themed thin scrollbar + edge fade so the cut-off blends into the card */}
            <div
              className={`max-h-[32rem] overflow-y-auto ${THEMED_SCROLLBAR_CLASS}`}
              style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
              }}
            >
              {notifLoading ? (
                <p
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-center justify-center gap-2 px-4 py-6 text-center text-sm text-zinc-400">
                  <Spinner size="compact" /> Loading notifications…
                </p>
              ) : filteredNotifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">
                  {notifications.length === 0 ? 'No notifications' : 'No notifications match this filter'}
                </p>
              ) : (
                filteredNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.href)}
                    className={`${dropdown.row} flex-col gap-0.5 ${
                      !n.is_read ? 'bg-[var(--accent)]/5 dark:bg-[var(--accent)]/10' : ''
                    }`}
                  >
                    <div className="flex w-full items-start gap-3">
                      <NotificationIconBadge module={n.module} />
                      <span className={`flex-1 leading-snug ${!n.is_read ? 'font-medium' : 'text-zinc-500'}`}>
                        {n.displayLabel}
                      </span>
                      {!n.is_read ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                      ) : null}
                    </div>
                    <span className="pl-12 text-xs text-zinc-400">{n.relativeTime}</span>
                  </button>
                ))
              )}
            </div>
          </DropdownSurface>
        ) : null}

        {drawerMounted ? (
          <NotificationsDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onClosed={() => setDrawerMounted(false)}
            barangayId={barangayId}
            barangayName={barangayName}
            onSynced={refetchNotifications}
          />
        ) : null}
      </div>

      {/* Profile menu */}
      <div className="relative">
        <button
          ref={accountTrigger}
          onClick={() => setShowProfileMenu((v) => !v)}
          aria-label="Account menu"
          aria-expanded={showProfileMenu}
          aria-haspopup="menu"
          onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setShowProfileMenu(true); } }}
          className={`flex items-center rounded-full border hover:bg-zinc-50 dark:hover:bg-zinc-800 ${styles.profile}`}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold dark:bg-zinc-700">
            {adminName.charAt(0).toUpperCase() || 'A'}
          </span>
          <span className="hidden sm:inline">{adminName}</span>
          <ChevronDown className="size-3.5 text-zinc-400" {...ICON_STROKE} />
        </button>

        {showProfileMenu ? (
          <AdminActionMenu anchor={accountTrigger} onClose={closeAccount} label="Account menu" items={[
            { label: 'Theme', icon: <Palette size={17} />, href: '/theme', onSelect: closeAccount },
            { label: 'Logout', icon: <LogOut size={17} />, destructive: true, onSelect: onLogout },
          ]} />
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}
