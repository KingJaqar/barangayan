import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import { usePathname } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import { isSearchableQuery, normalizeSearchQuery, queryResidentSearch, SEARCH_DEADLINE_MS, type SearchGroup } from '@/lib/resident-search';
import { createSearchHistoryStore } from '@/lib/search-history';
import { useSearchSession } from '@/hooks/use-search-session';

const historyStore = createSearchHistoryStore(AsyncStorage);
type SearchDraft = ReturnType<typeof useSearchSession> & {
  history: string[]; historyError: 'load' | 'save' | null; reloadHistory: () => void;
  rememberSearch: (query: string) => void; removeSearch: (query: string) => void; clearHistory: () => void;
};
const SearchContext = createContext<SearchDraft>({ query: '', setQuery: () => {}, history: [], historyError: null, reloadHistory: () => {},
  submittedQuery: null, submission: 0, origin: '/home', openSearch: () => {}, submitSearch: () => false, editSearch: () => {}, backFromSearch: () => {},
  rememberSearch: () => {}, removeSearch: () => {}, clearHistory: () => {} });

/** Lives above navigation: the header input and Search screen share one draft. */
export function ResidentSearchProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return <AccountSearchProvider key={userId ?? 'guest'} userId={userId}>{children}</AccountSearchProvider>;
}

function AccountSearchProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const { profile } = useProfile();
  const searchSession = useSearchSession(JSON.stringify([userId, profile?.barangay_id ?? null]));
  const [history, setHistory] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<SearchDraft['historyError']>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  /** Only the latest load or edit may publish; a failed edit re-reads what is actually saved. */
  const sync = useCallback((account: string, operation: Promise<string[]>, failure: 'load' | 'save') => {
    const ticket = ++revision.current;
    const current = () => mounted.current && revision.current === ticket;
    void operation.then(values => {
      if (!current()) return;
      setHistory(values);
      setHistoryError(null);
    }).catch(() => {
      if (!current()) return;
      setHistoryError(failure);
      if (failure === 'save') void historyStore.load(account).then(values => { if (current()) setHistory(values); }, () => {});
    });
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (userId) sync(userId, historyStore.load(userId), 'load');
    return () => { mounted.current = false; };
  }, [userId, sync]);
  const value = useMemo<SearchDraft>(() => {
    const rememberSearch = (input: string) => {
      if (userId && isSearchableQuery(input)) sync(userId, historyStore.remember(userId, normalizeSearchQuery(input)), 'save');
    };
    return { ...searchSession, history, historyError, rememberSearch,
      // Keyboard, button, recent and suggestion submissions all take this one path.
      submitSearch: (input: string) => {
        if (!searchSession.submitSearch(input)) return false;
        rememberSearch(input);
        Keyboard.dismiss();
        return true;
      },
      reloadHistory: () => { if (userId) sync(userId, historyStore.load(userId), 'load'); },
      removeSearch: (input: string) => { if (userId) sync(userId, historyStore.remove(userId, input), 'save'); },
      clearHistory: () => { if (userId) sync(userId, historyStore.clear(userId), 'save'); },
    };
  }, [searchSession, history, historyError, userId, sync]);
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
  const enabled = pathname === '/search' && isSearchableQuery(normalized);
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
        timeout = setTimeout(() => controller.abort(), SEARCH_DEADLINE_MS);
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
