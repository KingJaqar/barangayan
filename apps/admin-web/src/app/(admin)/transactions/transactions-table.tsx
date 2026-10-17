'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';
import { AdminSuggestions } from '@/components/admin/dropdown/admin-suggestions';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';

import { formatCentavosAsPHP, type Tables } from '@barangayan/shared';
import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { TableBrowsePanel } from '@/components/admin/table-browse-panel';
import { TableBrowseControls } from '@/components/admin/table-browse-controls';
import { TablePagination } from '@/components/admin/table-pagination';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { PilotSummary } from '@/components/admin/pilot-summary';
import { usePilotTableBrowse } from '@/hooks/use-pilot-table-browse';
import { pageRange, type BrowseResult, type BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import { directionLabel } from '@/lib/admin-tables/sort-definitions';
import { formatAdminTimestamp } from '@/lib/admin-tables/pilot-config';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableCellConfig, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { Spinner } from '@/components/loading/spinner';
import { formContainerClass, inputClass, readOnlyClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

// Tables<'payments'> already includes document_fee_centavos, paymongo_payment_id,
// refund_status, refund_amount_centavos, refund_reason, refunded_at, refunded_by
// (migration 0064) — no extra fields needed here.
export type Payment = Tables<'payments'> & {
  service_requests:
    | (Pick<Tables<'service_requests'>, 'reference_number' | 'resident_id' | 'document_type_id'> & {
        document_types: Pick<Tables<'document_types'>, 'name'> | null;
        profiles: Pick<Tables<'profiles'>, 'full_name'> | null;
      })
    | null;
  collector: Pick<Tables<'profiles'>, 'full_name'> | null;
};

const METHOD_OPTIONS = [
  { value: 'pickup', label: 'Pay at Pickup' },
  { value: 'qrph', label: 'QR PH' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

interface AdminOption {
  id: string;
  full_name: string;
}
interface ResidentOption {
  id: string;
  full_name: string;
}
interface DocumentTypeOption {
  id: string;
  name: string;
}

interface MatchedRequest {
  id: string;
  barangayId: string;
  residentName: string;
  documentName: string;
}

const LOOKUP_DEBOUNCE_MS = 350;

function AddTransactionForm({
  referenceOptions,
  admins,
  onClose,
  onChanged,
}: {
  referenceOptions: string[];
  admins: AdminOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<'pickup' | 'qrph'>('pickup');
  const [amountPesos, setAmountPesos] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [submitting, setSubmitting] = useState(false);

  // Live reference -> Resident/Document lookup, debounced so it doesn't fire a query on
  // every keystroke. Kept in a ref (not useEffect) so the debounce timer lives entirely
  // inside the onChange handler, matching how this codebase's other event-driven state
  // updates are wired (no set-state-in-effect surprises).
  const [matchedRequest, setMatchedRequest] = useState<MatchedRequest | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupVersion = useRef(0);
  useEffect(() => () => {
    lookupVersion.current++;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
  }, []);

  const [collectedBy, setCollectedBy] = useState('');
  const [sourceId, setSourceId] = useState('');

  function scheduleLookup(value: string) {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const version = ++lookupVersion.current;
    setMatchedRequest(null);
    const trimmed = value.trim().replace(/^#/, '');

    if (!trimmed) {
      setMatchedRequest(null);
      setLookupState('idle');
      return;
    }

    setLookupState('loading');
    lookupTimer.current = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, barangay_id, profiles!service_requests_resident_id_fkey(full_name), document_types(name)')
        .eq('reference_number', trimmed)
        .is('deleted_at', null)
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000))
        .maybeSingle();

      if (version !== lookupVersion.current) return;
      if (error || !data) {
        setMatchedRequest(null);
        setLookupState(error ? 'error' : 'not_found');
        return;
      }

      setMatchedRequest({
        id: data.id,
        barangayId: data.barangay_id,
        residentName: data.profiles?.full_name ?? '—',
        documentName: data.document_types?.name ?? '—',
      });
      setLookupState('found');
    }, LOOKUP_DEBOUNCE_MS);
  }

  function handleReferenceChange(value: string) {
    setReference(value);
    scheduleLookup(value);
  }

  function resetForm() {
    lookupVersion.current++;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setReference('');
    setAmountPesos('');
    setStatus('pending');
    setMethod('pickup');
    setMatchedRequest(null);
    setLookupState('idle');
    setCollectedBy('');
    setSourceId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchedRequest) {
      toast.showError('Select a valid request reference first.');
      return;
    }
    const pesos = Number(amountPesos);
    if (!amountPesos || Number.isNaN(pesos) || pesos < 0) {
      toast.showError('Amount must be a number of 0 or more.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    let resolvedCollectedBy: string | null = method === 'pickup' ? collectedBy || null : null;
    if (method === 'pickup' && !resolvedCollectedBy && status === 'paid') {
      // No admin explicitly picked but this is being recorded as already paid — default
      // to whoever's entering it, same fallback the row-level "Mark Payment Collected"
      // action already uses.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedCollectedBy = user?.id ?? null;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('payments')
      .insert({
        service_request_id: matchedRequest.id,
        barangay_id: matchedRequest.barangayId,
        method,
        amount_centavos: Math.round(pesos * 100),
        status,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        collected_by: resolvedCollectedBy,
        paymongo_source_id: method === 'qrph' ? sourceId.trim() || null : null,
      })
      .select('id')
      .single();

    setSubmitting(false);
    if (insertError || !inserted) {
      toast.showError(`Failed to add transaction: ${insertError?.message ?? 'No transaction was created.'}`);
      return;
    }

    logAdminAction({
      action: 'create',
      entityType: 'payment',
      entityId: inserted?.id,
      entityLabel: `#${reference.trim().replace(/^#/, '')} — ${matchedRequest.residentName}`,
      metadata: {
        reference_number: reference.trim().replace(/^#/, ''),
        resident: matchedRequest.residentName,
        method,
        amount_centavos: Math.round(pesos * 100),
        status,
      },
    }).catch(() => {});

    toast.showSuccess('Transaction added.');
    resetForm();
    onClose();
    onChanged();
  }

  const residentDisplay =
    lookupState === 'loading' ? 'Looking up…' : lookupState === 'error' ? 'Lookup failed — type the reference again to retry' : lookupState === 'not_found' ? 'No matching request' : (matchedRequest?.residentName ?? '');
  const documentDisplay =
    lookupState === 'loading' ? 'Looking up…' : lookupState === 'error' ? 'Lookup failed — type the reference again to retry' : lookupState === 'not_found' ? 'No matching request' : (matchedRequest?.documentName ?? '');

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-2 sm:grid-cols-4`}
    >
      <label className="col-span-2 text-sm sm:col-span-1">
        <span className="mb-1 block font-medium">Request Reference</span>
        <AdminSuggestions
          className={inputClass}
          value={reference}
          onValueChange={handleReferenceChange}
          placeholder="REQ-2026-00001"
          options={referenceOptions}
          aria-label="Request Reference"
          required
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">
          Resident
          {lookupState === 'loading' ? (
            <span role="status" aria-live="polite" aria-atomic="true" className="ml-2 inline-flex items-center align-middle">
              <Spinner size="compact" />
              <span className="sr-only">Looking up request</span>
            </span>
          ) : null}
        </span>
        <input
          className={readOnlyClass}
          value={residentDisplay}
          readOnly
          aria-busy={lookupState === 'loading'}
          placeholder="Auto-filled from reference"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Document</span>
        <input
          className={readOnlyClass}
          value={documentDisplay}
          readOnly
          aria-busy={lookupState === 'loading'}
          placeholder="Auto-filled from reference"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Method</span>
        <AdminSelect kind="payment" className={inputClass} value={method} onValueChange={(nextValue) => setMethod(nextValue as 'pickup' | 'qrph')}>
          {METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Amount (₱)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className={inputClass}
          value={amountPesos}
          onChange={(e) => setAmountPesos(e.target.value)}
          required
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <AdminSelect kind="status" className={inputClass} value={status} onValueChange={(nextValue) => setStatus(nextValue as 'pending' | 'paid')}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </AdminSelect>
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">{method === 'pickup' ? 'Collected By' : 'Source (PayMongo)'}</span>
        {method === 'pickup' ? (
          <AdminSelect kind="people" className={inputClass} value={collectedBy} onValueChange={(nextValue) => setCollectedBy(nextValue)}>
            <option value="">— Not yet collected —</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </AdminSelect>
        ) : (
          <input
            className={inputClass}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            placeholder="src_xxxxxxxxxxxx (optional)"
          />
        )}
      </label>

      <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={submitting}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Adding…">Add Transaction</LoadingButtonContent>
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            onClose();
          }}
          className={cancelButtonClass}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TransactionsTable({
  result, summary, requestedState, optionsError, barangayId, referenceOptions, admins, residents, documentTypes,
}: {
  result: QueryOutcome<BrowseResult<Payment>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  optionsError: string | null; barangayId: string; referenceOptions: string[]; admins: AdminOption[]; residents: ResidentOption[]; documentTypes: DocumentTypeOption[];
}) {

  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const browse = usePilotTableBrowse('transactions', requestedState, result);
  const { state, value } = browse;
  const activeSort = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const range = value ? pageRange(value.total, state.page, state.pageSize) : null;

  async function updateField(payment: Payment, patch: Partial<Tables<'payments'>>) {
    // Skip the log (but still persist) if nothing in the patch actually differs from the
    // row's current value — avoids a bell notification for a cell that's clicked into and
    // blurred without an edit.
    const before: Record<string, unknown> = {};
    let changed = false;
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      before[key] = payment[key];
      if (payment[key] !== patch[key]) changed = true;
    }

    if (!changed) return { error: null, row: payment };

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase.from('payments').update(patch).eq('id', payment.id).select('*').maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No transaction was updated. Check that you still have access to this barangay.' };

    logAdminAction({
      action: patch.status ? 'status_change' : 'update',
      entityType: 'payment',
      entityId: updated.id,
      entityLabel: `#${payment.service_requests?.reference_number ?? '—'}`,
      changes: { before, after: patch },
    }).catch(() => {});
    browse.refresh();
    return { error: null, row: updated };
  }

  /** Resident/Document aren't columns on payments — they're read off the linked
   * service_request via the join. "Editing" them means correcting that request's own
   * resident_id/document_type_id (the same request this payment already points to),
   * distinct from the Reference cell's edit which reassigns to a *different* request. */
  async function updateLinkedRequest(
    payment: Payment,
    patch: Partial<Tables<'service_requests'>>,
  ): Promise<{ error: string | null; row?: unknown }> {
    if (!payment.service_request_id) return { error: 'This transaction has no linked request.' };

    const before: Record<string, unknown> = {};
    let changed = false;
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      const currentValue =
        key === 'resident_id'
          ? payment.service_requests?.resident_id
          : key === 'document_type_id'
            ? payment.service_requests?.document_type_id
            : undefined;
      before[key] = currentValue;
      if (currentValue !== patch[key]) changed = true;
    }

    const supabase = createSupabaseBrowserClient();
    if (!changed) return { error: null, row: payment.service_requests };

    const { data: updated, error } = await supabase
      .from('service_requests')
      .update(patch)
      .eq('id', payment.service_request_id)
      .select('id, resident_id, document_type_id')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No linked request was updated. Check that you still have access to this barangay.' };

    logAdminAction({
      action: 'update',
      entityType: 'service_request',
      entityId: updated.id,
      entityLabel: payment.service_requests?.reference_number,
      changes: { before, after: patch },
    }).catch(() => {});

    browse.refresh();
    return { error: null, row: updated };
  }

  /** Reassigns a payment to a different service_request by looking up its reference
   * number, mirroring AddTransactionForm's own lookup — Resident/Document are derived
   * (joined) columns, so this is what "editing" them actually means. Persists and logs
   * directly (rather than delegating to updateField) so the audit entry can carry the
   * old + new reference numbers instead of updateField's generic before/after patch. */
  async function reassignReference(payment: Payment, referenceInput: string): Promise<{ error: string | null; row?: unknown }> {
    const next = referenceInput.trim().replace(/^#/, '');
    if (!next) return { error: 'Reference number cannot be empty.' };

    const previousReference = payment.service_requests?.reference_number ?? null;
    if (next === previousReference) return { error: null };

    const supabase = createSupabaseBrowserClient();
    const { data: request, error: lookupError } = await supabase
      .from('service_requests')
      .select('id, barangay_id')
      .eq('reference_number', next)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };
    if (!request) return { error: `Request "${next}" not found.` };

    const { data: updated, error } = await supabase
      .from('payments')
      .update({ service_request_id: request.id, barangay_id: request.barangay_id })
      .eq('id', payment.id)
      .select('id, service_request_id, barangay_id')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No transaction was updated. Check that you still have access to this barangay.' };

    logAdminAction({
      action: 'update',
      entityType: 'payment',
      entityId: updated.id,
      entityLabel: `#${previousReference ?? '—'} → #${next}`,
      metadata: { previousReference, newReference: next },
    }).catch(() => {});

    browse.refresh();
    return { error: null, row: updated };
  }

  // Full-amount only (no partial refunds) — see the refund-payment Edge Function.
  // Refunds settle asynchronously on PayMongo's side, so this only submits the request;
  // refund_status moves from 'pending' to 'refunded'/'failed' once the paymongo-webhook
  // function's refund.updated handler confirms it.
  async function refund(payment: Payment) {
    if (!await browse.settle()) return;
    const supabase = createSupabaseBrowserClient();
    const { data: refundResult, error } = await supabase.functions.invoke<{ paymentId: string; status: string }>('refund-payment', {
      body: { paymentId: payment.id, reason: 'requested_by_customer' },
    });
    if (error) {
      const context = (error as { context?: unknown }).context;
      const details = context instanceof Response ? await context.clone().json().catch(() => null) : null;
      toast.showError(`Failed to submit refund: ${typeof details?.error === 'string' ? details.error : error.message}`);
      browse.refresh();
      return;
    }

    const { data: updated, error: refreshError } = await supabase
      .from('payments')
      .select('id, refund_status, refund_amount_centavos, refund_reason, refund_transfer_link, refunded_by')
      .eq('id', refundResult?.paymentId ?? payment.id)
      .maybeSingle();
    if (refreshError || !updated || (refundResult?.status && updated.refund_status !== refundResult.status)) {
      toast.showError(`Refund was submitted but the changed transaction could not be confirmed: ${refreshError?.message ?? 'no transaction was returned'}`);
      return;
    }

    logAdminAction({
      action: 'status_change',
      entityType: 'payment',
      entityId: updated.id,
      entityLabel: `#${payment.service_requests?.reference_number ?? '—'}`,
      changes: { before: { status: payment.status }, after: { status: 'refund_requested' } },
      metadata: { reason: 'requested_by_customer' },
    }).catch(() => {});

    toast.showSuccess('Refund submitted to PayMongo — status will update once confirmed.');
    browse.refresh();
  }

  function refundAction(payment: Payment) {
    if (payment.method !== 'qrph' || payment.status !== 'paid'
      || ['refunded', 'pending', 'processing', 'refunding'].includes(payment.refund_status ?? '')) return null;
    const retry = payment.refund_status === 'failed';
    return <ConfirmButton label={<><RotateCcw size={16} aria-hidden="true" />{retry ? 'Retry Refund' : 'Refund Payment'}</>}
      confirmLabel={retry ? 'Retry refund?' : 'Refund full amount?'} onConfirm={() => refund(payment)}
      disabled={!payment.paymongo_payment_id || payment.amount_centavos < 100}
      title={!payment.paymongo_payment_id ? 'Waiting for PayMongo payment confirmation before a refund can be issued.' : payment.amount_centavos < 100 ? 'The minimum refundable payment is PHP 1.00.' : retry ? 'Retry this payment refund' : 'Refund this payment'} ariaLabel={retry ? 'Retry Refund' : 'Refund Payment'}
      className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-950 dark:text-red-200" />;
  }

  const lifecycle = useRecordWorkspace<Payment>('transactions', browse.refresh, browse.settle, { editHandle: browse.editHandle,
    actionsMinWidth: 360, workflowActions: refundAction,
  });

  const columns: EditableDataTableColumn<Payment>[] = [
    {
      id: 'created',
      header: 'Date created',
      initialWidth: 148,
      minWidth: 138,
      wrap: 'nowrap',
      render: (p) => <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{formatAdminTimestamp(p.created_at)}</span>,
      edit: {
        type: 'datetime',
        getValue: (p) => p.created_at,
        onSave: (p, value) => updateField(p, { created_at: String(value) }),
      },
    },
    {
      id: 'reference',
      header: 'Reference',
      initialWidth: 160,
      minWidth: 148,
      wrap: 'nowrap',
      render: (p) => <span className="font-mono text-xs font-medium tabular-nums">#{p.service_requests?.reference_number ?? '—'}</span>,
      edit: {
        type: 'text',
        getValue: (p) => p.service_requests?.reference_number ?? '',
        onSave: (p, value) => reassignReference(p, String(value)),
      },
    },
    {
      id: 'resident',
      header: 'Resident', frozen: true,
      initialWidth: 190,
      minWidth: 160,
      wrap: 'break-word',
      render: (p) => p.service_requests?.profiles?.full_name ?? '—',
      edit: {
        canEdit: () => !optionsError,
        type: 'select', selectKind: 'people',
        options: residents.map((r) => ({ value: r.id, label: r.full_name })),
        getValue: (p) => p.service_requests?.resident_id ?? '',
        onSave: (p, value) => updateLinkedRequest(p, { resident_id: String(value) }),
      },
    },
    {
      id: 'document',
      header: 'Document',
      initialWidth: 190,
      minWidth: 160,
      wrap: 'break-word',
      render: (p) => p.service_requests?.document_types?.name ?? '—',
      edit: {
        canEdit: () => !optionsError,
        type: 'select', selectKind: 'document',
        options: documentTypes.map((d) => ({ value: d.id, label: d.name })),
        getValue: (p) => p.service_requests?.document_type_id ?? '',
        onSave: (p, value) => updateLinkedRequest(p, { document_type_id: String(value) }),
      },
    },
    {
      id: 'method',
      header: 'Method',
      initialWidth: 126,
      minWidth: 116,
      wrap: 'nowrap',
      render: (p) => (p.method === 'qrph' ? 'QR PH' : 'Pay at Pickup'),
      edit: {
        type: 'select', selectKind: 'payment',
        options: METHOD_OPTIONS,
        getValue: (p) => p.method,
        onSave: (p, value) => updateField(p, { method: String(value) }),
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      initialWidth: 118,
      minWidth: 108,
      wrap: 'nowrap',
      render: (p) => <span className="font-medium tabular-nums">{formatCentavosAsPHP(p.amount_centavos)}</span>,
      edit: {
        type: 'number',
        getValue: (p) => (p.amount_centavos / 100).toFixed(2),
        // Locked once paid — amount shouldn't drift after settlement, matches the
        // ledger's audit intent (see the Phase 1 plan's Transactions section).
        canEdit: (p) => p.status !== 'paid',
        onSave: (p, value) => {
          const pesos = Number(value);
          if (Number.isNaN(pesos) || pesos < 0) return Promise.resolve({ error: 'Amount must be a number of 0 or more.' });
          return updateField(p, { amount_centavos: Math.round(pesos * 100) });
        },
      },
    },
    {
      id: 'status',
      header: 'Status',
      initialWidth: 136,
      minWidth: 128,
      wrap: 'nowrap',
      render: (p) => <StatusPill status={p.status} />,
      edit: {
        type: 'select', selectKind: 'status',
        options: STATUS_OPTIONS,
        getValue: (p) => p.status,
        onSave: (p, value) =>
          updateField(p, {
            status: String(value),
            paid_at: value === 'paid' ? new Date().toISOString() : p.paid_at,
          }),
        commitOnChange: true,
      },
    },
    {
      id: 'collector',
      header: 'Collected By / Source',
      initialWidth: 208,
      minWidth: 180,
      wrap: 'break-word',
      render: (p) => (p.method === 'pickup' ? (p.collector?.full_name ?? '—') : (p.paymongo_source_id ?? '—')),
      // Pickup rows need a select of admins (writes collected_by); QR PH rows need a free-text
      // PayMongo source id (writes paymongo_source_id) — genuinely different controls per row.
      edit: (p): EditableCellConfig<Payment> | undefined =>
        optionsError && p.method === 'pickup' ? undefined : p.method === 'pickup'
          ? {
              type: 'select', selectKind: 'people',
              options: admins.map((a) => ({ value: a.id, label: a.full_name })),
              getValue: () => p.collected_by ?? '',
              onSave: (row, value) => updateField(row, { collected_by: String(value) || null }),
            }
          : {
              type: 'text',
              getValue: () => p.paymongo_source_id ?? '',
              onSave: (row, value) => updateField(row, { paymongo_source_id: String(value) || null }),
            },
    },
    {
      id: 'refund',
      header: 'Refund',
      initialWidth: 148,
      minWidth: 132,
      wrap: 'nowrap',
      overflow: 'visible',
      render: (p) => {
        // A QRPH refund isn't credited automatically — the resident has to open the
        // transfer link to claim it (valid ~3 days), so surface it wherever one exists.
        const claimLink = p.refund_transfer_link ? (
          <a
            href={p.refund_transfer_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[var(--accent)] underline"
          >
            Claim link
          </a>
        ) : null;

        if (p.method !== 'qrph' || (p.status !== 'paid' && p.status !== 'refunded')) return '—';
        if (p.refund_status === 'refunded') {
          return (
            <div className="flex items-center gap-2">
              <StatusPill status="refunded" />
              {claimLink}
            </div>
          );
        }
        if (p.refund_status === 'pending' || p.refund_status === 'processing' || p.refund_status === 'refunding') {
          return (
            <div className="flex items-center gap-2">
              <StatusPill status="pending" />
              {claimLink}
            </div>
          );
        }
        if (p.refund_status === 'failed') {
          return (
            <div className="flex items-center gap-2">
              <StatusPill status="failed" />
              {claimLink}
            </div>
          );
        }
        return claimLink ?? '—';
      },
    },
    lifecycle.column,
  ];

  return <>
    <RecordArchiveLink name="transactions" beforeOpen={browse.settle} />
    <PilotSummary name="transactions" summary={summary} onRetry={browse.refresh} />
    {optionsError && <div role="alert" className="mb-4 rounded-xl border p-4">{optionsError} <button type="button" onClick={browse.refresh}>Retry options</button></div>}
    {addOpen && <fieldset disabled={!!optionsError || browse.pending}><AddTransactionForm referenceOptions={referenceOptions} admins={admins} onClose={() => setAddOpen(false)} onChanged={browse.refresh} /></fieldset>}
    <TableBrowsePanel label="Transactions" pending={browse.pending} error={browse.error} onRetry={browse.refresh}
      queryIdentity={value?.queryIdentity}
      announcement={value && range ? activeSort.label + ', ' + directionLabel(activeSort, state.dir) + '; Showing ' + range.start + '–' + range.end + ' of ' + value.total : undefined}
      controls={<TableBrowseControls state={state} sorts={browse.config.sorts} searchDraft={browse.searchDraft}
        onSearchChange={browse.changeSearch} onChange={change => void browse.commit(change)}
        category={<div className="table-browse-field"><label htmlFor="transactions-method">Method</label>
          <AdminSelect kind="payment" id="transactions-method" value={state.filters.method} onValueChange={nextValue => void browse.commit({ filters: { method: nextValue } })}>
            <option value="">All Methods</option>
            {METHOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </AdminSelect></div>}
        filters={<SegmentedFilter label="Payment status" value={state.filters.tab} options={TABS.map(tab => ({ value: tab.key, label: tab.label }))}
          onChange={tab => void browse.commit({ filters: { tab } })} />}
        actions={!addOpen && <button type="button" disabled={!barangayId || !!optionsError || browse.pending}
          onClick={() => void browse.settle().then(saved => { if (saved) setAddOpen(true); })}>+ Add Transaction</button>} />}
      pagination={value && <TablePagination total={value.total} page={state.page} pageSize={state.pageSize} pending={browse.pending}
        onPageChange={page => void browse.commit({ page })} onPageSizeChange={pageSize => void browse.commit({ pageSize })} />}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} rowKey={row => row.id} columns={columns}
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: browse.config.sorts, onChange: (sort, dir) => void browse.commit({ sort, dir }) }}
        emptyLabel={browse.pending ? 'Updating results…' : 'No transactions in this view.'}
        resizableColumns density="compact" tableMinWidth={1650} cellOverflow="hidden" />
    </TableBrowsePanel>
    {lifecycle.view}
  </>;
}
