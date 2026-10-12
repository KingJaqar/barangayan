import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditableDataTable, type TableEditHandle } from '../../src/components/admin/editable-data-table';
import { DataTable } from '../../src/components/admin/data-table';
import { ToastProvider } from '../../src/components/ui/toast';
import { TableBrowsePanel } from '../../src/components/admin/table-browse-panel';
import { TableBrowseControls } from '../../src/components/admin/table-browse-controls';
import { TablePagination } from '../../src/components/admin/table-pagination';
import { SegmentedFilter } from '../../src/components/admin/segmented-filter';
import { useTableBrowseNavigation } from '../../src/hooks/use-table-browse-navigation';
import { pageRange, queryIdentity, type BrowseConfig } from '../../src/lib/admin-tables/browse-state';

const config: BrowseConfig = { defaultSort: 'name', filters: { tab: { values: ['all', 'active'], defaultValue: 'active' } }, sorts: [
  { key: 'name', columnId: 'name', label: 'Name', category: 'text', directions: ['asc', 'desc'], initialDirection: 'asc' },
  { key: 'created', label: 'Date created', category: 'date', directions: ['asc', 'desc'], initialDirection: 'desc' },
] };
const all = Array.from({ length: 1505 }, (_, index) => ({ id: String(index).padStart(5, '0'), name: `Resident ${String(index + 1).padStart(4, '0')}`, notes: 'Long unbroken content '.repeat(20) }));
function Fixture() {
  const [total, setTotal] = useState(101);
  const [failSave, setFailSave] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const edit = useRef<TableEditHandle | null>(null);
  const browse = useTableBrowseNavigation(config, async () => edit.current?.settle() ?? true);
  const { state } = browse;
  const matches = all.slice(0, total).filter(row => row.name.includes(state.q));
  if (state.dir === 'desc') matches.reverse();
  const range = pageRange(matches.length, state.page, state.pageSize);
  const rows = matches.slice((range.page - 1) * state.pageSize, range.page * state.pageSize);
  return <>
    <div className="table-browse-controls">
      <label>Fixture count <select value={total} onChange={event => setTotal(Number(event.target.value))}>{[0, 1, 7, 10, 11, 23, 100, 101, 1505].map(n => <option key={n}>{n}</option>)}</select></label>
      <button onClick={() => setFailSave(!failSave)}>Fail save: {String(failSave)}</button>
      <button onClick={() => setError(!error)}>Toggle error</button>
      <button onClick={() => setPending(!pending)}>Toggle pending</button>
    </div>
    <TableBrowsePanel label="Fixture" queryIdentity={queryIdentity(state)} pending={pending}
      error={error ? 'Fixture query failed' : null} onRetry={() => setError(false)}
      announcement={`Name ${state.dir}; Showing ${range.start}–${range.end} of ${matches.length}`}
      controls={<TableBrowseControls state={state} sorts={config.sorts} searchDraft={browse.searchDraft}
        onSearchChange={browse.changeSearch} onChange={browse.commit}
        filters={<SegmentedFilter label="Status" value={state.filters.tab} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }]}
          onChange={tab => void browse.commit({ filters: { tab } })} />} />}
      pagination={<TablePagination total={matches.length} page={range.page} pageSize={state.pageSize}
        onPageChange={page => void browse.commit({ page })} onPageSizeChange={pageSize => void browse.commit({ pageSize })} />}>
      <EditableDataTable rows={rows} rowKey={row => row.id} editHandleRef={edit} resizableColumns pinLastColumn tableMinWidth={1600}
        sorting={{ descriptor: config.sorts.find(sort => sort.key === state.sort)!, direction: state.dir, choices: config.sorts,
          onChange: (sort, dir) => void browse.commit({ sort, dir }) }} columns={[
          { id: 'name', header: 'Name', initialWidth: 240, render: row => row.name,
            edit: { type: 'text', getValue: row => row.name, onSave: async () => ({ error: failSave ? 'Synthetic save failure' : null }) } },
          { id: 'notes', header: 'Notes', initialWidth: 1000, wrap: 'break-word', render: row => row.notes },
          { id: 'actions', header: 'Actions', initialWidth: 160, render: row => <button onClick={() => alert(row.id)}>Details {row.id}</button> },
        ]} />
    </TableBrowsePanel>
    <button id="after-table">After table</button>
    <div id="legacy"><DataTable rows={all.slice(0, 23)} rowKey={row => row.id} columns={[{ header: 'Dashboard fixture', render: row => row.name }]} /></div>
  </>;
}
function App() {
  const [mounted, setMounted] = useState(true);
  const [sidebar, setSidebar] = useState(false);
  return <ToastProvider><button id="mount" onClick={() => setMounted(!mounted)}>Toggle mount</button>
    <button id="sidebar" onClick={() => setSidebar(!sidebar)}>Toggle sidebar</button>
    <div style={{ display: 'flex', width: '100%' }}><aside style={{ width: sidebar ? 250 : 0, flexShrink: 0 }} />
      <main data-admin-viewport style={{ minWidth: 0, flex: 1, height: 'calc(100vh - 60px)', overflow: 'auto', padding: 16 }}>
        {mounted && <Fixture />}<div style={{ height: 800 }}>Outside scroll space</div>
      </main></div></ToastProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
