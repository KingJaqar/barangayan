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
      {error ? <div role="alert" className="table-browse-error">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
          strokeWidth="2.25" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg><span>{error}</span>
        {onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>
        : <div className="table-browse-body" data-pending={pending || undefined} inert={pending || undefined}>
          <div className="table-browse-progress" aria-hidden="true" />
          {children}
        </div>}
    </ViewportContext.Provider>
    <div data-browse-footer>{!error && pagination}</div>
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{lastAnnouncement}</div>
    {pending && <span className="sr-only">Updating results…</span>}
  </section>;
}
