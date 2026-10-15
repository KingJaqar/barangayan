'use client';
import { useEffect, useState } from 'react';
import { MIN_QUERY_LENGTH, isSearchResponse, normalizeQuery, type SearchFilter, type SearchResponse } from '@/lib/search/model';

export function useAdminSearch(query: string, { category = 'all', page = 1, suggestions = false, enabled = true }: {
  category?: SearchFilter; page?: number; suggestions?: boolean; enabled?: boolean;
} = {}) {
  const normalized = normalizeQuery(query);
  const [revision, setRevision] = useState(0);
  const identity = JSON.stringify([normalized, category, page, suggestions, revision]);
  const [settled, setSettled] = useState<{ identity: string; data: SearchResponse | null; error: string | null; denied: boolean } | null>(null);
  const active = enabled && normalized.length >= MIN_QUERY_LENGTH;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: normalized, category, page: String(page) });
        if (suggestions) params.set('mode', 'suggestions');
        const response = await fetch(`/api/search?${params}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store',
        });
        if (!response.ok) {
          const denied = response.status === 401 || response.status === 403;
          if (current) setSettled({ identity, data: null, denied, error: response.status === 401 ? 'Your session expired. Please sign in again.'
            : response.status === 403 ? 'Search requires an active administrator account.' : 'Search could not load. Check your connection and try again.' });
          return;
        }
        const data: unknown = await response.json();
        if (!isSearchResponse(data) || data.query !== normalized || data.category !== category) throw new Error('Invalid search response');
        if (current) setSettled({ identity, data, error: null, denied: false });
      } catch {
        if (current) setSettled({ identity, data: null, denied: false, error: 'Search could not load. Check your connection and try again.' });
      }
    }, suggestions ? 250 : 0);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [active, normalized, category, page, suggestions, identity]);
  const result = active && settled?.identity === identity ? settled : null;
  return { data: result?.data ?? null, error: result?.error ?? null, denied: result?.denied ?? false,
    loading: active && result === null, retry: () => setRevision(value => value + 1) };
}
