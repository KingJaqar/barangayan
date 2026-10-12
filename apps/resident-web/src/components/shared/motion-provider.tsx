'use client';

import { MotionConfig } from 'framer-motion';

/**
 * Applies the resident's reduced-motion preference to every existing Framer Motion
 * component (drawers, segment pills, modals): transform and layout animations are
 * skipped under `prefers-reduced-motion: reduce`. CSS motion is handled in globals.css.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
