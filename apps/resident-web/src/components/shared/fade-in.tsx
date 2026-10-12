import type * as React from 'react';

import { MOTION, staggerDelayMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Short content-arrival reveal: 200 ms fade with up to 6 px rise (CSS `rw-reveal`, so it
 * stays server-compatible and needs no client boundary). Pass `index` for an initial
 * list entrance: a 30 ms stagger capped at 150 ms for the first six items; later items
 * render steady so long lists do no extra motion work. Reduced motion renders content
 * immediately with no movement. Use one reveal per content region — don't nest them.
 */
export function FadeIn({ index, className, style, ...props }: React.ComponentProps<'div'> & { index?: number }) {
  if (index !== undefined && index >= MOTION.staggerLimit) {
    return <div className={className} style={style} {...props} />;
  }
  const delay = index ? staggerDelayMs(index) : 0;
  return (
    <div
      className={cn('rw-reveal', className)}
      style={delay ? ({ ...style, '--rw-reveal-delay': `${delay}ms` } as React.CSSProperties) : style}
      {...props}
    />
  );
}
