import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@barangayan/shared';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Configuration } from './config';
import { newSessionStorage } from './secure-storage';

export type Profile = Tables<'profiles'>;
type Client = SupabaseClient<Database>;
type Runtime = {
  client: Client;
  config: Configuration;
  session: Session | null;
  profile: Profile | null;
  recovery: boolean;
  epoch: number;
  refreshProfile: () => Promise<void>;
  setRecovery: (active: boolean) => Promise<void>;
  logout: () => Promise<void>;
};
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
    auth: { storage, storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
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

  useEffect(() => {
    let alive = true;
    let subscription: { unsubscribe(): void } | undefined;
    let lifecycle: { remove(): void } | undefined;
    let ownedConnection: Connection | undefined;
    let validatedUser: string | null = null;
    // Read installation policy BEFORE constructing a client (which restores asynchronously).
    const marker = `resident-ios.${new URL(config.url).hostname}.installation`;
    async function initialize() {
      setReady(false);
      setError(false);
      const mode = await AsyncStorage.getItem(marker);
      const storage = newSessionStorage(`resident-ios.${new URL(config.url).hostname}`);
      const key = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`;
      if (forceClear || (mode !== 'active' && mode !== 'recovery')) {
        await AsyncStorage.setItem(marker, 'closed');
        await Promise.all([key, `${key}-user`, `${key}-code-verifier`].map((name) => storage.removeItem(name)));
        await AsyncStorage.setItem(marker, 'active');
      }
      if (!alive) return;
      const current = connect(config);
      ownedConnection = current;
      connection.current = current;
      setActiveConnection(current);
      setRecoveryState(mode === 'recovery');
      async function validate(next: Session | null) {
        const version = ++revision.current;
        if (next?.user.id !== validatedUser) {
          setReady(false);
          setProfile(null);
        }
        if (!next) {
          validatedUser = null;
          if (alive) { setProfile(null); setSession(null); setReady(true); }
          return;
        }
        const { data: userData, error: userError } = await current.client.auth.getUser();
        if (userError || userData.user?.id !== next.user.id) throw userError ?? new Error('Session unavailable');
        const { data, error: profileError } = await current.client.from('profiles').select('*').eq('id', userData.user.id).is('deleted_at', null).single();
        if (profileError || !data || data.role !== 'resident' || data.barangay_id !== config.barangayId) throw profileError ?? new Error('Resident profile unavailable');
        if (!alive || version !== revision.current) return;
        validatedUser = next.user.id;
        setSession(next);
        setProfile(data);
        setError(false);
        setReady(true);
      }
      const result = await current.client.auth.getSession();
      if (result.error) throw result.error;
      await validate(result.data.session);
      if (!alive) return;
      subscription = current.client.auth.onAuthStateChange((event, next) => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'PASSWORD_RECOVERY') setRecoveryState(true);
        // Supabase warns against awaiting Auth methods inside its callback/lock.
        setTimeout(() => { if (alive) void validate(next).catch(() => { if (alive) { setError(true); setReady(false); } }); }, 0);
      }).data.subscription;
      lifecycle = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void current.client.auth.startAutoRefresh();
          void current.client.auth.getSession().then(({ data }) => validate(data.session)).catch(() => {
            if (alive) { setError(true); setReady(false); }
          });
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

  async function logout() {
    const current = connection.current;
    const token = session?.access_token;
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
      setEpoch((value) => value + 1);
    } catch { setError(true); throw new Error('Local cleanup needs retry.'); }
    // Revocation is separate from the local security transition and cannot resurrect it.
    if (token) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      void fetch(`${config.url}/auth/v1/logout?scope=local`, {
        method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }, signal: controller.signal,
      }).catch(() => undefined).finally(() => clearTimeout(timer));
    }
  }

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
    client: activeConnection.client, config, session, profile, recovery, epoch,
    logout,
    async setRecovery(active) {
      await AsyncStorage.setItem(activeConnection.marker, active ? 'recovery' : 'active');
      setRecoveryState(active);
    },
    async refreshProfile() {
      if (!session) return;
      const version = revision.current;
      const { data, error: queryError } = await activeConnection.client.from('profiles').select('*').eq('id', session.user.id).is('deleted_at', null).single();
      if (queryError) throw queryError;
      if (!data || data.role !== 'resident' || data.barangay_id !== config.barangayId) throw new Error('Resident profile unavailable');
      if (version === revision.current) setProfile(data);
    },
  };
  return <Context.Provider value={value}><SessionScope key={`${epoch}:${session?.user.id ?? 'guest'}`}>{children}</SessionScope></Context.Provider>;
}
function SessionScope({ children }: { children: ReactNode }) { return children; }
