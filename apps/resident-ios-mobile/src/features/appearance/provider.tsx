import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { useResident, type Profile } from '../../lib/runtime';
import { AccentContext, FontFamilyContext } from '../../lib/theme';
import { fontFamilyFor, planAddColor, planRemoveColor, preferencesFromProfile, PreferenceStore, type ColorProblem, type Preferences, type SaveState, type ThemePreference } from './preferences';
import { persistPreferences } from './save';

type AppearanceApi = {
  preferences: Preferences;
  save: SaveState;
  /** False for a guest or a resident without a profile row yet: choices last for this session only. */
  persistent: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (color: string) => void;
  setFont: (id: string) => void;
  /** Saves and applies a custom color; returns why it was refused, or null when it was saved. */
  addCustomColor: (color: string) => ColorProblem | null;
  removeCustomColor: (color: string) => void;
  dismissError: () => void;
};
const Context = createContext<AppearanceApi | null>(null);
export function useAppearance(): AppearanceApi {
  const value = useContext(Context);
  if (!value) throw new Error('Appearance preferences are not initialized.');
  return value;
}

/**
 * Appearance preferences for the current account. State is rebuilt for each account (and for a
 * guest), so one account's accent, font or theme never carries into another session.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { profile } = useResident();
  return <AccountAppearance key={profile?.id ?? 'session-only'} profile={profile}>{children}</AccountAppearance>;
}

function AccountAppearance({ profile, children }: { profile: Profile | null; children: ReactNode }) {
  const { client } = useResident();
  const [store] = useState(() => new PreferenceStore(preferencesFromProfile(profile), profile ? persistPreferences(client, profile.id) : null));
  const { preferences, save, persistent } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { theme } = preferences;

  // Light/Dark go through the native window so system chrome, alerts and pickers follow the choice.
  useEffect(() => {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
    return () => Appearance.setColorScheme('unspecified');
  }, [theme]);

  const api = useMemo<AppearanceApi>(() => ({
    preferences, save, persistent,
    setTheme: (next) => store.apply({ theme: next }),
    setAccent: (color) => store.apply({ accent: color }),
    setFont: (id) => store.apply({ font: id }),
    addCustomColor: (color) => {
      const plan = planAddColor(store.getSnapshot().preferences, color);
      if (!plan.ok) return plan.problem;
      store.apply(plan.change);
      return null;
    },
    removeCustomColor: (color) => store.apply(planRemoveColor(store.getSnapshot().preferences, color)),
    dismissError: () => store.dismissError(),
  }), [store, preferences, save, persistent]);

  return <Context.Provider value={api}>
    <AccentContext.Provider value={preferences.accent}>
      <FontFamilyContext.Provider value={fontFamilyFor(preferences.font)}>{children}</FontFamilyContext.Provider>
    </AccentContext.Provider>
  </Context.Provider>;
}
