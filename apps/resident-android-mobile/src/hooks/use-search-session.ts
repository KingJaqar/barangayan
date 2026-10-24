import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { isSearchableQuery, normalizeSearchQuery } from '@/lib/resident-search';

const ORIGINS = ['/home', '/services', '/drrm', '/home/emergency-info', '/maps', '/health', '/reports', '/announcements', '/settings'] as const;
type SearchOrigin = (typeof ORIGINS)[number];
const originFor = (path: string): SearchOrigin => ORIGINS.find(origin => origin === path) ?? '/home';
const emptySession = (scope: string) => ({ scope, query: '', submittedQuery: null as string | null, submission: 0, origin: '/home' as SearchOrigin, hasOrigin: false });

/** Transient route contract; history persistence and result data stay with their existing owners. */
export function useSearchSession(scope: string) {
  const pathname = usePathname();
  const [stored, setSession] = useState(() => emptySession(scope));
  const session = stored.scope === scope ? stored : emptySession(scope);
  // Reset this provider's state before descendants can commit another scope's draft.
  if (stored.scope !== scope) setSession(session);
  const transition = useRef<string | null>(null);
  useEffect(() => { transition.current = null; }, [pathname, scope]);
  const once = () => {
    const key = JSON.stringify([scope, pathname]);
    if (transition.current === key) return false;
    transition.current = key;
    return true;
  };
  /** Explore → entry with the submitted query, or with `draft` (X passes '' for an empty entry). */
  const editSearch = (draft?: string) => {
    if (pathname !== '/explore' || !once()) return;
    setSession({ ...session, query: draft ?? session.submittedQuery ?? session.query });
    // A submitted Explore is reached from entry; popping removes its history item.
    if (session.submittedQuery !== null && router.canGoBack()) router.back();
    else router.replace('/search');
  };
  return {
    query: session.query,
    submittedQuery: session.submittedQuery,
    /** Changes once per accepted submit, even for the same query: Explore keys its category (All), page and scroll state on it. */
    submission: session.submission,
    origin: session.origin,
    setQuery: (query: string) => setSession(current => ({ ...(current.scope === scope ? current : emptySession(scope)), query })),
    openSearch: (origin: string) => {
      if (pathname === '/search' || pathname === '/explore' || !once()) return;
      setSession({ ...session, origin: originFor(origin), hasOrigin: true, submittedQuery: null });
      router.navigate('/search');
    },
    submitSearch: (input: string) => {
      const query = normalizeSearchQuery(input);
      if (pathname !== '/search' || !isSearchableQuery(query) || !once()) return false;
      setSession({ ...session, query, submittedQuery: query, submission: session.submission + 1 });
      router.navigate('/explore');
      return true;
    },
    editSearch,
    backFromSearch: () => {
      if (pathname === '/explore') { editSearch(); return; }
      if (pathname !== '/search' || !once()) return;
      setSession({ ...session, submittedQuery: null, hasOrigin: false });
      if (session.hasOrigin && router.canGoBack()) {
        // Popping removes the entry from the tab history. A result opened in another tab moves that tab to the
        // end of the history, so the item before the entry may no longer be the origin: return there explicitly.
        router.back();
        router.navigate(session.origin);
      } else router.replace(session.origin);
    },
  };
}
