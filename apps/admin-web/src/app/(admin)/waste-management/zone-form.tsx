'use client';

import { wasteZoneSchema } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

export function ZoneForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = wasteZoneSchema.safeParse({
      name,
      description: description || undefined,
      isActive: true,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('waste_zones').insert({
      barangay_id: barangayId,
      name: result.data.name,
      description: result.data.description,
      is_active: true,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.showError(`Failed to add zone: ${insertError.message}`);
      return;
    }

    setName('');
    setDescription('');
    toast.showSuccess(`"${result.data.name}" added.`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
      <label className="col-span-4 text-sm sm:col-span-1">
        <span className={labelClass}>Zone Name</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Purok 1, Zone A"
          required
        />
      </label>

      <label className="col-span-4 text-sm sm:col-span-3">
        <span className={labelClass}>Description</span>
        <input
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of zone boundaries or landmarks"
        />
      </label>

      {error ? <p className="col-span-4 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-4">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add Zone'}
        </button>
      </div>
    </form>
  );
}
