'use client';

import Link from 'next/link';
import { formatDateTime, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { RequestStatusActions } from '@/components/admin/request-status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ServiceRequest } from './page';
import { TABS, type Tab } from './types';

interface Resident {
  id: string;
  full_name: string;
}
interface DocumentTypeOption {
  id: string;
  name: string;
}

function currentDateTimeLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function AddRequestForm({
  residents,
  documentTypes,
  barangayId,
  onClose,
}: {
  residents: Resident[];
  documentTypes: DocumentTypeOption[];
  barangayId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [residentId, setResidentId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [status, setStatus] = useState<'submitted' | 'in_progress' | 'out_for_delivery' | 'completed' | 'cancelled'>('submitted');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'waived'>('pending');
  const [submittedAt, setSubmittedAt] = useState(currentDateTimeLocal);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!residentId || !documentTypeId) {
      toast.showError('Resident and document type are required.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('service_requests').insert({
      resident_id: residentId,
      document_type_id: documentTypeId,
      barangay_id: barangayId,
      ...(referenceNumber.trim() ? { reference_number: referenceNumber.trim().replace(/^#/, '') } : {}),
      status,
      payment_status: paymentStatus,
      created_at: new Date(submittedAt).toISOString(),
      requester_notes: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.showError(`Failed to create request: ${error.message}`);
      return;
    }
    toast.showSuccess('Request created.');
    setReferenceNumber('');
    setResidentId('');
    setDocumentTypeId('');
    setStatus('submitted');
    setPaymentStatus('pending');
    setSubmittedAt(currentDateTimeLocal());
    setNotes('');
    onClose();
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-4"
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Reference</span>
        <input
          className={inputClass}
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="Auto-generated on save"
        />
        <span className="mt-1 block text-xs text-zinc-500">Leave blank to use the next unique reference.</span>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Resident</span>
        <select className={inputClass} value={residentId} onChange={(e) => setResidentId(e.target.value)} required>
          <option value="">Select a resident…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Document Type</span>
        <select className={inputClass} value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} required>
          <option value="">Select a document type…</option>
          {documentTypes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="submitted">Submitted</option>
          <option value="in_progress">Processing</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="completed">Completed/Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Payment</span>
        <select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as typeof paymentStatus)}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Submitted Date</span>
        <input type="datetime-local" className={inputClass} value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Notes (optional)</span>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of request" />
      </label>
      <div className="col-span-1 flex items-end gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={submitting || !residentId || !documentTypeId}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Request'}
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RequestsTable({
  requests,
  residents,
  documentTypes,
  barangayId,
  tab,
  q,
  doc,
}: {
  requests: ServiceRequest[];
  residents: Resident[];
  documentTypes: DocumentTypeOption[];
  barangayId: string;
  tab: Tab;
  q: string;
  doc: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [referenceOrder, setReferenceOrder] = useState<'asc' | 'desc'>('asc');
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState(q);

  useEffect(() => {
    setSearchText(q);
  }, [q]);

  // Keep the latest tab/doc around for the debounced search effect below, without making
  // that effect re-fire (and re-push a redundant URL) whenever tab/doc change on their own —
  // those already navigate immediately through their own handlers.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const docRef = useRef(doc);
  docRef.current = doc;

  function navigate(next: { tab?: string; q?: string; doc?: string }) {
    const nextQ = next.q ?? q;
    const nextDoc = next.doc ?? doc;
    const params = new URLSearchParams({
      tab: next.tab ?? tab,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextDoc ? { doc: nextDoc } : {}),
    });
    router.push(`/requests?${params.toString()}`);
  }

  // Real-time search: push the URL (and let the server re-filter) a short moment after the
  // user stops typing, instead of waiting for a submit click.
  useEffect(() => {
    if (searchText === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        tab: tabRef.current,
        ...(searchText ? { q: searchText } : {}),
        ...(docRef.current ? { doc: docRef.current } : {}),
      });
      router.push(`/requests?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('admin-service-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const sortedRequests = [...requests].sort(
    (a, b) => a.reference_number.localeCompare(b.reference_number) * (referenceOrder === 'asc' ? 1 : -1),
  );

  async function updateField(request: ServiceRequest, patch: Partial<Tables<'service_requests'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('service_requests').update(patch).eq('id', request.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function archive(request: ServiceRequest) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('service_requests').update({ deleted_at: new Date().toISOString() }).eq('id', request.id);
    if (error) {
      toast.showError(`Failed to archive request: ${error.message}`);
      return;
    }
    toast.showSuccess(`Request #${request.reference_number} archived.`);
    router.refresh();
  }

  const columns: EditableDataTableColumn<ServiceRequest>[] = [
    {
      // Plain text, not a Link — an editable cell can't also be a reliable nav target
      // (the anchor's default navigation fires on click regardless of the edit handler).
      // Navigation moved to the "View" link in Actions instead.
      header: 'Reference',
      render: (r) => <span className="font-medium">#{r.reference_number}</span>,
      edit: {
        type: 'text',
        getValue: (r) => r.reference_number,
        onSave: async (r, value) => {
          const next = String(value).trim();
          if (!next) return { error: 'Reference number cannot be empty.' };
          return updateField(r, { reference_number: next });
        },
      },
    },
    {
      header: 'Resident',
      render: (r) => r.profiles?.full_name ?? '—',
      edit: {
        type: 'select',
        options: residents.map((res) => ({ value: res.id, label: res.full_name })),
        getValue: (r) => r.resident_id,
        onSave: (r, value) => updateField(r, { resident_id: String(value) }),
      },
    },
    {
      header: 'Document',
      render: (r) => r.document_types?.name ?? '—',
      edit: {
        type: 'select',
        options: documentTypes.map((d) => ({ value: d.id, label: d.name })),
        getValue: (r) => r.document_type_id,
        onSave: (r, value) => updateField(r, { document_type_id: String(value) }),
      },
    },
    {
      header: 'Status',
      render: (r) => <StatusPill status={r.status} />,
      edit: {
        type: 'select',
        options: [
          { value: 'submitted', label: 'Submitted' },
          { value: 'in_progress', label: 'Processing' },
          { value: 'out_for_delivery', label: 'Out for Delivery' },
          { value: 'completed', label: 'Completed/Delivered' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
        // Same bare .update({status}) the FSM buttons in RequestStatusActions use — the
        // track_service_request_status trigger (0002/0007) appends a status_history entry
        // on any status-changing UPDATE, so this stays consistent with that audit trail.
        getValue: (r) => r.status,
        onSave: (r, value) => updateField(r, { status: String(value) }),
      },
    },
    {
      header: 'Payment',
      render: (r) => <StatusPill status={r.payment_status} />,
      edit: {
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'paid', label: 'Paid' },
          { value: 'waived', label: 'Waived' },
        ],
        getValue: (r) => r.payment_status,
        onSave: (r, value) => updateField(r, { payment_status: String(value) }),
      },
    },
    {
      header: 'Submitted',
      render: (r) => formatDateTime(r.created_at),
      edit: {
        type: 'datetime',
        getValue: (r) => r.created_at,
        onSave: (r, value) => updateField(r, { created_at: String(value) }),
      },
    },
    {
      header: 'Notes',
      render: (r) => r.requester_notes ?? '—',
      edit: {
        type: 'text',
        getValue: (r) => r.requester_notes ?? '',
        onSave: (r, value) => updateField(r, { requester_notes: String(value) || null }),
      },
    },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Link href={`/requests/${r.id}`} className="rounded-full px-2 py-1 text-xs font-medium text-[var(--accent)] hover:underline">
            View
          </Link>
          <RequestStatusActions
            requestId={r.id}
            status={r.status}
            paymentStatus={r.payment_status}
            paymentMethod={r.payment_method}
            variant="compact"
          />
          <ConfirmButton
            label="🗑"
            confirmLabel="Archive?"
            onConfirm={() => archive(r)}
            title="Archive"
            className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
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
            onClick={() => setReferenceOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
          >
            Reference {referenceOrder === 'asc' ? '↑' : '↓'}
          </button>

          <select
            value={doc}
            onChange={(e) => navigate({ doc: e.target.value })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All documents</option>
            {documentTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
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
              placeholder="Search reference, resident, document…"
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
            + Add Request
          </button>
        )}
      </div>

      {/* Section 4: segmented tabs, beneath the sort/filter/search + add row */}
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
        <AddRequestForm residents={residents} documentTypes={documentTypes} barangayId={barangayId} onClose={() => setAddOpen(false)} />
      )}

      {/* Section 6: table display — columns are user-resizable (drag the divider in each
          header cell), and row/header divider lines are a step thicker than the shared
          table default. */}
      <EditableDataTable
        rows={sortedRequests}
        rowKey={(r) => r.id}
        emptyLabel="No requests in this view."
        columns={columns}
        resizableColumns
        thickBorders
      />
    </>
  );
}
