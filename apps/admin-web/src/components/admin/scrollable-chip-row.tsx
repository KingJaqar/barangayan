'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollableChipRowProps {
  children: React.ReactNode;
  /** Extra classes for the scrolling track itself (padding, border, etc.). */
  className?: string;
  /** Tailwind gradient "from" classes matching the surrounding surface's
   * background, so the chevron buttons' fade blends in seamlessly instead of
   * showing a seam — the bell popover and the drawer sit on different
   * background colors, so this isn't safe to hardcode. */
  edgeFromClassName?: string;
}

const SCROLL_STEP = 220;

/**
 * Wraps a horizontally-scrollable row of filter chips with click-to-scroll
 * chevron buttons at either edge. The chips remain scrollable by drag/wheel/
 * touch as before — the chevrons are an added affordance, shown only on the
 * side(s) that actually have more content to reveal (checked via scroll
 * position, kept in sync via a `scroll` listener and a `ResizeObserver` so
 * they stay correct if the chip set or container width changes).
 */
export function ScrollableChipRow({ children, className = '', edgeFromClassName = 'from-white dark:from-zinc-900' }: ScrollableChipRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });

    // Re-check when the row's own size or its content's size changes (chips
    // added/removed, drawer resized, etc.) — a plain mount-only check would
    // go stale the moment the chip set or container width changes.
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
    // `children` is in the dep list (not read in the body) purely to retrigger
    // this check when the chip set changes shape (e.g. module list vs. action list).
  }, [updateScrollState, children]);

  function scrollBy(direction: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -SCROLL_STEP : SCROLL_STEP, behavior: 'smooth' });
  }

  return (
    <div className="relative flex items-center">
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scrollBy('left')}
          aria-label="Scroll filters left"
          className={`absolute left-0 z-10 flex h-full items-center bg-gradient-to-r ${edgeFromClassName} to-transparent pl-0.5 pr-3`}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10">
            <ChevronLeft className="size-3.5" />
          </span>
        </button>
      ) : null}

      <div
        ref={scrollRef}
        className={`flex items-center gap-1.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>

      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scrollBy('right')}
          aria-label="Scroll filters right"
          className={`absolute right-0 z-10 flex h-full items-center bg-gradient-to-l ${edgeFromClassName} to-transparent pl-3 pr-0.5`}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10">
            <ChevronRight className="size-3.5" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
