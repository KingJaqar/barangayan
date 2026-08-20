'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SEGMENTS = [
  { href: '/emergency', label: 'Hub', exact: true },
  { href: '/emergency/centers', label: 'Centers', exact: false },
  { href: '/emergency/scan', label: 'Scan', exact: false },
  { href: '/emergency/family', label: 'Family', exact: false },
  { href: '/emergency/alerts', label: 'Alerts', exact: false },
] as const;

/**
 * The 5-segment pill nav shared by every Emergency & DRRM route — web counterpart of
 * mobile's `?tab=` switcher (index.tsx's TABS), but as real routes so each segment is a
 * real, linkable, back-button-friendly URL (plan's file-tree rationale: "route-per-segment
 * beats one giant file").
 */
export function EmergencySegmentNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
      {SEGMENTS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors">
            {active ? (
              <motion.span
                layoutId="emergency-segment-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            ) : null}
            <span className={`relative ${active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
