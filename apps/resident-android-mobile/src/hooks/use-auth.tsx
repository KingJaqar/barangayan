import type { Session } from '@supabase/supabase-js';
import { residentSetupRoute, residentSetupFailure, type ResidentSetupIntent, type ResidentSetupLoad, type ResidentSetupRoute } from '@barangayan/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { SetupRequestGate, SetupOwner, authSetupRequests, profileSetupRequests } from '@/lib/setup-request';
import { pendingGoogleAuth } from '@/lib/google-auth';
import { isBackgroundRefresh, refreshFailureOutcome, type OwnedSetup } from '@/lib/setup-refresh';
import { loadAccountSetupStatus } from '@/lib/account-setup-status';

const INTENT_KEY = 'resident-setup-intent-v1';
const RECOVERY_KEY = 'resident-recovery-intent-v1';
const intents: ResidentSetupIntent[] = ['sign_in', 'email_signup', 'google_signup', 'resume_profile', 'google_details_saved', 'settings_profile', 'settings_password'];
interface AuthContextValue {
  session: Session | null;
  needsCompletion: boolean | null;
  completionError: string | null;
  /** A failed refresh over an earlier server-confirmed status; that status is kept. */
  setupRefreshError: string | null;
  refreshCompletion: () => Promise<void>;
  isLoading: boolean;
  restorationError: string | null;
  retryRestoration: () => void;
  isPasswordRecovery: boolean;
  setPasswordRecovery: (value: boolean) => void;
  isGuest: boolean;
  setGuest: (value: boolean) => void;
  signedOutEntry: boolean;
  logoutNotice: boolean;
  dismissLogoutNotice: () => void;
  setup: ResidentSetupLoad;
  setupRoute: ResidentSetupRoute;
  setSetupIntent: (intent: ResidentSetupIntent, expectedUserId?: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const ownership = useRef(new SetupOwner());
  const [isLoading, setIsLoading] = useState(true);
  const [restorationError, setRestorationError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [isPasswordRecovery, setRecovery] = useState(false);
  const [isGuest, setGuestState] = useState(false);
  const [signedOutEntry, setSignedOutEntry] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState(false);
  const dismissLogoutNotice = useCallback(() => setLogoutNotice(false), []);
  const setGuest = useCallback((value: boolean) => {
    setGuestState(value);
    if (value) { setSignedOutEntry(false); setLogoutNotice(false); }
  }, []);
  const [intent, setIntent] = useState<ResidentSetupIntent>('sign_in');
  const intentRef = useRef<ResidentSetupIntent>('sign_in');
  const [actor, setActor] = useState<'resident' | 'staff' | 'blocked'>('resident');
  const [ownedSetup, setOwnedSetupState] = useState<OwnedSetup>(null);
  const ownedSetupRef = useRef<OwnedSetup>(null);
  const setOwnedSetup = useCallback((value: OwnedSetup) => { ownedSetupRef.current = value; setOwnedSetupState(value); }, []);
  const [refreshFailure, setRefreshFailure] = useState<{ uid: string; message: string } | null>(null);
  const rerunStatus = useRef(false);
  const statusGate = useRef(new SetupRequestGate());
  const restoreGate = useRef(new SetupRequestGate());
  const setup: ResidentSetupLoad = session && ownedSetup?.uid === session.user.id ? ownedSetup.value : { state: 'loading' };
  const setPasswordRecovery = useCallback((value: boolean) => {
    setRecovery(value);
    const uid = sessionRef.current?.user.id;
    if (!value) void AsyncStorage.removeItem(RECOVERY_KEY).catch(() => {});
    else if (uid) void AsyncStorage.setItem(RECOVERY_KEY, JSON.stringify({ uid, until: Date.now() + 3_600_000 })).catch(() => {});
  }, []);

  const setSetupIntent = useCallback(async (value: ResidentSetupIntent, expectedUserId?: string) => {
    if (expectedUserId && sessionRef.current?.user.id !== expectedUserId) throw new Error('The account changed. Please start this action again.');
    intentRef.current = value; setIntent(value);
    const uid = sessionRef.current?.user.id;
    if (uid) await AsyncStorage.setItem(INTENT_KEY, JSON.stringify({ uid, intent: value }));
  }, []);

  const refreshCompletion = useCallback(async function refreshCurrentCompletion() {
    const current = sessionRef.current;
    if (!current) return;
    const uid = current.user.id, ticket = ownership.current.ticket();
    const owns = () => ticket() && sessionRef.current?.user.id === uid;
    // A refresh requested mid-flight (e.g. right after a save) runs again afterwards,
    // so a read that started before the write cannot leave a stale warning.
    if (statusGate.current.busy) { rerunStatus.current = true; return; }
    // Background refresh: keep this user's server-confirmed status while reloading, so
    // Settings is not unmounted by a transient loading state; never downgrade it on error.
    const background = isBackgroundRefresh(ownedSetupRef.current, uid);
    if (!background) setOwnedSetup({ uid, value: { state: 'loading' } });
    try {
      const value = await statusGate.current.run(async () => {
        const pendingGoogle = await pendingGoogleAuth();
        if (pendingGoogle?.phase === 'exchanging' && pendingGoogle.expectedUserId && pendingGoogle.expectedUserId !== uid) {
          // Auth emits the exchanged session before the callback owner check.
          // Do not provision or admit that unintended account in the meantime.
          throw { code: '42501' };
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          return await loadAccountSetupStatus(supabase, current.user, controller.signal);
        } finally {
          clearTimeout(timer);
          if (sessionRef.current && sessionRef.current.user.id !== uid) setTimeout(() => { void refreshCurrentCompletion(); }, 0);
        }
      });
      if (!owns()) return;
      setActor(value.actor); setRefreshFailure(null);
      setOwnedSetup({ uid, value: { state: 'ready', status: value.status } });
    } catch (cause) {
      if (owns()) {
        const failure = residentSetupFailure(cause as { code?: string; name?: string });
        // Deleted/forbidden accounts never keep earlier access through a background read.
        const outcome = refreshFailureOutcome(background, failure);
        if (outcome.type === 'keep_status') setRefreshFailure({ uid, message: outcome.message });
        else { setActor('resident'); setOwnedSetup({ uid, value: { state: 'error', failure } }); }
      }
    } finally {
      if (rerunStatus.current && !statusGate.current.busy) { rerunStatus.current = false; if (owns()) setTimeout(() => { void refreshCurrentCompletion(); }, 0); }
    }
  }, [setOwnedSetup]);

  useEffect(() => {
    let active = true, eventRevision = 0;
    const scope = ownership.current;
    const install = (next: Session | null) => {
      const previousId = sessionRef.current?.user.id;
      if (previousId !== next?.user.id) {
        scope.invalidate(); setOwnedSetup(null); setActor('resident'); setRefreshFailure(null); rerunStatus.current = false;
        if (previousId) { intentRef.current = 'sign_in'; setIntent('sign_in'); setPasswordRecovery(false); }
      }
      sessionRef.current = next; setSession(next);
      if (next) { setGuestState(false); setSignedOutEntry(false); setLogoutNotice(false); }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      // No network/storage awaits in the SDK's Auth callback (it holds its lock).
      eventRevision++; install(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    const revision = eventRevision;
    void restoreGate.current.run(async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const raw = await AsyncStorage.getItem(INTENT_KEY);
      const recoveryRaw = await AsyncStorage.getItem(RECOVERY_KEY);
      const pendingGoogle = await pendingGoogleAuth();
      if (active && revision === eventRevision) install(data.session);
      let restored: { uid?: string; intent?: ResidentSetupIntent } | null = null;
      try { restored = raw ? JSON.parse(raw) : null; } catch { /* Ignore corrupt non-secret intent, never session state. */ }
      if (active && restored?.uid === sessionRef.current?.user.id && restored?.intent && intents.includes(restored.intent)) {
        intentRef.current = restored.intent; setIntent(restored.intent);
      } else if (active && pendingGoogle?.userId === sessionRef.current?.user.id && pendingGoogle?.intent === 'sign_up') {
        intentRef.current = 'google_signup'; setIntent('google_signup');
      }
      try {
        const recovery = recoveryRaw ? JSON.parse(recoveryRaw) : null;
        if (active && recovery?.uid === sessionRef.current?.user.id && recovery.until > Date.now() && recovery.until <= Date.now() + 3_600_000) setRecovery(true);
      } catch { /* Invalid recovery hint never establishes an Auth session. */ }
    }).then(() => { if (active) { setRestorationError(null); setIsLoading(false); } })
      .catch(() => { if (active) { setRestorationError('Unable to restore your session. Check your connection and retry.'); setIsLoading(false); } });
    return () => { active = false; scope.invalidate(); subscription.unsubscribe(); };
  }, [restoreAttempt, setPasswordRecovery, setOwnedSetup]);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || isLoading || restorationError) return;
    // Token refresh changes the Session object, not ownership. No repeated RPC on it.
    void AsyncStorage.setItem(INTENT_KEY, JSON.stringify({ uid: userId, intent: intentRef.current })).catch(() => {});
    void refreshCompletion();
  }, [userId, isLoading, restorationError, refreshCompletion]);
  useEffect(() => {
    if (userId && isPasswordRecovery) void AsyncStorage.setItem(RECOVERY_KEY, JSON.stringify({ uid: userId, until: Date.now() + 3_600_000 })).catch(() => {});
  }, [userId, isPasswordRecovery]);

  async function logout() {
    if (authSetupRequests.busy || profileSetupRequests.busy) return;
    try {
      await authSetupRequests.run(async () => {
        ownership.current.invalidate(); const previousId = sessionRef.current?.user.id;
        setSignedOutEntry(true); setLogoutNotice(false); setGuestState(false);
        sessionRef.current = null; setSession(null); setOwnedSetup(null); setRefreshFailure(null);
        intentRef.current = 'sign_in'; setIntent('sign_in'); setPasswordRecovery(false);
        await AsyncStorage.multiRemove([INTENT_KEY, RECOVERY_KEY, 'resident-google-pkce-v2', 'emergency_cache_resident_profile', ...(previousId ? [`resident_profile_v2:${previousId}`] : [])]).catch(() => {});
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
      });
      setLogoutNotice(true);
    }
    catch { setRestorationError('Sign-out could not be confirmed. Retry session restoration before signing in again.'); }
  }
  const setupRoute = residentSetupRoute({ session: isLoading || restorationError ? 'restoring' : session ? 'authenticated' : 'signed_out', intent, recovery: isPasswordRecovery, guest: !session && isGuest, actor, setup });
  return <AuthContext.Provider value={{ session, setup, setupRoute, setSetupIntent,
    needsCompletion: !session ? false : setup.state === 'ready' ? !setup.status.profileComplete : actor === 'staff' ? false : null,
    completionError: setup.state === 'error' ? setup.failure.message : null,
    setupRefreshError: session && refreshFailure?.uid === session.user.id ? refreshFailure.message : null,
    refreshCompletion, isLoading, restorationError,
    retryRestoration: () => { setIsLoading(true); setRestoreAttempt(value => value + 1); },
    isPasswordRecovery, setPasswordRecovery, isGuest, setGuest, signedOutEntry, logoutNotice, dismissLogoutNotice, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
