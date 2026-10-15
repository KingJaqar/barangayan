'use client';

import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { type TableName } from '@/lib/admin-tables/table-configs';
import { archiveBrowseConfig } from '@/lib/admin-tables/archive-config';
import { useSearchParams } from 'next/navigation';
import type { QueryOutcome, TableRows } from '@/lib/admin-tables/queries/browse';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import { RECORD_CONFIG, recordLabel, type RecordData } from '@/lib/admin-tables/record-config';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { useRecordWorkspace } from '@/components/admin/record-workspace';
import { ResidentDetailContent } from '../../residents/resident-directory';
import type { ResidentRow } from '../../residents/types';

export function ArchivedRecords({ name, result, requestedState, currentUserId }: {
  name: TableName; result: QueryOutcome<BrowseResult<TableRows[TableName]>>; requestedState: BrowseState; currentUserId: string;
}) {
  const params = useSearchParams();
  const browse = useConfiguredTableBrowse(archiveBrowseConfig(name, params), requestedState, result, name !== 'requests' && name !== 'transactions');
  const lifecycle = useRecordWorkspace<TableRows[TableName]>(name, browse.refresh, browse.settle, { currentUserId, archived: true,
    ...(name === 'residents' ? { extra: (row: TableRows[TableName], close: () => void) => <ResidentDetailContent resident={row as ResidentRow} onClose={close} onIdStatusChange={browse.refresh} /> } : {}) });
  const columns: EditableDataTableColumn<TableRows[TableName]>[] = [
    { id: 'record', header: 'Record', initialWidth: 280, minWidth: 180, wrap: 'break-word', render: row => recordLabel(row as unknown as RecordData) },
    { id: 'status', header: 'Status', initialWidth: 160, minWidth: 130, render: row => String((row as unknown as RecordData).status ?? 'Archived') },
    lifecycle.column,
  ];
  return <>
    <ProfileTablePanel label={`${RECORD_CONFIG[name].label} Archive`} browse={browse}>
      <EditableDataTable columns={columns} rows={browse.value?.rows ?? []} rowKey={row => row.id} onRowClick={row => lifecycle.open(row)}
        emptyLabel="No archived records found." resizableColumns pinLastColumn tableMinWidth={800} density="compact" />
    </ProfileTablePanel>
    {lifecycle.view}
  </>;
}
