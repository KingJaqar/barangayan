'use client';

import { useEffect, useRef, type ComponentProps } from 'react';

import { cn } from '@/lib/utils';
import styles from './landing.module.css';

/**
 * Fades a below-the-fold block in once as it scrolls into view. Content is visible by
 * default (no JS, reduced motion, or already on screen) — the hidden state is only
 * applied after mount to blocks that start off-screen, so nothing ever flashes or stays
 * invisible. The observer disconnects after the first reveal, so scrolling back up does
 * no repeat work.
 */
export function ScrollReveal({ className, ...props }: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.reveal = 'hidden';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = 'shown';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={cn(styles.reveal, className)} {...props} />;
}
