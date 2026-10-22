// Phase 19 whole-app audit (P19-T01/T02/T05): joins the 1,218 parity checkpoints, 54+10 routes and 16 modal
// families to the CURRENT iOS source, its tests, the execution ledger and the release gates. It reads only; it
// proves structure (the implementing file exists and matches, a test names the checkpoint, the gate is open or
// closed). It does not prove a checkpoint's behavior: that stays with the owning phase record and its tests.
//
//   node plans/evidence/resident-ios-parity/phase-19/audit.mjs
//
// Writes audit-results.json, checkpoint-coverage.csv and coverage-report.md next to itself. Exits 1 when a
// route, modal family or section locator does not resolve, a checkpoint has no owning phase, or a counted total drifts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const evidence = join(here, '..');
const ios = join(here, '..', '..', '..', '..', 'apps', 'resident-ios-mobile');
const src = join(ios, 'src');

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; rows.push(row); row = []; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
const read = (path) => readFileSync(path, 'utf8');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const problems = [];
const problem = (message) => problems.push(message);

const parity = parseCsv(read(join(evidence, 'phase-00', 'parity-ledger.csv')));
const routes = parseCsv(read(join(evidence, 'phase-00', 'route-ledger.csv')));
const modals = parseCsv(read(join(evidence, 'phase-00', 'modal-ledger.csv')));
const execution = parseCsv(read(join(evidence, 'execution-ledger.csv')));

// ---- totals the plan states -------------------------------------------------------------------------------
if (parity.length !== 1218) problem(`parity ledger has ${parity.length} checkpoints, expected 1218`);
if (routes.filter((r) => /^R\d\d$/.test(r.route_id)).length !== 54) problem('route ledger does not hold R01-R54');
if (modals.length !== 16) problem(`modal ledger has ${modals.length} families, expected 16`);

// ---- phase status -----------------------------------------------------------------------------------------
const phaseStatus = Object.fromEntries(execution.filter((r) => r.type === 'phase').map((r) => [r.id, r.status]));
const statusClass = (status) => (/^Verified/.test(status) ? 'verified' : /^Partially/.test(status) ? 'partial' : /^Blocked/.test(status) ? 'blocked' : 'planned');

// ---- route map: each Android route to the iOS file that carries its outcome ---------------------------------
// [file under src/app, how it is carried, text the file must contain (proves it is that outcome, not a stub)]
const T = '(tabs)/';
const ROUTE_MAP = {
  R01: ['_layout.tsx', 'canonical', /ResidentProvider/], R02: [`${T}_layout.tsx`, 'canonical', /NativeTabs/],
  R03: [`${T}health/_layout.tsx`, 'canonical', /Stack/], R04: [`${T}health/index.tsx`, 'canonical', /Health/],
  R05: ['health/register/[id].tsx', 'alias (id in the path instead of ?driveId=)', /RegisterScreen/],
  R06: [`${T}home/_layout.tsx`, 'canonical', /Stack/],
  R07: ['emergency.tsx', 'converged (no nested home/emergency-info stack; one root route)', /EmergencyScreen/],
  R08: ['emergency.tsx', 'canonical', /EmergencyScreen/],
  R09: ['emergency.tsx', 'converged (?section=qr)', /EmergencyScreen/], R10: ['emergency.tsx', 'converged (?section=qr, scan inside the section)', /EmergencyScreen/],
  R11: [`${T}home/index.tsx`, 'canonical', /Home/], R12: ['emergency.tsx', 'converged (duplicate of R09)', /EmergencyScreen/],
  R13: [`${T}maps/_layout.tsx`, 'canonical', /Stack/],
  R14: [`${T}maps/hotline-directory.tsx`, 'redirect to /emergency?section=hotlines', /section: 'hotlines'/],
  R15: [`${T}maps/index.tsx`, 'canonical', /Maps/],
  R16: [`${T}maps/preparedness-guide.tsx`, 'redirect to /emergency?section=guidelines', /section: 'guidelines'/],
  R17: [`${T}reports/_layout.tsx`, 'canonical', /Stack/], R18: [`${T}reports/incidents/[incidentId].tsx`, 'canonical', /IncidentDetail|incident/i],
  R19: [`${T}reports/index.tsx`, 'canonical', /Reports/], R20: [`${T}reports/new.tsx`, 'canonical', /Concern/],
  R21: [`${T}services/_layout.tsx`, 'canonical', /Stack/], R22: [`${T}services/[id].tsx`, 'alias ([id] for [documentId])', /DocumentDetail|useLocalSearchParams/],
  R23: [`${T}services/index.tsx`, 'canonical', /segment/],
  R24: ['services/payment/[requestId].tsx', 'canonical', /requestId/], R25: ['services/payment/pickup/[requestId].tsx', 'canonical', /requestId/],
  R26: ['services/payment/qrph/[requestId].tsx', 'canonical', /requestId/], R27: ['services/payment/success.tsx', 'canonical', /requestId/],
  R28: ['services/request/[id].tsx', 'alias ([id] for [documentId])', /RequestRoute/], R29: ['request/[id].tsx', 'alias (/request/[id] for /services/requests/[requestId])', /RequestDetail|id/],
  R30: [`${T}settings/_layout.tsx`, 'canonical', /Stack/], R31: [`${T}settings/about.tsx`, 'canonical', /About/],
  R32: [`${T}settings/change-password.tsx`, 'canonical', /./], R33: [`${T}settings/email-verification.tsx`, 'canonical', /./],
  R34: [`${T}settings/help/[id].tsx`, 'alias ([id] for [articleId])', /./], R35: [`${T}settings/help/index.tsx`, 'canonical', /./],
  R36: [`${T}settings/index.tsx`, 'canonical', /./], R37: [`${T}settings/location-verification.tsx`, 'canonical', /./],
  R38: [`${T}settings/profile.tsx`, 'canonical (/profile redirects here)', /./], R39: [`${T}settings/terms-privacy.tsx`, 'canonical', /./],
  R40: ['_layout.tsx', 'converged (auth routes live in the root stack, guarded)', /Stack\.Protected/],
  R41: ['auth/choice.tsx', 'canonical', /./], R42: ['onboarding/completion.tsx', 'canonical', /./], R43: ['auth/recovery.tsx', 'canonical', /./],
  R44: ['auth/login.tsx', 'canonical', /./], R45: ['auth/otp.tsx', 'canonical', /./], R46: ['onboarding/personalization.tsx', 'canonical', /./],
  R47: ['auth/register.tsx', 'canonical', /./], R48: ['auth/reset-password.tsx', 'canonical', /./], R49: ['onboarding/value-prop.tsx', 'canonical', /./],
  R50: ['onboarding/welcome.tsx', 'canonical', /./], R51: ['account-setup.tsx', 'canonical', /./], R52: ['auth/callback.tsx', 'canonical', /./],
  R53: ['complete-profile.tsx', 'canonical', /./], R54: ['index.tsx', 'canonical', /Redirect/],
  RD01: [null, 'deferred untriaged Android delta (OD-03), not iOS scope', null], RD02: [null, 'deferred untriaged Android delta (OD-03/OD-11), not iOS scope', null],
  IR01: [`${T}reports/announcements/[announcementId].tsx`, 'canonical', /./], IR02: ['notifications.tsx', 'canonical at /notifications (not /inbox)', /InboxScreen/],
  IR03: ['notifications.tsx', 'converged (entries open their record from the list; no separate /inbox/[entryId])', /InboxScreen/],
  IR04: ['auth/callback.tsx', 'shares the callback state machine', /./], IR05: ['services/request/[id].tsx', 'in-screen review step (no /review path)', /./],
  IR06: ['request/received.tsx', 'canonical at /request/received', /./], IR07: [`${T}settings/download-data.tsx`, 'canonical at /settings/download-data', /./],
  IR08: [`${T}health/[id].tsx`, 'canonical at /health/[id]', /./], IR09: [`${T}settings/terms-privacy.tsx`, 'folded into Terms and Privacy / About', /./],
  IR10: [`${T}services/index.tsx`, '?segment=requests', /segment/],
};
const routeAudit = routes.map((r) => {
  const [file, how, must] = ROUTE_MAP[r.route_id] ?? [undefined, 'UNMAPPED', null];
  let state;
  if (!(r.route_id in ROUTE_MAP)) { state = 'unmapped'; problem(`route ${r.route_id} has no audit mapping`); }
  else if (file === null) state = 'deferred';
  else {
    const path = join(src, 'app', file);
    if (!existsSync(path)) { state = 'missing'; problem(`route ${r.route_id}: ${file} does not exist`); }
    else if (must && !must.test(read(path))) { state = 'mismatch'; problem(`route ${r.route_id}: ${file} does not contain ${must}`); }
    else state = 'resolved';
  }
  return { route_id: r.route_id, android_file: r.android_file, ios_file: file ? `src/app/${file}` : '', how, state };
});
// every iOS route file is accounted for by a ledger row or is a documented legacy alias
const mappedFiles = new Set(Object.values(ROUTE_MAP).map((v) => v[0]).filter(Boolean));
const LEGACY_ALIASES = new Set(['auth.tsx', 'register.tsx', 'recovery.tsx', 'profile.tsx', 'requests.tsx', `${T}reports/[id].tsx`, `${T}settings/appearance.tsx`, `${T}settings/delete-account.tsx`, `${T}settings/id-verification.tsx`, `${T}settings/notifications.tsx`]);
const unaccounted = walk(join(src, 'app')).map((f) => relative(join(src, 'app'), f).split(sep).join('/')).filter((f) => !f.endsWith('_layout.tsx') && !mappedFiles.has(f) && !LEGACY_ALIASES.has(f));
if (unaccounted.length) problem(`iOS route files with no ledger row or alias: ${unaccounted.join(', ')}`);

// ---- modal families -> implementing files ------------------------------------------------------------------
const MODAL_MAP = {
  M01: ['features/auth/register-screen.tsx', 'features/auth/password-step.tsx', 'features/auth/details-form.tsx'],
  M02: ['features/services/request-screen.tsx', 'features/services/request-form.ts'],
  M03: ['features/services/request-detail.tsx', 'features/payments/qr-screen.tsx', 'features/payments/payment-screen.tsx'],
  M04: ['features/maps/drrm-panel.tsx', 'features/centers/centers-section.tsx', 'features/centers/center-card.tsx'],
  M05: ['features/qr/scanner-modal.tsx', 'features/qr/center-qr-sheet.tsx', 'features/qr/qr-section.tsx'],
  M06: ['features/profile/household-card.tsx', 'features/qr/household-qr-card.tsx', 'features/qr/family-section.tsx'],
  M07: ['features/emergency/alerts-section.tsx', 'features/emergency/alert-filters.ts'],
  M08: ['features/health/drive-calendar.tsx', 'features/health/filter-chips.tsx', 'features/health/drive-detail.tsx'],
  M09: ['features/profile/pin-picker.tsx', 'features/reports/photo-viewer.tsx', 'features/reports/incident-detail.tsx'],
  M10: ['features/reports/reports-hub.tsx', 'features/reports/use-read-actions.ts'],
  M11: ['features/profile/profile-screen.tsx', 'features/profile/birthday-sheet.tsx', 'features/profile/id-screen.tsx'],
  M12: ['features/auth/password-step.tsx', 'auth/fresh-authentication.ts'],
  M13: ['features/appearance/color-picker.tsx', 'features/appearance/appearance-screen.tsx'],
  M14: ['features/privacy/download-screen.tsx', 'features/privacy/delete-screen.tsx', 'features/notifications/logout.ts'],
  M15: ['features/information/terms-privacy-screen.tsx', 'features/information/help-screen.tsx'],
  M16: ['components/ui.tsx', 'components/resource-list.tsx'],
};
const modalAudit = modals.map((m) => {
  const files = MODAL_MAP[m.modal_id] ?? [];
  const missing = files.filter((f) => !existsSync(join(src, f)));
  if (!files.length) problem(`modal ${m.modal_id} has no audit mapping`);
  for (const f of missing) problem(`modal ${m.modal_id}: ${f} does not exist`);
  return { modal_id: m.modal_id, family: m.family, files, state: files.length && !missing.length ? 'resolved' : 'missing' };
});

// ---- section -> implementation (A01-A52) -------------------------------------------------------------------
const SECTION_IMPL = {
  A01: ['app/_layout.tsx', 'lib/runtime.tsx', 'app/(tabs)/_layout.tsx'], A02: ['features/onboarding/screens.tsx'], A03: ['features/auth/choice-screen.tsx', 'auth/auth-flow.tsx'],
  A04: ['features/auth/register-screen.tsx'], A05: ['features/auth/login-screen.tsx', 'auth/providers.ts'], A06: ['features/auth/account-setup-screen.tsx', 'auth/setup-status.ts'],
  A07: ['features/auth/recovery-screen.tsx', 'auth/recovery-flow.ts'], A08: ['features/home/home-screen.tsx'], A09: ['features/services/documents-list.tsx', 'features/services/catalog.ts'],
  A10: ['features/services/document-detail.tsx'], A11: ['features/services/request-screen.tsx', 'features/services/request-submit.ts'], A12: ['features/services/own-requests.tsx'],
  A13: ['features/services/request-detail.tsx', 'features/services/sla-clock.tsx'], A14: ['features/services/request-tracking.ts', 'features/payments/qr-screen.tsx'],
  A15: ['features/payments/payment-screen.tsx', 'features/payments/assessment.ts'], A16: ['features/payments/qr-screen.tsx', 'features/payments/qr-session.ts'],
  A17: ['features/payments/receipt-screen.tsx', 'features/payments/receipt.ts'], A18: ['features/services/own-logs.tsx'], A19: ['features/maps/maps-screen.tsx', 'features/maps/discovery-map.tsx'],
  A20: ['features/emergency/emergency-screen.tsx'], A21: ['features/emergency/guidelines-section.tsx'], A22: ['features/emergency/hotlines-section.tsx'],
  A23: ['features/centers/centers-section.tsx', 'features/centers/center-model.ts'], A24: ['features/centers/route-controller.ts', 'lib/device-location.ts'],
  A25: ['features/qr/qr-section.tsx', 'features/qr/scan-controller.ts'], A26: ['features/qr/center-qr-sheet.tsx', 'features/qr/show-qr.ts'],
  A27: ['features/profile/household-card.tsx', 'features/qr/family-section.tsx'], A28: ['features/emergency/alerts-section.tsx'],
  A29: ['features/health/health-screen.tsx', 'features/health/drive-calendar.tsx'], A30: ['features/health/register-screen.tsx', 'features/health/registration-form.ts'],
  A31: ['features/health/my-registrations.tsx'], A32: ['features/reports/reports-hub.tsx'], A33: ['features/reports/concern-screen.tsx', 'features/reports/concern-submit.ts'],
  A34: ['features/reports/incident-detail.tsx', 'features/reports/incident-actions.ts'], A35: ['features/reports/reports-hub.tsx'], A36: ['features/reports/read-state.ts', 'data/report-counts.tsx'],
  A37: ['features/profile/profile-screen.tsx', 'features/profile/profile-save.ts'], A38: ['features/profile/birthday-sheet.tsx'], A39: ['features/profile/id-screen.tsx', 'features/profile/id-evidence.ts'],
  A40: ['features/auth/email-verification-screen.tsx'], A41: ['features/profile/location-screen.tsx'], A42: ['app/(tabs)/settings/change-password.tsx', 'auth/fresh-authentication.ts'],
  A43: ['features/appearance/appearance-screen.tsx', 'features/appearance/preferences.ts'], A44: ['features/notifications/preferences-screen.tsx', 'features/notifications/inbox-screen.tsx'],
  A45: ['features/privacy/download-screen.tsx', 'features/privacy/export-run.ts'], A46: ['features/privacy/delete-screen.tsx', 'features/privacy/delete-run.ts'],
  A47: ['app/(tabs)/settings/index.tsx', 'features/notifications/logout.ts'], A48: ['features/information/help-screen.tsx'], A49: ['features/information/terms-privacy-screen.tsx', 'features/information/about-screen.tsx'],
  A50: ['components/ui.tsx'], A51: ['data/use-resource.ts', 'data/realtime.ts', 'lib/drafts.ts'], A52: ['lib/release-gates.ts'],
};
const sectionIds = [...new Set(parity.map((c) => c.section))];
for (const id of sectionIds) {
  const files = SECTION_IMPL[id];
  if (!files) { problem(`section ${id} has no implementation mapping`); continue; }
  for (const f of files) if (!existsSync(join(src, f))) problem(`section ${id}: ${f} does not exist`);
}

// ---- feature gates -------------------------------------------------------------------------------------------
const gateSource = read(join(src, 'lib', 'release-gates.ts'));
const gates = Object.fromEntries([...gateSource.matchAll(/^\s{2}(\w+): (true|false),/gm)].map((m) => [m[1], m[2] === 'true']));
const GATE_SECTIONS = { householdEditing: ['A27'], privateIdUploads: ['A39'], qrph: ['A16'], pickup: ['A15'], mapProviders: ['A19', 'A24', 'A41'], routeService: ['A24'], emergencyContent: ['A21', 'A22', 'A28'], evacuationCheckin: ['A25'], householdQr: ['A27'], publicIncidents: ['A32', 'A33', 'A34'], medicalRegistration: ['A30'], completeExport: ['A45'], accountDeletion: ['A46'], remotePush: ['A44'] };
const closedBySection = {};
for (const [gate, open] of Object.entries(gates)) if (!open) for (const s of GATE_SECTIONS[gate] ?? []) (closedBySection[s] ??= []).push(gate);
for (const gate of Object.keys(gates)) if (!GATE_SECTIONS[gate]) problem(`gate ${gate} is not mapped to a section`);

// ---- tests: explicit checkpoint references -------------------------------------------------------------------
const testFiles = walk(join(ios, 'tests')).filter((f) => f.endsWith('.test.ts'));
const refs = new Map();
const addRef = (id, file) => { if (!refs.has(id)) refs.set(id, new Set()); refs.get(id).add(file); };
for (const file of testFiles) {
  const text = read(file); const name = relative(ios, file).split(sep).join('/');
  // "A44-001…003, 014, 015" names 001-003, 014 and 015; "A23-001 through A23-037" names the whole range.
  for (const m of text.matchAll(/\bA(\d{2})-(\d{3})((?:\s*(?:…|\.\.\.|–|through)\s*(?:A\d{2}-)?\d{3}|\s*[,/]\s*\d{3})*)/g)) {
    const sec = m[1]; let previous = Number(m[2]); addRef(`A${sec}-${m[2]}`, name);
    for (const t of m[3].matchAll(/(…|\.\.\.|–|through)?\s*[,/]?\s*(?:A\d{2}-)?(\d{3})/g)) {
      const n = Number(t[2]);
      for (let k = t[1] ? previous : n; k <= n; k++) addRef(`A${sec}-${String(k).padStart(3, '0')}`, name);
      previous = n;
    }
  }
  for (const m of text.matchAll(/\bA(\d{2})\b(?!-)/g)) addRef(`A${m[1]}`, name);
  for (const m of text.matchAll(/\bT(\d{2})\b/g)) addRef(`A${m[1]}`, name); // T01-T52 are one-to-one with A01-A52
}
// Sections whose tests do not cite checkpoint ids: the test files that cover the area (read and confirmed in Phase 19).
// Paths are relative to the iOS workspace or, with '../..', to the repository.
const FAMILY_TESTS = {
  A09: ['tests/services.test.ts'], A10: ['tests/services.test.ts'], A18: ['tests/resident-api.test.ts', 'tests/request-tracking.test.ts'],
  A40: ['../../packages/shared/src/lib/resident-email-verification-client.test.ts'],
  A47: ['tests/notifications.test.ts', 'tests/persistence.test.ts', 'tests/privacy.test.ts'], A48: ['tests/information.test.ts'],
  A51: ['tests/persistence.test.ts', 'tests/pagination.test.ts', 'tests/outcome.test.ts', 'tests/resident-api.test.ts', 'tests/files.test.ts', 'tests/secure-storage.test.ts'],
};
for (const [section, files] of Object.entries(FAMILY_TESTS)) for (const f of files) {
  if (!existsSync(join(ios, f))) problem(`family test ${f} for ${section} does not exist`);
  else addRef(section, f.replace(/^(\.\.\/)+/, ''));
}
const sectionLevel = (section) => {
  const files = new Set(refs.get(section) ?? []);
  for (const [id, set] of refs) if (id.startsWith(`${section}-`)) for (const f of set) files.add(f);
  return files.size;
};

// ---- per-checkpoint join --------------------------------------------------------------------------------------
const rows = parity.map((c) => {
  const primary = c.primary_phase;
  const status = phaseStatus[primary];
  if (!status) problem(`${c.checkpoint_id}: primary phase ${primary} not in the execution ledger`);
  const explicit = refs.get(c.checkpoint_id)?.size ?? 0;
  const closed = closedBySection[c.section] ?? [];
  const cls = statusClass(status ?? '');
  // A: a test names the checkpoint, its phase is verified and no feature gate of its section is closed.
  // B: a test names it, but the phase is only partial or a gate is closed. C: only a test of the same section/family exists.
  // D: no test of the section or family names it (device, live or content evidence only).
  let audit;
  if (explicit > 0) audit = cls === 'verified' && !closed.length ? 'A' : 'B';
  else audit = sectionLevel(c.section) > 0 ? 'C' : 'D';
  return { checkpoint_id: c.checkpoint_id, section: c.section, primary_phase: primary, primary_phase_status: status ?? '', android_state: c.android_state, corrective_disposition: c.corrective_disposition, gates: c.gates, test_family: c.test_family, explicit_test_files: explicit, section_test_files: sectionLevel(c.section), closed_feature_gates: closed.join(' '), audit_class: audit };
});

const count = (items, key) => items.reduce((a, i) => ({ ...a, [i[key]]: (a[i[key]] ?? 0) + 1 }), {});
const bySection = sectionIds.map((s) => {
  const r = rows.filter((x) => x.section === s);
  return { section: s, total: r.length, A: r.filter((x) => x.audit_class === 'A').length, B: r.filter((x) => x.audit_class === 'B').length, C: r.filter((x) => x.audit_class === 'C').length, D: r.filter((x) => x.audit_class === 'D').length, closed_gates: (closedBySection[s] ?? []).join(' '), phase: [...new Set(r.map((x) => x.primary_phase))].join(' ') };
});
const results = {
  generated: new Date().toISOString().slice(0, 10), checkpoints: rows.length, routes: count(routeAudit, 'state'), modals: count(modalAudit, 'state'),
  auditClass: count(rows, 'audit_class'), gates, openGates: Object.entries(gates).filter(([, o]) => o).map(([g]) => g), closedGates: Object.entries(gates).filter(([, o]) => !o).map(([g]) => g),
  phaseStatus, testFiles: testFiles.length, problems,
};
writeFileSync(join(here, 'audit-results.json'), `${JSON.stringify({ ...results, routeAudit, modalAudit, bySection }, null, 2)}\n`);
const header = Object.keys(rows[0]);
writeFileSync(join(here, 'checkpoint-coverage.csv'), `${[header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n')}\n`);

const md = [];
md.push('# Phase 19 coverage report (generated by audit.mjs)', '',
  'Structural join of every checkpoint to its owning phase status, the closed feature gates of its section and the tests that name it. **Audit class is not a pass/fail of behavior.** A: a test names the checkpoint, its phase is verified (non-device) and no feature gate of its section is closed. B: a test names it, but its phase is only partial or a feature gate is closed. C: only a test of the same section or T-family exists. D: no test of the section or family names it (device, live or content evidence only).', '',
  `Checkpoints ${rows.length} · class A ${results.auditClass.A ?? 0} · B ${results.auditClass.B ?? 0} · C ${results.auditClass.C ?? 0} · D ${results.auditClass.D ?? 0}.`, '',
  `Routes ${JSON.stringify(results.routes)} · modal families ${JSON.stringify(results.modals)} · open gates: ${results.openGates.join(', ')} · closed gates: ${results.closedGates.join(', ')}.`, '',
  '## Sections', '', '| Section | Phase | Total | A | B | C | D | Closed feature gates |', '|---|---|---:|---:|---:|---:|---:|---|',
  ...bySection.map((s) => `| ${s.section} | ${s.phase} | ${s.total} | ${s.A} | ${s.B} | ${s.C} | ${s.D} | ${s.closed_gates} |`), '',
  '## Routes', '', '| Route | Android file | iOS file | How | State |', '|---|---|---|---|---|',
  ...routeAudit.map((r) => `| ${r.route_id} | ${r.android_file.replace('apps/resident-android-mobile/src/app/', '')} | ${r.ios_file.replace('src/app/', '')} | ${r.how} | ${r.state} |`), '',
  '## Modal families', '', '| Family | Implementing files | State |', '|---|---|---|', ...modalAudit.map((m) => `| ${m.modal_id} ${m.family} | ${m.files.join('<br>')} | ${m.state} |`), '');
writeFileSync(join(here, 'coverage-report.md'), `${md.join('\n')}\n`);

console.log(JSON.stringify({ checkpoints: rows.length, auditClass: results.auditClass, routes: results.routes, modals: results.modals, closedGates: results.closedGates, problems }, null, 2));
process.exit(problems.length ? 1 : 0);
