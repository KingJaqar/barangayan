import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import { normalizeSearchQuery, queryResidentSearch, type SearchGroup } from '@/lib/resident-search';
import { createSearchHistoryStore } from '@/lib/search-history';

const historyStore = createSearchHistoryStore(AsyncStorage);
type SearchDraft = {
  query: string; setQuery: (query: string) => void; history: string[]; historyError: string | null;
  rememberSearch: (query: string) => void; selectSearch: (query: string) => void;
  removeSearch: (query: string) => void; clearHistory: () => void;
};
const SearchContext = createContext<SearchDraft>({ query: '', setQuery: () => {}, history: [], historyError: null,
  rememberSearch: () => {}, selectSearch: () => {}, removeSearch: () => {}, clearHistory: () => {} });

/** Lives above navigation: the header input and Search screen share one draft. */
export function ResidentSearchProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return <AccountSearchProvider key={userId ?? 'guest'} userId={userId}>{children}</AccountSearchProvider>;
}

function AccountSearchProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const ticket = ++revision.current;
    if (userId) void historyStore.load(userId).then(values => {
      if (mounted.current && revision.current === ticket) setHistory(values);
    }).catch(() => {
      if (mounted.current && revision.current === ticket) setHistoryError('Recent searches could not be loaded.');
    });
    return () => { mounted.current = false; };
  }, [userId]);
  const value = useMemo<SearchDraft>(() => {
    function update(operation: Promise<string[]>) {
      const ticket = ++revision.current;
      void operation.then(values => {
        if (!mounted.current || revision.current !== ticket) return;
        setHistory(values);
        setHistoryError(null);
      }).catch(() => {
        if (mounted.current && revision.current === ticket) setHistoryError('Recent searches could not be saved. Please try again.');
      });
    }
    const rememberSearch = (input: string) => {
      const normalized = normalizeSearchQuery(input);
      if (userId && /[\p{L}\p{N}]/u.test(normalized)) update(historyStore.remember(userId, normalized));
    };
    return { query, setQuery, history, historyError, rememberSearch,
      selectSearch: (input: string) => { setQuery(normalizeSearchQuery(input)); rememberSearch(input); },
      removeSearch: (input: string) => { if (userId) update(historyStore.remove(userId, input)); },
      clearHistory: () => { if (userId) update(historyStore.clear(userId)); },
    };
  }, [query, history, historyError, userId]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export const useSearchDraft = () => useContext(SearchContext);

export function useResidentSearch() {
  const { query } = useSearchDraft();
  const { session } = useAuth();
  const { profile, isLoading, error: profileError } = useProfile();
  const pathname = usePathname();
  const userId = session?.user.id ?? null;
  const barangayId = profile?.barangay_id ?? null;
  const normalized = normalizeSearchQuery(query);
  const enabled = pathname === '/search' && /[\p{L}\p{N}]/u.test(normalized);
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([normalized, userId, barangayId, enabled, retry, isLoading, profileError]);
  // Revisiting a query and reopening search are fresh activations.
  const [activation, setActivation] = useState({ key, sequence: 0 });
  const sequence = activation.sequence + Number(activation.key !== key);
  if (activation.key !== key) setActivation({ key, sequence });
  const identity = JSON.stringify([key, sequence]);
  const [settled, setSettled] = useState<{ key: string; groups: SearchGroup[]; error: string | null } | null>(null);

  useEffect(() => {
    if (!enabled || (userId && isLoading)) return;
    let current = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      try {
        if (userId && (profileError || !barangayId)) throw new Error('Profile unavailable');
        timeout = setTimeout(() => controller.abort(), 12000);
        const groups = await queryResidentSearch(supabase, { userId, barangayId }, normalized, controller.signal);
        if (current) setSettled({ key: identity, groups, error: null });
      } catch {
        if (current) setSettled({ key: identity, groups: [], error: 'Search is unavailable. Check your connection and try again.' });
      } finally {
        clearTimeout(timeout);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, enabled, userId, barangayId, isLoading, profileError]);

  const result = enabled && settled?.key === identity ? settled : null;
  return {
    query: normalized,
    groups: result?.groups ?? [],
    loading: enabled && !result,
    error: result?.error ?? null,
    enabled,
    retry: () => setRetry(value => value + 1),
  };
}
