import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import { registerPushToken, unregisterPushToken } from '@/lib/push-notifications';

interface NotificationPreferencesContextValue {
  pushEnabled: boolean;
  setPushEnabled: (value: boolean) => void;
}

const NotificationPreferencesContext = createContext<NotificationPreferencesContextValue>({
  pushEnabled: false,
  setPushEnabled: () => {},
});

/**
 * Persisted push-notification opt-in, following the exact ThemePreferenceProvider pattern:
 * loads once per session from the profile, mirrors it in local state for instant UI
 * response, and fire-and-forgets writes back to Supabase. Guests (no session) always get
 * `false` and setPushEnabled is a no-op — there's no profile row to persist to.
 */
export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { profile } = useProfile();

  const [pushEnabled, setPushEnabledState] = useState(false);

  useEffect(() => {
    if (profile) {
      setPushEnabledState(profile.push_notifications_enabled ?? true);
    } else if (!session) {
      setPushEnabledState(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function setPushEnabled(value: boolean) {
    if (!session) return;

    setPushEnabledState(value);

    // Same lazy-thenable gotcha as ThemePreferenceProvider — must .then()/await to
    // actually send the request.
    supabase
      .from('profiles')
      .update({ push_notifications_enabled: value })
      .eq('id', session.user.id)
      .then(({ error }) => {
        if (error) console.warn('Failed to persist push_notifications_enabled:', error.message);
      });

    if (value) {
      registerPushToken().catch((error) =>
        console.warn('Failed to register push token:', error),
      );
    } else {
      unregisterPushToken().catch((error) =>
        console.warn('Failed to unregister push token:', error),
      );
    }
  }

  return (
    <NotificationPreferencesContext.Provider value={{ pushEnabled, setPushEnabled }}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences() {
  return useContext(NotificationPreferencesContext);
}
