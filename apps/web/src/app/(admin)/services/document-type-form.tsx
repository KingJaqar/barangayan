'use client';

import { documentTypeSchema } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function DocumentTypeForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [feePesos, setFeePesos] = useState('0');
  const [processingHours, setProcessingHours] = useState('24');
  const [requirementsText, setRequirementsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const requirements = requirementsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const result = documentTypeSchema.safeParse({
      name,
      description: description || undefined,
      feeCentavos: Math.round(Number(feePesos) * 100),
      processingTargetHours: Number(processingHours),
      requirements,
      isActive: true,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('document_types').insert({
      barangay_id: barangayId,
      name: result.data.name,
      description: result.data.description ?? null,
      fee_centavos: result.data.feeCentavos,
      processing_target_hours: result.data.processingTargetHours,
      requirements: result.data.requirements,
      is_active: true,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.showError(`Failed to add document type: ${insertError.message}`);
      return;
    }

    setName('');
    setDescription('');
    setFeePesos('0');
    setProcessingHours('24');
    setRequirementsText('');
    toast.showSuccess(`"${result.data.name}" added.`);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Fee (₱)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className={inputClass}
          value={feePesos}
          onChange={(e) => setFeePesos(e.target.value)}
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Processing Time (hours)</span>
        <input
          type="number"
          min="1"
          className={inputClass}
          value={processingHours}
          onChange={(e) => setProcessingHours(e.target.value)}
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Requirements (one per line)</span>
        <textarea
          className={inputClass}
          value={requirementsText}
          onChange={(e) => setRequirementsText(e.target.value)}
          rows={3}
          placeholder={'Valid ID\nCedula (Community Tax Cert)'}
        />
      </label>

      {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add Document Type'}
        </button>
      </div>
    </form>
  );
}
