'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

/** Thin fade+rise-on-mount wrapper, used across onboarding and card lists in place of
 * Reanimated's FadeInDown (see the plan's §10 component tree). */
export function FadeIn({ delay = 0, className, children, ...props }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
      {...props}>
      {children}
    </motion.div>
  );
}
