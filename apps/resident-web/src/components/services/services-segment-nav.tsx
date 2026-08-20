'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SEGMENTS = [
  { href: '/services/documents', label: 'Documents' },
  { href: '/services/requests', label: 'Requests' },
  { href: '/services/logs', label: 'Logs' },
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

  if (!isAuthenticated) {
    return (
      <nav className="mb-6 inline-flex rounded-full border border-border bg-card p-1">
        <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Documents</span>
      </nav>
    );
  }

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
      {SEGMENTS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors">
            {active ? (
              <motion.span
                layoutId="services-segment-pill"
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
