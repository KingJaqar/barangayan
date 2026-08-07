'use client';

import Link from 'next/link';
import { formatDateTime, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { RequestStatusActions } from '@/components/admin/request-status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ServiceRequest } from './page';

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
}: {
  residents: Resident[];
  documentTypes: DocumentTypeOption[];
  barangayId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!barangayId}
        className="mb-4 rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        + Add Request
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-4">
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
        <input
          type="datetime-local"
          className={inputClass}
          value={submittedAt}
          onChange={(e) => setSubmittedAt(e.target.value)}
          required
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Notes (optional)</span>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of request" />
      </label>
      <div className="col-span-1 flex items-end gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={submitting || !residentId || !documentTypeId}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create Request'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
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
}: {
  requests: ServiceRequest[];
  residents: Resident[];
  documentTypes: DocumentTypeOption[];
  barangayId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [referenceOrder, setReferenceOrder] = useState<'asc' | 'desc'>('asc');

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

  const sortedRequests = [...requests].sort((a, b) =>
    a.reference_number.localeCompare(b.reference_number) * (referenceOrder === 'asc' ? 1 : -1),
  );

  async function updateField(request: ServiceRequest, patch: Partial<Tables<'service_requests'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('service_requests').update(patch).eq('id', request.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function archive(request: ServiceRequest) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('service_requests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', request.id);
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
          <Link href={`/requests/${r.id}`} className="rounded-full px-2 py-1 text-xs font-medium text-[#0F6E5B] hover:underline">
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AddRequestForm residents={residents} documentTypes={documentTypes} barangayId={barangayId} />
        <button
          type="button"
          onClick={() => setReferenceOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
          className="mb-4 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:border-[#0F6E5B] hover:text-[#0F6E5B] dark:border-zinc-700">
          Reference {referenceOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      <EditableDataTable rows={sortedRequests} rowKey={(r) => r.id} emptyLabel="No requests in this view." columns={columns} />
    </>
  );
}
