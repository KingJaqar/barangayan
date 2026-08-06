import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  /** True until the initial getSession() check resolves — keep the splash screen up
   * during this window so signed-in/signed-out never flashes the wrong screen first. */
  isLoading: boolean;
  /**
   * Supabase's recovery OTP verification establishes a REAL session (so updateUser can
   * be called), which would otherwise satisfy Stack.Protected's guard={!!session} and
   * bounce the user straight into the main app before they've set a new password. Set
   * this true right when entering the recovery flow (forgot-password.tsx) and false once
   * reset-password.tsx's updateUser succeeds — the root navigator's guard checks both.
   */
  isPasswordRecovery: boolean;
  setPasswordRecovery: (value: boolean) => void;
  /**
   * Same idea as isPasswordRecovery: signup verification also establishes a real session
   * immediately, but the design's flow wants an interstitial Completion screen ("You're
   * all set") before landing in the main app. Set true right before verifying the signup
   * OTP, cleared when the user taps "Go to Home" on completion.tsx.
   */
  isOnboarding: boolean;
  setOnboarding: (value: boolean) => void;
  /**
   * "I'll Sign In Later" on the Auth Choice screen — lets Stack.Protected's guard admit
   * (app) with no real session, for real read-only browsing (Announcements, the Documents
   * catalog; see the 0005 migration's anon RLS policies). Cleared implicitly once a real
   * session exists (nothing should ever check isGuest in isolation, only alongside
   * !!session) — logging in from Settings just makes the same tabs show real personal
   * data, no redirect dance.
   */
  isGuest: boolean;
  setGuest: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  isPasswordRecovery: false,
  setPasswordRecovery: () => {},
  isOnboarding: false,
  setOnboarding: () => {},
  isGuest: false,
  setGuest: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Belt-and-suspenders alongside the manual set in forgot-password.tsx.
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      // A future Log Out action should return to the real auth flow, not silently fall
      // back into guest browsing from a stale isGuest=true.
      if (event === 'SIGNED_OUT') {
        setIsGuest(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isPasswordRecovery,
        setPasswordRecovery: setIsPasswordRecovery,
        isOnboarding,
        setOnboarding: setIsOnboarding,
        isGuest,
        setGuest: setIsGuest,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
