'use client';

/**
 * Client half of the Requests page — owns which request is selected and renders the
 * responsive grid + RequestDrawer. Split out of page.tsx (a Server Component, keeps the
 * data fetch) because opening the drawer needs client state; each row is a button
 * (not a Link) so clicking it opens the drawer instead of navigating away — the
 * existing /services/requests/[requestId] route stays intact for deep links/back-
 * button/refresh.
 */

import { formatDateTime, getSlaFlag } from '@barangayan/shared';

import { StatusPill } from '@/components/shared/status-pill';
import { RequestDrawer } from './request-drawer';
import { useState } from 'react';

const OPEN_STATUSES = ['submitted', 'in_progress', 'ready_for_pickup'];

interface RequestRow {
  id: string;
  reference_number: string;
  status: string;
  payment_status: string;
  created_at: string;
  document_types: { name: string; processing_target_hours: number } | null;
}

export function RequestsList({ requests, emptyMessage }: { requests: RequestRow[]; emptyMessage: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drawerOpen = selectedId !== null;

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Forced back to a single column while the drawer is open so the background
          list stays comfortably readable next to it instead of competing for width. */}
      <div className={`grid grid-cols-1 gap-3 ${drawerOpen ? '' : 'sm:grid-cols-2'}`}>
        {requests.map((r) => {
          const flag = OPEN_STATUSES.includes(r.status)
            ? getSlaFlag(r.created_at, r.document_types?.processing_target_hours ?? 24)
            : 'on_track';
          const active = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              aria-current={active ? 'true' : undefined}
              className={`flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors ${
                active ? 'border-primary' : 'border-border hover:border-primary/40'
              }`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.document_types?.name ?? 'Document Request'}</p>
                <p className="text-xs text-muted-foreground">
                  {r.reference_number} · {formatDateTime(r.created_at)}
                </p>
                {flag !== 'on_track' && (
                  <p className={`mt-0.5 text-xs font-medium ${flag === 'overdue' ? 'text-status-error' : 'text-status-warning'}`}>
                    {flag === 'overdue' ? 'Taking longer than usual' : 'Nearing expected completion time'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusPill status={r.payment_status} />
                <StatusPill status={r.status} />
              </div>
            </button>
          );
        })}
      </div>

      <RequestDrawer requestId={selectedId} open={drawerOpen} onClose={() => setSelectedId(null)} />
    </>
  );
}
