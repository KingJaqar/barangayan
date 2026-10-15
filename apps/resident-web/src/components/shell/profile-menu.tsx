'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, LogOut, Moon, Settings, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { LoadingStatus, PendingText } from '@/components/shared/loading-status';
import { Spinner } from '@/components/ui/loading';
import { useThemeController } from '@/components/theme/theme-controller';
import { useSignOut } from '@/hooks/use-sign-out';
import styles from './resident-shell.module.css';

export function ProfileMenu({ residentName, avatarUrl }: { residentName: string | null; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const { signOut, pending: signingOut } = useSignOut();
  const { theme, setTheme } = useThemeController();
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<'first' | 'last'>('first');

  useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)');
    items?.[initialFocus.current === 'last' ? items.length - 1 : 0]?.focus();

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function closeAndFocusTrigger() {
    setOpen(false);
    trigger.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      // Let the browser move focus before removing the focused menu item.
      window.requestAnimationFrame(() => setOpen(false));
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
      return;
    }
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = (index + 1) % items.length; break;
      case 'ArrowUp': next = (index - 1 + items.length) % items.length; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default:
        // Native links need Space activation to match menu keyboard behavior.
        if (event.key === ' ' && document.activeElement instanceof HTMLAnchorElement) {
          event.preventDefault();
          document.activeElement.click();
        }
        return;
    }
    event.preventDefault();
    items[next].focus();
  }

  return (
    <div
      ref={container}
      className={styles.profileMenu}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        aria-label="Resident account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        className={styles.profileTrigger}
        onClick={() => { initialFocus.current = 'first'; setOpen(!open); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first';
            if (open) {
              const items = menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)');
              items?.[initialFocus.current === 'last' ? items.length - 1 : 0]?.focus();
            } else setOpen(true);
          } else if (event.key === 'Escape' && open) closeAndFocusTrigger();
        }}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full object-cover" />
        ) : (
          <span aria-hidden className={styles.avatarFallback}>{(residentName?.trim() || '?').charAt(0).toUpperCase()}</span>
        )}
        <ChevronDown aria-hidden size={14} strokeWidth={1.75} />
      </button>

      {open ? (
        <div className={styles.profileDropdown}>
          <div className={styles.profileSummary}>
            <p className={styles.residentName} title={residentName ?? undefined}>{residentName || 'Resident'}</p>
            <p className={styles.accountLabel}>Resident account</p>
          </div>
          <div ref={menu} id={`${id}-menu`} role="menu" aria-labelledby={`${id}-trigger`} onKeyDown={handleMenuKeyDown}>
            <Link href="/settings/profile" role="menuitem" tabIndex={-1} className={styles.profileMenuItem} onClick={closeAndFocusTrigger}>
              <UserRound aria-hidden size={18} strokeWidth={1.75} /> My Profile
            </Link>
            <Link href="/settings" role="menuitem" tabIndex={-1} className={styles.profileMenuItem} onClick={closeAndFocusTrigger}>
              <Settings aria-hidden size={18} strokeWidth={1.75} /> Settings
            </Link>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={theme === 'dark'}
              tabIndex={-1}
              className={styles.profileMenuItem}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Moon aria-hidden size={18} strokeWidth={1.75} /> Dark mode
              <span aria-hidden className={styles.themeToggle} />
            </button>
            <div role="separator" className={styles.profileSeparator} />
            <button type="button" role="menuitem" tabIndex={-1} disabled={signingOut} aria-busy={signingOut || undefined}
              className={`${styles.profileMenuItem} ${styles.profileLogout}`} onClick={() => {
                // Disabling the focused item blurs it; keep focus inside the menu so
                // the pending state and any failed-attempt retry remain visible.
                trigger.current?.focus();
                void signOut();
              }}>
              {signingOut ? <Spinner /> : <LogOut aria-hidden size={18} strokeWidth={1.75} />}
              {signingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
          {signingOut ? <PendingText label={null} slowLabel={<p className="px-3 py-2 text-xs text-muted-foreground">Taking longer than usual…</p>} /> : null}
        </div>
      ) : null}
      <LoadingStatus active={signingOut} label="Logging out…" className="sr-only" />
    </div>
  );
}
