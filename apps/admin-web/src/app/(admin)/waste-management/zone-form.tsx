'use client';

import { ContentFormActions } from '@/components/admin/content-create-panel';
import styles from '@/components/admin/content-forms.module.css';

import { wasteZoneSchema } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ZoneForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    const toastAttempt = beginAttempt('handleSubmit');
    try {
      event.preventDefault();
      setError(null);

      const result = wasteZoneSchema.safeParse({
        name,
        description: description || undefined,
        isActive: true,
      });

      if (!result.success) {
        toast.error('Review the highlighted fields before continuing.', { id: toastAttempt });
        setError(result.error.issues[0]?.message ?? 'Invalid input');
        return;
      }

      setSubmitting(true);
      const supabase = createSupabaseBrowserClient();
      const { data, error: insertError } = await supabase
        .from('waste_zones')
        .insert({
          barangay_id: barangayId,
          name: result.data.name,
          description: result.data.description,
          is_active: true,
        })
        .select('id')
        .single();
      setSubmitting(false);

      if (insertError) {
        setError(insertError.message);
        toast.error(`Failed to add zone: ${insertError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'create',
        entityType: 'waste_zone',
        entityId: data?.id,
        entityLabel: result.data.name,
        metadata: { name: result.data.name, description: result.data.description ?? null },
      }).catch(() => {});

      setName('');
      setDescription('');
      toast.success(`"${result.data.name}" added.`, { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} grid grid-cols-1 gap-5 sm:grid-cols-2`}>
      <label className="text-sm">
        <span className={labelClass}>Zone Name</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Purok 1, Zone A"
          required
        />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Description</span>
        <input
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of zone boundaries or landmarks"
        />
      </label>

      {error ? <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}

      <ContentFormActions busy={submitting}>
        <button
          type="submit"
          aria-busy={submitting}
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          <LoadingButtonContent pending={submitting} pendingLabel="Adding…">Add Zone</LoadingButtonContent>
        </button>
      </ContentFormActions>
    </form>
  );
}
