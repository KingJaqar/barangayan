'use client';

import { formatDateTime, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { IncidentActions } from './incident-actions';
import { IncidentDetailModal } from './incident-detail-modal';
import type { IncidentRow } from './page';
import { TABS, type Tab } from './types';

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}
interface ResidentOption {
  id: string;
  full_name: string;
}

export const INCIDENT_STATUS: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  resolved: { label: 'Resolved', className: 'bg-[var(--accent)]/15 text-[var(--accent)]' },
  withdrawn: { label: 'Withdrawn', className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
  unresolved: { label: 'Unresolved', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export function IncidentStatusPill({ status }: { status: string }) {
  const cfg = INCIDENT_STATUS[status] ?? { label: status, className: 'bg-zinc-200 text-zinc-700' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.className}`}>{cfg.label}</span>;
}

function currentDateTimeLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function AddIncidentForm({
  categories,
  residents,
  barangayId,
  onClose,
}: {
  categories: CategoryOption[];
  residents: ResidentOption[];
  barangayId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reporterId, setReporterId] = useState('');
  const [status, setStatus] = useState<keyof typeof INCIDENT_STATUS>('open');
  const [submittedAt, setSubmittedAt] = useState(currentDateTimeLocal);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.showError('Incident title is required.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('incidents').insert({
      barangay_id: barangayId,
      title: title.trim(),
      description: description.trim() || null,
      category_id: categoryId || null,
      reporter_id: reporterId || null,
      status,
      created_at: new Date(submittedAt).toISOString(),
      // Walk-in/phoned-in reports have no resident-supplied coordinates yet.
      location: {},
    });
    setSubmitting(false);
    if (error) {
      toast.showError(`Failed to create incident: ${error.message}`);
      return;
    }
    toast.showSuccess('Incident report created.');
    setTitle('');
    setDescription('');
    setCategoryId('');
    setReporterId('');
    setStatus('open');
    setSubmittedAt(currentDateTimeLocal());
    onClose();
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-3"
    >
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Title</span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Description</span>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Category</span>
        <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Reporter</span>
        <select className={inputClass} value={reporterId} onChange={(e) => setReporterId(e.target.value)}>
          <option value="">Anonymous / Walk-in</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {Object.entries(INCIDENT_STATUS).map(([value, cfg]) => (
            <option key={value} value={value}>
              {cfg.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Submitted Date</span>
        <input type="datetime-local" className={inputClass} value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} required />
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Incident'}
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Interactive incident table — inline-editable cells for Category, Reporter, Confirmation
 * Status, Current Status, and Submission Date (same click-to-edit pattern as the Requests
 * screen's EditableDataTable). Click the Incident cell to open the full-detail modal (photos,
 * location, and a form for the free-text fields: title, description). Status/remove action
 * buttons stop click propagation so they don't also open the modal. */
export function IncidentTable({
  rows,
  categories,
  residents,
  barangayId,
  tab,
  category,
  q,
}: {
  rows: IncidentRow[];
  categories: CategoryOption[];
  residents: ResidentOption[];
  barangayId: string;
  tab: Tab;
  category: string;
  q: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<IncidentRow | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<'asc' | 'desc'>('desc');
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState(q);

  useEffect(() => {
    setSearchText(q);
  }, [q]);

  // Keep the latest tab/category around for the debounced search effect below, without
  // making that effect re-fire (and re-push a redundant URL) whenever tab/category change
  // on their own — those already navigate immediately through their own handlers.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const categoryRef = useRef(category);
  categoryRef.current = category;

  function navigate(next: { tab?: string; category?: string; q?: string }) {
    const nextQ = next.q ?? q;
    const nextCategory = next.category ?? category;
    const params = new URLSearchParams({
      tab: next.tab ?? tab,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextCategory ? { category: nextCategory } : {}),
    });
    router.push(`/incident-reports?${params.toString()}`);
  }

  // Real-time search: push the URL (and let the server re-filter) a short moment after the
  // user stops typing, instead of waiting for a submit click.
  useEffect(() => {
    if (searchText === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        tab: tabRef.current,
        ...(searchText ? { q: searchText } : {}),
        ...(categoryRef.current ? { category: categoryRef.current } : {}),
      });
      router.push(`/incident-reports?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const sortedRows = [...rows].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return submittedOrder === 'asc' ? diff : -diff;
  });
  // Unique per mount: removeChannel() is async, so a remount (StrictMode's double-invoked
  // effects in dev, or a route change back to this page) would otherwise call
  // supabase.channel('admin-incidents') while the previous channel is still subscribed,
  // get that same channel back, and throw on .on() — the same failure the mobile
  // useMyIncidents hook hit.
  const [channelName] = useState(() => `admin-incidents-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, channelName]);

  async function updateField(incident: IncidentRow, patch: Partial<Tables<'incidents'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('incidents').update(patch).eq('id', incident.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function removeIncident(incident: IncidentRow) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('soft_delete_incident', { p_incident_id: incident.id });
    if (error) {
      toast.showError(`Failed to remove incident: ${error.message}`);
      return;
    }
    toast.showSuccess('Incident removed.');
    router.refresh();
  }

  const columns: EditableDataTableColumn<IncidentRow>[] = [
    {
      header: 'Incident',
      className: 'max-w-xs',
      render: (r) => (
        <div>
          <p className="font-semibold leading-snug">{r.title}</p>
          {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{r.description}</p>}
          {(r.photo_urls ?? []).length > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-400">
              📷 {r.photo_urls.length} photo{r.photo_urls.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      ),
      // Incident Details (title + description) are long-form — edited via the detail
      // modal's form rather than a cramped inline text cell.
    },
    {
      header: 'Category',
      render: (r) =>
        r.incident_categories ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${r.incident_categories.color}22`, color: r.incident_categories.color }}
          >
            {r.incident_categories.name}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
      edit: {
        type: 'select',
        options: [{ value: '', label: 'Uncategorized' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
        getValue: (r) => r.category_id ?? '',
        onSave: (r, value) => updateField(r, { category_id: String(value) || null }),
      },
    },
    {
      header: 'Reporter',
      render: (r) => r.profiles?.full_name ?? <span className="text-zinc-400">Anonymous</span>,
      edit: {
        type: 'select',
        options: [{ value: '', label: 'Anonymous / Walk-in' }, ...residents.map((res) => ({ value: res.id, label: res.full_name }))],
        getValue: (r) => r.reporter_id ?? '',
        onSave: (r, value) => updateField(r, { reporter_id: String(value) || null }),
      },
    },
    {
      header: 'Confirmed',
      render: (r) => (
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            r.confirmation_count > 0 ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800',
          ].join(' ')}
        >
          👥 {r.confirmation_count}
        </span>
      ),
      edit: {
        type: 'number',
        getValue: (r) => r.confirmation_count,
        onSave: (r, value) => {
          const next = Number(value);
          if (!Number.isFinite(next) || next < 0) return Promise.resolve({ error: 'Enter a non-negative number.' });
          return updateField(r, { confirmation_count: Math.trunc(next) });
        },
      },
    },
    {
      header: 'Status',
      render: (r) => <IncidentStatusPill status={r.status} />,
      edit: {
        type: 'select',
        options: Object.entries(INCIDENT_STATUS).map(([value, cfg]) => ({ value, label: cfg.label })),
        // Bare update — an admin hand-correction path alongside the guided FSM buttons in
        // the Actions column (which go through update_incident_status for guardrails).
        getValue: (r) => r.status,
        onSave: (r, value) => updateField(r, { status: String(value) }),
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
      header: 'Actions',
      // Stop propagation so the surrounding EditableDataTable's onRowClick (which opens the
      // detail modal for the non-editable Incident/Actions cells) doesn't also fire and
      // reopen the modal underneath these buttons.
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelected(r)} className="rounded-full px-2 py-1 text-xs font-medium text-[var(--accent)] hover:underline">
            View
          </button>
          <IncidentActions incidentId={r.id} status={r.status} variant="compact" />
          <ConfirmButton
            label="🗑"
            confirmLabel="Remove?"
            onConfirm={() => removeIncident(r)}
            title="Remove"
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
            onClick={() => setSubmittedOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
          >
            Submitted {submittedOrder === 'asc' ? '↑' : '↓'}
          </button>

          <select
            value={category}
            onChange={(e) => navigate({ category: e.target.value })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
              placeholder="Search title, description, reporter…"
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
            + Add Incident
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
        <AddIncidentForm categories={categories} residents={residents} barangayId={barangayId} onClose={() => setAddOpen(false)} />
      )}

      {/* Section 6: table display — columns are user-resizable (drag the divider in
          each header cell) since incident text fields vary a lot in length. */}
      <EditableDataTable
        rows={sortedRows}
        rowKey={(r) => r.id}
        emptyLabel="No incident reports found."
        columns={columns}
        onRowClick={setSelected}
        resizableColumns
        thickBorders
      />

      {selected && <IncidentDetailModal incident={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
