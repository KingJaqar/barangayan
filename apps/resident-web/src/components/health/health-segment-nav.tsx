'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPendingHint } from '@/components/shell/link-pending-hint';

import styles from './health.module.css';

const SEGMENTS = [
  { href: '/health', label: 'Active Drives', exact: true },
  { href: '/health/my-registrations', label: 'My Registrations', exact: false },
] as const;

/** Shared health navigation retains its animated selection and pending-route hint. */
export function HealthSegmentNav() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <nav className={styles.nav} aria-label="Health navigation">
      {SEGMENTS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={styles.navLink}>
            {active ? (
              <motion.span
                layoutId="health-segment-pill"
                className={styles.navPill}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            ) : null}
            <span className={styles.navLabel}>{exact ? <CalendarDays size={15} aria-hidden="true" /> : <ClipboardList size={15} aria-hidden="true" />}{label}</span>
            <LinkPendingHint className="bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 text-primary" />
          </Link>
        );
      })}
    </nav>
  );
}
