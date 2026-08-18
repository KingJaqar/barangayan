'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { DEFAULT_FONT_ID, FONT_OPTIONS, getFontStack, isValidFontId } from '@barangayan/shared';

const STORAGE_KEY = 'barangayan-web-font';

interface FontControllerValue {
  fontId: string;
  /** Sets `--font-app` on <html> immediately, same pattern as accent-controller.tsx.
   * Callers (theme-form.tsx) additionally persist to profiles.font_preference for
   * cross-device sync. */
  setFontId: (id: string) => void;
}

const FontControllerContext = createContext<FontControllerValue | null>(null);

function applyFontVar(id: string) {
  document.documentElement.style.setProperty('--font-app', getFontStack(id));
}

/** Mirrors theme-controller.tsx's hasStoredTheme() — gates theme-form.tsx's DB
 * reconciliation to a genuinely first-ever visit on this browser. */
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
 * JS — including @barangayan/shared — is evaluated). Built here from the real
 * FONT_OPTIONS list so the two can never drift apart. */
const FONT_STACKS_BY_ID: Record<string, string> = Object.fromEntries(FONT_OPTIONS.map((f) => [f.id, f.stack]));

/** Render-blocking script source — must run before first paint so body text never
 * flashes the default font before switching to the admin's saved one. Mirrors
 * ACCENT_INIT_SCRIPT's localStorage-first, validate-before-trust approach. */
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
  const [fontId, setFontIdState] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_FONT_ID;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && isValidFontId(stored) ? stored : DEFAULT_FONT_ID;
    } catch {
      return DEFAULT_FONT_ID;
    }
  });

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

  return <FontControllerContext.Provider value={{ fontId, setFontId }}>{children}</FontControllerContext.Provider>;
}

export function useFontController(): FontControllerValue {
  const ctx = useContext(FontControllerContext);
  if (!ctx) {
    throw new Error('useFontController must be used within a FontControllerProvider');
  }
  return ctx;
}
