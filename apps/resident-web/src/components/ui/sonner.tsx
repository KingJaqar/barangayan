'use client';

import { useEffect, type CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';

import { useThemeController } from '@/components/theme/theme-controller';
import { adapterToastIdOf, holdToast, releaseToast } from '@/lib/notify';

const TOAST_SELECTOR = '[data-sonner-toast]';
const TOASTER_SELECTOR = '[data-sonner-toaster]';
// Auth pages have no header: 16 px below the top safe area. Resident pages set
// --rw-toast-top to the measured header bottom + 12 px (see toastAnchorRef).
const TOP = 'var(--rw-toast-top, calc(env(safe-area-inset-top, 0px) + 16px))';
const OFFSET = {
  top: TOP,
  left: 'calc(env(safe-area-inset-left, 0px) + 16px)',
  right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
};

/**
 * The single resident-web toast host (root layout). Feature code notifies through
 * lib/notify.ts; direct `toast()` calls not yet migrated render here too.
 * Top-center, at most 3 visible, 400 px max width, dismissible, themed to the active
 * light/dark mode and app font. Sonner pauses timers on hover and while the page is
 * hidden; focus pausing and Radix-dialog coexistence are handled below.
 */
/**
 * Ref callback for the element toasts sit below (the resident shell header, which also
 * carries data-toast-anchor). It measures header bottom + 12 px into --rw-toast-top and
 * keeps it current while the header resizes. Its cleanup runs when the header unmounts,
 * restoring the auth-page offset. Because the header registers itself, a route fallback
 * or streamed shell that mounts the header after the host still positions toasts
 * correctly. Module-level and stable, so React attaches it once per header element.
 */
function toastAnchorRef(anchor: HTMLElement | null) {
  if (!anchor) return;
  const root = document.documentElement;
  const update = () => root.style.setProperty('--rw-toast-top', `${Math.round(anchor.getBoundingClientRect().bottom) + 12}px`);
  update();
  const observer = new ResizeObserver(update);
  observer.observe(anchor);
  return () => {
    observer.disconnect();
    root.style.removeProperty('--rw-toast-top');
  };
}

function Toaster() {
  const { theme } = useThemeController();

  useEffect(() => {
    // Radix modal layers treat a toast as an "outside" interaction and would close the
    // open dialog (losing its input) when a toast is clicked or focused. Cancel only
    // those toast-originated outside events; the dialog keeps every other rule.
    const keepDialogOpen = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(TOASTER_SELECTOR)) event.preventDefault();
    };
    const onFocusIn = (event: FocusEvent) => {
      const item = event.target instanceof Element ? event.target.closest(TOAST_SELECTOR) : null;
      const id = item && adapterToastIdOf(item);
      if (id) holdToast(id);
    };
    const onFocusOut = (event: FocusEvent) => {
      const item = event.target instanceof Element ? event.target.closest(TOAST_SELECTOR) : null;
      if (!item || (event.relatedTarget instanceof Node && item.contains(event.relatedTarget))) return;
      const id = adapterToastIdOf(item);
      if (id) releaseToast(id);
    };
    document.addEventListener('dismissableLayer.pointerDownOutside', keepDialogOpen, true);
    document.addEventListener('dismissableLayer.focusOutside', keepDialogOpen, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('dismissableLayer.pointerDownOutside', keepDialogOpen, true);
      document.removeEventListener('dismissableLayer.focusOutside', keepDialogOpen, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <Sonner
      className="toaster group"
      position="top-center"
      theme={theme}
      visibleToasts={3}
      closeButton
      pauseWhenPageIsHidden
      containerAriaLabel="Notifications"
      offset={OFFSET}
      mobileOffset={OFFSET}
      style={{ '--width': '400px', fontFamily: 'var(--font-app)' } as CSSProperties}
      toastOptions={{
        classNames: {
          toast: 'group toast rounded-xl border border-border bg-card text-card-foreground shadow-lg',
          title: 'text-sm font-semibold',
          description: 'text-sm text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
    />
  );
}

export { Toaster, toastAnchorRef };
