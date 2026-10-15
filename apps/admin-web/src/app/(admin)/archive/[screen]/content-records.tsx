'use client';

import { Eye } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { TableDetailDialog } from '@/components/admin/table-detail-dialog';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { contentArchiveConfig, type ContentArchiveRow, type ContentArchiveSection } from '@/lib/admin-tables/archive-sections';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome } from '@/lib/admin-tables/queries/browse';

const date = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(value));

const fieldLabel = (key: string) => key.replaceAll('_', ' ').replace(/^\w/, letter => letter.toUpperCase());
function detail(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? <ul className="space-y-2">{value.map((item, index) => <li key={index}>{detail(item)}</li>)}</ul> : 'None';
  if (typeof value === 'object') return <dl className="space-y-2">{Object.entries(value).map(([key, item]) =>
    <div key={key}><dt className="text-xs text-zinc-500">{fieldLabel(key)}</dt><dd>{detail(item)}</dd></div>)}</dl>;
  return String(value);
}

export function ArchivedContentRecords({ name, label, result, requestedState }: {
  name: ContentArchiveSection; label: string;
  result: QueryOutcome<BrowseResult<ContentArchiveRow>>; requestedState: BrowseState;
}) {
  const browse = useConfiguredTableBrowse(contentArchiveConfig(name), requestedState, result, true);
  const [selection, setSelection] = useState<string | null>(null);
  const selected = browse.value?.rows.find(row => row.id === selection);
  const columns: EditableDataTableColumn<ContentArchiveRow>[] = [
    { id: 'record', header: 'Record', initialWidth: 280, minWidth: 180, wrap: 'break-word', render: row => row.title },
    { id: 'description', header: 'Description', initialWidth: 360, minWidth: 180, wrap: 'break-word', render: row => row.description || '—' },
    { id: 'archived', header: 'Archived on', initialWidth: 190, minWidth: 160, render: row => date(row.archivedAt) },
    { id: 'details', header: 'Details', initialWidth: 90, minWidth: 90, render: row =>
      <button type="button" aria-label={`View details: ${row.title}`} className="rounded-lg border p-2 text-blue-700 dark:text-blue-300"
        onClick={event => { event.stopPropagation(); setSelection(row.id); }}><Eye size={20} aria-hidden="true" /></button> },
  ];
  return <>
    <ProfileTablePanel label={`${label} archived records`} browse={browse}
      filters={name === 'waste-management' ? <SegmentedFilter label="Archived waste records" value={browse.state.filters.kind} disabled={browse.pending}
        onChange={kind => { setSelection(null); void browse.commit({ filters: { kind } }); }} options={[
          { value: 'zones', label: 'Zones' }, { value: 'schedules', label: 'Schedules' }, { value: 'incidents', label: 'Dumping reports' },
        ]} /> : undefined}>
      <EditableDataTable columns={columns} rows={browse.value?.rows ?? []} rowKey={row => row.id}
        onRowClick={row => setSelection(row.id)} emptyLabel="No archived records found."
        resizableColumns tableMinWidth={800} density="compact" />
    </ProfileTablePanel>
    {selected ? <TableDetailDialog label={`Archived record: ${selected.title}`} onClose={() => setSelection(null)}>
      <div className="max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{selected.title}</h2>
          <p className="text-sm text-zinc-500">Archived on {date(selected.archivedAt)}</p></div>
          <button type="button" onClick={() => setSelection(null)} className="rounded-lg border px-3 py-2">Close</button></div>
        <dl className="space-y-4">{Object.entries(selected.details).filter(([key]) => key !== 'id' && !key.endsWith('_id')).map(([key, value]) =>
          <div key={key}><dt className="text-xs font-semibold text-zinc-500">{key === 'deleted_at' ? 'Archived on' : fieldLabel(key)}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm">{detail(key.endsWith('_at') && typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? date(value) : value)}</dd></div>)}</dl>
      </div>
    </TableDetailDialog> : null}
  </>;
}
