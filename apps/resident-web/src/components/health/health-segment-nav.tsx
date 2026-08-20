'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SEGMENTS = [
  { href: '/health', label: 'Active Drives', exact: true },
  { href: '/health/my-registrations', label: 'My Registrations', exact: false },
] as const;

/** 2-segment pill nav shared by both Health routes — same design as EmergencySegmentNav. */
export function HealthSegmentNav() {
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
                layoutId="health-segment-pill"
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
