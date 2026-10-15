import AsyncStorage from '@react-native-async-storage/async-storage';
import { residentSetupFailure } from '@barangayan/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useLatest } from '../lib/use-latest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import type { LogoutReason } from '../lib/runtime';
import { SETUP_INTENT_KEY } from './hints';
import { pendingDestination, returnPath, type PendingDestination } from './pending-destination';
import { createProviderAuth, pendingProviderAttempt, watchAppleCredential, type ProviderAuth } from './providers';
import { RecoveryFlow } from './recovery-flow';
import { Ownership, RequestGate } from './request-gate';
import { setupAllowsApp, setupDestination, setupRoute, SETUP_INTENTS, type SetupDestination, type SetupIntent, type SetupRoute } from './setup-route';
import { fetchSetupStatus, isBackgroundRefresh, refreshFailureOutcome, type OwnedSetup, type SetupLoad } from './setup-status';

type AuthFlow = {
  providers: ProviderAuth;
  /** Survives the screen remount that follows a verified recovery code, and ends with the client. */
  recoveryFlow: RecoveryFlow;
  intent: SetupIntent;
  setIntent: (intent: SetupIntent, expectedUserId?: string) => Promise<void>;
  /** Server-confirmed setup status for the signed-in resident, scoped to that account. */
  setup: SetupLoad;
  route: SetupRoute;
  /** False while required setup is outstanding or the status is unknown. */
  appAllowed: boolean;
  destination: SetupDestination;
  /** A failed refresh over an earlier confirmed status; that status is kept. */
  refreshError: string | null;
  refreshSetup: () => Promise<void>;
  guest: boolean;
  setGuest: (value: boolean) => void;
  pending: PendingDestination | null;
  /** Remembers an allowlisted private destination; anything else is ignored. */
  rememberDestination: (path: string) => void;
  /** The authorized return path (pending destination or Home); clears the pending value. */
  takeReturnPath: () => string;
};

const Context = createContext<AuthFlow | null>(null);
export function useAuthFlow() {
  const value = useContext(Context);
  if (!value) throw new Error('Authentication flow is not initialized.');
  return value;
}

/**
 * Owns resident setup coordination above the per-session screen scope: sign-in intent, guest
 * browsing, the server-confirmed setup status and the allowlisted pending destination. Status
 * is always the database's; nothing is inferred from local form state.
 */
export function AuthFlowProvider({ client, session, recovery, logout, children }: {
  client: SupabaseClient<Database>;
  session: Session | null;
  recovery: boolean;
  logout: (reason?: LogoutReason) => Promise<void>;
  children: ReactNode;
}) {
  // `logout` is a new function every render of its owner; a ref keeps effects from re-running.
  const logoutRef = useLatest(logout);
  const providers = useMemo(() => createProviderAuth(client), [client]);
  const recoveryFlow = useMemo(() => new RecoveryFlow(client.auth), [client]);
  // An intent recorded for another signed-in account never applies to this one.
  const [intentState, setIntentState] = useState<{ uid: string | null; value: SetupIntent }>({ uid: null, value: 'sign_in' });
  const [guest, setGuestState] = useState(false);
  const [owned, setOwnedState] = useState<OwnedSetup>(null);
  const ownedRef = useRef<OwnedSetup>(null);
  const [refreshFailure, setRefreshFailure] = useState<{ uid: string; message: string } | null>(null);
  const [pending, setPending] = useState<PendingDestination | null>(null);
  const pendingRef = useRef<PendingDestination | null>(null);
  const ownership = useRef(new Ownership());
  const gate = useRef(new RequestGate());
  const rerun = useRef(false);
  const sessionRef = useLatest(session);
  const userId = session?.user.id;

  const setOwned = useCallback((value: OwnedSetup) => { ownedRef.current = value; setOwnedState(value); }, []);

  const setIntent = useCallback(async (value: SetupIntent, expectedUserId?: string) => {
    let uid = sessionRef.current?.user.id ?? null;
    if (expectedUserId) {
      // The Auth client's own session is authoritative; React state can lag a just-exchanged session.
      const { data } = await client.auth.getSession();
      if (data.session?.user.id !== expectedUserId) throw new Error('The account changed. Please start this action again.');
      uid = expectedUserId;
    }
    setIntentState({ uid, value });
    if (uid) await AsyncStorage.setItem(SETUP_INTENT_KEY, JSON.stringify({ uid, intent: value })).catch(() => undefined);
  }, [client, sessionRef]);

  const refreshSetup = useCallback(async function refreshCurrent() {
    const current = sessionRef.current;
    if (!current) return;
    const uid = current.user.id;
    const owns = ownership.current.ticket();
    const stillOwned = () => owns() && sessionRef.current?.user.id === uid;
    // A refresh requested mid-flight (for example right after a save) runs again afterwards, so
    // a read that began before the write cannot leave a stale warning.
    if (gate.current.busy) { rerun.current = true; return; }
    const background = isBackgroundRefresh(ownedRef.current, uid);
    if (!background) setOwned({ uid, value: { state: 'loading' } });
    try {
      const status = await gate.current.run(async () => {
        const attempt = await pendingProviderAttempt();
        // Auth emits an exchanged session before the callback owner check; never admit an
        // account that is not the one this attempt was started for.
        if (attempt?.phase === 'exchanging' && attempt.expectedUserId && attempt.expectedUserId !== uid) throw { code: '42501' };
        return fetchSetupStatus(client);
      });
      if (!stillOwned()) return;
      setRefreshFailure(null);
      setOwned({ uid, value: { state: 'ready', status } });
    } catch (cause) {
      if (!stillOwned()) return;
      const failure = (cause && typeof cause === 'object' && 'failure' in cause ? (cause as { failure: ReturnType<typeof residentSetupFailure> }).failure : residentSetupFailure(cause as { code?: string; name?: string }));
      // An account the server forbids, or a session that has ended, never keeps earlier access.
      if (failure.kind === 'forbidden') { void logoutRef.current('access-denied'); return; }
      if (failure.kind === 'session_expired') { void logoutRef.current('session-ended'); return; }
      const outcome = refreshFailureOutcome(background, failure);
      if (outcome.type === 'keep_status') setRefreshFailure({ uid, message: outcome.message });
      else setOwned({ uid, value: { state: 'error', failure } });
    } finally {
      if (rerun.current && !gate.current.busy) {
        rerun.current = false;
        if (owns() && sessionRef.current) setTimeout(() => { void refreshCurrent(); }, 0);
      }
    }
  }, [client, setOwned, sessionRef, logoutRef]);

  useEffect(() => {
    const scope = ownership.current;
    // Anything still running for the previous account stops owning state; the status, failure and
    // intent are account-scoped values, so a previous account's are never shown for this one.
    scope.invalidate();
    rerun.current = false;
    if (!userId) return;
    void AsyncStorage.getItem(SETUP_INTENT_KEY).then(async (raw) => {
      if (sessionRef.current?.user.id !== userId) return;
      try {
        const stored: unknown = raw ? JSON.parse(raw) : null;
        const value = stored && typeof stored === 'object' ? stored as { uid?: unknown; intent?: unknown } : null;
        if (value?.uid === userId && typeof value.intent === 'string' && SETUP_INTENTS.includes(value.intent as SetupIntent)) {
          // A restored hint never replaces an intent this account's sign-in already recorded.
          setIntentState((previous) => previous.uid === userId ? previous : { uid: userId, value: value.intent as SetupIntent });
          return;
        }
      } catch { /* A corrupt non-secret hint is ignored; it never carries session state. */ }
      // A provider sign-up that crossed a restart is recovered from its own attempt record.
      const attempt = await pendingProviderAttempt();
      if (attempt?.userId === userId && attempt.intent === 'sign_up' && sessionRef.current?.user.id === userId) {
        setIntentState((previous) => previous.uid === userId ? previous : { uid: userId, value: 'provider_signup' });
      }
    }).catch(() => undefined);
    void refreshSetup();
    return () => { scope.invalidate(); };
  }, [userId, refreshSetup, sessionRef]);

  // Re-read the server's status when the app returns to the foreground.
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshSetup(); });
    return () => subscription.remove();
  }, [userId, refreshSetup]);

  // Apple credential revocation ends the local session instead of leaving a stale identity.
  useEffect(() => {
    const current = sessionRef.current;
    if (!userId || !current) return;
    // The watcher depends on the account, not on every refreshed token.
    return watchAppleCredential(current, () => { void logoutRef.current('access-denied'); });
  }, [userId, sessionRef, logoutRef]);

  const rememberDestination = useCallback((path: string) => {
    const next = pendingDestination(path);
    if (!next || pendingRef.current?.path === next.path) return;
    pendingRef.current = next;
    setPending(next);
  }, []);
  const takeReturnPath = useCallback(() => {
    const path = returnPath(pendingRef.current);
    pendingRef.current = null;
    setPending(null);
    return path;
  }, []);

  const intent: SetupIntent = intentState.uid === null || intentState.uid === userId ? intentState.value : 'sign_in';
  const setup: SetupLoad = session && owned?.uid === session.user.id ? owned.value : { state: 'loading' };
  const route = setupRoute({ session: session ? 'authenticated' : 'signed_out', intent, recovery, guest: !session && guest, setup });
  const value: AuthFlow = {
    providers, recoveryFlow, intent, setIntent, setup, route,
    appAllowed: setupAllowsApp(route, setup),
    destination: setupDestination(route, setup),
    refreshError: session && refreshFailure?.uid === session.user.id ? refreshFailure.message : null,
    refreshSetup,
    guest,
    setGuest: (next) => setGuestState(next),
    pending,
    rememberDestination,
    takeReturnPath,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
