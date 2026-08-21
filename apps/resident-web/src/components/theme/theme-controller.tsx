'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ResolvedTheme = 'light' | 'dark';

// Prefixed distinctly from admin-web's 'barangayan-web-theme' — separate origins already
// isolate localStorage, but a distinct key keeps the two apps' theme state legible if
// ever inspected side by side (see the plan's Phase 0 note: "copied near-verbatim, only
// STORAGE_KEY prefixes change").
const STORAGE_KEY = 'barangayan-resident-web-theme';

/** True once this browser has ever had an explicit theme choice recorded. Mirrors
 * admin-web's hasStoredTheme() — gates any future DB-reconciliation logic (Phase 7's
 * Theme page) to a genuinely first-ever visit instead of clobbering a live local pick. */
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
   * without a flash of the wrong theme. Phase 7's theme-form.tsx additionally persists
   * to profiles.theme_preference for cross-device sync. */
  setTheme: (theme: ResolvedTheme) => void;
  /** Forgets the saved choice and reverts to the OS/browser preference, as if this
   * browser had never picked a theme — called on logout (see use-reset-preferences.ts)
   * so a signed-out browser never keeps showing the *previous* resident's theme.
   * localStorage is origin-wide, not per-account, so without this a guest session right
   * after logout would otherwise inherit whatever the last resident chose. */
  resetTheme: () => void;
}

const ThemeControllerContext = createContext<ThemeControllerValue | null>(null);

function applyThemeClass(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Render-blocking script source — must run before first paint to avoid a flash of the
 * wrong theme. Reads localStorage first (an explicit prior choice), falls back to the
 * OS/browser's prefers-color-scheme only on a genuinely first-ever visit. Exported as a
 * string (not a component) because next/script's beforeInteractive strategy must be
 * placed directly in app/layout.tsx — see layout.tsx. */
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
  // Always starts 'light', matching what the server rendered (no `document` there) —
  // reading THEME_INIT_SCRIPT's already-applied class directly in the lazy
  // initializer would make the client's first hydration pass disagree with the
  // server-rendered HTML whenever the resolved theme is actually 'dark', which React
  // reports as a hydration mismatch. THEME_INIT_SCRIPT has already applied the .dark
  // class to <html> before first paint regardless (that's what prevents the visible
  // flash) — this effect only corrects the *React state* driving toggle UI, one tick
  // after mount, which is not visible.
  const [theme, setThemeState] = useState<ResolvedTheme>('light');

  useEffect(() => {
    // Deferred a microtask so this doesn't setState synchronously inside the effect's
    // commit phase (react-hooks/set-state-in-effect) — it's still applied before the
    // browser's next paint, so there's nothing user-visible about the delay.
    queueMicrotask(() => {
      if (document.documentElement.classList.contains('dark')) {
        setThemeState('dark');
      }
    });
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

  const resetTheme = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing / storage disabled — nothing to remove.
    }
    const osTheme: ResolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setThemeState(osTheme);
    applyThemeClass(osTheme);
  }, []);

  return <ThemeControllerContext.Provider value={{ theme, setTheme, resetTheme }}>{children}</ThemeControllerContext.Provider>;
}

export function useThemeController(): ThemeControllerValue {
  const ctx = useContext(ThemeControllerContext);
  if (!ctx) {
    throw new Error('useThemeController must be used within a ThemeControllerProvider');
  }
  return ctx;
}
