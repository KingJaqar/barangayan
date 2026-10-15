'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ClipboardList, FileText, History } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPendingHint } from '@/components/shell/link-pending-hint';
import styles from './services-segment-nav.module.css';

const SEGMENTS = [
  { href: '/services/documents', label: 'Documents', icon: FileText },
  { href: '/services/requests', label: 'Requests', icon: ClipboardList },
  { href: '/services/logs', label: 'Logs', icon: History },
] as const;

/**
 * Web counterpart of mobile's Documents/Requests/Logs SegmentedControl on the Services
 * screen (apps/resident-android-mobile/.../services/index.tsx) — real routes instead of
 * tab state, same reasoning as EmergencySegmentNav (plan's "route-per-segment beats one
 * giant file"). Guests only ever see Documents (real, guest-readable data per the 0005
 * migration's anon RLS policy on document_types) — Requests/Logs require a session, so
 * for a guest this renders as a single static, non-interactive pill rather than a
 * reachable-but-gated control, mirroring the mobile guest behavior exactly.
 */
export function ServicesSegmentNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (!isAuthenticated) {
    return (
      <nav className={styles.nav} aria-label="Services navigation">
        <span className={styles.link} aria-current="page">
          <span className={styles.pill} />
          <span className={styles.label}><FileText size={15} aria-hidden="true" />Documents</span>
        </span>
      </nav>
    );
  }

  return (
    <nav className={styles.nav} aria-label="Services navigation">
      {SEGMENTS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={styles.link}>
            {active ? (
              <motion.span
                layoutId="services-segment-pill"
                className={styles.pill}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            ) : null}
            <span className={styles.label}><Icon size={15} aria-hidden="true" />{label}</span>
            <LinkPendingHint className="bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 text-primary" />
          </Link>
        );
      })}
    </nav>
  );
}
