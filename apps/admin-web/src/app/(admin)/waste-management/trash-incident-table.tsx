'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateTime, type Tables } from '@barangayan/shared';

type ScoredTrashIncident = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color' | 'icon'> | null;
  waste_zones: Pick<Tables<'waste_zones'>, 'name'> | null;
  score: number;
};

function ScoreBadge({ score, threshold }: { score: number; threshold: number }) {
  const isHigh = score >= threshold;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        isHigh
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      }`}
      title={isHigh ? 'High priority — above threshold' : 'Normal priority'}>
      {score.toFixed(1)} pts
    </span>
  );
}

export function TrashIncidentTable({
  rows,
  categoryNames,
  highPriorityThreshold,
}: {
  rows: ScoredTrashIncident[];
  categoryNames: Record<string, string>;
  highPriorityThreshold: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    const supabase = createSupabaseBrowserClient();
    // Route through the guarded FSM RPC (same one incident-actions.tsx uses)
    // instead of a raw `.update()` — a direct column write bypasses the
    // forward-only transition guard and would let this table make illegal
    // backward transitions that the incident-reports table can't.
    const { error } = await supabase.rpc('update_incident_status', {
      p_incident_id: id,
      p_status: status,
    });
    setUpdating(null);
    if (error) {
      toast.showError(`Failed to update: ${error.message}`);
      return;
    }
    toast.showSuccess('Status updated.');
    router.refresh();
  }

  async function archive(id: string) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('incidents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.showError(`Failed to archive: ${error.message}`);
      return;
    }
    toast.showSuccess('Report archived.');
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">No illegal dumping or trash-related reports found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.title}</span>
                <ScoreBadge score={r.score} threshold={highPriorityThreshold} />
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: (r.incident_categories?.color ?? '#6B7280') + '20',
                    color: r.incident_categories?.color ?? '#6B7280',
                  }}>
                  {r.incident_categories?.name ?? categoryNames[r.category_id ?? ''] ?? 'Unknown'}
                </span>
                {r.waste_zones?.name && (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    📍 {r.waste_zones.name}
                  </span>
                )}
                <span className="text-xs text-zinc-500">{formatDateTime(r.created_at)}</span>
              </div>
              {r.description && <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{r.description}</p>}
              <p className="mt-1 text-xs text-zinc-400">
                {r.confirmation_count} confirmation{r.confirmation_count !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {r.status === 'open' && (
                <button
                  onClick={() => updateStatus(r.id, 'in_progress')}
                  disabled={updating === r.id}
                  className="rounded-full bg-[var(--accent)]/15 px-4 py-1.5 text-xs font-semibold text-[var(--accent)] disabled:opacity-50">
                  {updating === r.id ? '…' : 'Start'}
                </button>
              )}
              {r.status === 'in_progress' && (
                <button
                  onClick={() => updateStatus(r.id, 'resolved')}
                  disabled={updating === r.id}
                  className="rounded-full bg-[var(--accent)]/15 px-4 py-1.5 text-xs font-semibold text-[var(--accent)] disabled:opacity-50">
                  {updating === r.id ? '…' : 'Resolve'}
                </button>
              )}
              <ConfirmButton
                label="Archive"
                confirmLabel="Archive report?"
                onConfirm={() => archive(r.id)}
                title="Archive Report"
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
