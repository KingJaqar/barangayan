'use client';

import { wasteScheduleSchema, WASTE_TYPES, WASTE_TYPE_CONFIG, DAY_NAMES, type Tables, type WasteType } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type WasteSchedule = Tables<'waste_collection_schedules'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ScheduleRow({ schedule, zoneName }: { schedule: WasteSchedule; zoneName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasteType, setWasteType] = useState(schedule.waste_type);
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule.day_of_week));
  const [startTime, setStartTime] = useState(schedule.start_time);
  const [endTime, setEndTime] = useState(schedule.end_time);
  const [notes, setNotes] = useState(schedule.notes);

  function startEdit() {
    setWasteType(schedule.waste_type);
    setDayOfWeek(String(schedule.day_of_week));
    setStartTime(schedule.start_time);
    setEndTime(schedule.end_time);
    setNotes(schedule.notes);
    setError(null);
    setIsEditing(true);
  }

  async function toggleActive() {
    const supabase = createSupabaseBrowserClient();
    const { error: toggleError } = await supabase
      .from('waste_collection_schedules')
      .update({ is_active: !schedule.is_active })
      .eq('id', schedule.id);
    if (toggleError) {
      toast.showError(`Failed to ${schedule.is_active ? 'deactivate' : 'activate'}: ${toggleError.message}`);
      return;
    }
    toast.showSuccess(`Schedule ${schedule.is_active ? 'deactivated' : 'activated'}.`);
    router.refresh();
  }

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('waste_collection_schedules')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', schedule.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }
    toast.showSuccess('Schedule archived.');
    router.refresh();
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = wasteScheduleSchema.safeParse({
      zoneId: schedule.zone_id,
      wasteType: wasteType as WasteType,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      notes: notes || undefined,
      isActive: schedule.is_active,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('waste_collection_schedules')
      .update({
        waste_type: result.data.wasteType,
        day_of_week: result.data.dayOfWeek,
        start_time: result.data.startTime,
        end_time: result.data.endTime,
        notes: result.data.notes,
      })
      .eq('id', schedule.id);
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      toast.showError(`Failed to save changes: ${updateError.message}`);
      return;
    }

    toast.showSuccess('Schedule updated.');
    setIsEditing(false);
    router.refresh();
  }

  const typeConfig = WASTE_TYPE_CONFIG[schedule.waste_type as keyof typeof WASTE_TYPE_CONFIG];
  const dayName = DAY_NAMES[schedule.day_of_week] ?? 'Unknown';

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="rounded-xl border border-[var(--accent)] bg-white p-3 dark:border-[var(--accent)] dark:bg-zinc-900">
        <div className="grid grid-cols-4 gap-3">
          <label className="text-sm">
            <span className={labelClass}>Waste Type</span>
            <select className={inputClass} value={wasteType} onChange={(e) => setWasteType(e.target.value)}>
              {WASTE_TYPES.map((t) => (
                <option key={t} value={t}>{WASTE_TYPE_CONFIG[t].label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className={labelClass}>Day</span>
            <select className={inputClass} value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className={labelClass}>Start Time</span>
            <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>

          <label className="text-sm">
            <span className={labelClass}>End Time</span>
            <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>

          <label className="col-span-4 text-sm">
            <span className={labelClass}>Notes</span>
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: typeConfig.color + '20', color: typeConfig.color }}>
              {typeConfig.label}
            </span>
            <span className="text-sm font-semibold">{dayName}</span>
            <span className="text-xs text-zinc-500">{schedule.start_time} – {schedule.end_time}</span>
            {!schedule.is_active ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Inactive</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {zoneName} {schedule.notes ? `· ${schedule.notes}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button onClick={toggleActive} className={`rounded-full px-3 py-1 text-xs font-semibold ${schedule.is_active ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>
            {schedule.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={startEdit} title="Edit" className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:hover:bg-[var(--accent)]/20">Edit</button>
          <ConfirmButton label="Archive" confirmLabel="Archive schedule?" onConfirm={archive} title="Archive Schedule" className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300" />
        </div>
      </div>
    </div>
  );
}
