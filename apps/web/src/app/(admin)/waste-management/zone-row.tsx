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
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

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
      <form onSubmit={handleSave} className="rounded-xl border border-[#0F6E5B] bg-white p-4 dark:border-[#0F6E5B] dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Zone Name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </label>

          {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-2 flex items-center gap-2">
            <button type="submit" disabled={submitting} className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} disabled={submitting} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{zone.name}</span>
            {!zone.is_active ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Inactive</span>
            ) : null}
          </div>
          {zone.description && <p className="mt-0.5 text-xs text-zinc-500">{zone.description}</p>}
          {schedules.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} assigned
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={toggleActive} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${zone.is_active ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-[#0F6E5B]/15 text-[#0F6E5B]'}`}>
            {zone.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={startEdit} title="Edit" className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-[#0F6E5B]/10 hover:text-[#0F6E5B] dark:hover:bg-[#0F6E5B]/20">Edit</button>
          <ConfirmButton label="Archive" confirmLabel="Archive zone?" onConfirm={archive} title="Archive Zone" className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300" />
        </div>
      </div>
    </div>
  );
}
