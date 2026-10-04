'use client';

import { catalogContract, charterSections, formatCentavosAsPHP, serviceProcessingLabel, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DocumentTypeForm } from './document-type-form';

type DocumentType = Tables<'document_types'>;
export function ServiceCatalogEditor({ documentType: row }: { documentType: DocumentType }) {
  const catalog = catalogContract(row);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function change(values: { is_active?: boolean; deleted_at?: string }) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const { error: failure } = await createSupabaseBrowserClient().from('document_types').update(values)
        .eq('id', row.id).eq('barangay_id', row.barangay_id).select('id').single();
      if (failure) throw failure;
      void logAdminAction({ action: values.deleted_at ? 'delete' : 'status_change', entityType: 'document_type',
        entityId: row.id, entityLabel: row.name, metadata: values }).catch(() => {});
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String((failure as { message?: string }).message ?? failure));
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
    <h3 className="font-semibold">{row.name} {!row.is_active ? '(Inactive)' : ''}</h3>
    <p className="my-2 text-sm text-zinc-500">
      {catalog?.pricingMode === 'assessment' ? 'Staff assessment required' : catalog?.pricingMode === 'per_page' ? '₱10 per confirmed billable page' : formatCentavosAsPHP(row.fee_centavos)}
      {' · '}{serviceProcessingLabel(row)}
    </p>
    <p className="mb-3 whitespace-pre-wrap text-sm">{row.description || 'No description.'}</p>
    {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
    {editing ? <DocumentTypeForm key={row.id} barangayId={row.barangay_id} documentType={row}
      onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} /> : <>
      {catalog ? <details className="mb-3 text-sm">
        <summary className="cursor-pointer font-medium">View document details</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {charterSections.map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt>
            <dd className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">{catalog.charter[key] ?? 'Not specified'}</dd></div>)}
          <div><dt className="font-medium">Processing Target</dt><dd>{catalog.processingTargetMinutes} minutes</dd></div>
          <div><dt className="font-medium">Purposes</dt><dd>{catalog.purposes.map(p => p.label + (p.requiresExplanation ? ' (explanation required)' : '')).join('; ')}</dd></div>
          <div><dt className="font-medium">Supporting Requirement Rules</dt><dd>{[
            catalog.requirementRules.dtiRequired ? 'DTI attachment' : null, catalog.requirementRules.hoaRequired ? 'HOA certification' : null,
            catalog.requirementRules.lessorForRenter ? 'Lessor endorsement for renters' : null, catalog.requirementRules.personalAppearance ? 'Personal appearance' : null,
          ].filter(Boolean).join('; ') || 'No additional supporting rules'}</dd></div>
          <div><dt className="font-medium">Pricing</dt><dd>{catalog.pricingMode === 'fixed' ? 'Confirmed fixed fee: ' + formatCentavosAsPHP(row.fee_centavos) :
            catalog.pricingMode === 'per_page' ? '₱10 per confirmed billable page' : 'Staff assessment / exemption confirmation'}</dd></div>
        </dl>
      </details> : <p className="mb-3 text-sm text-zinc-500">Previous catalog format. Edit to complete its charter for future requests.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white" onClick={() => {setError('');setEditing(true);}}>Edit Document Type</button>
        <button type="button" disabled={busy} className="rounded-lg border px-4 py-2 text-sm" onClick={() => change({ is_active: !row.is_active })}>
          {busy ? 'Updating…' : row.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <ConfirmButton label="Archive" confirmLabel="Archive?" disabled={busy} className="rounded-lg border px-4 py-2 text-sm"
          onConfirm={() => change({ deleted_at: new Date().toISOString() })} />
      </div>
    </>}
  </section>;
}
