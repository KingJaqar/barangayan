'use client';

import { catalogContract, charterSections, serviceDocumentTypeSchema, serviceDocumentTypeValues, type ServiceCatalogContract, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type DocumentType = Tables<'document_types'>;
const control = 'mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700';
const kinds = [['general', 'General service'], ['business', 'Business establishment'], ['indigency', 'Indigency / residency'], ['first_time_job_seeker', 'First time job seeker'], ['certified_true_copy', 'Certified true copy']] as const;

function initialCatalog(row?: DocumentType): ServiceCatalogContract {
  if (row?.contract_version === 2) return catalogContract(row)!;
  return {
    serviceKind: 'general',
    charter: { officeDivision: '', classification: 'Simple', transactionType: 'G2C', whoMayAvail: '',
      checklistOfRequirements: row?.requirements.join('\n') ?? '', whereToSecureRequirements: '',
      clientSteps: '', agencyActions: '', feesToBePaid: '', processingTime: '', personResponsible: null },
    purposes: [{ code: 'general', label: 'General request', requiresExplanation: false }],
    requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: false, personalAppearance: false },
    pricingMode: row ? 'fixed' : 'assessment', processingTargetMinutes: row ? row.processing_target_hours * 60 : 15,
  };
}

export function DocumentTypeForm({ barangayId, documentType: row, onSaved, onCancel }: {
  barangayId: string; documentType?: DocumentType; onSaved?: () => void; onCancel?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(row?.name ?? '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [fee, setFee] = useState(String((row?.fee_centavos ?? 0) / 100));
  const [draft, setDraft] = useState(() => initialCatalog(row));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const createId = useRef<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError('');
    const parsed = serviceDocumentTypeSchema.safeParse({ name, description,
      feeCentavos: draft.pricingMode === 'fixed' ? Math.round(Number(fee) * 100) : 0, catalog: draft });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.at(-1);
      const label = charterSections.find(([key]) => key === field)?.[1] ?? ({
        name: 'Name', description: 'Description', feeCentavos: 'Confirmed fee',
        processingTargetMinutes: 'Processing Target (minutes)', label: 'Purpose',
        purposes: 'Purposes', requirementRules: 'Supporting Requirement Rules', pricingMode: 'Pricing',
      } as Record<string, string>)[String(field)] ?? 'Form';
      const message = issue?.code === 'too_small' && issue.type === 'string' ? 'Enter a value.' : issue?.message ?? 'Check your entries.';
      setError(`${label}: ${message}`);
      return;
    }
    inFlight.current = true; setBusy(true);
    try {
      const values = serviceDocumentTypeValues(parsed.data);
      const client = createSupabaseBrowserClient();
      let id = row?.id;
      if (row) {
        const { error: failure } = await client.from('document_types').update(values)
          .eq('id', row.id).eq('barangay_id', barangayId).select('id').single();
        if (failure) throw failure;
      } else {
        createId.current ??= crypto.randomUUID(); id = createId.current;
        const { error: failure } = await client.from('document_types').insert({
          ...values, id, barangay_id: barangayId, is_active: true,
          processing_target_hours: Math.max(1, Math.ceil(draft.processingTargetMinutes / 60)),
        }).select('id').single();
        if (failure) {
          // Reconcile a lost reply by this attempt's UUID without overwriting another entry.
          const { data: saved } = await client.from('document_types').select('*').eq('id', id).maybeSingle();
          if (!saved || saved.contract_version !== 2 || JSON.stringify(serviceDocumentTypeValues({
            name: saved.name, description: saved.description ?? '', feeCentavos: saved.fee_centavos,
            catalog: catalogContract(saved)!,
          })) !== JSON.stringify(values)) throw failure;
        }
      }
      void logAdminAction({ action: row ? 'update' : 'create', entityType: 'document_type',
        entityId: id, entityLabel: values.name, metadata: values }).catch(() => {});
      toast.showSuccess(`"${values.name}" ${row ? 'updated' : 'added'}.`);
      if (!row) { setName(''); setDescription(''); setFee('0'); setDraft(initialCatalog()); createId.current = null; }
      onSaved?.(); router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String((failure as { message?: string }).message ?? failure));
    } finally { inFlight.current = false; setBusy(false); }
  }

  const residency = ['indigency', 'first_time_job_seeker'].includes(draft.serviceKind);
  return <form onSubmit={save} className="space-y-5" aria-busy={busy}>
    <fieldset disabled={busy} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Name<input className={control} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="text-sm">Description<textarea className={control} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
      </div>
      {row && row.contract_version === 1 ? <p className="text-sm text-zinc-500">Complete the charter for future requests. Existing requests keep their recorded fees and previous timing model.</p> : null}
      <label className="block text-sm">Service workflow
        <select className={control} value={draft.serviceKind} disabled={row?.contract_version === 2}
          onChange={e => setDraft({ ...draft, serviceKind: e.target.value as ServiceCatalogContract['serviceKind'],
            pricingMode: 'assessment', requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: false, personalAppearance: draft.requirementRules.personalAppearance } })}>
          {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">Determines the resident form and compatible supporting rules. Existing charter workflows remain fixed.</span>
      </label>
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <legend className="px-1 font-semibold">Citizen’s Charter</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {charterSections.map(([key, label]) => <label key={key} className="text-sm">{label}
            <textarea className={control} rows={['clientSteps', 'agencyActions', 'processingTime'].includes(key) ? 4 : 2}
              required={key !== 'personResponsible'} maxLength={key === 'classification' || key === 'transactionType' ? 200 : 10000}
              value={draft.charter[key] ?? ''}
              onChange={e => setDraft({ ...draft, charter: { ...draft.charter, [key]: key === 'personResponsible' && !e.target.value.trim() ? null : e.target.value } })} />
            {key === 'processingTime' ? <span className="block text-xs text-zinc-500">Procedure durations from the charter; separate from the SLA target.</span> : null}
            {key === 'feesToBePaid' ? <span className="block text-xs text-zinc-500">Published fee guidance; charging rules are configured under Pricing.</span> : null}
            {key === 'checklistOfRequirements' ? <span className="block text-xs text-zinc-500">Requirements displayed to residents. Configure enforced attachment rules below.</span> : null}
            {key === 'personResponsible' ? <span className="block text-xs text-zinc-500">Leave blank when the responsible person is not specified.</span> : null}
          </label>)}
        </div>
      </fieldset>
      <label className="block text-sm">Processing Target (minutes)
        <input className={control} type="number" min={1} max={2147483647} step={1} required value={draft.processingTargetMinutes}
          onChange={e => setDraft({ ...draft, processingTargetMinutes: Number(e.target.value) })} />
        <span className="block text-xs text-zinc-500">Agency processing SLA for future requests; excludes recorded resident waits.</span>
      </label>
      <fieldset className="space-y-3">
        <legend className="font-semibold">Purposes</legend>
        {draft.purposes.map((purpose, index) => <div key={purpose.code} className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm">Purpose {index + 1}<input className={control} required maxLength={200} value={purpose.label}
            onChange={e => setDraft({ ...draft, purposes: draft.purposes.map((p, i) => i === index ? { ...p, label: e.target.value } : p) })} /></label>
          <label className="text-sm"><input type="checkbox" checked={purpose.requiresExplanation}
            onChange={e => setDraft({ ...draft, purposes: draft.purposes.map((p, i) => i === index ? { ...p, requiresExplanation: e.target.checked } : p) })} /> Explanation required</label>
          <button type="button" className="rounded border px-3 py-2 text-sm" aria-label={`Remove purpose ${index + 1}`} disabled={draft.purposes.length === 1}
            onClick={() => setDraft({ ...draft, purposes: draft.purposes.filter((_, i) => i !== index) })}>Remove</button>
        </div>)}
        <button type="button" className="rounded border px-3 py-2 text-sm" disabled={draft.purposes.length >= 30}
          onClick={() => setDraft({ ...draft, purposes: [...draft.purposes, { code: `purpose_${crypto.randomUUID().replaceAll('-', '_')}`, label: '', requiresExplanation: false }] })}>Add purpose</button>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-semibold">Supporting Requirement Rules</legend>
        <p className="text-xs text-zinc-500">Enforced information and attachment rules; separate from the displayed charter checklist.</p>
        {([['dtiRequired', 'DTI attachment required', draft.serviceKind === 'business'],
          ['hoaRequired', 'HOA certification required', residency],
          ['lessorForRenter', 'Lessor endorsement for renters', residency],
          ['personalAppearance', 'Personal appearance required', true]] as const).map(([key, label, applicable]) =>
          <label key={key} className="block text-sm"><input type="checkbox" checked={draft.requirementRules[key]} disabled={!applicable}
            onChange={e => setDraft({ ...draft, requirementRules: { ...draft.requirementRules, [key]: e.target.checked } })} /> {label}
            {!applicable ? <span className="ml-2 text-xs text-zinc-500">(Requires the corresponding service workflow)</span> : null}
          </label>)}
      </fieldset>
      <label className="block text-sm">Pricing<select className={control} value={draft.pricingMode}
        onChange={e => setDraft({ ...draft, pricingMode: e.target.value as ServiceCatalogContract['pricingMode'] })}>
        <option value="assessment">Staff assessment / exemption confirmation</option>
        <option value="fixed">Confirmed fixed fee</option>
        {draft.serviceKind === 'certified_true_copy' ? <option value="per_page">₱10 per confirmed billable page</option> : null}
      </select></label>
      {draft.pricingMode === 'fixed' ? <label className="block text-sm">Confirmed fee (₱)<input className={control} type="number" min={0}
        max={21474836.47} step="0.01" required value={fee} onChange={e => setFee(e.target.value)} /></label> :
        <p className="text-sm text-zinc-500">{draft.pricingMode === 'per_page' ? '₱10 per total confirmed page; staff confirm the billable page count.' :
          'Residents submit before assessment; payment waits for a confirmed amount or explicit waiver.'}</p>}
    </fieldset>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={busy || !barangayId} className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <LoadingButtonContent pending={busy} pendingLabel={row ? 'Saving…' : 'Adding…'}>{row ? 'Save Document Type' : 'Add Document Type'}</LoadingButtonContent>
      </button>
      {onCancel ? <button type="button" disabled={busy} onClick={onCancel} className="rounded border px-4 py-2 text-sm">Cancel</button> : null}
    </div>
  </form>;
}
