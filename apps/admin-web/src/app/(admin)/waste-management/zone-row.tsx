'use client';

import styles from '@/components/admin/content-workspace.module.css';

import { Trash2 } from 'lucide-react';

import { wasteZoneSchema, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

type WasteZone = Tables<'waste_zones'>;
type WasteSchedule = Tables<'waste_collection_schedules'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ZoneRow({ zone, schedules }: { zone: WasteZone; schedules: WasteSchedule[] }) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(zone.name);
  const [description, setDescription] = useState(zone.description ?? '');

  function startEdit() {
    setName(zone.name);
    setDescription(zone.description ?? '');
    setError(null);
    setIsEditing(true);
  }

  async function toggleActive() {
    const toastAttempt = beginAttempt('toggleActive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: toggleError } = await supabase
        .from('waste_zones')
        .update({ is_active: !zone.is_active })
        .eq('id', zone.id);
      if (toggleError) {
        toast.error(`Failed to ${zone.is_active ? 'deactivate' : 'activate'}: ${toggleError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'status_change',
        entityType: 'waste_zone',
        entityId: zone.id,
        entityLabel: zone.name,
        changes: { before: { is_active: zone.is_active }, after: { is_active: !zone.is_active } },
      }).catch(() => {});

      toast.success(`Zone ${zone.is_active ? 'deactivated' : 'activated'}.`, { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  async function archive() {
    const toastAttempt = beginAttempt('archive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: archiveError } = await supabase
        .from('waste_zones')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', zone.id);
      if (archiveError) {
        toast.error(`Failed to archive: ${archiveError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'delete',
        entityType: 'waste_zone',
        entityId: zone.id,
        entityLabel: zone.name,
        metadata: { name: zone.name, description: zone.description },
      }).catch(() => {});

      toast.success(`"${zone.name}" archived.`, { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  async function handleSave(event: React.FormEvent) {
    const toastAttempt = beginAttempt('handleSave');
    try {
      event.preventDefault();
      setError(null);

      const result = wasteZoneSchema.safeParse({
        name,
        description: description || undefined,
        isActive: zone.is_active,
      });

      if (!result.success) {
        toast.error('Review the highlighted fields before continuing.', { id: toastAttempt });
        setError(result.error.issues[0]?.message ?? 'Invalid input');
        return;
      }

      setSubmitting(true);
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('waste_zones')
        .update({
          name: result.data.name,
          description: result.data.description,
        })
        .eq('id', zone.id);
      setSubmitting(false);

      if (updateError) {
        setError(updateError.message);
        toast.error(`Failed to save changes: ${updateError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'update',
        entityType: 'waste_zone',
        entityId: zone.id,
        entityLabel: result.data.name,
        changes: {
          before: { name: zone.name, description: zone.description },
          after: { name: result.data.name, description: result.data.description },
        },
      }).catch(() => {});

      toast.success(`"${result.data.name}" updated.`, { id: toastAttempt });
      setIsEditing(false);
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className={styles.rowEdit}>
        <div className="grid grid-cols-4 gap-3">
          <label className="col-span-4 text-sm sm:col-span-1">
            <span className={labelClass}>Zone Name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="col-span-4 text-sm sm:col-span-3">
            <span className={labelClass}>Description</span>
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          {error ? <p className="col-span-4 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-4 flex items-center gap-2">
            <button type="submit" disabled={submitting} className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            aria-busy={submitting}>
              <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
            </button>
            <button type="button" onClick={() => setIsEditing(false)} disabled={submitting} className="rounded-full bg-zinc-200 px-5 py-1.5 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <div className={styles.rowMain}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={styles.rowTitle}>{zone.name}</h3>
            {!zone.is_active ? (
              <span className={styles.badge}>Inactive</span>
            ) : null}
            {zone.trash_score > 0 && (
              <span
                title={`Dumping priority score${zone.trash_score_updated_at ? ` · Updated ${new Date(zone.trash_score_updated_at).toLocaleString()}` : ''}`}
                className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <Trash2 size={13} className="mr-1 inline-block" aria-hidden="true" />{zone.trash_score.toFixed(1)} pts
              </span>
            )}
          </div>
          <p className={styles.rowMeta}>
            {zone.description ? `${zone.description} · ` : ''}
            {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} assigned
          </p>
        </div>

        <div className={styles.rowActions}>
          <button onClick={toggleActive} className={`rounded-full px-3 py-1 text-xs font-semibold ${zone.is_active ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>
            {zone.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={startEdit} title="Edit" className={styles.primaryAction}>Edit</button>
          <ConfirmButton label="Archive" confirmLabel="Archive zone?" onConfirm={archive} title="Archive Zone" className={styles.dangerAction} />
        </div>
      </div>
    </div>
  );
}
