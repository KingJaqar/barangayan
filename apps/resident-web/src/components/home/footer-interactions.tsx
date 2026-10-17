'use client';

import { ArrowUp, ChevronDown } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';

import { preferredScrollBehavior } from '@/lib/motion';
import styles from './landing.module.css';

/**
 * A footer link column. From tablet width up it is a plain heading with an always-open
 * list; on phones the heading becomes a disclosure button so four columns don't push the
 * footer off-screen. Only one of the two headings is ever rendered (CSS display), so
 * assistive tech never sees a duplicate.
 */
export function FooterGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className={`${styles.footerGroup} ${open ? styles.footerGroupOpen : ''}`}>
      <h3 className={styles.footerGroupHeading}>{title}</h3>
      <button
        type="button"
        className={styles.footerGroupToggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}>
        {title}
        <ChevronDown aria-hidden size={16} className={styles.footerChevron} />
      </button>
      <div id={listId} className={styles.footerGroupBody}>
        <div className={styles.footerGroupInner}>{children}</div>
      </div>
    </div>
  );
}

/** Scrolls the shell's scroll container (`<main>`, not the window) back to the top. */
export function BackToTop() {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      type="button"
      className={styles.backToTop}
      onClick={() => {
        const scroller = ref.current?.closest('main');
        if (scroller) scroller.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
        else window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
      }}>
      Back to top <ArrowUp aria-hidden size={15} />
    </button>
  );
}
