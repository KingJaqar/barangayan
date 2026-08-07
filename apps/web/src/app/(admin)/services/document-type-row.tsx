'use client';

import { documentTypeSchema, formatCentavosAsPHP, formatProcessingTime, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type DocumentType = Tables<'document_types'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

/** Deactivating (not deleting) remains the primary "hide from residents" action — keeps
 * historical service_requests referencing this type intact, matching is_active's existing
 * role in the anon RLS policy (0005 migration). Archiving (deleted_at) is a separate,
 * stronger action for rows that shouldn't appear in the admin catalog at all anymore. */
export function DocumentTypeRow({ documentType }: { documentType: DocumentType }) {
  const router = useRouter();
  const toast = useToast();
  const [toggling, setToggling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(documentType.name);
  const [description, setDescription] = useState(documentType.description ?? '');
  const [feePesos, setFeePesos] = useState((documentType.fee_centavos / 100).toFixed(2));
  const [processingHours, setProcessingHours] = useState(String(documentType.processing_target_hours));
  const [requirementsText, setRequirementsText] = useState(documentType.requirements.join('\n'));

  function startEdit() {
    // Reset drafts to the current row values every time edit opens, in case another
    // admin (or this one, in another tab) changed something since the last edit.
    setName(documentType.name);
    setDescription(documentType.description ?? '');
    setFeePesos((documentType.fee_centavos / 100).toFixed(2));
    setProcessingHours(String(documentType.processing_target_hours));
    setRequirementsText(documentType.requirements.join('\n'));
    setError(null);
    setIsEditing(true);
  }

  async function toggleActive() {
    setToggling(true);
    const supabase = createSupabaseBrowserClient();
    const { error: toggleError } = await supabase
      .from('document_types')
      .update({ is_active: !documentType.is_active })
      .eq('id', documentType.id);
    setToggling(false);
    if (toggleError) {
      toast.showError(`Failed to ${documentType.is_active ? 'deactivate' : 'activate'}: ${toggleError.message}`);
      return;
    }
    router.refresh();
  }

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('document_types')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentType.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }
    toast.showSuccess(`"${documentType.name}" archived.`);
    router.refresh();
  }

  async function handleSave(event: React.FormEvent) {
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
      isActive: documentType.is_active,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('document_types')
      .update({
        name: result.data.name,
        description: result.data.description ?? null,
        fee_centavos: result.data.feeCentavos,
        processing_target_hours: result.data.processingTargetHours,
        requirements: result.data.requirements,
      })
      .eq('id', documentType.id);
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
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-[#0F6E5B] bg-white p-4 dark:border-[#0F6E5B] dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-3">
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
              rows={4}
              placeholder={'Valid ID\nCedula (Community Tax Cert)'}
            />
          </label>

          {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
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
            <span className="font-semibold">{documentType.name}</span>
            {!documentType.is_active ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                Inactive
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {documentType.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(documentType.fee_centavos)} ·{' '}
            {formatProcessingTime(documentType.processing_target_hours)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleActive}
            disabled={toggling}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              documentType.is_active
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-[#0F6E5B]/15 text-[#0F6E5B]'
            }`}>
            {documentType.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={startEdit}
            title="Edit"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-[#0F6E5B]/10 hover:text-[#0F6E5B] dark:hover:bg-[#0F6E5B]/20">
            ✏️
          </button>
          <ConfirmButton
            label="🗑"
            confirmLabel="Archive?"
            onConfirm={archive}
            title="Archive"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      </div>

      <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/5">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <span className="font-medium text-zinc-500">Description: </span>
          {documentType.description || 'No description.'}
        </p>

        <div className="mt-2">
          <span className="mb-1 block text-sm font-medium text-zinc-500">Requirements:</span>
          {documentType.requirements.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
              {documentType.requirements.map((req, i) => (
                <li key={`${req}-${i}`}>{req}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">No requirements.</p>
          )}
        </div>
      </div>
    </div>
  );
}
