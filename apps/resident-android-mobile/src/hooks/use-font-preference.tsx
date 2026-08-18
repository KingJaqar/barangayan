import { isValidFontId } from '@barangayan/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { DEFAULT_FONT_ID } from '@/constants/fonts';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

interface FontPreferenceContextValue {
  fontId: string;
  setFontId: (id: string) => void;
}

const FontPreferenceContext = createContext<FontPreferenceContextValue>({
  fontId: DEFAULT_FONT_ID,
  setFontId: () => {},
});

/**
 * Real, persisted font-style preference — same shape as ThemePreferenceProvider
 * (use-theme-preference.tsx), writing/reading `profiles.font_preference` (0075 migration,
 * shared with the web admin's Theme page). Guests get local-only state for the session.
 */
export function FontPreferenceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { profile } = useProfile();

  const [fontId, setFontIdState] = useState<string>(DEFAULT_FONT_ID);

  // Same "only overwrite on the initial load per session" reasoning as
  // ThemePreferenceProvider — avoids a background refetch clobbering a change made seconds
  // ago.
  useEffect(() => {
    if (profile) {
      const stored = profile.font_preference;
      setFontIdState(stored && isValidFontId(stored) ? stored : DEFAULT_FONT_ID);
    } else if (!session) {
      setFontIdState(DEFAULT_FONT_ID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function setFontId(id: string) {
    if (!isValidFontId(id)) return;
    setFontIdState(id);
    if (session) {
      supabase
        .from('profiles')
        .update({ font_preference: id })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to persist font_preference:', error.message);
        });
    }
  }

  return <FontPreferenceContext.Provider value={{ fontId, setFontId }}>{children}</FontPreferenceContext.Provider>;
}

export function useFontPreference() {
  return useContext(FontPreferenceContext);
}
