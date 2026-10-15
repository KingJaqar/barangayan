'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { ContentFormActions } from '@/components/admin/content-create-panel';
import styles from '@/components/admin/content-forms.module.css';

import { wasteScheduleSchema, WASTE_TYPES, WASTE_TYPE_CONFIG, DAY_NAMES, type Tables, type WasteType } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

type WasteZone = Tables<'waste_zones'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ScheduleForm({ barangayId, zones }: { barangayId: string; zones: WasteZone[] }) {
  const router = useRouter();
  const toast = useToast();
  const [zoneId, setZoneId] = useState('');
  const [wasteType, setWasteType] = useState<string>(WASTE_TYPES[0]);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = wasteScheduleSchema.safeParse({
      zoneId,
      wasteType: wasteType as WasteType,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      notes: notes || undefined,
      isActive: true,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: insertError } = await supabase
      .from('waste_collection_schedules')
      .insert({
        barangay_id: barangayId,
        zone_id: result.data.zoneId,
        waste_type: result.data.wasteType,
        day_of_week: result.data.dayOfWeek,
        start_time: result.data.startTime,
        end_time: result.data.endTime,
        notes: result.data.notes,
        is_active: true,
      })
      .select('id')
      .single();
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.showError(`Failed to add schedule: ${insertError.message}`);
      return;
    }

    const zoneName = zones.find((z) => z.id === result.data.zoneId)?.name ?? 'Unknown zone';
    logAdminAction({
      action: 'create',
      entityType: 'waste_schedule',
      entityId: data?.id,
      entityLabel: `${zoneName} — ${DAY_NAMES[result.data.dayOfWeek] ?? 'Unknown'}`,
      metadata: {
        zone: zoneName,
        waste_type: result.data.wasteType,
        day_of_week: DAY_NAMES[result.data.dayOfWeek] ?? result.data.dayOfWeek,
        start_time: result.data.startTime,
        end_time: result.data.endTime,
        notes: result.data.notes ?? null,
      },
    }).catch(() => {});

    setZoneId('');
    setWasteType(WASTE_TYPES[0]);
    setDayOfWeek('1');
    setStartTime('08:00');
    setEndTime('12:00');
    setNotes('');
    toast.showSuccess('Schedule added.');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} grid grid-cols-1 gap-5 sm:grid-cols-2`}>
      <label className="text-sm">
        <span className={labelClass}>Zone</span>
        <AdminSelect kind="zone" className={inputClass} value={zoneId} onValueChange={(nextValue) => setZoneId(nextValue)} required>
          <option value="">Select a zone</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </AdminSelect>
      </label>

      <label className="text-sm">
        <span className={labelClass}>Waste Type</span>
        <AdminSelect kind="waste" className={inputClass} value={wasteType} onValueChange={(nextValue) => setWasteType(nextValue)}>
          {WASTE_TYPES.map((t) => (
            <option key={t} value={t}>{WASTE_TYPE_CONFIG[t].label}</option>
          ))}
        </AdminSelect>
      </label>

      <label className="text-sm">
        <span className={labelClass}>Day</span>
        <AdminSelect kind="date" className={inputClass} value={dayOfWeek} onValueChange={(nextValue) => setDayOfWeek(nextValue)}>
          {DAY_NAMES.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </AdminSelect>
      </label>

      <div className={styles.groupHeading}><h3>Collection window</h3></div>

      <label className="text-sm">
        <span className={labelClass}>Start Time</span>
        <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
      </label>

      <label className="text-sm">
        <span className={labelClass}>End Time</span>
        <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
      </label>

      <label className="sm:col-span-2 text-sm">
        <span className={labelClass}>Notes</span>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional instructions or reminders" />
      </label>

      {error ? <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}

      <ContentFormActions busy={submitting}>
        <button type="submit" disabled={submitting || !barangayId} className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Adding…">Add Schedule</LoadingButtonContent>
        </button>
      </ContentFormActions>
    </form>
  );
}
