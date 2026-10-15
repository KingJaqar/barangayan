'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Bell, House, MapPin, QrCode, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPendingHint } from '@/components/shell/link-pending-hint';
import styles from './emergency.module.css';

const SEGMENTS = [
  { href: '/emergency', label: 'Hub', icon: House, exact: true },
  { href: '/emergency/centers', label: 'Centers', icon: MapPin, exact: false },
  { href: '/emergency/scan', label: 'Scan', icon: QrCode, exact: false },
  { href: '/emergency/family', label: 'Family', icon: Users, exact: false },
  { href: '/emergency/alerts', label: 'Alerts', icon: Bell, exact: false },
] as const;

/**
 * The 5-segment pill nav shared by every Emergency & DRRM route — web counterpart of
 * mobile's `?tab=` switcher (index.tsx's TABS), but as real routes so each segment is a
 * real, linkable, back-button-friendly URL (plan's file-tree rationale: "route-per-segment
 * beats one giant file").
 */
export function EmergencySegmentNav() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <div className={styles.navigation}>
      <nav aria-label="Emergency sections" className={styles.segments}>
        {SEGMENTS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={styles.segment}>
              {active ? (
                <motion.span
                  layoutId="emergency-segment-pill"
                  className={styles.activePill}
                  transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.25, duration: 0.35 }}
                />
              ) : null}
              <Icon size={15} aria-hidden="true" />
              <span className={styles.segmentLabel}>{label}</span>
              <LinkPendingHint className="bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 text-primary" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
