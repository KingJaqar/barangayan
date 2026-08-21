'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { DEFAULT_FONT_ID, FONT_OPTIONS, getFontStack, isValidFontId } from '@barangayan/shared';

const STORAGE_KEY = 'barangayan-resident-web-font';

interface FontControllerValue {
  fontId: string;
  /** Sets `--font-app` on <html> immediately, same pattern as accent-controller.tsx.
   * Phase 7's theme-form.tsx additionally persists to profiles.font_preference for
   * cross-device sync. */
  setFontId: (id: string) => void;
  /** Forgets the saved font and reverts to DEFAULT_FONT_ID — called on logout (see
   * use-reset-preferences.ts), mirrors theme-controller.tsx's resetTheme(). */
  resetFont: () => void;
}

const FontControllerContext = createContext<FontControllerValue | null>(null);

function applyFontVar(id: string) {
  document.documentElement.style.setProperty('--font-app', getFontStack(id));
}

/** Mirrors theme-controller.tsx's hasStoredTheme(). */
export function hasStoredFont(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/** id -> CSS font-family stack, serialized into FONT_INIT_SCRIPT below so the
 * render-blocking script needs no module import (it must run standalone, before any app
 * JS — including @barangayan/shared — is evaluated). */
const FONT_STACKS_BY_ID: Record<string, string> = Object.fromEntries(FONT_OPTIONS.map((f) => [f.id, f.stack]));

/** Render-blocking script source — must run before first paint so body text never
 * flashes the default font before switching to the resident's saved one. */
export const FONT_INIT_SCRIPT = `
  (function () {
    try {
      var stacks = ${JSON.stringify(FONT_STACKS_BY_ID)};
      var stored = localStorage.getItem('${STORAGE_KEY}');
      if (stored && stacks[stored]) {
        document.documentElement.style.setProperty('--font-app', stacks[stored]);
      }
    } catch (e) {}
  })();
`;

export function FontControllerProvider({ children }: { children: ReactNode }) {
  // Starts at DEFAULT_FONT_ID (matching the server, which has no localStorage) and
  // corrects via effect after mount — see theme-controller.tsx's identical fix for why
  // reading localStorage directly in the lazy initializer would cause a hydration
  // mismatch. FONT_INIT_SCRIPT has already applied the real --font-app value before
  // first paint regardless, so there's no visible flash — only the React state
  // driving font-picker selection UI (Phase 7) lags by one tick.
  const [fontId, setFontIdState] = useState<string>(DEFAULT_FONT_ID);

  useEffect(() => {
    // Deferred a microtask — see theme-controller.tsx's identical fix for why (avoids
    // react-hooks/set-state-in-effect without changing anything user-visible).
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && isValidFontId(stored)) setFontIdState(stored);
      } catch {
        // Private browsing / storage disabled — DEFAULT_FONT_ID stands.
      }
    });
  }, []);

  const setFontId = useCallback((id: string) => {
    if (!isValidFontId(id)) return;
    setFontIdState(id);
    applyFontVar(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Private browsing / storage disabled — the CSS var still applies for this session.
    }
  }, []);

  const resetFont = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing / storage disabled — nothing to remove.
    }
    setFontIdState(DEFAULT_FONT_ID);
    applyFontVar(DEFAULT_FONT_ID);
  }, []);

  return <FontControllerContext.Provider value={{ fontId, setFontId, resetFont }}>{children}</FontControllerContext.Provider>;
}

export function useFontController(): FontControllerValue {
  const ctx = useContext(FontControllerContext);
  if (!ctx) {
    throw new Error('useFontController must be used within a FontControllerProvider');
  }
  return ctx;
}
