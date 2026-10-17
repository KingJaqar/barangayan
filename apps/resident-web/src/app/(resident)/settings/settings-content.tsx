'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

/** Scroll only the Settings pane (or the main pane on narrow screens).
 * scrollIntoView also scrolls hidden outer ancestors, moving the resident header.
 */
function settingsScrollPane(target: HTMLElement | null) {
  let pane = target?.closest<HTMLElement>('[data-settings-content]') ?? null;
  while (pane) {
    const overflow = window.getComputedStyle(pane).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') {
      return pane;
    }
    pane = pane.parentElement;
  }
  return null;
}

export function scrollSettingsContentToTop(target: HTMLElement | null) {
  settingsScrollPane(target)?.scrollTo({ top: 0, behavior: 'instant' });
}

/** A gentle, cancellable transition confined to the content's scroll pane. */
export function scrollSettingsContentToDetails(target: HTMLElement | null) {
  const pane = settingsScrollPane(target);
  if (!pane || !target) return;
  const start = pane.scrollTop;
  const end = Math.max(0, Math.min(pane.scrollHeight - pane.clientHeight,
    start + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pane.scrollTo({ top: end, behavior: 'instant' });
    return;
  }
  let frame = 0;
  const began = performance.now();
  const cancel = () => {
    cancelAnimationFrame(frame);
    pane.removeEventListener('wheel', cancel);
    pane.removeEventListener('pointerdown', cancel);
    pane.removeEventListener('keydown', cancel);
  };
  const animate = (now: number) => {
    const progress = Math.min(1, (now - began) / 800);
    pane.scrollTo({ top: start + (end - start) * (1 - (1 - progress) ** 3), behavior: 'instant' });
    if (progress < 1) frame = requestAnimationFrame(animate);
    else cancel();
  };
  pane.addEventListener('wheel', cancel, { passive: true });
  pane.addEventListener('pointerdown', cancel, { passive: true });
  pane.addEventListener('keydown', cancel);
  frame = requestAnimationFrame(animate);
  return cancel;
}

/** Reset the new page without touching the shared sidebar's scroll position. */
export function SettingsContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div
      ref={contentRef}
      data-settings-content
      className="min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]">
      {children}
    </div>
  );
}
