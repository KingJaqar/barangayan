'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatCentavosAsPHP, formatProcessingTime, requestFormSchema, type Tables } from '@barangayan/shared';

type DocumentTypeOption = Pick<
  Tables<'document_types'>,
  'id' | 'name' | 'description' | 'fee_centavos' | 'processing_target_hours' | 'requirements'
>;

export function NewRequestForm({ documentTypes }: { documentTypes: DocumentTypeOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = documentTypes.find((d) => d.id === documentTypeId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = requestFormSchema.safeParse({
      documentTypeId,
      requesterNotes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please select a document type.');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

    const { data: inserted, error: insertErr } = await supabase
      .from('service_requests')
      .insert({
        barangay_id: profile!.barangay_id,
        resident_id: user!.id,
        document_type_id: parsed.data.documentTypeId,
        requester_notes: parsed.data.requesterNotes ?? null,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (insertErr || !inserted) {
      toast.showError(`Failed to submit request: ${insertErr?.message ?? 'Unknown error'}`);
      return;
    }

    toast.showSuccess('Request submitted.');
    router.replace(`/resident/requests/${inserted.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {documentTypes.map((doc) => (
          <button
            type="button"
            key={doc.id}
            onClick={() => setDocumentTypeId(doc.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              documentTypeId === doc.id
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-black/10 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-900'
            }`}>
            <p className="font-semibold">{doc.name}</p>
            {doc.description && <p className="mt-1 text-xs text-zinc-500">{doc.description}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
              <span>{formatCentavosAsPHP(doc.fee_centavos)}</span>
              <span>·</span>
              <span>{formatProcessingTime(doc.processing_target_hours)}</span>
            </div>
          </button>
        ))}
        {documentTypes.length === 0 && (
          <p className="col-span-2 text-sm text-zinc-500">No document types are available right now.</p>
        )}
      </div>

      {selected && selected.requirements.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="mb-1 font-semibold">Requirements</p>
          <ul className="list-inside list-disc">
            {selected.requirements.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="text-sm">
        <span className="mb-1 block font-medium">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Anything the barangay staff should know about this request…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !documentTypeId}
        className="self-start rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {submitting ? 'Submitting…' : 'Submit Request'}
      </button>
    </form>
  );
}
