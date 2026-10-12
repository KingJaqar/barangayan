'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { TableEditHandle } from '@/components/admin/editable-data-table';
import { createRefreshCoordinator } from '@/lib/admin-tables/browse-coordination';
import { browseUrl, queryIdentity, type BrowseConfig, type BrowseResult, type BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome } from '@/lib/admin-tables/queries/browse';
import { pilotConfig, type PilotTable } from '@/lib/admin-tables/pilot-config';
import { useTableBrowseNavigation } from './use-table-browse-navigation';

export function usePilotTableBrowse<T>(name: PilotTable, requested: BrowseState, result: QueryOutcome<BrowseResult<T>>) {
  const params = useSearchParams();
  return useConfiguredTableBrowse(pilotConfig(name, params.get('doc') ?? ''), requested, result);
}

/** Shared settlement, latest-query and refresh coordination for integrated routes. */
export function useConfiguredTableBrowse<T>(config: BrowseConfig, requested: BrowseState, result: QueryOutcome<BrowseResult<T>>, trimSearch = false) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const editHandle = useRef<TableEditHandle | null>(null);
  const settle = useCallback(async () => editHandle.current?.settle() ?? true, []);
  const navigation = useTableBrowseNavigation(config, settle);
  const [refreshPending, startRefresh] = useTransition();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshWait = useRef<{ resolve: () => void; reject: (error: Error) => void; started: boolean } | null>(null);
  const editing = useRef(false);
  const navigating = useRef(false);
  const coordinator = useRef<ReturnType<typeof createRefreshCoordinator> | null>(null);
  const performRefresh = useCallback(() => new Promise<void>((resolve, reject) => {
    setRefreshError(null);
    refreshWait.current = { resolve, reject, started: false };
    startRefresh(() => router.refresh());
  }), [router, startRefresh]);
  useEffect(() => {
    const wait = refreshWait.current;
    if (!wait) return;
    if (refreshPending) wait.started = true;
    else if (wait.started) { refreshWait.current = null; wait.resolve(); }
  }, [refreshPending]);
  useEffect(() => {
    if (!refreshPending) return;
    const timer = setTimeout(() => {
      const wait = refreshWait.current;
      refreshWait.current = null;
      wait?.reject(new Error('Refresh deadline exceeded'));
    }, 15000);
    return () => clearTimeout(timer);
  }, [refreshPending]);
  useEffect(() => {
    const instance = createRefreshCoordinator(performRefresh,
      () => setRefreshError('The refresh did not finish. Retry to reconcile the results.'));
    coordinator.current = instance;
    return () => { instance.dispose(); coordinator.current = null; refreshWait.current?.resolve(); refreshWait.current = null; };
  }, [performRefresh]);
  useEffect(() => {
    navigating.current = navigation.pending;
    coordinator.current?.setEditing(editing.current || navigation.pending);
  }, [navigation.pending]);
  const onEditingChange = useCallback((value: boolean) => {
    editing.current = value;
    coordinator.current?.setEditing(value || navigating.current);
  }, []);
  const refresh = useCallback(() => coordinator.current?.request(), []);
  const current = queryIdentity(trimSearch ? { ...navigation.state, q: navigation.state.q.trim() } : navigation.state) === queryIdentity(requested);
  const value = current && result.status === 'success' ? result.value : null;
  const state = value?.state ?? navigation.state;
  const correction = useRef<string | null>(null);
  // The adapter's single correction is authoritative. Replace only the matching
  // committed query; never overwrite a newer navigation or the search draft.
  useEffect(() => {
    if (value && value.state.page === requested.page) correction.current = null;
    if (!value || navigation.pending || refreshPending || value.state.page === requested.page) return;
    const target = browseUrl(pathname, search, value.state, config);
    if (target !== browseUrl(pathname, search, requested, config) && correction.current !== target) {
      correction.current = target;
      router.replace(target, { scroll: false });
    }
  }, [value, navigation.pending, refreshPending, requested, pathname, search, config, router]);
  return { ...navigation, config, state, value, editHandle, settle, refresh, onEditingChange,
    pending: navigation.pending || refreshPending || !current,
    error: refreshError ?? (current && result.status === 'error' ? result.message : null) };
}
