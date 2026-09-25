'use client';

import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableCellConfig, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { TABS, type Tab } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { Spinner } from '@/components/loading/spinner';

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
}: {
  referenceOptions: string[];
  admins: AdminOption[];
  onClose: () => void;
}) {
  const router = useRouter();
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
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collectedBy, setCollectedBy] = useState('');
  const [sourceId, setSourceId] = useState('');

  function scheduleLookup(value: string) {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
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
        .select('id, barangay_id, profiles(full_name), document_types(name)')
        .eq('reference_number', trimmed)
        .is('deleted_at', null)
        .maybeSingle();

      if (error || !data) {
        setMatchedRequest(null);
        setLookupState('not_found');
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
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
  const readOnlyClass =
    'w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400';

  const residentDisplay =
    lookupState === 'loading' ? 'Looking up…' : lookupState === 'not_found' ? 'No matching request' : (matchedRequest?.residentName ?? '');
  const documentDisplay =
    lookupState === 'loading' ? 'Looking up…' : lookupState === 'not_found' ? 'No matching request' : (matchedRequest?.documentName ?? '');

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-4"
    >
      <label className="col-span-2 text-sm sm:col-span-1">
        <span className="mb-1 block font-medium">Request Reference</span>
        <input
          className={inputClass}
          value={reference}
          onChange={(e) => handleReferenceChange(e.target.value)}
          placeholder="REQ-2026-00001"
          list="transaction-reference-options"
          required
        />
        <datalist id="transaction-reference-options">
          {referenceOptions.map((ref) => (
            <option key={ref} value={ref} />
          ))}
        </datalist>
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
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as 'pickup' | 'qrph')}>
          {METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'paid')}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">{method === 'pickup' ? 'Collected By' : 'Source (PayMongo)'}</span>
        {method === 'pickup' ? (
          <select className={inputClass} value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)}>
            <option value="">— Not yet collected —</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
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
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Adding…">Add Transaction</LoadingButtonContent>
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TransactionsTable({
  payments,
  barangayId,
  referenceOptions,
  admins,
  residents,
  documentTypes,
  tab,
  method,
  q,
}: {
  payments: Payment[];
  barangayId: string;
  referenceOptions: string[];
  admins: AdminOption[];
  residents: ResidentOption[];
  documentTypes: DocumentTypeOption[];
  tab: Tab;
  method: string;
  q: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('desc');
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState(q);

  // Re-sync the box with the URL when the server sends a different `q` (back/forward, or a
  // navigation from elsewhere). Adjusting state during render is React's recommended way to
  // do this — an effect would render the stale value first, then immediately render again.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setSearchText(q);
  }

  // Keep the latest tab/method around for the debounced search effect below, without making
  // that effect re-fire (and re-push a redundant URL) whenever tab/method change on their
  // own — those already navigate immediately through their own handlers.
  const tabRef = useRef(tab);
  const methodRef = useRef(method);
  useEffect(() => {
    tabRef.current = tab;
    methodRef.current = method;
  }, [tab, method]);

  function navigate(next: { tab?: string; method?: string; q?: string }) {
    const nextQ = next.q ?? q;
    const nextMethod = next.method ?? method;
    const params = new URLSearchParams({
      tab: next.tab ?? tab,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextMethod ? { method: nextMethod } : {}),
    });
    router.push(`/transactions?${params.toString()}`);
  }

  // Real-time search: push the URL (and let the server re-filter) a short moment after the
  // user stops typing, instead of waiting for a submit click.
  useEffect(() => {
    if (searchText === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        tab: tabRef.current,
        ...(searchText ? { q: searchText } : {}),
        ...(methodRef.current ? { method: methodRef.current } : {}),
      });
      router.push(`/transactions?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const sortedPayments = [...payments].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateOrder === 'asc' ? diff : -diff;
  });

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
    router.refresh();
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

    router.refresh();
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

    router.refresh();
    return { error: null, row: updated };
  }

  async function archive(payment: Payment) {
    const supabase = createSupabaseBrowserClient();
    const { data: archived, error } = await supabase
      .from('payments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', payment.id)
      .select('id, deleted_at')
      .maybeSingle();
    if (error) {
      toast.showError(`Failed to archive transaction: ${error.message}`);
      return;
    }
    if (!archived) {
      toast.showError('Failed to archive transaction: no transaction was updated. Check that you still have access to this barangay.');
      return;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'payment',
      entityId: archived.id,
      entityLabel: `#${payment.service_requests?.reference_number ?? '—'}`,
      metadata: { reference_number: payment.service_requests?.reference_number ?? null, method: payment.method, amount_centavos: payment.amount_centavos, status: payment.status },
    }).catch(() => {});

    toast.showSuccess('Transaction archived.');
    router.refresh();
  }

  // Full-amount only (no partial refunds) — see the refund-payment Edge Function.
  // Refunds settle asynchronously on PayMongo's side, so this only submits the request;
  // refund_status moves from 'pending' to 'refunded'/'failed' once the paymongo-webhook
  // function's refund.updated handler confirms it.
  async function refund(payment: Payment) {
    const supabase = createSupabaseBrowserClient();
    const { data: refundResult, error } = await supabase.functions.invoke<{ paymentId: string; status: string }>('refund-payment', {
      body: { paymentId: payment.id, reason: 'requested_by_customer' },
    });
    if (error) {
      toast.showError(`Failed to submit refund: ${error.message}`);
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
    router.refresh();
  }

  const columns: EditableDataTableColumn<Payment>[] = [
    {
      header: 'Date',
      initialWidth: 148,
      minWidth: 138,
      wrap: 'nowrap',
      render: (p) => <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{formatDateTime(p.created_at)}</span>,
      edit: {
        type: 'datetime',
        getValue: (p) => p.created_at,
        onSave: (p, value) => updateField(p, { created_at: String(value) }),
      },
    },
    {
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
      header: 'Resident',
      initialWidth: 190,
      minWidth: 160,
      wrap: 'break-word',
      render: (p) => p.service_requests?.profiles?.full_name ?? '—',
      edit: {
        type: 'select',
        options: residents.map((r) => ({ value: r.id, label: r.full_name })),
        getValue: (p) => p.service_requests?.resident_id ?? '',
        onSave: (p, value) => updateLinkedRequest(p, { resident_id: String(value) }),
      },
    },
    {
      header: 'Document',
      initialWidth: 190,
      minWidth: 160,
      wrap: 'break-word',
      render: (p) => p.service_requests?.document_types?.name ?? '—',
      edit: {
        type: 'select',
        options: documentTypes.map((d) => ({ value: d.id, label: d.name })),
        getValue: (p) => p.service_requests?.document_type_id ?? '',
        onSave: (p, value) => updateLinkedRequest(p, { document_type_id: String(value) }),
      },
    },
    {
      header: 'Method',
      initialWidth: 126,
      minWidth: 116,
      wrap: 'nowrap',
      render: (p) => (p.method === 'qrph' ? 'QR PH' : 'Pay at Pickup'),
      edit: {
        type: 'select',
        options: METHOD_OPTIONS,
        getValue: (p) => p.method,
        onSave: (p, value) => updateField(p, { method: String(value) }),
      },
    },
    {
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
      header: 'Status',
      initialWidth: 136,
      minWidth: 128,
      wrap: 'nowrap',
      render: (p) => <StatusPill status={p.status} />,
      edit: {
        type: 'select',
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
      header: 'Collected By / Source',
      initialWidth: 208,
      minWidth: 180,
      wrap: 'break-word',
      render: (p) => (p.method === 'pickup' ? (p.collector?.full_name ?? '—') : (p.paymongo_source_id ?? '—')),
      // Pickup rows need a select of admins (writes collected_by); QR PH rows need a free-text
      // PayMongo source id (writes paymongo_source_id) — genuinely different controls per row.
      edit: (p): EditableCellConfig<Payment> =>
        p.method === 'pickup'
          ? {
              type: 'select',
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
              <ConfirmButton
                label={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                confirmLabel="Refund?"
                onConfirm={() => refund(p)}
                title="Retry refund"
                ariaLabel={`Retry refund for ${p.service_requests?.reference_number ?? 'transaction'}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700 transition-colors hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:bg-red-900/40 dark:text-red-300 dark:focus-visible:ring-offset-zinc-900"
              />
            </div>
          );
        }
        return (
          <ConfirmButton
            label={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
            confirmLabel="Refund full amount?"
            onConfirm={() => refund(p)}
            title="Refund this payment"
            ariaLabel={`Refund ${p.service_requests?.reference_number ?? 'transaction'}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:bg-red-900/30 dark:text-red-300 dark:focus-visible:ring-offset-zinc-900"
          />
        );
      },
    },
    {
      header: 'Actions',
      initialWidth: 76,
      minWidth: 72,
      wrap: 'nowrap',
      overflow: 'visible',
      render: (p) => (
        <ConfirmButton
          label={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          confirmLabel="Archive?"
          onConfirm={() => archive(p)}
          title="Archive transaction"
          ariaLabel={`Archive ${p.service_requests?.reference_number ?? 'transaction'}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-300 dark:focus-visible:ring-offset-zinc-900"
        />
      ),
    },
  ];

  return (
    <>
      {/* Section 3: sort/filter/search (left) + Section 5: add button (right) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDateOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
          >
            Date {dateOrder === 'asc' ? '↑' : '↓'}
          </button>

          <select
            value={method}
            onChange={(e) => navigate({ method: e.target.value })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All Methods</option>
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: searchText });
            }}
            className="flex items-center gap-2"
          >
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search reference, resident, document, collector…"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
            >
              Search
            </button>
          </form>
        </div>

        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!barangayId}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            + Add Transaction
          </button>
        )}
      </div>

      {/* Section 4: segmented status tabs, beneath the sort/filter/search + add row */}
      <div className="mb-4 flex gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ tab: t.key })}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {addOpen && (
        <AddTransactionForm referenceOptions={referenceOptions} admins={admins} onClose={() => setAddOpen(false)} />
      )}

      {/* Section 6: table display — columns are user-resizable (drag the divider in each
          header cell). */}
      <EditableDataTable
        rows={sortedPayments}
        rowKey={(p) => p.id}
        emptyLabel="No transactions yet."
        columns={columns}
        resizableColumns
        density="compact"
        tableMinWidth={1650}
        cellOverflow="hidden"
      />
    </>
  );
}
