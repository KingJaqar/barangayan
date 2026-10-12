'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { browseUrl, changeBrowseState, parseBrowseState, type BrowseChange, type BrowseConfig } from '@/lib/admin-tables/browse-state';

/** Failed edit settlement returns false and preserves the draft. */
export function useTableBrowseNavigation(config: BrowseConfig, settleEdit?: () => Promise<boolean>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const state = parseBrowseState(params, config);
  const [searchDraft, setSearchDraft] = useState(state.q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const draftRef = useRef(state.q);
  const targetRef = useRef<string | null>(null);
  const cancelDebounce = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    generation.current++;
  }, []);
  useEffect(() => {
    const committed = new URLSearchParams(search);
    committed.sort();
    // Ignore an intermediate commit while a newer navigation is outstanding.
    if (targetRef.current && targetRef.current !== `${pathname}?${committed.toString()}`) return;
    cancelDebounce();
    targetRef.current = null;
    draftRef.current = new URLSearchParams(search).get('q') ?? '';
    setSearchDraft(draftRef.current);
    return cancelDebounce;
  }, [pathname, search, cancelDebounce]);
  useEffect(() => {
    const onHistory = () => { targetRef.current = null; cancelDebounce(); };
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, [cancelDebounce]);
  // Also cancel when an intermediate navigation effect has no cleanup of its own.
  useEffect(() => cancelDebounce, [cancelDebounce]);
  async function commit(change: BrowseChange) {
    cancelDebounce();
    const version = generation.current;
    const baseSearch = targetRef.current?.split('?')[1] ?? search;
    const current = parseBrowseState(new URLSearchParams(baseSearch), config);
    const withDraft = draftRef.current !== current.q ? { ...change, q: draftRef.current } : change;
    const next = changeBrowseState(current, withDraft, config);
    const target = browseUrl(pathname, baseSearch, next, config);
    if (target === browseUrl(pathname, search, current, config) || target === targetRef.current) return;
    if (settleEdit && !await settleEdit()) return;
    if (version !== generation.current) return;
    targetRef.current = target;
    startTransition(() => router.push(target, { scroll: false }));
  }
  function changeSearch(value: string) {
    cancelDebounce();
    draftRef.current = value;
    setSearchDraft(value);
    timer.current = setTimeout(() => { void commit({ q: value }); }, 300);
  }
  return { state, searchDraft, pending, changeSearch, commit, cancelDebounce };
}
