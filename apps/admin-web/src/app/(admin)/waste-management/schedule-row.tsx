'use client';

import { ContentEditDialog } from '@/components/admin/content-edit-dialog';
import editStyles from '@/components/admin/content-edit-dialog.module.css';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import styles from '@/components/admin/content-workspace.module.css';

import { wasteScheduleSchema, WASTE_TYPES, WASTE_TYPE_CONFIG, DAY_NAMES, type Tables, type WasteType } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

type WasteSchedule = Tables<'waste_collection_schedules'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ScheduleRow({ schedule, zoneName }: { schedule: WasteSchedule; zoneName: string }) {
  const router = useRouter();
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
    const toastAttempt = beginAttempt('toggleActive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: toggleError } = await supabase
        .from('waste_collection_schedules')
        .update({ is_active: !schedule.is_active })
        .eq('id', schedule.id);
      if (toggleError) {
        toast.error(`Failed to ${schedule.is_active ? 'deactivate' : 'activate'}: ${toggleError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'status_change',
        entityType: 'waste_schedule',
        entityId: schedule.id,
        entityLabel: `${zoneName} — ${DAY_NAMES[schedule.day_of_week] ?? 'Unknown'}`,
        changes: { before: { is_active: schedule.is_active }, after: { is_active: !schedule.is_active } },
      }).catch(() => {});

      toast.success(`Schedule ${schedule.is_active ? 'deactivated' : 'activated'}.`, { id: toastAttempt });
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
        .from('waste_collection_schedules')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', schedule.id);
      if (archiveError) {
        toast.error(`Failed to archive: ${archiveError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'delete',
        entityType: 'waste_schedule',
        entityId: schedule.id,
        entityLabel: `${zoneName} — ${DAY_NAMES[schedule.day_of_week] ?? 'Unknown'}`,
        metadata: {
          zone: zoneName,
          waste_type: schedule.waste_type,
          day_of_week: DAY_NAMES[schedule.day_of_week] ?? schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
        },
      }).catch(() => {});

      toast.success('Schedule archived.', { id: toastAttempt });
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
        toast.error('Review the highlighted fields before continuing.', { id: toastAttempt });
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
        toast.error(`Failed to save changes: ${updateError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'update',
        entityType: 'waste_schedule',
        entityId: schedule.id,
        entityLabel: `${zoneName} — ${DAY_NAMES[result.data.dayOfWeek] ?? 'Unknown'}`,
        changes: {
          before: {
            waste_type: schedule.waste_type,
            day_of_week: schedule.day_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            notes: schedule.notes,
          },
          after: {
            waste_type: result.data.wasteType,
            day_of_week: result.data.dayOfWeek,
            start_time: result.data.startTime,
            end_time: result.data.endTime,
            notes: result.data.notes,
          },
        },
      }).catch(() => {});

      toast.success('Schedule updated.', { id: toastAttempt });
      setIsEditing(false);
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  const typeConfig = WASTE_TYPE_CONFIG[schedule.waste_type as keyof typeof WASTE_TYPE_CONFIG];
  const dayName = DAY_NAMES[schedule.day_of_week] ?? 'Unknown';

  return (
    <>
    <ContentEditDialog open={isEditing} title="Edit collection schedule" context={`${zoneName} · ${dayName}`}
      description="Set the waste type, collection day, and pickup window for this zone." busy={submitting} onClose={() => setIsEditing(false)}>
      <form onSubmit={handleSave} className={editStyles.form} aria-busy={submitting}>
        <div className={editStyles.fields} data-edit-scroll>
        <fieldset disabled={submitting}>
          <div className={editStyles.grid}>
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

            <label className="text-sm">
              <span className={labelClass}>Start Time</span>
              <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>

            <label className="text-sm">
              <span className={labelClass}>End Time</span>
              <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </label>

            <label className={editStyles.full}>
              <span className={labelClass}>Notes</span>
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            {error ? <p role="alert" className={`${editStyles.full} ${editStyles.error}`}>{error}</p> : null}

          </div>
        </fieldset>
        </div>
        <div className={editStyles.actions}>
          <button type="button" onClick={() => setIsEditing(false)} disabled={submitting} >
            Cancel
          </button>
          <button type="submit" disabled={submitting}
          aria-busy={submitting}>
            <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
          </button>
        </div>
      </form>
    </ContentEditDialog>
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <div className={styles.rowMain}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={styles.badge}>
              <span className={styles.categoryDot} style={{ backgroundColor: typeConfig.color }} aria-hidden="true" />
              {typeConfig.label}
            </span>
            <h3 className={styles.rowTitle}>{dayName}</h3>
            <span className="text-xs text-zinc-500">{schedule.start_time} – {schedule.end_time}</span>
            {!schedule.is_active ? (
              <span className={styles.badge}>Inactive</span>
            ) : null}
          </div>
          <p className={styles.rowMeta}>
            {zoneName} {schedule.notes ? `· ${schedule.notes}` : ''}
          </p>
        </div>

        <div className={styles.rowActions}>
          <button onClick={toggleActive} className={`rounded-full px-3 py-1 text-xs font-semibold ${schedule.is_active ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>
            {schedule.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={startEdit} aria-haspopup="dialog" title="Edit" className={styles.primaryAction}>Edit</button>
          <ConfirmButton label="Archive" confirmLabel="Archive schedule?" onConfirm={archive} title="Archive Schedule" className={styles.dangerAction} />
        </div>
      </div>
    </div>
    </>
  );
}
