'use client';

import Script from 'next/script';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'barangayan-web-theme';

interface ThemeControllerValue {
  theme: ResolvedTheme;
  /** Flips the .dark class on <html> immediately (no DB round-trip needed for the
   * visual effect) and remembers the choice in localStorage so it survives a reload
   * without a flash of the wrong theme. Callers (theme-form.tsx) additionally persist
   * to profiles.theme_preference for cross-device sync — that's a separate concern from
   * "does the UI actually look different right now," which is what was broken. */
  setTheme: (theme: ResolvedTheme) => void;
}

const ThemeControllerContext = createContext<ThemeControllerValue | null>(null);

function applyThemeClass(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem('${STORAGE_KEY}');
      var theme = stored === 'light' || stored === 'dark'
        ? stored
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

/** Render-blocking script — must run before first paint to avoid a flash of the wrong
 * theme. Reads localStorage first (an explicit prior choice), falls back to the
 * OS/browser's prefers-color-scheme only on a genuinely first-ever visit. Uses
 * next/script's beforeInteractive strategy (not a raw <script> tag) — the App Router
 * warns/mishandles literal <script> elements rendered from a component tree otherwise. */
export function ThemeInitScript() {
  return <Script id="theme-init" strategy="beforeInteractive">{INIT_SCRIPT}</Script>;
}

export function ThemeControllerProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ResolvedTheme>('light');

  // Sync React state to whatever ThemeInitScript already applied pre-hydration, so the
  // Theme page's toggle starts in the right position instead of always showing "Light".
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((next: ResolvedTheme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — the class still applies for this session.
    }
  }, []);

  return <ThemeControllerContext.Provider value={{ theme, setTheme }}>{children}</ThemeControllerContext.Provider>;
}

export function useThemeController(): ThemeControllerValue {
  const ctx = useContext(ThemeControllerContext);
  if (!ctx) {
    throw new Error('useThemeController must be used within a ThemeControllerProvider');
  }
  return ctx;
}
