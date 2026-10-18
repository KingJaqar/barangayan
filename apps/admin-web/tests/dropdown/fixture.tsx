import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Controller, useForm } from 'react-hook-form';
import { AdminSelect } from '../../src/components/admin/dropdown/admin-select';
import { ContentCreatePanel } from '../../src/components/admin/content-create-panel';
import { EditableDataTable, type EditableDataTableColumn } from '../../src/components/admin/editable-data-table';
import { Toaster } from '../../src/components/ui/sonner';
import { ThemeControllerProvider } from '../../src/components/ui/theme-controller';
import { DateRangePicker, type DateRangeValue } from '../../src/components/admin/date-range-picker';

const options = [{ value: '', label: 'Select a resident…' }, { value: 'a', label: 'Alpha Resident' },
  { value: 'b', label: 'Beta Resident', disabled: true }, ...Array.from({ length: 70 }, (_, i) => ({ value: `r${i}`, label: `Resident ${String(i).padStart(2, '0')} — a long household name that wraps` }))];

function RequiredForm() {
  const [value, setValue] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [short, setShort] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [calls, setCalls] = useState(0);
  const [submitted, setSubmitted] = useState('');
  return <>
    <button type="button" onClick={() => setDisabled(!disabled)}>Toggle fieldset</button>
    <button type="button" onClick={() => setShort(!short)}>Toggle options</button>
    <button type="button" onClick={() => setEmpty(!empty)}>Toggle empty options</button>
    <form onSubmit={event => { event.preventDefault(); setSubmitted(String(new FormData(event.currentTarget).get('resident'))); }}>
      <fieldset disabled={disabled}><label>Resident<AdminSelect name="resident" required aria-label="Resident" value={value}
        options={empty ? [] : short ? options.slice(0, 2) : options} onValueChange={next => { setValue(next); setCalls(current => current + 1); }} /></label>
      <label>Next field<input aria-label="Next field" /></label></fieldset>
      <button type="submit">Submit required</button><button type="reset">Reset form</button>
    </form>
    <output data-testid="calls">{calls}</output><output data-testid="submitted">{submitted}</output>
  </>;
}

function HookForm() {
  const form = useForm({ defaultValues: { icon: 'qr-code-outline' } });
  const [submitted, setSubmitted] = useState('');
  return <form onSubmit={form.handleSubmit(data => setSubmitted(data.icon))}>
    <Controller name="icon" control={form.control} render={({ field, fieldState }) => <>
      <AdminSelect ref={field.ref} name={field.name} aria-label="Icon" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur}
        options={[{ value: 'qr-code-outline', label: 'QR code' }, { value: 'warning-outline', label: 'Warning' }]} />
      <output data-testid="hook-state">{JSON.stringify({ dirty: fieldState.isDirty, touched: fieldState.isTouched })}</output>
    </>} />
    <button type="submit">Submit icon</button><button type="button" onClick={() => form.reset()}>Reset icon</button>
    <output data-testid="hook-submit">{submitted}</output>
  </form>;
}

function Fixture() {
  const [row, setRow] = useState({ id: '1', status: 'a' });
  const [writes, setWrites] = useState(0);
  const [rowOpens, setRowOpens] = useState(0);
  const [commit, setCommit] = useState(false);
  const [fail, setFail] = useState(false);
  const [dates, setDates] = useState<DateRangeValue>({ from: '', to: '' });
  const [dateCalls, setDateCalls] = useState(0);
  const [edge, setEdge] = useState('');
  const columns: EditableDataTableColumn<typeof row>[] = [{ header: 'Status', render: item => item.status, initialWidth: 180,
    edit: { type: 'select', options: [{ value: 'a', label: 'Alpha' }, { value: 'c', label: 'Complete' }], getValue: item => item.status, commitOnChange: commit,
      onSave: async (_item, value) => { setWrites(current => current + 1); if (fail) return { error: 'Fixture save failed' }; setRow(current => ({ ...current, status: String(value) })); return { error: null }; } },
  }, { header: 'Description', render: () => 'Wide table content', initialWidth: 900 }];
  return <main style={{ padding: 16 }}>
    <h1>Dropdown interaction fixture</h1><RequiredForm /><HookForm />
    <ContentCreatePanel title="Drawer pilot" description="Synthetic form" forms={[{ label: 'Open drawer', title: 'Resident drawer', description: 'Focus containment pilot', content: <RequiredForm /> }]} />
    <button onClick={() => setCommit(!commit)}>Toggle immediate commit</button><button onClick={() => setFail(!fail)}>Toggle save failure</button>
    <div style={{ overflow: 'auto', maxWidth: '100%' }}><EditableDataTable columns={columns} rows={[row]} rowKey={item => item.id}
      tableMinWidth={1000} resizableColumns onRowClick={() => setRowOpens(current => current + 1)} /></div>
    <output data-testid="writes">{writes}</output><output data-testid="row-opens">{rowOpens}</output>
    <DateRangePicker value={dates} onChange={next => { setDates(next); setDateCalls(current => current + 1); }} />
    <output data-testid="dates">{JSON.stringify({ ...dates, calls: dateCalls })}</output>
    <div style={{ position: 'fixed', right: 0, bottom: 0, width: 230 }}><AdminSelect aria-label="Viewport edge" value={edge} onValueChange={setEdge}
      options={[{ value: '', label: 'Uncategorized' }, ...options.slice(1)]} /></div>
  </main>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<ThemeControllerProvider><Toaster /><Fixture /></ThemeControllerProvider>);
