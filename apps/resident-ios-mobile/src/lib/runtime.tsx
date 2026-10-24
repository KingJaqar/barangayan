import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@barangayan/shared';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import '../auth/native-pkce-crypto';
import { AuthFlowProvider } from '../auth/auth-flow';
import { clearAppleAuthorizationCode } from '../auth/apple-authorization';
import { clearAuthHints } from '../auth/hints';
import { RECOVERY_HINT_MS } from '../auth/recovery-flow';
import { releaseDeviceForLogout } from '../features/notifications/logout';
import type { Configuration } from './config';
import { finishPendingDraftPurge, purgeAllDrafts, purgeOtherAccountDrafts } from './drafts';
import { purgePrivateFiles } from './private-files';
import { newSessionStorage } from './secure-storage';

export type Profile = Tables<'profiles'>;
type Client = SupabaseClient<Database>;
/** Why the resident is back at the signed-out entry; shown once as feedback. */
export type SignedOutNotice = 'logged-out' | 'session-ended' | 'access-denied' | 'account-deleted';
export type LogoutReason = SignedOutNotice;
type Runtime = {
  client: Client;
  config: Configuration;
  session: Session | null;
  /** Null while a signed-in resident has not completed account setup (no profile row yet). */
  profile: Profile | null;
  recovery: boolean;
  epoch: number;
  notice: SignedOutNotice | null;
  dismissNotice: () => void;
  refreshProfile: () => Promise<void>;
  setRecovery: (active: boolean) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
};

/** The signed-in account may not use the resident app (staff, other tenant or deleted). */
class AccessDenied extends Error {}
const Context = createContext<Runtime | null>(null);
export const useResident = () => {
  const context = useContext(Context);
  if (!context) throw new Error('Resident session is not initialized.');
  return context;
};

type Connection = ReturnType<typeof connect>;
function connect(config: Configuration) {
  const storageKey = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`;
  const prefix = `resident-ios.${new URL(config.url).hostname}`;
  const storage = newSessionStorage(prefix);
  const pending = new Set<AbortController>();
  let closed = false;
  const client = createClient<Database>(config.url, config.anonKey, {
    auth: { storage, storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
    global: {
      fetch: async (input, options) => {
        if (closed) throw new Error('Session ended');
        const controller = new AbortController();
        const abort = () => controller.abort();
        options?.signal?.addEventListener('abort', abort, { once: true });
        if (options?.signal?.aborted) abort();
        pending.add(controller);
        const timeout = setTimeout(abort, 20000);
        try {
          const result = await fetch(input, { ...options, signal: controller.signal });
          if (closed) throw new Error('Session ended');
          return result;
        } finally {
          clearTimeout(timeout);
          options?.signal?.removeEventListener('abort', abort);
          pending.delete(controller);
        }
      },
    },
  });
  return {
    client, storage,
    marker: `${prefix}.installation`,
    recoveryUntil: `${prefix}.recovery-until`,
    close() {
      closed = true;
      storage.disable();
      void client.auth.stopAutoRefresh();
      void client.removeAllChannels();
      pending.forEach((controller) => controller.abort());
    },
    async clear() {
      // A persistent tombstone stops recovery even if a later Keychain deletion fails.
      await AsyncStorage.setItem(`${prefix}.installation`, 'closed');
      await Promise.all([storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`].map((key) => storage.removeItem(key)));
    },
  };
}

export function ResidentProvider({ config, children, fallback }: {
  config: Configuration;
  children: ReactNode;
  fallback: (state: { error: boolean; retry: () => void; clear: () => void }) => ReactNode;
}) {
  const connection = useRef<Connection | null>(null);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [forceClear, setForceClear] = useState(false);
  const revision = useRef(0);
  const [epoch, setEpoch] = useState(0);
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovery, setRecoveryState] = useState(false);
  const [notice, setNotice] = useState<SignedOutNotice | null>(null);
  // True while this app is performing a sign-out, so it is not reported as an unexpected end.
  const closing = useRef(false);
  // The current logout, for callbacks created before it is defined (denial found during validation).
  const logoutRef = useRef<((reason?: LogoutReason) => Promise<void>) | null>(null);

  useEffect(() => {
    let alive = true;
    let subscription: { unsubscribe(): void } | undefined;
    let lifecycle: { remove(): void } | undefined;
    let ownedConnection: Connection | undefined;
    let validatedUser: string | null = null;
    // Read installation policy BEFORE constructing a client (which restores asynchronously).
    const marker = `resident-ios.${new URL(config.url).hostname}.installation`;
    const recoveryUntil = `resident-ios.${new URL(config.url).hostname}.recovery-until`;
    async function initialize() {
      setReady(false);
      setError(false);
      // Files left by a killed process or an earlier session (exports, receipts, QR images, picked photos) never outlive it.
      purgePrivateFiles();
      const mode = await AsyncStorage.getItem(marker);
      const storage = newSessionStorage(`resident-ios.${new URL(config.url).hostname}`);
      const key = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`;
      if (forceClear || (mode !== 'active' && mode !== 'recovery')) {
        await AsyncStorage.setItem(marker, 'closed');
        await Promise.all([key, `${key}-user`, `${key}-code-verifier`].map((name) => storage.removeItem(name)));
        // Keychain items survive reinstall; a fresh install must not resurrect old private drafts.
        await purgeAllDrafts();
        await clearAuthHints();
        await AsyncStorage.setItem(marker, 'active');
      } else {
        await finishPendingDraftPurge();
      }
      if (!alive) return;
      const current = connect(config);
      ownedConnection = current;
      connection.current = current;
      setActiveConnection(current);
      // A recovery hint only keeps the recovery stack reachable for a limited time.
      const until = Number(await AsyncStorage.getItem(recoveryUntil));
      const recoveryActive = mode === 'recovery' && Number.isFinite(until) && until > Date.now() && until <= Date.now() + RECOVERY_HINT_MS;
      if (mode === 'recovery' && !recoveryActive) await AsyncStorage.setItem(marker, 'active');
      setRecoveryState(recoveryActive);
      async function validate(next: Session | null) {
        const version = ++revision.current;
        const owns = () => alive && version === revision.current;
        try {
          if (next?.user.id !== validatedUser) {
            setReady(false);
            setProfile(null);
          }
          if (!next) {
            const ended = validatedUser !== null;
            validatedUser = null;
            if (ended && !closing.current) {
              await logoutRef.current?.('session-ended');
              return;
            }
            if (alive) {
              setProfile(null); setSession(null); setReady(true);
            }
            return;
          }
          const { data: userData, error: userError } = await current.client.auth.getUser();
          if (!owns()) return;
          if (userError || userData.user?.id !== next.user.id) throw userError ?? new Error('Session unavailable');
          // No profile row yet is a valid pre-setup resident; a deleted, staff or foreign-tenant row is not.
          const { data, error: profileError } = await current.client.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
          if (!owns()) return;
          if (profileError) throw profileError;
          if (data && (data.deleted_at !== null || data.role !== 'resident' || data.barangay_id !== config.barangayId)) throw new AccessDenied();
          if (validatedUser !== next.user.id) {
            await purgeOtherAccountDrafts({ environment: config.environment, barangayId: config.barangayId, userId: next.user.id });
            // A session that ended without this app's own logout may have left an earlier account's temporary files behind.
            purgePrivateFiles();
          }
          if (!owns()) return;
          validatedUser = next.user.id;
          setSession(next);
          setProfile(data);
          setNotice(null);
          setError(false);
          setReady(true);
        } catch (failure) {
          // A denied or failed read for an earlier account cannot end a newer session.
          if (owns()) failed(failure);
        }
      }
      function failed(failure: unknown) {
        if (!alive) return;
        if (failure instanceof AccessDenied) { void logoutRef.current?.('access-denied').catch(() => undefined); return; }
        setError(true); setReady(false);
      }
      const result = await current.client.auth.getSession();
      if (result.error) throw result.error;
      await validate(result.data.session).catch(failed);
      if (!alive) return;
      subscription = current.client.auth.onAuthStateChange((event, next) => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryState(true);
          void AsyncStorage.multiSet([[marker, 'recovery'], [recoveryUntil, String(Date.now() + RECOVERY_HINT_MS)]]);
        }
        // Supabase warns against awaiting Auth methods inside its callback/lock.
        setTimeout(() => { if (alive) void validate(next).catch(failed); }, 0);
      }).data.subscription;
      lifecycle = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void current.client.auth.startAutoRefresh();
          void current.client.auth.getSession().then(({ data }) => validate(data.session)).catch(failed);
        } else { void current.client.auth.stopAutoRefresh(); }
      });
      if (AppState.currentState !== 'active') void current.client.auth.stopAutoRefresh();
    }
    void initialize().catch(() => { if (alive) { setError(true); setReady(false); } });
    return () => {
      alive = false;
      subscription?.unsubscribe();
      lifecycle?.remove();
      ownedConnection?.close();
      if (connection.current === ownedConnection) connection.current = null;
    };
  }, [config, epoch, forceClear, retry]);

  async function logout(reason: LogoutReason = 'logged-out') {
    if (closing.current) return;
    const current = connection.current;
    const token = session?.access_token;
    closing.current = true;
    // The push token can only be released while the session is still valid; it never throws and waits briefly at most.
    if (current) await releaseDeviceForLogout(current.client, config, session?.user.id);
    setForceClear(true);
    revision.current++;
    setReady(false);
    setActiveConnection(null);
    setSession(null);
    setProfile(null);
    setRecoveryState(false);
    current?.close();
    try {
      await current?.clear();
      if (current) await AsyncStorage.removeItem(current.recoveryUntil);
      await clearAuthHints();
      clearAppleAuthorizationCode();
      await purgeAllDrafts();
      // Temporary files are not part of the sign-out guarantee: a failure here is retried by the purge at the next launch.
      purgePrivateFiles();
      setNotice(reason);
      closing.current = false;
      setEpoch((value) => value + 1);
    } catch { closing.current = false; setError(true); throw new Error('Local cleanup needs retry.'); }
    // Revocation is separate from the local security transition and cannot resurrect it.
    if (token) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      void fetch(`${config.url}/auth/v1/logout?scope=local`, {
        method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }, signal: controller.signal,
      }).catch(() => undefined).finally(() => clearTimeout(timer));
    }
  }
  useEffect(() => { logoutRef.current = logout; });

  function retryInitialization() {
    setReady(false);
    setActiveConnection(null);
    setRetry((value) => value + 1);
  }

  function clearDeviceSession() {
    setReady(false);
    setActiveConnection(null);
    setForceClear(true);
    setRetry((value) => value + 1);
  }

  if (!ready || !activeConnection) return fallback({
    error,
    retry: retryInitialization,
    clear: clearDeviceSession,
  });
  const value: Runtime = {
    client: activeConnection.client, config, session, profile, recovery, epoch, notice,
    dismissNotice: () => setNotice(null),
    logout,
    async setRecovery(active) {
      if (active) await AsyncStorage.setItem(activeConnection.recoveryUntil, String(Date.now() + RECOVERY_HINT_MS));
      else await AsyncStorage.removeItem(activeConnection.recoveryUntil);
      await AsyncStorage.setItem(activeConnection.marker, active ? 'recovery' : 'active');
      setRecoveryState(active);
    },
    async refreshProfile() {
      if (!session) return;
      const version = revision.current;
      const { data, error: queryError } = await activeConnection.client.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (version !== revision.current || connection.current !== activeConnection) return;
      if (queryError) throw queryError;
      if (data && (data.deleted_at !== null || data.role !== 'resident' || data.barangay_id !== config.barangayId)) {
        void logoutRef.current?.('access-denied');
        throw new Error('Resident profile unavailable');
      }
      if (version === revision.current) setProfile(data);
    },
  };
  return <Context.Provider value={value}><AuthFlowProvider key={epoch} client={activeConnection.client} session={session} recovery={recovery} logout={logout}><SessionScope key={`${epoch}:${session?.user.id ?? 'guest'}`}>{children}</SessionScope></AuthFlowProvider></Context.Provider>;
}
function SessionScope({ children }: { children: ReactNode }) { return children; }
