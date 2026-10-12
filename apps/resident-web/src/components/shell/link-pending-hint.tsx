'use client';

import { useLinkStatus } from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Fixed-size, always-rendered navigation hint for the enclosing next/link `<Link>` (it
 * must be a descendant of one). It is absolutely positioned, so the parent link needs
 * `relative`, and it never changes the link's size, name, or active styles. It is
 * decorative (aria-hidden): `useLinkStatus` reports pending only until browser history
 * updates, and prefetched routes skip it entirely, so it is pre-navigation feedback, not
 * a completion signal. The `rw-link-hint` CSS reveals it only after the shared 120 ms
 * delay and keeps it static under reduced motion.
 */
export function LinkPendingHint({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-slot="link-pending-hint"
      data-pending={pending ? '' : undefined}
      className={cn('rw-link-hint pointer-events-none absolute rounded-full bg-current', className)}
    />
  );
}
