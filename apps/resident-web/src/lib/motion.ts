/**
 * Shared loading/motion defaults (Resident_Web_Loading_Motion_and_Toast_Implementation_Plan
 * §2 "Motion defaults"). CSS consumers use the matching `--motion-*` custom properties and
 * `rw-*` classes in app/globals.css; Framer Motion consumers use the transitions below.
 * The root MotionProvider sets `reducedMotion="user"`, so Framer transforms are skipped
 * for residents who prefer reduced motion.
 */
export const MOTION = {
  hintDelayMs: 120,
  revealMs: 200,
  staggerMs: 30,
  staggerMaxMs: 150,
  /** Only the first six cards of a list get an entrance; later cards render steady. */
  staggerLimit: 6,
  slowOperationMs: 10_000,
} as const;

const easeOut = [0.32, 0.72, 0, 1] as const;
const easeIn = [0.4, 0, 1, 1] as const;

/** Drawer slide: 240 ms entrance, 180 ms exit, no spring/bounce. */
export const drawerTransition = {
  enter: { type: 'tween', duration: 0.24, ease: easeOut },
  exit: { type: 'tween', duration: 0.18, ease: easeIn },
} as const;

/** Dialog: 180 ms entrance, 140 ms exit. */
export const dialogTransition = {
  enter: { type: 'tween', duration: 0.18, ease: easeOut },
  exit: { type: 'tween', duration: 0.14, ease: easeIn },
} as const;

/** Bounded initial-card stagger: 30 ms steps, 150 ms maximum. */
export function staggerDelayMs(index: number): number {
  return Math.min(Math.max(index, 0) * MOTION.staggerMs, MOTION.staggerMaxMs);
}

/** Programmatic scrolling is instant for residents who prefer reduced motion. */
export function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
