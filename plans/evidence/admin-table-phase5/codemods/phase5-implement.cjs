const fs = require('node:fs');
const base = 'apps/admin-web/src/app/(admin)/';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const write = (file, value) => fs.writeFileSync(file, value);
const specs = [
  ['incidents', 'incident-reports/', 'IncidentRow', 'IncidentTable', 'incident-table', 'Incident Reports', 'Review, triage, and resolve community-submitted incident reports.'],
  ['health', 'health/', 'DriveRow', 'DriveTable', 'drive-table', 'Health', 'Manage vaccination, medical, and wellness drives for the barangay.'],
  ['applicants', 'health/applicants/', 'ApplicantRow', 'ApplicantsTable', 'applicants-table', 'Medical Applicants', 'Review and manage resident registrations for medical drives.'],
];
for (const [name, dir, rowType, component, tableFile, label, description] of specs) {
  const oldPage = read(base + dir + 'page.tsx');
  const dto = oldPage.slice(oldPage.indexOf(`export type ${rowType}`), oldPage.indexOf('\n\n', oldPage.indexOf(`export type ${rowType}`)));
  const typesFile = base + dir + 'types.ts';
  let types = read(typesFile);
  if (name !== 'applicants') types = types.replace(`  { key: 'all', label: 'All' },\n`, '').replace('= [\n', "= [\n  { key: 'all', label: 'All' },\n");
  write(typesFile, (name !== 'applicants' ? "import type { Tables } from '@barangayan/shared';\n\n" : '') + types + '\n' + dto + '\n');
  const hasOptions = name !== 'health';
  const options = name === 'incidents' ? `operationsOptions(supabase, 'incident_categories', profile.barangay_id),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'resident')` : `operationsOptions(supabase, 'medical_drives', profile.barangay_id),
    pilotOptions(supabase, 'profiles', profile.barangay_id, 'resident')`;
  write(base + dir + 'page.tsx', `import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTable, parseTableState } from '@/lib/admin-tables/queries/browse';
${hasOptions ? "import { pilotOptions } from '@/lib/admin-tables/queries/pilot-options';\nimport { operationsOptions } from '@/lib/admin-tables/queries/operations-options';\n" : ''}import { ${component} } from './${tableFile}';
export type { ${rowType} } from './types';

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams(Object.entries(await searchParams)
    .flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('barangay_id,role')
    .eq('id', user.id).is('deleted_at', null).single();
  if (!profile || profile.role !== 'admin') redirect('/login');
  const ${hasOptions ? '[results, options, residents]' : 'results'} = await ${hasOptions ? `Promise.all([loadTable('${name}', params, supabase),\n    ${options}])` : `loadTable('${name}', params, supabase)`};
  return <div className="mx-auto min-w-0 max-w-6xl">
    <div className="mb-6"><h1 className="text-2xl font-bold">${label}</h1>
      <p className="text-sm text-zinc-500">${description}</p></div>
    <${component} result={results.table} summary={results.summary} requestedState={parseTableState('${name}', params)}
      barangayId={profile.barangay_id}${hasOptions ? `\n      ${name === 'incidents' ? 'categories' : 'drives'}={options.status === 'success' ? options.value : []}
      residents={residents.status === 'success' ? residents.value : []}
      optionsError={options.status === 'error' ? options.message : residents.status === 'error' ? residents.message : null}` : ''} />
  </div>;
}
`);
  let code = read(base + dir + tableFile + '.tsx');
  code = code.replace("import { useEffect, useRef, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';")
    .replace(`import type { ${rowType} } from './page';`, `import type { ${rowType} } from './types';`)
    .replace(/, type Tab/g, '');
  code = code.replace("import { useRouter } from 'next/navigation';", "import { useSearchParams } from 'next/navigation';");
  code = code.replace("import { logAdminAction }", `import { OperationsTableSummary } from '@/components/admin/operations-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { useProfileTableDetail } from '@/hooks/use-profile-table-detail';
import { operationsConfig } from '@/lib/admin-tables/operations-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import { logAdminAction }`);
  // Form refreshes use the same coalesced path as edits and subscriptions.
  if (name === 'incidents') {
    code = code.replace('  onClose,\n}: {', '  onClose, onChanged,\n}: {').replace('  onClose: () => void;\n}) {', '  onClose: () => void; onChanged: () => void;\n}) {');
  } else if (name === 'health') {
    code = code.replace('function AddDriveForm({ barangayId, onClose }: { barangayId: string; onClose: () => void })', 'function AddDriveForm({ barangayId, onClose, onChanged }: { barangayId: string; onClose: () => void; onChanged: () => void })');
  } else {
    code = code.replace('function AddApplicantForm({ onClose }: { onClose: () => void })', 'function AddApplicantForm({ onClose, onChanged, drives, residents }: { onClose: () => void; onChanged: () => void; drives: DriveOption[]; residents: ResidentOption[] })');
    code = code.replace("  const [drives, setDrives] = useState<DriveOption[]>([]);\n  const [residents, setResidents] = useState<ResidentOption[]>([]);\n", '');
    const start = code.indexOf('  useEffect(() => {');
    const end = code.indexOf('\n\n  async function handleSubmit', start);
    code = code.slice(0, start) + code.slice(end);
    code = code.replace("{ month: 'short', day: 'numeric', year: 'numeric' }", "{ month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }")
      .replace("{ hour: 'numeric', minute: '2-digit' }", "{ hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }");
  }
  code = code.replace('  const router = useRouter();\n', '').replace('    router.refresh();', '    onChanged();'); // first form only, main removed below
  const start = code.indexOf(`export function ${component}(`);
  const mutation = code.indexOf('  async function updateField', start);
  code = code.slice(0, start) + `export function ${component}({ result, summary, requestedState, barangayId${hasOptions ? name === 'incidents' ? ', categories, residents, optionsError' : ', drives, residents, optionsError' : ''} }: {
  result: QueryOutcome<BrowseResult<${rowType}>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string;${hasOptions ? `\n  ${name === 'incidents' ? 'categories: CategoryOption[]' : 'drives: DriveOption[]'}; residents: ResidentOption[]; optionsError: string | null;` : ''}
}) {
  const toast = useToast();
  const params = useSearchParams();
  const category = params.get('category') ?? '';
  const config = useMemo(() => operationsConfig('${name}'${name === 'incidents' ? ', [category, ...categories.map(option => option.id)]' : ''}), [${name === 'incidents' ? 'category, categories' : ''}]);
  const browse = useConfiguredTableBrowse(config, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = config.sorts.find(sort => sort.key === state.sort)!;
  const detail = useProfileTableDetail<${rowType}>('${name}', result, browse.settle);
  const [addOpen, setAddOpen] = useState(false);
  const [channelName] = useState(() => 'admin-${name}-' + Math.random().toString(36).slice(2));
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: '${name === 'incidents' ? 'incidents' : name === 'health' ? 'medical_drives' : 'drive_registrations'}' }, browse.refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelName, browse.refresh]);

` + code.slice(mutation);
  code = code.replaceAll('    onChanged();', '    browse.refresh();'); // then correct form section below
  const mainStart = code.indexOf(`export function ${component}(`);
  code = code.slice(0, mainStart).replaceAll('    browse.refresh();', '    onChanged();') + code.slice(mainStart);
  code = code.replaceAll('onClick={() => setSelected(r)}', 'onClick={event => void detail.open(r, event.currentTarget)}');
  const columnIds = name === 'incidents' ? {Incident:'title',Category:'category',Reporter:'reporter',Confirmed:'confirmations',Status:'status',Submitted:'submitted'}
    : name === 'health' ? {Drive:'title',Category:'category',Date:'drive_date',Stock:'stock',Registrations:'registrations',Active:'active'}
    : {'Applicant #':'number',Drive:'drive',Resident:'resident',Age:'age','Priority Score':'priority',Status:'status','Registered At':'registered'};
  for (const [header, id] of Object.entries(columnIds)) code = code.replace(`header: '${header}',`, `id: '${id}', header: '${header === 'Date' ? 'Drive date' : header}',`);
  if (name === 'incidents') code = code.replace(/(id: '(category|reporter)', header: '(Category|Reporter)',)/g, '$1\n      canEdit: () => !optionsError,');
  const removalName = name === 'incidents' ? 'removeIncident' : name === 'health' ? 'removeDrive' : 'cancelRegistration';
  code = code.replace(new RegExp(`(async function ${removalName}\\([^]*?\\) \\{)`), '$1\n    if (!await browse.settle()) return;');
  if (name === 'incidents') code = code.replace('variant="compact" />', 'variant="compact" onBeforeAction={browse.settle} onChanged={browse.refresh} />');
  const returnStart = code.indexOf('  return (\n    <>', code.indexOf('  const columns:', mainStart));
  const filter = name === 'incidents' ? `<label className="flex flex-wrap items-center gap-2 text-sm">Category
        <select aria-label="Category" value={state.filters.category} disabled={!!optionsError}
          onChange={event => void browse.commit({ filters: { category: event.target.value } })}>
          <option value="">All categories</option>
          {state.filters.category && !categories.some(option => option.id === state.filters.category) && <option value={state.filters.category}>Selected category</option>}
          {categories.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select></label>` : `<label className="flex flex-wrap items-center gap-2 text-sm">Category
        <select aria-label="Category" value={state.filters.type} onChange={event => void browse.commit({ filters: { type: event.target.value } })}>
          <option value="">All categories</option>
          {DRIVE_TYPES.map(type => <option key={type} value={type}>{DRIVE_TYPE_CONFIG[type].label}</option>)}
        </select></label>`;
  const addLabel = name === 'incidents' ? '+ Add Incident' : name === 'health' ? '+ Add Drive' : '+ Add Registration';
  const groupLabel = name === 'incidents' ? 'Incident status' : name === 'health' ? 'Drive schedule' : 'Registration status';
  const form = name === 'incidents' ? '<AddIncidentForm categories={categories} residents={residents} barangayId={barangayId} onClose={() => setAddOpen(false)} onChanged={browse.refresh} />'
    : name === 'health' ? '<AddDriveForm barangayId={barangayId} onClose={() => setAddOpen(false)} onChanged={browse.refresh} />'
    : '<AddApplicantForm drives={drives} residents={residents} onClose={() => setAddOpen(false)} onChanged={browse.refresh} />';
  const modal = name === 'incidents' ? 'IncidentDetailModal incident' : name === 'health' ? 'DriveDetailModal drive' : 'ApplicantDetailModal row';
  code = code.slice(0, returnStart) + `  return <div ref={detail.containerRef}>
    <OperationsTableSummary name="${name}" summary={summary} onRetry={browse.refresh} />
    ${hasOptions ? '<div>{optionsError && <p role="alert" className="mb-4">{optionsError} <button type="button" onClick={browse.refresh}>Retry options</button></p>}</div>' : ''}
    {addOpen${hasOptions ? ' && !optionsError' : ''} && ${form}}
    <ProfileTablePanel label="${label === 'Health' ? 'Medical drives' : label}" browse={browse} controls={<>
      ${filter}
      <SegmentedFilter label="${groupLabel}" options={TABS.map(tab => ({ value: tab.key, label: tab.label }))}
        value={state.filters.tab} onChange={tab => void browse.commit({ filters: { tab } })} />
      <button type="button" onClick={async () => { if (await browse.settle()) setAddOpen(true); }}
        disabled={browse.pending || !barangayId${hasOptions ? ' || !!optionsError' : ''}}
        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">${addLabel}</button>
    </>}>
      <EditableDataTable rows={value?.rows ?? []} rowKey={row => row.id} columns={columns}
        emptyLabel="${name === 'incidents' ? 'No incident reports found.' : name === 'health' ? 'No medical drives found.' : 'No registrations found.'}"
        onRowClick={row => void detail.open(row)} resizableColumns ${name === 'applicants' ? '' : 'pinLastColumn'} density="compact"
        tableMinWidth={name === 'incidents' ? 1710 : name === 'health' ? 900 : 1320} cellOverflow="hidden"
        browse={{ label: '${label === 'Health' ? 'Medical drives' : label}', queryIdentity: value?.queryIdentity ?? '',
          sort: { key: state.sort, dir: state.dir }, sorts: config.sorts,
          onSort: sort => void browse.commit(sort), activeColumnId: activeSort.columnId,
          editHandle: browse.editHandle, onEditingChange: browse.onEditingChange }} />
    </ProfileTablePanel>
    {detail.selected && <${modal}={detail.selected} key={detail.selected.id}
      detailStatus={detail.status} onRetry={detail.retry} onClose={detail.close}
      onChanged={browse.refresh} onEditingChange={browse.onEditingChange} />}
  </div>;
}
`;
  if (name !== 'incidents') code = code.replace("  const params = useSearchParams();\n  const category = params.get('category') ?? '';\n", '').replace("import { useSearchParams } from 'next/navigation';\n", '');
  write(base + dir + tableFile + '.tsx', code);
}
