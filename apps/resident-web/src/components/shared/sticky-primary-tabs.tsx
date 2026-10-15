'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import styles from './sticky-tabs.module.css';

/** Keep secondary tabs below the actual primary row, including responsive spacing. */
export function StickyPrimaryTabs({ children }: { children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const workspace = row?.parentElement;
    if (!row || !workspace) return;

    const property = '--resident-primary-tabs-height';
    const previousHeight = workspace.style.getPropertyValue(property);
    const updateHeight = () => {
      workspace.style.setProperty(property, `${row.getBoundingClientRect().height}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(row);

    return () => {
      observer.disconnect();
      if (previousHeight) workspace.style.setProperty(property, previousHeight);
      else workspace.style.removeProperty(property);
    };
  }, []);

  return <div ref={rowRef} className={styles.primary}>{children}</div>;
}
