'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface BrowseViewport { bounded: boolean; label: string; resetKey?: string }
const ViewportContext = createContext<BrowseViewport>({ bounded: false, label: 'Table' });
export const useBrowseViewport = () => useContext(ViewportContext);

/** Controls/footer are siblings of the scroller, measured by TableScrollArea. */
export function TableBrowsePanel({ label, controls, pagination, children, pending = false, error,
  onRetry, announcement, queryIdentity }: {
  label: string; controls: ReactNode; pagination?: ReactNode; children: ReactNode; pending?: boolean;
  error?: string | null; onRetry?: () => void; announcement?: string; queryIdentity?: string;
}) {
  const [lastAnnouncement, setLastAnnouncement] = useState(announcement);
  if (!pending && !error && lastAnnouncement !== announcement) setLastAnnouncement(announcement);
  return <section aria-label={label} className="table-browse-panel" aria-busy={pending}>
    <div data-browse-controls>{controls}</div>
    <ViewportContext.Provider value={{ bounded: true, label, resetKey: queryIdentity }}>
      {error ? <div role="alert">{error} {onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>
        : <div inert={pending || undefined}>{children}</div>}
    </ViewportContext.Provider>
    <div data-browse-footer>{!error && pagination}</div>
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{lastAnnouncement}</div>
    {pending && <span className="text-sm text-zinc-500">Updating results…</span>}
  </section>;
}
