'use client';

import { beginAttempt, notify } from '@/lib/notify';

import { catalogContract, charterSections, servicePriceLabel, serviceProcessingLabel, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DocumentTypeForm } from './document-type-form';
import { ContentStatus } from '@/components/admin/content-workspace';
import { ContentEditDialog } from '@/components/admin/content-edit-dialog';
import styles from '@/components/admin/content-workspace.module.css';

type DocumentType = Tables<'document_types'>;
export function ServiceCatalogEditor({ documentType: row }: { documentType: DocumentType }) {
  const catalog = catalogContract(row);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function change(values: { is_active?: boolean; deleted_at?: string }) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    const attempt = beginAttempt('service-catalog');
    try {
      const { error: failure } = await createSupabaseBrowserClient().from('document_types').update(values)
        .eq('id', row.id).eq('barangay_id', row.barangay_id).select('id').single();
      if (failure) throw failure;
      notify.success(values.deleted_at ? 'Service archived.' : values.is_active ? 'Service activated.' : 'Service deactivated.', { id: attempt });
      void logAdminAction({ action: values.deleted_at ? 'delete' : 'status_change', entityType: 'document_type',
        entityId: row.id, entityLabel: row.name, metadata: values }).catch(() => {});
      router.refresh();
    } catch (failure) {
      notify.warning("We couldn't confirm the service change. Refresh before trying again.", { id: attempt });
      setError(failure instanceof Error ? failure.message : String((failure as { message?: string }).message ?? failure));
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <section className={styles.row}>
    <ContentEditDialog open={editing} title="Edit service" context={row.name} wide busy={saving}
      description="Update service details, Citizen’s Charter, requirements, and pricing for future requests."
      onClose={() => setEditing(false)}>
      <DocumentTypeForm key={row.id} barangayId={row.barangay_id} documentType={row} inDialog
        onBusyChange={setSaving} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
    </ContentEditDialog>
    <div className={styles.rowHeader}>
      <h3 className={styles.rowTitle}>{row.name}</h3>
      <ContentStatus active={row.is_active} />
    </div>
    <p className={styles.keyDetails}>
      <span>
      {servicePriceLabel(row)}
      </span><span>{serviceProcessingLabel(row)}</span>
    </p>
    <p className={`${styles.rowDescription} whitespace-pre-wrap`}>{row.description || 'No description.'}</p>
    {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
    <>
      {catalog ? <details className={styles.details}>
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
          <div><dt className="font-medium">Pricing</dt><dd>{servicePriceLabel(row)}</dd></div>
        </dl>
      </details> : <p className="mb-3 text-sm text-zinc-500">Previous catalog format. Edit to complete its charter for future requests.</p>}
      <div className={`${styles.rowActions} mt-4`}>
        <button type="button" disabled={busy} aria-haspopup="dialog" className={styles.primaryAction} onClick={() => {setError('');setEditing(true);}}>Edit service</button>
        <button type="button" disabled={busy} className="rounded-lg border px-4 py-2 text-sm" onClick={() => change({ is_active: !row.is_active })}>
          {busy ? 'Updating…' : row.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <ConfirmButton label="Archive" confirmLabel="Archive?" disabled={busy} className={styles.dangerAction}
          onConfirm={() => change({ deleted_at: new Date().toISOString() })} />
      </div>
    </>
  </section>;
}
