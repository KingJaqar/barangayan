'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';
import { IncidentActions } from './incident-actions';

import type { Tables } from '@barangayan/shared';
import { formatAdminTimestamp as formatDateTime } from '@/lib/admin-tables/pilot-config';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { OperationsTableSummary } from '@/components/admin/operations-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { operationsConfig } from '@/lib/admin-tables/operations-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { IncidentRow } from './types';
import { TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

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

/** Parses the Coordinates column's inline-edit input, "lat, lng" (e.g. "14.68040, 121.11974"),
 * into a `location` jsonb value. Returns null on anything that isn't two valid, in-range numbers. */
function parseCoordinates(raw: string): { lat: number; lng: number } | null {
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function AddIncidentForm({
  categories,
  residents,
  barangayId,
  onClose, onChanged,
}: {
  categories: CategoryOption[];
  residents: ResidentOption[];
  barangayId: string;
  onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [specificAreaDetails, setSpecificAreaDetails] = useState('');
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
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        barangay_id: barangayId,
        title: title.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        specific_area_details: specificAreaDetails.trim() || null,
        category_id: categoryId || null,
        reporter_id: reporterId || null,
        status,
        created_at: new Date(submittedAt).toISOString(),
        // Walk-in/phoned-in reports have no map pin — address/specific area details are
        // whatever the resident described verbally, entered by the admin above.
        location: {},
      })
      .select('*')
      .single();
    setSubmitting(false);
    if (error) {
      toast.showError(`Failed to create incident: ${error.message}`);
      return;
    }

    logAdminAction({
      action: 'create',
      entityType: 'incident',
      entityId: data?.id,
      entityLabel: title.trim(),
      metadata: {
        title: title.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        category: categories.find((c) => c.id === categoryId)?.name ?? null,
        reporter: residents.find((r) => r.id === reporterId)?.full_name ?? 'Anonymous / Walk-in',
        status,
      },
    }).catch(() => {});

    toast.showSuccess('Incident report created.');
    setTitle('');
    setDescription('');
    setAddress('');
    setSpecificAreaDetails('');
    setCategoryId('');
    setReporterId('');
    setStatus('open');
    setSubmittedAt(currentDateTimeLocal());
    onClose();
    onChanged();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-1 sm:grid-cols-3`}
    >
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Title</span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Description</span>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Address</span>
        <input
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={300}
          placeholder="Where the resident described the incident"
        />
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Specific Area Details</span>
        <input
          className={inputClass}
          value={specificAreaDetails}
          onChange={(e) => setSpecificAreaDetails(e.target.value)}
          maxLength={300}
          placeholder="e.g. near the blue gate, 2nd house from the corner"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Category</span>
        <AdminSelect className={inputClass} value={categoryId} onValueChange={(nextValue) => setCategoryId(nextValue)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Reporter</span>
        <AdminSelect kind="people" className={inputClass} value={reporterId} onValueChange={(nextValue) => setReporterId(nextValue)}>
          <option value="">Anonymous / Walk-in</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <AdminSelect kind="status" className={inputClass} value={status} onValueChange={(nextValue) => setStatus(nextValue as typeof status)}>
          {Object.entries(INCIDENT_STATUS).map(([value, cfg]) => (
            <option key={value} value={value}>
              {cfg.label}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm sm:col-span-3">
        <span className="mb-1 block font-medium">Submitted Date</span>
        <input type="datetime-local" className={inputClass} value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} required />
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Creating…">Create Incident</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
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
export function IncidentTable({ result, summary, requestedState, barangayId, categories, residents, optionsError }: {
  result: QueryOutcome<BrowseResult<IncidentRow>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string;
  categories: CategoryOption[]; residents: ResidentOption[]; optionsError: string | null;
}) {
  const params = useSearchParams();
  const category = params.get('category') ?? '';
  const config = useMemo(() => operationsConfig('incidents', [category, ...categories.map(option => option.id)]), [category, categories]);
  const browse = useConfiguredTableBrowse(config, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = config.sorts.find(sort => sort.key === state.sort)!;

  const [addOpen, setAddOpen] = useState(false);
  const [channelName] = useState(() => 'admin-incidents-' + Math.random().toString(36).slice(2));
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, browse.refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelName, browse.refresh]);

  async function updateField(incident: IncidentRow, patch: Partial<Tables<'incidents'>>) {
    // Skip the log (but still write the update) when nothing actually changed — avoids a
    // notification for a cell that's clicked into and blurred without editing.
    const changedKeys = Object.keys(patch).filter((key) => {
      const current = (incident as unknown as Record<string, unknown>)[key];
      const next = (patch as Record<string, unknown>)[key];
      return JSON.stringify(current) !== JSON.stringify(next);
    });

    const supabase = createSupabaseBrowserClient();
    if (changedKeys.length === 0) return { error: null };

    const { data: updated, error } = await supabase
      .from('incidents')
      .update(patch)
      .eq('id', incident.id)
      .select('*')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No incident was updated. Check that you still have access to this barangay.' };

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of changedKeys) {
      before[key] = (incident as unknown as Record<string, unknown>)[key];
      after[key] = (patch as Record<string, unknown>)[key];
    }
    logAdminAction({
      action: patch.status ? 'status_change' : 'update',
      entityType: 'incident',
      entityId: updated.id,
      entityLabel: updated.title,
      changes: { before, after },
    }).catch(() => {});
    browse.refresh();
    return { error: null };
  }

  const lifecycle = useRecordWorkspace<IncidentRow>('incidents', browse.refresh, browse.settle, {
    actionsMinWidth: 640,
    workflowActions: row => <IncidentActions incidentId={row.id} status={row.status} incidentTitle={row.title} variant="compact"
      showRemove={false}
      onBeforeAction={browse.settle} onChanged={browse.refresh} />,
  });

  const columns: EditableDataTableColumn<IncidentRow>[] = [
    {
      id: 'title', header: 'Incident',
      initialWidth: 280,
      minWidth: 230,
      wrap: 'break-word',
      className: 'max-w-sm',
      render: (r) => (
        <div>
          <p className="font-semibold leading-snug">{r.title}</p>
          {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{r.description}</p>}
          {r.address && (
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400" title={r.address}>
              📍 {r.address}
            </p>
          )}
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
      id: 'category', header: 'Category',
      initialWidth: 160,
      minWidth: 130,
      wrap: 'nowrap',
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
        type: 'select', selectKind: 'category',
        canEdit: () => !optionsError,
        options: [{ value: '', label: 'Uncategorized' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
        getValue: (r) => r.category_id ?? '',
        onSave: (r, value) => updateField(r, { category_id: String(value) || null }),
        commitOnChange: true,
      },
    },
    {
      id: 'reporter', header: 'Reporter',
      initialWidth: 210,
      minWidth: 180,
      wrap: 'break-word',
      render: (r) =>
        r.profiles ? (
          <div>
            <p>{r.profiles.full_name}</p>
            {r.profiles.email && <p className="text-xs text-zinc-400">{r.profiles.email}</p>}
          </div>
        ) : (
          <span className="text-zinc-400">Anonymous</span>
        ),
      edit: {
        type: 'select', selectKind: 'people',
        canEdit: () => !optionsError,
        options: [{ value: '', label: 'Anonymous / Walk-in' }, ...residents.map((res) => ({ value: res.id, label: res.full_name }))],
        getValue: (r) => r.reporter_id ?? '',
        onSave: (r, value) => updateField(r, { reporter_id: String(value) || null }),
        commitOnChange: true,
      },
    },
    {
      header: 'Coordinates',
      initialWidth: 160,
      minWidth: 150,
      wrap: 'nowrap',
      render: (r) => {
        const loc = r.location as { lat?: unknown; lng?: unknown } | null;
        const hasLocation = loc !== null && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number';
        return hasLocation ? (
          <span className="whitespace-nowrap text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {(loc!.lat as number).toFixed(5)}, {(loc!.lng as number).toFixed(5)}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        );
      },
      edit: {
        type: 'text',
        getValue: (r) => {
          const loc = r.location as { lat?: unknown; lng?: unknown } | null;
          return loc !== null && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number'
            ? `${loc.lat}, ${loc.lng}`
            : '';
        },
        onSave: (r, value) => {
          const parsed = parseCoordinates(String(value));
          if (!parsed) {
            return Promise.resolve({ error: 'Enter coordinates as "lat, lng" (e.g. 14.68040, 121.11974), both in valid range.' });
          }
          return updateField(r, { location: parsed });
        },
      },
    },
    {
      header: 'Address',
      initialWidth: 220,
      minWidth: 180,
      wrap: 'break-word',
      className: 'max-w-sm',
      render: (r) =>
        r.address ? (
          <span className="line-clamp-2 text-xs">{r.address}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
      edit: {
        type: 'text',
        getValue: (r) => r.address ?? '',
        onSave: (r, value) => updateField(r, { address: String(value).trim() || null }),
      },
    },
    {
      header: 'Specific Area Details',
      initialWidth: 230,
      minWidth: 180,
      wrap: 'break-word',
      className: 'max-w-sm',
      render: (r) =>
        r.specific_area_details ? (
          <span className="line-clamp-2 text-xs italic text-zinc-500 dark:text-zinc-400">{r.specific_area_details}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
      edit: {
        type: 'text',
        getValue: (r) => r.specific_area_details ?? '',
        onSave: (r, value) => updateField(r, { specific_area_details: String(value).trim() || null }),
      },
    },
    {
      id: 'confirmations', header: 'Confirmed',
      initialWidth: 112,
      minWidth: 100,
      wrap: 'nowrap',
      render: (r) => (
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
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
      id: 'status', header: 'Status',
      initialWidth: 140,
      minWidth: 130,
      wrap: 'nowrap',
      render: (r) => <IncidentStatusPill status={r.status} />,
      edit: {
        type: 'select', selectKind: 'status',
        options: Object.entries(INCIDENT_STATUS).map(([value, cfg]) => ({ value, label: cfg.label })),
        // Bare update — an admin hand-correction path alongside the guided FSM buttons in
        // the Actions column (which go through update_incident_status for guardrails).
        getValue: (r) => r.status,
        onSave: (r, value) => updateField(r, { status: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'submitted', header: 'Submitted',
      initialWidth: 170,
      minWidth: 160,
      wrap: 'nowrap',
      render: (r) => <span className="tabular-nums">{formatDateTime(r.created_at)}</span>,
      edit: {
        type: 'datetime',
        getValue: (r) => r.created_at,
        onSave: (r, value) => updateField(r, { created_at: String(value) }),
      },
    },
    lifecycle.column,
  ];

  return <div >
    <RecordArchiveLink name="incidents" beforeOpen={browse.settle} />
    <OperationsTableSummary name="incidents" summary={summary} onRetry={browse.refresh} />
    <div>{optionsError && <p role="alert" className="mb-4">{optionsError} <button type="button" onClick={browse.refresh}>Retry options</button></p>}</div>
    {addOpen && <fieldset disabled={browse.pending || !!optionsError}><AddIncidentForm categories={categories} residents={residents} barangayId={barangayId} onClose={() => setAddOpen(false)} onChanged={browse.refresh} /></fieldset>}
    <ProfileTablePanel label="Incident Reports" browse={browse}
      category={<label className="table-browse-field">Category
        <AdminSelect aria-label="Category" value={state.filters.category} disabled={!!optionsError}
          onValueChange={nextValue => void browse.commit({ filters: { category: nextValue } })}>
          <option value="">All categories</option>
          {state.filters.category && !categories.some(option => option.id === state.filters.category) && <option value={state.filters.category}>Selected category</option>}
          {categories.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </AdminSelect></label>}
      filters={<SegmentedFilter label="Incident status" options={TABS.map(tab => ({ value: tab.key, label: tab.label }))}
        value={state.filters.tab} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={<button type="button" onClick={async () => { if (await browse.settle()) setAddOpen(true); }}
        disabled={browse.pending || !barangayId || !!optionsError}>+ Add Incident</button>}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} rowKey={row => row.id} columns={columns}
        emptyLabel="No incident reports found."
        onRowClick={row => lifecycle.open(row)} resizableColumns pinLastColumn density="compact"
        tableMinWidth={1710} cellOverflow="hidden"
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: config.sorts,
          onChange: (sort, dir) => void browse.commit({ sort, dir }) }} />
    </ProfileTablePanel>
    {lifecycle.view}
  </div>;
}
