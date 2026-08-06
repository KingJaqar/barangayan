import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

export type ThemePreference = 'light' | 'dark' | 'system';
export const DEFAULT_ACCENT_COLOR = '#0F6E5B';

interface ThemePreferenceContextValue {
  themePreference: ThemePreference;
  /** Resolved to an actual scheme — 'system' falls through to the OS setting. */
  scheme: 'light' | 'dark';
  accentColor: string;
  setThemePreference: (value: ThemePreference) => void;
  setAccentColor: (value: string) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  themePreference: 'system',
  scheme: 'light',
  accentColor: DEFAULT_ACCENT_COLOR,
  setThemePreference: () => {},
  setAccentColor: () => {},
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

  // Load from the profile once it's available — only overwrites local state on the
  // initial load per session, so a change made seconds ago isn't clobbered by a
  // background refetch of stale data.
  useEffect(() => {
    if (profile) {
      setThemePreferenceState((profile.theme_preference as ThemePreference) ?? 'system');
      setAccentColorState(profile.accent_color ?? DEFAULT_ACCENT_COLOR);
    } else if (!session) {
      // Signed out / logged out — back to defaults rather than keeping a stale account's
      // theme applied to the next guest session.
      setThemePreferenceState('system');
      setAccentColorState(DEFAULT_ACCENT_COLOR);
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

  const resolvedSystemScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const scheme = themePreference === 'system' ? resolvedSystemScheme : themePreference;

  return (
    <ThemePreferenceContext.Provider
      value={{ themePreference, scheme, accentColor, setThemePreference, setAccentColor }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
