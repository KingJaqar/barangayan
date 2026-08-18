'use client';

import { wasteZoneSchema, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type WasteZone = Tables<'waste_zones'>;
type WasteSchedule = Tables<'waste_collection_schedules'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ZoneRow({ zone, schedules }: { zone: WasteZone; schedules: WasteSchedule[] }) {
  const router = useRouter();
  const toast = useToast();
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
    const supabase = createSupabaseBrowserClient();
    const { error: toggleError } = await supabase
      .from('waste_zones')
      .update({ is_active: !zone.is_active })
      .eq('id', zone.id);
    if (toggleError) {
      toast.showError(`Failed to ${zone.is_active ? 'deactivate' : 'activate'}: ${toggleError.message}`);
      return;
    }
    toast.showSuccess(`Zone ${zone.is_active ? 'deactivated' : 'activated'}.`);
    router.refresh();
  }

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('waste_zones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', zone.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }
    toast.showSuccess(`"${zone.name}" archived.`);
    router.refresh();
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = wasteZoneSchema.safeParse({
      name,
      description: description || undefined,
      isActive: zone.is_active,
    });

    if (!result.success) {
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
      toast.showError(`Failed to save changes: ${updateError.message}`);
      return;
    }

    toast.showSuccess(`"${result.data.name}" updated.`);
    setIsEditing(false);
    router.refresh();
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="rounded-xl border border-[var(--accent)] bg-white p-3 dark:border-[var(--accent)] dark:bg-zinc-900">
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
            <button type="submit" disabled={submitting} className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
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
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{zone.name}</span>
            {!zone.is_active ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Inactive</span>
            ) : null}
            {zone.trash_score > 0 && (
              <span
                title={`Time-decay dumping score, recomputed hourly by pg_cron${zone.trash_score_updated_at ? ` (last: ${new Date(zone.trash_score_updated_at).toLocaleString()})` : ''}`}
                className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                🗑 {zone.trash_score.toFixed(1)} pts
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {zone.description ? `${zone.description} · ` : ''}
            {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} assigned
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button onClick={toggleActive} className={`rounded-full px-3 py-1 text-xs font-semibold ${zone.is_active ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>
            {zone.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={startEdit} title="Edit" className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:hover:bg-[var(--accent)]/20">Edit</button>
          <ConfirmButton label="Archive" confirmLabel="Archive zone?" onConfirm={archive} title="Archive Zone" className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300" />
        </div>
      </div>
    </div>
  );
}
