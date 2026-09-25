'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/loading/spinner';

interface IncidentActionsProps {
  incidentId: string;
  status: string;
  incidentTitle: string;
  /** Threaded down purely so the "remove" audit log entry can show what was
   * deleted, since the row itself disappears from the table after this runs. */
  incidentDescription?: string | null;
  variant?: 'compact' | 'full';
}

// Mirrors the guarded FSM in update_incident_status (0026): open -> in_progress -> resolved,
// with a branch to "unresolved" (admin cancel/close) from open or in_progress. Resolved,
// withdrawn, and unresolved are terminal — no guided-action buttons render for those.
const NEXT_STEP: Record<string, { next: string; label: string; color: string } | null> = {
  open: { next: 'in_progress', label: 'Mark In Progress', color: 'bg-blue-600 text-white' },
  in_progress: { next: 'resolved', label: 'Mark Resolved', color: 'bg-[var(--accent)] text-white' },
  resolved: null,
  withdrawn: null,
  unresolved: null,
};

const CAN_MARK_UNRESOLVED = new Set(['open', 'in_progress']);

/** Admin-side status transition buttons for a single incident row/page. */
export function IncidentActions({ incidentId, status, incidentTitle, incidentDescription, variant = 'full' }: IncidentActionsProps) {
  const router = useRouter();
  const toast  = useToast();
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const btnClass =
    variant === 'compact'
      ? 'rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50'
      : 'rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50';

  const step = NEXT_STEP[status] ?? null;

  async function setStatus(next: string, successLabel: string) {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('update_incident_status', {
      p_incident_id: incidentId,
      p_status: next,
    });
    if (error) {
      setBusy(false);
      toast.showError(`Failed: ${error.message}`);
      return;
    }

    // The RPC returns void, so confirm the persisted row before logging or reporting
    // success. It also catches a zero-row result if access changed during the request.
    const { data: updated, error: readError } = await supabase
      .from('incidents')
      .select('id, status')
      .eq('id', incidentId)
      .maybeSingle();
    setBusy(false);
    if (readError || !updated || updated.status !== next) {
      toast.showError(`Failed: ${readError?.message ?? 'The incident status was not updated.'}`);
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'incident',
      entityId: incidentId,
      entityLabel: incidentTitle,
      changes: { before: { status }, after: { status: next } },
    }).catch(() => {});

    toast.showSuccess(successLabel);
    router.refresh();
  }

  async function softDelete() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('incidents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', incidentId)
      .select('id, deleted_at')
      .maybeSingle();
    setBusy(false);
    setShowDeleteConfirm(false);
    if (error) {
      toast.showError(`Failed: ${error.message}`);
      return;
    }
    if (!updated?.deleted_at) {
      toast.showError('Failed: no incident was removed. Check that you still have access to this barangay.');
      return;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'incident',
      entityId: updated.id,
      entityLabel: incidentTitle,
      metadata: { title: incidentTitle, description: incidentDescription ?? null, status },
    }).catch(() => {});

    toast.showSuccess('Incident removed.');
    router.refresh();
  }

  return (
    <>
      <div aria-busy={busy} className="flex flex-wrap items-center gap-2">
        {step && (
          <button
            onClick={() => setStatus(step.next, `Incident marked as ${step.next.replace('_', ' ')}.`)}
            disabled={busy}
            className={`${btnClass} ${step.color}`}>
            {step.label}
          </button>
        )}

        {CAN_MARK_UNRESOLVED.has(status) && (
          <button
            onClick={() => setStatus('unresolved', 'Incident marked as unresolved.')}
            disabled={busy}
            className={`${btnClass} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>
            Mark Unresolved
          </button>
        )}

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={busy}
            className={`${btnClass} bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300`}>
            Remove
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 dark:text-red-400">Remove this incident?</span>
            <button
              onClick={softDelete}
              disabled={busy}
              className={`${btnClass} bg-red-600 text-white`}>
              Confirm
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className={`${btnClass} bg-zinc-200 dark:bg-zinc-700`}>
              Cancel
            </button>
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className={`mt-2 items-center gap-2 text-xs text-zinc-500 ${busy ? 'inline-flex' : 'sr-only'}`}>
        {busy ? <><Spinner size="compact" /> Updating incident…</> : ''}
      </p>
    </>
  );
}
