'use client';

import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableCellConfig, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { TABS, type Tab } from './types';

// Tables<'payments'> already includes document_fee_centavos, shipping_fee_centavos,
// paymongo_payment_id, refund_status, refund_amount_centavos, refund_reason,
// refunded_at, refunded_by (migration 0064) — no extra fields needed here.
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
  { value: 'cash', label: 'Cash on Delivery' },
  { value: 'qrph', label: 'QR Ph' },
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
  barangayId,
  referenceOptions,
  admins,
  onClose,
}: {
  barangayId: string;
  referenceOptions: string[];
  admins: AdminOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<'cash' | 'qrph'>('cash');
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
    setMethod('cash');
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

    let resolvedCollectedBy: string | null = method === 'cash' ? collectedBy || null : null;
    if (method === 'cash' && !resolvedCollectedBy && status === 'paid') {
      // No admin explicitly picked but this is being recorded as already paid — default
      // to whoever's entering it, same fallback the row-level "Mark Payment Collected"
      // action already uses.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedCollectedBy = user?.id ?? null;
    }

    const { error: insertError } = await supabase.from('payments').insert({
      service_request_id: matchedRequest.id,
      barangay_id: matchedRequest.barangayId,
      method,
      amount_centavos: Math.round(pesos * 100),
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      collected_by: resolvedCollectedBy,
      paymongo_source_id: method === 'qrph' ? sourceId.trim() || null : null,
    });

    setSubmitting(false);
    if (insertError) {
      toast.showError(`Failed to add transaction: ${insertError.message}`);
      return;
    }

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
        <span className="mb-1 block font-medium">Resident</span>
        <input className={readOnlyClass} value={residentDisplay} readOnly placeholder="Auto-filled from reference" />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Document</span>
        <input className={readOnlyClass} value={documentDisplay} readOnly placeholder="Auto-filled from reference" />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Method</span>
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as 'cash' | 'qrph')}>
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
        <span className="mb-1 block font-medium">{method === 'cash' ? 'Collected By' : 'Source (PayMongo)'}</span>
        {method === 'cash' ? (
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
        >
          {submitting ? 'Adding…' : 'Add Transaction'}
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

  useEffect(() => {
    setSearchText(q);
  }, [q]);

  // Keep the latest tab/method around for the debounced search effect below, without making
  // that effect re-fire (and re-push a redundant URL) whenever tab/method change on their
  // own — those already navigate immediately through their own handlers.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const methodRef = useRef(method);
  methodRef.current = method;

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
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('payments').update(patch).eq('id', payment.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  /** Resident/Document aren't columns on payments — they're read off the linked
   * service_request via the join. "Editing" them means correcting that request's own
   * resident_id/document_type_id (the same request this payment already points to),
   * distinct from the Reference cell's edit which reassigns to a *different* request. */
  async function updateLinkedRequest(payment: Payment, patch: Partial<Tables<'service_requests'>>): Promise<{ error: string | null }> {
    if (!payment.service_request_id) return { error: 'This transaction has no linked request.' };
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('service_requests').update(patch).eq('id', payment.service_request_id);
    if (error) return { error: error.message };
    router.refresh();
    return { error: null };
  }

  /** Reassigns a payment to a different service_request by looking up its reference
   * number, mirroring AddTransactionForm's own lookup — Resident/Document are derived
   * (joined) columns, so this is what "editing" them actually means. */
  async function reassignReference(payment: Payment, referenceInput: string): Promise<{ error: string | null }> {
    const next = referenceInput.trim().replace(/^#/, '');
    if (!next) return { error: 'Reference number cannot be empty.' };

    const supabase = createSupabaseBrowserClient();
    const { data: request, error: lookupError } = await supabase
      .from('service_requests')
      .select('id, barangay_id')
      .eq('reference_number', next)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };
    if (!request) return { error: `Request "${next}" not found.` };

    return updateField(payment, { service_request_id: request.id, barangay_id: request.barangay_id });
  }

  async function archive(payment: Payment) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', payment.id);
    if (error) {
      toast.showError(`Failed to archive transaction: ${error.message}`);
      return;
    }
    toast.showSuccess('Transaction archived.');
    router.refresh();
  }

  // Full-amount only (no partial refunds) — see the refund-payment Edge Function.
  // Refunds settle asynchronously on PayMongo's side, so this only submits the request;
  // refund_status moves from 'pending' to 'refunded'/'failed' once the paymongo-webhook
  // function's refund.updated handler confirms it.
  async function refund(payment: Payment) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.functions.invoke('refund-payment', {
      body: { paymentId: payment.id, reason: 'requested_by_customer' },
    });
    if (error) {
      toast.showError(`Failed to submit refund: ${error.message}`);
      return;
    }
    toast.showSuccess('Refund submitted to PayMongo — status will update once confirmed.');
    router.refresh();
  }

  const columns: EditableDataTableColumn<Payment>[] = [
    {
      header: 'Date',
      render: (p) => formatDateTime(p.created_at),
      edit: {
        type: 'datetime',
        getValue: (p) => p.created_at,
        onSave: (p, value) => updateField(p, { created_at: String(value) }),
      },
    },
    {
      header: 'Reference',
      render: (p) => `#${p.service_requests?.reference_number ?? '—'}`,
      edit: {
        type: 'text',
        getValue: (p) => p.service_requests?.reference_number ?? '',
        onSave: (p, value) => reassignReference(p, String(value)),
      },
    },
    {
      header: 'Resident',
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
      render: (p) => (p.method === 'qrph' ? 'QR Ph' : 'Cash on Delivery'),
      edit: {
        type: 'select',
        options: METHOD_OPTIONS,
        getValue: (p) => p.method,
        onSave: (p, value) => updateField(p, { method: String(value) }),
      },
    },
    {
      header: 'Amount',
      render: (p) =>
        p.shipping_fee_centavos ? (
          <div>
            <div>{formatCentavosAsPHP(p.amount_centavos)}</div>
            <div className="text-xs text-zinc-500">
              Doc {formatCentavosAsPHP(p.document_fee_centavos ?? 0)} + Ship {formatCentavosAsPHP(p.shipping_fee_centavos)}
            </div>
          </div>
        ) : (
          formatCentavosAsPHP(p.amount_centavos)
        ),
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
      },
    },
    {
      header: 'Collected By / Source',
      render: (p) => (p.method === 'cash' ? (p.collector?.full_name ?? '—') : (p.paymongo_source_id ?? '—')),
      // Cash rows need a select of admins (writes collected_by); QR Ph rows need a free-text
      // PayMongo source id (writes paymongo_source_id) — genuinely different controls per row.
      edit: (p): EditableCellConfig<Payment> =>
        p.method === 'cash'
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
                label="Retry"
                confirmLabel="Refund?"
                onConfirm={() => refund(p)}
                title="Retry refund"
                className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
              />
            </div>
          );
        }
        return (
          <ConfirmButton
            label="Refund"
            confirmLabel="Refund full amount?"
            onConfirm={() => refund(p)}
            title="Refund this payment"
            className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
          />
        );
      },
    },
    {
      header: '',
      render: (p) => (
        <ConfirmButton
          label="🗑"
          confirmLabel="Archive?"
          onConfirm={() => archive(p)}
          title="Archive"
          className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
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
        <AddTransactionForm barangayId={barangayId} referenceOptions={referenceOptions} admins={admins} onClose={() => setAddOpen(false)} />
      )}

      {/* Section 6: table display — columns are user-resizable (drag the divider in each
          header cell). */}
      <EditableDataTable
        rows={sortedPayments}
        rowKey={(p) => p.id}
        emptyLabel="No transactions yet."
        columns={columns}
        resizableColumns
        thickBorders
      />
    </>
  );
}
