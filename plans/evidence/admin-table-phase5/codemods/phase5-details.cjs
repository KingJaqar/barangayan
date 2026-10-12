const fs = require('node:fs');
const base = 'apps/admin-web/src/app/(admin)/';
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const write = (file, value) => fs.writeFileSync(file, value);
for (const [file, component, prop, dto, label] of [
  ['incident-reports/incident-detail-modal.tsx', 'IncidentDetailModal', 'incident', 'IncidentRow', 'Incident details'],
  ['health/drive-detail-modal.tsx', 'DriveDetailModal', 'drive', 'DriveRow', 'Drive details'],
  ['health/applicants/applicant-detail-modal.tsx', 'ApplicantDetailModal', 'row', 'ApplicantRow', 'Applicant details'],
]) {
  let code = read(base + file);
  code = code.replace("import { formatDateTime } from '@barangayan/shared';", "import { formatAdminTimestamp as formatDateTime } from '@/lib/admin-tables/pilot-config';")
    .replace("import { useRouter } from 'next/navigation';\n", '')
    .replace("import { useEffect, useState } from 'react';", "import { useEffect, useRef, useState } from 'react';")
    .replace(`import type { ${dto} } from './page';`, `import type { ${dto} } from './types';`)
    .replace("import { logAdminAction }", "import { TableDetailDialog, TableDetailState } from '@/components/admin/table-detail-dialog';\nimport { logAdminAction }");
  const start = code.indexOf(`export function ${component}(`), end = code.indexOf('  const toast = useToast();', start);
  code = code.slice(0, start) + `export function ${component}({ ${prop}, onClose, onChanged, onEditingChange, detailStatus, onRetry }: {
  ${prop}: ${dto}; onClose: () => void; onChanged: () => void; onEditingChange: (editing: boolean) => void;
  detailStatus: 'loading' | 'ready' | 'error' | 'unavailable'; onRetry: () => void;
}) {
` + code.slice(end);
  if (!code.includes('const savingRef')) code = code.replace('  const [saving, setSaving] = useState(false);', '  const [saving, setSaving] = useState(false);\n  const savingRef = useRef(false);');
  const eff = code.indexOf('  useEffect(() => {'), effEnd = code.indexOf('\n\n  async function saveDetails', eff);
  code = code.slice(0, eff) + `  useEffect(() => {
    onEditingChange(editing);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);

` + code.slice(effEnd + 2);
  if (prop !== 'row') {
    code = code.replace('  async function saveDetails() {', '  async function saveDetails() {\n    if (savingRef.current) return;');
    code = code.replace('    setSaving(true);', '    savingRef.current = true;\n    setSaving(true);');
    if (prop === 'incident') code = code.replace("    const { error } = await supabase", "    let result;\n    try { result = await supabase").replace("      .eq('id', incident.id);\n    setSaving(false);", "      .eq('id', incident.id).select('id').maybeSingle();\n    } catch (cause) {\n      savingRef.current = false; setSaving(false);\n      toast.showError(`Failed to save: ${cause instanceof Error ? cause.message : 'The update could not be completed.'}`); return;\n    }\n    savingRef.current = false; setSaving(false);\n    const { error, data: updated } = result;");
    else code = code.replace("    const { error } = await supabase.from('medical_drives').update(newValues).eq('id', drive.id);\n    setSaving(false);", "    let result;\n    try { result = await supabase.from('medical_drives').update(newValues).eq('id', drive.id).select('id').maybeSingle(); }\n    catch (cause) {\n      savingRef.current = false; setSaving(false);\n      toast.showError(`Failed to save: ${cause instanceof Error ? cause.message : 'The update could not be completed.'}`); return;\n    }\n    savingRef.current = false; setSaving(false);\n    const { error, data: updated } = result;");
    code = code.replace('    if (error) {', "    if (error || !updated) {").replace('`Failed to save: ${error.message}`', "`Failed to save: ${error?.message ?? 'No record was updated. Check your access.'}`");
  }
  code = code.replace('    router.refresh();', '    onChanged();').replace('    onSave({ ...row, ...updated });\n', '');
  const rootStart = code.indexOf('    <div\n      className="fixed inset-0'), rootEnd = code.indexOf('      <div\n', rootStart);
  code = code.slice(0, rootStart) + `    <TableDetailDialog label={\`${label}: \${${prop}.${prop === 'row' ? 'applicant_number' : 'title'}}\`}
      preventClose={saving} onClose={() => { if (!savingRef.current) onClose(); }}>
      {detailStatus !== 'ready' && !editing ? <TableDetailState status={detailStatus} onClose={onClose} onRetry={onRetry} /> :
` + code.slice(rootEnd);
  code = code.replace('      </div>\n    </div>\n  );', '      </div>}\n    </TableDetailDialog>\n  );');
  code = code.replace('className="flex items-start justify-between gap-3 border-b', 'className="flex max-h-[40vh] shrink-0 items-start justify-between gap-3 overflow-y-auto border-b')
    .replace('className="flex-1"', 'className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"')
    .replace('className="flex-1 overflow-y-auto', 'className="min-h-0 flex-1 overflow-y-auto break-words [overflow-wrap:anywhere]');
  code = code.replace('onClick={onClose}\n            aria-label="Close"', 'onClick={onClose}\n            disabled={saving}\n            aria-label="Close"');
  if (prop === 'incident') {
    code = code.replace('variant="full" />', 'variant="full" onChanged={onChanged} />');
    code = code.replace('                autoFocus\n', '                autoFocus\n                aria-label="Incident title"\n');
    code = code.replace('placeholder="Description"', 'aria-label="Description" placeholder="Description"').replace('placeholder="Address"', 'aria-label="Address" placeholder="Address"').replace('placeholder="Specific area details (e.g. near the blue gate)"', 'aria-label="Specific area details" placeholder="Specific area details (e.g. near the blue gate)"');
    code = code.replace('<div className="border-t border-black/10 px-6 py-4 dark:border-white/10">', '<fieldset disabled={editing || saving} className="shrink-0 border-t border-black/10 px-6 py-4 dark:border-white/10">')
      .replace('onChanged={onChanged} />\n        </div>', 'onChanged={onChanged} />\n        </fieldset>');
  }
  if (prop === 'drive') code = code.replace('          {/* Timeline */}', `          <div className="mb-3 text-xs text-zinc-500"><p className="font-semibold uppercase tracking-wide">Date created</p>
            <p>{formatDateTime(drive.created_at)}</p></div>
          {/* Timeline */}`);
  write(base + file, code);
}
for (const file of ['incident-reports/incident-table.tsx', 'health/drive-table.tsx', 'health/applicants/applicants-table.tsx']) {
  let code = read(base + file);
  const start = code.indexOf('export function ' + (file.includes('incident-table') ? 'IncidentTable' : file.includes('applicants-table') ? 'ApplicantsTable' : 'DriveTable'));
  code = code.slice(0, start) + code.slice(start).replaceAll('router.refresh()', 'browse.refresh()');
  code = code.replace("      canEdit: () => !optionsError,\n", '');
  if (file.includes('incident-table')) code = code.replaceAll("      edit: {\n        type: 'select',", "      edit: {\n        type: 'select',"); // option guards only
  if (file.includes('incident-table')) {
    code = code.replace("options: [{ value: '', label: 'Uncategorized' }", "canEdit: () => !optionsError,\n        options: [{ value: '', label: 'Uncategorized' }")
      .replace("options: [{ value: '', label: 'Anonymous / Walk-in' }", "canEdit: () => !optionsError,\n        options: [{ value: '', label: 'Anonymous / Walk-in' }");
    code = code.replace("import { formatDateTime, type Tables } from '@barangayan/shared';", "import type { Tables } from '@barangayan/shared';\nimport { formatAdminTimestamp as formatDateTime } from '@/lib/admin-tables/pilot-config';");
  }
  code = code.replace('onRowClick={row => void detail.open(row)}', 'onRowClick={(row, trigger) => void detail.open(row, trigger)}');
  const propStart = code.indexOf('        browse={{');
  code = code.slice(0, propStart) + `        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: config.sorts,
          onChange: (sort, dir) => void browse.commit({ sort, dir }) }} />` + code.slice(code.indexOf(' />', propStart) + 3);
  code = code.replace(/\{addOpen( && !optionsError)? && (<Add[^]*?onChanged=\{browse.refresh\} \/>)\}/, '{addOpen && <fieldset disabled={browse.pending' + (file.includes('drive-table.tsx') ? '' : ' || !!optionsError') + '}>$2</fieldset>}');
  write(base + file, code);
}
let actions = read(base + 'incident-reports/incident-actions.tsx');
actions = actions.replace("  variant?: 'compact' | 'full';", "  variant?: 'compact' | 'full';\n  onBeforeAction?: () => Promise<boolean>; onChanged?: () => void;")
  .replace("variant = 'full' }: IncidentActionsProps)", "variant = 'full', onBeforeAction, onChanged }: IncidentActionsProps)")
  .replace('    setBusy(true);', '    if (onBeforeAction && !await onBeforeAction()) return;\n    setBusy(true);')
  .replace('  async function softDelete() {\n    setBusy(true);', '  async function softDelete() {\n    if (onBeforeAction && !await onBeforeAction()) return;\n    setBusy(true);')
  .replaceAll('    router.refresh();', '    if (onChanged) onChanged(); else router.refresh();');
write(base + 'incident-reports/incident-actions.tsx', actions);
