'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'barangayan-web-theme';

/** True once this browser has ever had an explicit theme choice recorded — either by the
 * toggle switch or a prior DB-restore. Used to gate the Theme page's DB reconciliation so
 * it only ever adopts profiles.theme_preference on a genuinely first-ever visit (a new
 * browser/device), never on a routine navigation to /theme where it would clobber a theme
 * the admin already set locally. See theme-form.tsx. */
export function hasStoredTheme(): boolean {
  if (typeof localStorage === 'undefined') return true; // SSR: don't force a client-only sync
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // storage disabled — treat as "already decided", never override live state
  }
}

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

/** Render-blocking script source — must run before first paint to avoid a flash of the
 * wrong theme. Reads localStorage first (an explicit prior choice), falls back to the
 * OS/browser's prefers-color-scheme only on a genuinely first-ever visit. Exported as a
 * string (not a component) because next/script's beforeInteractive strategy must be
 * placed directly in app/layout.tsx for the framework/lint tooling to recognize it —
 * see layout.tsx. */
export const THEME_INIT_SCRIPT = `
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

export function ThemeControllerProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads whatever ThemeInitScript already applied pre-hydration, so the
  // Theme page's toggle starts in the right position instead of always showing "Light".
  // (document is undefined during SSR; the client's first render is what matters here.)
  const [theme, setThemeState] = useState<ResolvedTheme>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

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
