'use client';

import { useEffect, useState } from 'react';
import { isSearchResponse, type SearchFilter, type SearchResponse } from '@/lib/search/types';

export function useResidentSearch(query: string, { category = 'all', page = 1, suggestions = false, enabled = true }: { category?: SearchFilter; page?: number; suggestions?: boolean; enabled?: boolean } = {}) {
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([query, category, page, suggestions]);
  const active = enabled && query.length > 0;
  const activationKey = JSON.stringify([key, active]);
  const [activation, setActivation] = useState({ key: activationKey, sequence: 0 });
  // Revisiting a previously typed query is a new request, not proof the old response
  // is current. Update during render so no stale options commit before the effect.
  const sequence = activation.sequence + Number(activation.key !== activationKey);
  if (activation.key !== activationKey) setActivation({ key: activationKey, sequence });
  const identity = JSON.stringify([key, sequence, retry]);
  const [settled, setSettled] = useState<{ identity: string; key: string; sequence: number; data: SearchResponse | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    // Debounce only suggestions. Cleanup prevents an old response replacing the
    // current query, including requests that settle just before cancellation.
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, category, page: String(page) });
        if (suggestions) params.set('suggestions', '1');
        const response = await fetch(`/api/search?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store' });
        if (!response.ok) throw new Error('Search unavailable');
        const data: unknown = await response.json();
        if (!isSearchResponse(data) || data.query !== query) throw new Error('Invalid search response');
        if (current) setSettled({ identity, key, sequence, data, error: null });
      } catch {
        if (current) setSettled(previous => ({ identity, key, sequence, data: previous?.key === key && previous.sequence === sequence ? previous.data : null, error: "We couldn't search right now. Check your connection and try again." }));
      }
    }, suggestions ? 250 : 0);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [active, query, category, page, suggestions, identity, key, sequence]);

  const result = active && settled?.identity === identity ? settled : null;
  const data = active && settled?.key === key && settled.sequence === sequence ? settled.data : null;
  const loading = active && result === null;
  return { data, error: result?.error ?? null, loading, refreshing: loading && data !== null, retry: () => setRetry(value => value + 1) };
}
