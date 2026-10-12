'use client';

import type { ReactNode } from 'react';
import type { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { pageRange } from '@/lib/admin-tables/browse-state';
import { directionLabel } from '@/lib/admin-tables/sort-definitions';
import { TableBrowsePanel } from './table-browse-panel';
import { TableBrowseControls } from './table-browse-controls';
import { TablePagination } from './table-pagination';

export function ProfileTablePanel<T>({ label, browse, category, filters, actions, children }: {
  label: string; browse: ReturnType<typeof useConfiguredTableBrowse<T>>;
  category?: ReactNode; filters?: ReactNode; actions?: ReactNode; children: ReactNode;
}) {
  const { value, state } = browse;
  const active = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const range = value ? pageRange(value.total, state.page, state.pageSize) : null;
  return <TableBrowsePanel label={label} pending={browse.pending} error={browse.error} onRetry={browse.refresh}
    queryIdentity={value?.queryIdentity}
    announcement={value && range ? `${active.label}, ${directionLabel(active, state.dir)}; Showing ${range.start}–${range.end} of ${value.total}` : undefined}
    controls={<TableBrowseControls state={state} sorts={browse.config.sorts} searchDraft={browse.searchDraft}
      onSearchChange={browse.changeSearch} onChange={change => void browse.commit(change)}
      category={category} filters={filters} actions={actions} />}
    pagination={value && <TablePagination total={value.total} page={state.page} pageSize={state.pageSize} pending={browse.pending}
      onPageChange={page => void browse.commit({ page })} onPageSizeChange={pageSize => void browse.commit({ pageSize })} />}>
    {children}
  </TableBrowsePanel>;
}
