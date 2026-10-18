import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditableDataTable } from '../../src/components/admin/editable-data-table';
import { Toaster } from '../../src/components/ui/sonner';
import { ThemeControllerProvider } from '../../src/components/ui/theme-controller';

function Fixture() {
  const [visible, setVisible] = useState(true);
  const [count, setCount] = useState(0);
  const columns = [
    { id: 'name', header: 'Name', render: (row: { id: string }) => row.id },
    { id: 'actions', header: 'Actions', render: (row: { id: string }) => row.id === 'empty' ? 'No actions' : <div onClick={event => event.stopPropagation()}>
      <button type="button" onClick={() => setCount(value => value + 1)}>Run {row.id}</button>
      <button type="button" aria-label="Protected" disabled>Protected</button>
      <button type="button" hidden>Hidden action</button>
      <a href="#linked">Open link</a>
    </div> },
  ];
  return <ThemeControllerProvider><Toaster /><main>
    <button id="unmount" onClick={() => setVisible(false)}>Unmount tables</button>
    <output id="count">{count}</output>
    {visible && <>
      <EditableDataTable contextMenuColumnId="actions" columns={columns} rows={[{ id: 'first' }, { id: 'second' }, { id: 'empty' }]} rowKey={row => row.id} />
      <EditableDataTable contextMenuColumnId="actions" columns={columns} rows={[{ id: 'other-table' }]} rowKey={row => row.id} />
      <EditableDataTable columns={columns} rows={[{ id: 'unsupported' }]} rowKey={row => row.id} />
    </>}
  </main></ThemeControllerProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
