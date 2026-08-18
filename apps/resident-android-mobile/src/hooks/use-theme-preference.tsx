import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

export type ThemePreference = 'light' | 'dark' | 'system';
export const DEFAULT_ACCENT_COLOR = '#0F6E5B';

/** How many custom (non-swatch) colors a resident can save at once. Matches the
 * `custom_accent_colors` column's array-length check in the 0075 migration and the web
 * admin's accent-controller.tsx MAX_CUSTOM_COLORS — keep all three in sync if this changes. */
export const MAX_CUSTOM_COLORS = 10;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

/** Normalizes a possibly-partial hex string (e.g. missing `#`, mixed case) to a canonical
 * `#RRGGBB` form, or null if it can never resolve to a valid hex color. */
export function normalizeHexColor(value: string): string | null {
  const withHash = value.startsWith('#') ? value : `#${value}`;
  return isValidHexColor(withHash) ? withHash : null;
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

interface ThemePreferenceContextValue {
  themePreference: ThemePreference;
  /** Resolved to an actual scheme — 'system' falls through to the OS setting. */
  scheme: 'light' | 'dark';
  accentColor: string;
  setThemePreference: (value: ThemePreference) => void;
  setAccentColor: (value: string) => void;
  /** Up to MAX_CUSTOM_COLORS resident-saved swatches, most recently saved first. */
  customColors: string[];
  /** Adds `color` to the front of the saved list and persists it. No-ops (returns false)
   * if the color is invalid, already saved, or the list is already at MAX_CUSTOM_COLORS. */
  addCustomColor: (color: string) => boolean;
  removeCustomColor: (color: string) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  themePreference: 'system',
  scheme: 'light',
  accentColor: DEFAULT_ACCENT_COLOR,
  setThemePreference: () => {},
  setAccentColor: () => {},
  customColors: [],
  addCustomColor: () => false,
  removeCustomColor: () => {},
});

/**
 * Real, persisted App Theme (Light/Dark + accent color) for logged-in users — settings
 * live on their profiles row and apply app-wide (every useTheme() call), not just within
 * the Settings screen. Guests get local-only state for the session (no profile to persist
 * to; resets on app restart) — matches the Settings-rebuild plan's scope boundary.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const systemScheme = useSystemColorScheme();

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT_COLOR);
  const [customColors, setCustomColorsState] = useState<string[]>([]);

  // Load from the profile once it's available — only overwrites local state on the
  // initial load per session, so a change made seconds ago isn't clobbered by a
  // background refetch of stale data.
  useEffect(() => {
    if (profile) {
      setThemePreferenceState((profile.theme_preference as ThemePreference) ?? 'system');
      setAccentColorState(profile.accent_color ?? DEFAULT_ACCENT_COLOR);
      setCustomColorsState(normalizeCustomList(profile.custom_accent_colors ?? []));
    } else if (!session) {
      // Signed out / logged out — back to defaults rather than keeping a stale account's
      // theme applied to the next guest session.
      setThemePreferenceState('system');
      setAccentColorState(DEFAULT_ACCENT_COLOR);
      setCustomColorsState([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function setThemePreference(value: ThemePreference) {
    setThemePreferenceState(value);
    if (session) {
      // Supabase's query builder is a lazy thenable — the fetch is only actually
      // constructed and sent once .then()/await runs (see PostgrestBuilder.then()).
      // Calling the builder without awaiting/then-ing it is a silent no-op: no request,
      // no error, nothing. Caught this exact bug via a real browser click-through, not
      // by type-checking or a curl-simulated equivalent.
      supabase
        .from('profiles')
        .update({ theme_preference: value })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to persist theme_preference:', error.message);
        });
    }
  }

  function setAccentColor(value: string) {
    setAccentColorState(value);
    if (session) {
      supabase
        .from('profiles')
        .update({ accent_color: value })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to persist accent_color:', error.message);
        });
    }
  }

  function persistCustomColors(next: string[]) {
    setCustomColorsState(next);
    if (session) {
      supabase
        .from('profiles')
        .update({ custom_accent_colors: next })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to persist custom_accent_colors:', error.message);
        });
    }
  }

  function addCustomColor(color: string): boolean {
    if (!isValidHexColor(color)) return false;
    if (customColors.some((c) => c.toLowerCase() === color.toLowerCase()) || customColors.length >= MAX_CUSTOM_COLORS) {
      return false;
    }
    persistCustomColors([color, ...customColors]);
    return true;
  }

  function removeCustomColor(color: string) {
    persistCustomColors(customColors.filter((c) => c.toLowerCase() !== color.toLowerCase()));
  }

  const resolvedSystemScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const scheme = themePreference === 'system' ? resolvedSystemScheme : themePreference;

  return (
    <ThemePreferenceContext.Provider
      value={{
        themePreference,
        scheme,
        accentColor,
        setThemePreference,
        setAccentColor,
        customColors,
        addCustomColor,
        removeCustomColor,
      }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
