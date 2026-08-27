'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Wraps a `<table>` (passed as `children`, already rendered — so this also works when the
 * caller is a React Server Component, since only rendered JSX crosses the server/client
 * boundary here, not functions) in a horizontal scroll area with two synced scrollbars: the
 * real one below the table, and a thin mirror pinned above it so wide tables stay scrollable
 * even when the bottom scrollbar sits below the fold. Dragging either one scrolls both.
 *
 * Shared by DataTable, EditableDataTable, and the hand-rolled Resident Directory table so all
 * table screens get identical horizontal-scroll behavior from one place. */
export function TableScrollArea({ children }: { children: ReactNode }) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const syncingFrom = useRef<'top' | 'bottom' | null>(null);

  useLayoutEffect(() => {
    const bottomEl = bottomScrollRef.current;
    const table = bottomEl?.firstElementChild as HTMLElement | undefined;
    if (!bottomEl || !table) return;

    const updateWidth = () => setTableWidth(table.scrollWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(table);
    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    function handleWindowResize() {
      const table = bottomScrollRef.current?.firstElementChild as HTMLElement | undefined;
      if (table) setTableWidth(table.scrollWidth);
    }
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  function handleTopScroll() {
    if (syncingFrom.current === 'bottom') return;
    syncingFrom.current = 'top';
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    syncingFrom.current = null;
  }

  function handleBottomScroll() {
    if (syncingFrom.current === 'top') return;
    syncingFrom.current = 'bottom';
    if (bottomScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    syncingFrom.current = null;
  }

  return (
    <div>
      <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: 16 }}>
        <div style={{ width: tableWidth, height: 1 }} />
      </div>
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className="w-full overflow-x-auto rounded-xl border border-black/10 dark:border-white/10"
      >
        {children}
      </div>
    </div>
  );
}
