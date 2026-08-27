'use client';

import { LucideProvider } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Every icon in this app comes from lucide-react, which ships a single
 * "regular" weight (strokeWidth 2) by default. The admin UI wants a
 * bolder, thicker outline everywhere, so this sets that heavier weight
 * once via lucide-react's built-in context instead of passing
 * `strokeWidth` to every individual icon usage. Screens that already pass
 * their own `strokeWidth` (e.g. tiny 12px glyphs that need extra weight to
 * stay legible) keep overriding this default — the context value only
 * fills in where a call site doesn't specify one.
 */
const BOLD_ICON_STROKE_WIDTH = 2.5;

export function IconControllerProvider({ children }: { children: ReactNode }) {
  return <LucideProvider strokeWidth={BOLD_ICON_STROKE_WIDTH}>{children}</LucideProvider>;
}
