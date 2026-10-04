import type { Session } from '@supabase/supabase-js';
import { ensureGoogleResidentProfile, needsResidentProfile } from '@barangayan/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextValue {
  session: Session | null;
  needsCompletion: boolean | null;
  completionError: string | null;
  refreshCompletion: () => Promise<void>;
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
   * "I'll Sign In Later" on the Auth Choice screen — lets Stack.Protected's guard admit
   * (app) with no real session, for real read-only browsing (Announcements, the Documents
   * catalog; see the 0005 migration's anon RLS policies). Cleared implicitly once a real
   * session exists (nothing should ever check isGuest in isolation, only alongside
   * !!session) — logging in from Settings just makes the same tabs show real personal
   * data, no redirect dance.
   */
  isGuest: boolean;
  setGuest: (value: boolean) => void;
  /**
   * signUp() returns a live session immediately (Confirm Email is disabled), which would
   * otherwise satisfy Stack.Protected's guard={!!session} and bounce the new resident
   * straight into (app) before register.tsx gets a chance to sign that session back out
   * and show its "Account Created" modal. Set this true right before calling signUp() and
   * false once the post-signup signOut() settles — same pattern as isPasswordRecovery.
   */
  isRegistering: boolean;
  setRegistering: (value: boolean) => void;
  /**
   * Settings > Logout. Flips into Guest Mode instead of bouncing the user back to the
   * Onboarding welcome screen — signs out, then sets isGuest so Stack.Protected's
   * appReachable (session || isGuest) stays true throughout and (app) never unmounts.
   * The caller (Settings) stays on its current screen; only the session-gated content
   * within it switches to the guest view.
   */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  needsCompletion: null,
  completionError: null,
  refreshCompletion: async () => {},
  isLoading: true,
  isPasswordRecovery: false,
  setPasswordRecovery: () => {},
  isGuest: false,
  setGuest: () => {},
  isRegistering: false,
  setRegistering: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [completion, setCompletion] = useState<{ userId: string; needed: boolean } | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  async function refreshCompletion() {
    if (!session) return;
    await ensureGoogleResidentProfile(supabase, session.user);
    const needed = await needsResidentProfile(supabase, session.user.id);
    setCompletion({ userId: session.user.id, needed }); setCompletionError(null);
  }
  useEffect(() => {
    let active = true;
    if (session) void ensureGoogleResidentProfile(supabase, session.user).then(() => needsResidentProfile(supabase, session.user.id)).then(needed => {
      if (active) { setCompletion({ userId: session.user.id, needed }); setCompletionError(null); }
    }).catch(cause => { if (active) setCompletionError(cause.message); });
    return () => { active = false; };
  }, [session]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
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
    });

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    // Set isGuest before awaiting signOut so appReachable (session || isGuest) never dips
    // to false in the gap while the signOut network round-trip is in flight — otherwise
    // Stack.Protected would briefly consider (app) unreachable and bounce the user to
    // (auth) instead of leaving them on their current Settings screen.
    setIsGuest(true);
    const previousId = session?.user.id;
    setSession(null);
    setCompletion(null); setCompletionError(null);
    await AsyncStorage.multiRemove(['emergency_cache_resident_profile', ...(previousId ? [`resident_profile_v2:${previousId}`] : [])]).catch(() => {});
    try {
      // signOut()'s server round-trip revokes the refresh token, but a caller showing a
      // blocking "Logging out..." indicator must never be stuck behind it forever if the
      // network stalls — race it against a timeout. Either way the user is already local
      // Guest Mode (isGuest, above) by the time this settles; a stalled revoke just means
      // the old refresh token dies later server-side (on its own expiry) instead of
      // immediately, not that anything in this app stays signed in.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('supabase.auth.signOut() failed (already switched to local Guest Mode):', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        needsCompletion: session ? (completion?.userId === session.user.id ? completion.needed : null) : false,
        completionError,
        refreshCompletion,
        isLoading,
        isPasswordRecovery,
        setPasswordRecovery: setIsPasswordRecovery,
        isGuest,
        setGuest: setIsGuest,
        isRegistering,
        setRegistering: setIsRegistering,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
