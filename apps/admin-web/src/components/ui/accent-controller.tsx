'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { ACCENT_COLORS } from '@barangayan/shared';

const STORAGE_KEY = 'barangayan-web-accent';
const CUSTOM_STORAGE_KEY = 'barangayan-web-accent-custom';
export const DEFAULT_ACCENT = ACCENT_COLORS[0];

/** How many custom (non-swatch) colors an admin can save at once. Matches the
 * `custom_accent_colors` column's array-length check in the 0075 migration — keep both in
 * sync if this ever changes. */
export const MAX_CUSTOM_COLORS = 10;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

function normalizeCustomList(colors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const color of colors) {
    const lower = color.toLowerCase();
    if (!isValidHexColor(color) || seen.has(lower)) continue;
    seen.add(lower);
    out.push(color);
    if (out.length >= MAX_CUSTOM_COLORS) break;
  }
  return out;
}

interface AccentControllerValue {
  accent: string;
  /** Flips `--accent` on <html> immediately — the same "don't wait on a DB
   * round-trip to see the effect" fix theme-controller.tsx applies to dark
   * mode. Callers (theme-form.tsx) additionally persist to
   * profiles.accent_color for cross-device sync. */
  setAccent: (color: string) => void;
  /** Up to MAX_CUSTOM_COLORS admin-saved swatches, most recently saved first. */
  customColors: string[];
  /** Replaces the whole saved list (used to reconcile with a DB value). */
  setCustomColors: (colors: string[]) => void;
  /** Adds `color` to the front of the saved list. No-ops (returns false) if the color is
   * invalid, already saved, or the list is already at MAX_CUSTOM_COLORS. */
  addCustomColor: (color: string) => boolean;
  removeCustomColor: (color: string) => void;
}

const AccentControllerContext = createContext<AccentControllerValue | null>(null);

function applyAccentVar(color: string) {
  document.documentElement.style.setProperty('--accent', color);
}

/** True once this browser has ever cached an accent choice — mirrors
 * theme-controller.tsx's hasStoredTheme(), gating theme-form.tsx's DB reconciliation to a
 * genuinely first-ever visit instead of clobbering a live pick on every /theme visit. */
export function hasStoredAccent(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/** Render-blocking script source — must run before first paint so the whole app (sidebar,
 * buttons, focus rings) never flashes the default green before switching to the admin's
 * saved accent. Mirrors THEME_INIT_SCRIPT's localStorage-first, validate-before-trust
 * approach. Exported as a string for the same next/script beforeInteractive reason. */
export const ACCENT_INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem('${STORAGE_KEY}');
      if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
        document.documentElement.style.setProperty('--accent', stored);
      }
    } catch (e) {}
  })();
`;

function readStoredCustomColors(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeCustomList(parsed) : [];
  } catch {
    return [];
  }
}

export function AccentControllerProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<string>(() =>
    typeof document !== 'undefined'
      ? document.documentElement.style.getPropertyValue('--accent').trim() || DEFAULT_ACCENT
      : DEFAULT_ACCENT,
  );
  const [customColors, setCustomColorsState] = useState<string[]>(readStoredCustomColors);

  const setAccent = useCallback((next: string) => {
    if (!isValidHexColor(next)) return;
    setAccentState(next);
    applyAccentVar(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — the CSS var still applies for this session.
    }
  }, []);

  const persistCustomColors = useCallback((next: string[]) => {
    setCustomColorsState(next);
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing / storage disabled — the in-memory list still works this session.
    }
  }, []);

  const setCustomColors = useCallback(
    (colors: string[]) => persistCustomColors(normalizeCustomList(colors)),
    [persistCustomColors],
  );

  const addCustomColor = useCallback(
    (color: string): boolean => {
      if (!isValidHexColor(color)) return false;
      let added = false;
      setCustomColorsState((prev) => {
        if (prev.some((c) => c.toLowerCase() === color.toLowerCase()) || prev.length >= MAX_CUSTOM_COLORS) {
          return prev;
        }
        added = true;
        const next = [color, ...prev];
        try {
          localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Private browsing / storage disabled — the in-memory list still works this session.
        }
        return next;
      });
      return added;
    },
    [],
  );

  const removeCustomColor = useCallback((color: string) => {
    setCustomColorsState((prev) => {
      const next = prev.filter((c) => c.toLowerCase() !== color.toLowerCase());
      try {
        localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private browsing / storage disabled — the in-memory list still works this session.
      }
      return next;
    });
  }, []);

  return (
    <AccentControllerContext.Provider
      value={{ accent, setAccent, customColors, setCustomColors, addCustomColor, removeCustomColor }}>
      {children}
    </AccentControllerContext.Provider>
  );
}

export function useAccentController(): AccentControllerValue {
  const ctx = useContext(AccentControllerContext);
  if (!ctx) {
    throw new Error('useAccentController must be used within an AccentControllerProvider');
  }
  return ctx;
}
