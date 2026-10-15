// P00-T02/T03/T06/T07 ledger builder. Read-only for sources; writes ledgers in this directory and the
// root execution-ledger.csv. Exits 1 when any completeness check fails.
// Run: node plans/evidence/resident-ios-parity/phase-00/build-ledgers.mjs
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const evidenceRoot = path.resolve(here, '..');
const root = path.resolve(here, '../../../..');
const lines = (relative) => fs.readFileSync(path.join(root, relative), 'utf8').split(/\r?\n/);
const plan = lines('plans/Resident_iOS_Implementation_Plan.md');
const handoff = lines('plans/Resident_iOS_UI_UX_Design_System_Handoff.md');
const breakdown = lines('contexts/Resident_Android_Features&Functions_BreakdownList.md');

// User decision 2026-10-13 (option A): the repository owner holds every role and approval until delegated.
const NAMED_OWNER = 'KingJaqar';
const pad = (number) => String(number).padStart(2, '0');
const phaseId = (number) => `P${pad(number)}`;
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const formatPhases = (numbers) => numbers.map(phaseId).join(' ');

// Verification/evidence and traceability lines of plan §4.3, per phase.
const PHASE_FAULTS = {
  0: 'F01-F12 as applicable', 1: 'F01 F08 F12', 2: 'F02-F08 F11', 3: 'F02 F03 F09-F11', 4: 'F01-F04 F07 F11 F12',
  5: 'F02-F04 F06-F08 F12', 6: 'F04 F07 F12', 7: 'F01 F02 F04 F05 F12', 8: 'F02-F07 F12', 9: 'F01-F05 F09 F12',
  10: 'F02 F03 F06 F07 F09 F12', 11: 'F01-F03 F05 F07 F11 F12', 12: 'F01-F08 F12', 13: 'F01 F02 F05 F07 F08 F12',
  14: 'F01 F02 F05 F07 F08 F12', 15: 'F01-F03 F06-F08 F10 F12', 16: 'F01-F05 F07 F10 F12', 17: 'F01-F03 F07 F11 F12',
  18: 'F01-F07 F11 F12', 19: 'F01-F12', 20: 'F01-F12',
};
const PHASE_GATES = {
  0: ['G01', 'G17'], 1: ['G02', 'G14', 'G22'], 2: ['G01', 'G04', 'G19'], 3: ['G01', 'G03', 'G04', 'G08', 'G16', 'G18', 'G19'],
  4: ['G01', 'G18'], 5: ['G03', 'G04'], 6: ['G22'], 7: ['G04', 'G17'], 8: ['G04', 'G17', 'G19'], 9: ['G06', 'G17', 'G19'],
  10: ['G05', 'G06'], 11: ['G12', 'G17', 'G19'], 12: ['G12', 'G17', 'G19'], 13: ['G07', 'G12'], 14: ['G07'],
  15: ['G03', 'G08', 'G15'], 16: ['G09', 'G16'], 17: ['G13', 'G18', 'G20'], 18: ['G10', 'G11', 'G12', 'G20', 'G21'],
  19: ['G17', 'G19', 'G20', 'G22'], 20: range(1, 22).map((number) => `G${pad(number)}`),
};

// Section delivery from plan Appendix A "Delivery:" lines (primary first).
const SECTION_DELIVERY = {
  A01: [1, [2, 4, 19, 20]], A02: [6, []], A03: [4, [1]], A04: [4, []], A05: [4, []], A06: [4, []], A07: [4, []],
  A08: [18, []], A09: [7, [9]], A10: [7, [8]], A11: [8, [9, 10]], A12: [9, []], A13: [9, [10]], A14: [9, [10]],
  A15: [10, []], A16: [10, []], A17: [10, []], A18: [9, []], A19: [13, [14]], A20: [13, [14, 15]], A21: [13, []],
  A22: [13, []], A23: [14, []], A24: [14, []], A25: [15, []], A26: [15, []], A27: [5, [15]], A28: [13, []],
  A29: [16, []], A30: [16, []], A31: [16, []], A32: [11, [12]], A33: [12, []], A34: [12, []], A35: [11, []],
  A36: [11, [17, 18]], A37: [5, []], A38: [5, []], A39: [5, []], A40: [4, []], A41: [5, []], A42: [4, []],
  A43: [6, []], A44: [17, []], A45: [18, []], A46: [18, []], A47: [4, [17, 18, 19]], A48: [18, []], A49: [18, []],
  A50: [1, [6, 19]], A51: [2, range(4, 19)], A52: [0, []],
};

// Checkpoint-level splits where a section spans phases (plan §4.1 "split journeys").
const SPLITS = [
  [['A09-003', 'A09-004'], 9, [7], 'Requests/Logs subsections close with Phase 9'],
  [range(2, 11).map((n) => `A13-${String(n).padStart(3, '0')}`), 10, [9], 'payment method/status/amount fields close with Phase 10'],
  [range(7, 11).map((n) => `A14-${String(n).padStart(3, '0')}`), 10, [9], 'payment-attempt cancellation is Phase 10'],
  [['A19-017', 'A19-018', 'A19-019', 'A19-020', 'A19-022', 'A19-023', 'A19-024', 'A19-032'], 14, [13], 'location controller/center entry close with Phase 14'],
  [['A19-033'], 13, [5, 15], 'Family entry; household content Phases 5/15'],
  [['A20-005'], 13, [14], 'Centers section content Phase 14'],
  [['A20-006'], 13, [15], 'Scan section content Phase 15'],
  [['A20-007'], 13, [5, 15], 'Family section content Phases 5/15'],
  [range(2, 7).map((n) => `A27-${String(n).padStart(3, '0')}`), 15, [5], 'household QR closes in Phase 15'],
  [['A32-025', 'A32-026'], 12, [11], 'incident detail/report action count only after Phase 12'],
  [['A50-005', 'A50-006', 'A50-008', 'A50-009', 'A50-012', 'A50-017', 'A50-018', 'A50-022', 'A50-023', 'A50-024', 'A50-025', 'A50-033'], 6, [1, 19], 'shared interaction completion (P06-T06)'],
  [['A50-037', 'A50-038'], 2, [8, 12], 'file adapter (P02-T05)'],
  [['A51-023', 'A51-024', 'A51-027'], 15, [2], 'QR generation/capture and corrected check-in'],
  [['A51-025'], 10, [2], 'paid receipt PDF'],
  [['A51-026'], 18, [2], 'export PDF'],
  [['A52-001'], 18, [0], '§6.8 disposition recorded in Phase 0'], [['A52-002'], 7, [0], '§6.8 disposition recorded in Phase 0'],
  [['A52-003'], 13, [0], '§6.8 disposition recorded in Phase 0'], [['A52-004'], 17, [0], '§6.8 disposition recorded in Phase 0'],
  [['A52-005'], 10, [0], '§6.8 disposition recorded in Phase 0'], [['A52-006', 'A52-007'], 13, [0], '§6.8 disposition recorded in Phase 0'],
  [['A52-008'], 15, [0], '§6.8 disposition recorded in Phase 0'], [['A52-009'], 17, [0], '§6.8 disposition recorded in Phase 0'],
  [['A52-010'], 16, [0], '§6.8 disposition recorded in Phase 0'], [['A52-011'], 6, [0], '§6.8 disposition recorded in Phase 0'],
  [['A52-012'], 14, [0], '§6.8 disposition recorded in Phase 0; P14-T07 revalidates'],
];

// Android source state (P00-T06). Default: working as traced in source; no device capture yet.
const ANDROID_STATES = [
  [['A08-012'], 'unconnected', '§6.8 A52-001: defined functional Home search or omit'],
  [['A09-006'], 'unconnected', '§6.8 A52-002: functional scoped Services search'],
  [range(1, 20).map((n) => `A16-${String(n).padStart(3, '0')}`), 'conditional', '§6.8 A52-005: real QR PH settlement required for full conversion'],
  [['A18-001'], 'partial', '§6.8 A18: truthful latest-activity view, not a full audit stream (logs-list.tsx:23)'],
  [['A25-023', 'A25-024'], 'defective', '§6.4/§6.8: no client bulk household attendance; online resident-only check-in'],
  [['A30-002', 'A30-003', 'A30-005'], 'defective', '§6.8 A30-002/A30-005: household choice not sent to register_for_drive (register.tsx:443); self-only corrective equivalent'],
  [['A30-024', 'A30-025'], 'defective', '§6.8 prior dose: fabricated 2025-01-01 at register.tsx:394; actual date or authoritative null'],
  [['A44-018'], 'local-only', '§6.8 A44-018/A52-004: SMS visibly unavailable unless approved consent/provider backend'],
  [['A51-020', 'A51-021'], 'platform-specific', '§6.8 A51 picker: native iOS picker/cache/security-scoped equivalent'],
  [['A51-027'], 'defective', '§6.8 A51-027/A52-008: online resident-only check-in; no offline attendance queue'],
  [['A01-036', 'A50-028', 'A50-038'], 'platform-specific', '§6.8 A01/A50: iOS safe-area/back/swipe/picker equivalent'],
  [range(1, 14).map((n) => `A02-${String(n).padStart(3, '0')}`), 'partial-reachability', '§6.8 A52-011: intentional first-run/Help entry; account choice stays signed-out root'],
  [['A52-001', 'A52-002'], 'unconnected', '§6.8 A52-001/A52-002'],
  [['A52-003'], 'inert-control', '§6.8 A52-003: keep chips; working filter sheet or omit icon'],
  [['A52-004'], 'local-only', '§6.8 A44-018/A52-004'],
  [['A52-005'], 'conditional', '§6.8 A52-005'],
  [['A52-006', 'A52-007'], 'placeholder', '§6.8 A52-006/A52-007: redirect to Emergency Hub sections'],
  [['A52-008'], 'defective', '§6.8 A51-027/A52-008: no caller of syncPendingCheckins (use-qr-checkins.ts:88)'],
  [['A52-009'], 'unconnected', '§6.8 A52-009: addNotificationResponseListener (push-notifications.ts:141) has no caller'],
  [['A52-010'], 'unreachable', '§6.8 A52-010: reachable full-screen registration only'],
  [['A52-011'], 'partial-reachability', '§6.8 A52-011'],
  [['A52-012'], 'not-wired', '§6.8 A52-012: weather/BFS/Dijkstra not imported by Android screens at baseline'],
];

// P00-T03 audit of the existing iOS shell (apps/resident-ios-mobile at the baseline). Code presence is not completion.
const IOS = 'apps/resident-ios-mobile/src';
const IOS_BASELINE = {
  A01: ['partial-unqualified', `${IOS}/app/(tabs)/_layout.tsx:2; ${IOS}/app/_layout.tsx:13; ${IOS}/lib/runtime.tsx:102`, 'Five native tabs (no Settings destination/More); session restore/retry/clear exist; no font readiness, auth-callback handling or Reports badges.'],
  A02: ['not-started', '', 'No onboarding routes.'],
  A03: ['partial-unqualified', `${IOS}/features/auth/auth-screen.tsx:32; ${IOS}/app/index.tsx:2`, 'Guest link exists; root always redirects Home, no account-choice root.'],
  A04: ['defective-baseline', `${IOS}/features/auth/register-screen.tsx:67`, 'Direct auth.signUp with profile/tenant user metadata and no OTP; conflicts with §2 setup semantics and the no-editable-metadata rule. Replace in Phase 4.'],
  A05: ['partial-unqualified', `${IOS}/features/auth/auth-screen.tsx:16`, 'Email/password only; no show/hide, Google or Apple.'],
  A06: ['not-started', '', 'No server-owned setup status flow.'],
  A07: ['partial-unqualified', `${IOS}/features/auth/recovery-screen.tsx:26`, 'OTP recovery and new password; client-only 45 s cooldown; no live requirement indicators.'],
  A08: ['partial-unqualified', `${IOS}/app/(tabs)/home/index.tsx:5`, 'Greeting and links only.'],
  A09: ['partial-unqualified', `${IOS}/app/(tabs)/services/index.tsx:7`, 'Catalogue with client-side text filter over all loaded rows; no segments/ID status.'],
  A10: ['partial-unqualified', `${IOS}/app/(tabs)/services/[id].tsx:7`, 'Legacy fee/requirements only; renders document_types.fee_centavos directly; no charter fields.'],
  A11: ['defective-baseline', `${IOS}/data/resident-api.ts:40; ${IOS}/app/services/request/[id].tsx:23`, 'Notes-only form with direct service_requests insert; §6.2 forbids direct client insert (use submit_service_request).'],
  A12: ['partial-unqualified', `${IOS}/app/requests.tsx:7`, 'List loads every page before display (pages() helper), contrary to incremental pagination.'],
  A13: ['partial-unqualified', `${IOS}/app/request/[id].tsx:9`, 'Reference/status/method only; no history or SLA.'],
  A14: ['partial-unqualified', `${IOS}/app/request/[id].tsx:20`, 'cancel_own_service_request with reconciliation; no confirmation; no payment cancellation.'],
  A15: ['placeholder-gated', `${IOS}/app/request/[id].tsx:27`, '"Payment and receipt actions" unavailable.'],
  A16: ['placeholder-gated', `${IOS}/lib/release-gates.ts:5`, 'qrph gate closed.'],
  A17: ['placeholder-gated', `${IOS}/app/request/[id].tsx:27`, 'Unavailable.'],
  A18: ['not-started', '', ''],
  A19: ['placeholder-gated', `${IOS}/app/(tabs)/maps/index.tsx:2`, 'Unavailable (mapProviders gate).'],
  A20: ['placeholder-gated', `${IOS}/app/emergency.tsx:7`, 'emergencyContent gate closed; single list behind gate.'],
  A21: ['placeholder-gated', `${IOS}/app/emergency.tsx:16`, 'Generic emergency_information list behind closed gate.'],
  A22: ['not-started', '', ''],
  A23: ['placeholder-gated', `${IOS}/app/emergency.tsx:17`, 'Center list behind closed gate.'],
  A24: ['not-started', '', ''],
  A25: ['placeholder-gated', `${IOS}/app/emergency.tsx:18`, 'Unavailable.'],
  A26: ['not-started', '', ''],
  A27: ['placeholder-gated', `${IOS}/data/resident-api.ts:82`, 'Unused household() adapter reads canonical household_members, not the reachable profiles.household_members editor contract; reconcile in Phase 5.'],
  A28: ['not-started', '', ''],
  A29: ['partial-unqualified', `${IOS}/app/(tabs)/health/index.tsx:6`, 'Drive list with text filter; no calendar/categories/My registrations.'],
  A30: ['placeholder-gated', `${IOS}/app/health/register/[id].tsx:30`, 'Self-only form with actual prior-dose date but free-text conditions; medicalRegistration gate closed.'],
  A31: ['not-started', `${IOS}/data/resident-api.ts:70`, 'registrations() adapter exists with no caller.'],
  A32: ['partial-unqualified', `${IOS}/app/(tabs)/reports/index.tsx:5`, 'Announcements only; no four views.'],
  A33: ['not-started', '', ''],
  A34: ['not-started', '', ''],
  A35: ['partial-unqualified', `${IOS}/app/(tabs)/reports/[id].tsx:8`, 'Announcement detail on /reports/[id], which Android uses for incidents (route-identity conflict, R18).'],
  A36: ['not-started', '', ''],
  A37: ['partial-unqualified', `${IOS}/app/profile.tsx:33`, 'Unconditional profiles update; city editable; no avatar/household/ID/version conflict handling.'],
  A38: ['partial-unqualified', `${IOS}/app/profile.tsx:62`, 'Compact native date picker; no month/year/day apply/cancel picker.'],
  A39: ['placeholder-gated', `${IOS}/lib/release-gates.ts:4`, 'privateIdUploads gate closed; no UI.'],
  A40: ['not-started', '', ''],
  A41: ['not-started', '', ''],
  A42: ['partial-unqualified', `${IOS}/app/settings/change-password.tsx:8`, 'Password reauth/change; no show/hide or passwordless/provider path.'],
  A43: ['not-started', `${IOS}/components/ui.tsx:6`, 'System scheme only; palette differs from handoff tokens.'],
  A44: ['not-started', `${IOS}/app/settings/index.tsx:21`, 'Settings notice only.'],
  A45: ['placeholder-gated', `${IOS}/app/settings/index.tsx:21`, 'completeExport gate closed.'],
  A46: ['placeholder-gated', `${IOS}/app/settings/index.tsx:21`, 'accountDeletion gate closed.'],
  A47: ['partial-unqualified', `${IOS}/lib/runtime.tsx:171`, 'Tombstone, Keychain cleanup and best-effort revocation; no setup/recovery/Google hint cleanup beyond recovery marker.'],
  A48: ['partial-unqualified', `${IOS}/app/settings/help/index.tsx:5`, 'FAQ list/article; no categories/search/support.'],
  A49: ['partial-unqualified', `${IOS}/app/settings/information.tsx:5`, 'site_content list; no Terms/Privacy/About/version.'],
  A50: ['partial-unqualified', `${IOS}/components/ui.tsx:6`, 'Basic Action/Field/Toggle/Card/Notice/Loading primitives; not handoff tokens.'],
  A51: ['partial-unqualified', `${IOS}/lib/secure-storage-core.ts:11; ${IOS}/data/use-resource.ts:7`, 'Chunked Keychain storage with tests; epoch-scoped abortable reads; all-pages loader.'],
  A52: ['n/a-disposition', 'plans/Resident_iOS_Implementation_Plan.md §6.8', 'Dispositions recorded; implementation evidence pending in owning phases.'],
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const csv = (rows) => rows.map((row) => row.map((value) => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}).join(',')).join('\n') + '\n';
const strip = (text) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// --- Appendix A sections and checkpoints
const sections = new Map();
let current;
for (const line of plan) {
  let match = line.match(/^### (A\d{2}) — (.+)$/);
  if (match) { current = { id: match[1], title: match[2], declared: 0, checkpoints: [] }; sections.set(match[1], current); continue; }
  match = line.match(/^\*\*Source checkpoints \((\d+)\):\*\*$/);
  if (match && current) { current.declared = Number(match[1]); continue; }
  match = line.match(/^- \[[ x]\] \*\*(A\d{2}-\d{3})\*\* (.+) \*\(source L(\d+)\)\*$/);
  if (match) {
    check(match[1].startsWith(current?.id ?? '-'), `${match[1]} outside its section`);
    current.checkpoints.push({ id: match[1], text: match[2], sourceLine: Number(match[3]) });
  }
}
const checkpoints = [...sections.values()].flatMap((section) => section.checkpoints.map((item) => ({ ...item, section })));
check(sections.size === 52, `expected 52 sections, found ${sections.size}`);
check(checkpoints.length === 1218, `expected 1218 checkpoints, found ${checkpoints.length}`);
for (const section of sections.values()) check(section.declared === section.checkpoints.length, `${section.id} declares ${section.declared} but lists ${section.checkpoints.length}`);
check(new Set(checkpoints.map((item) => item.id)).size === checkpoints.length, 'duplicate checkpoint IDs');

// Source wording drift against the breakdown.
const drift = [];
for (const item of checkpoints) {
  const source = breakdown[item.sourceLine - 1] ?? '';
  const sourceText = strip(source.replace(/^\s*[-*]\s+/, ''));
  if (!/^\s*[-*]\s+/.test(source) || sourceText !== strip(item.text)) drift.push({ id: item.id, sourceLine: item.sourceLine, plan: strip(item.text), breakdown: sourceText });
}
const bulletLines = breakdown.filter((line) => /^\s*[-*]\s+/.test(line)).length;
check(bulletLines === 1218, `breakdown has ${bulletLines} bullet lines`);
check(new Set(checkpoints.map((item) => item.sourceLine)).size === 1218, 'checkpoint source lines are not unique');

// --- Handoff DX crosswalk
const dx = new Map();
for (const line of handoff) {
  const match = line.match(/^\| (DX\d{2}) \| \[(A\d{2}) — [^\]]+\]\([^)]*\) \| ([^|]+) \| ([^|]+) \|$/);
  if (!match) continue;
  let families = [...match[3].matchAll(/D\d{2}(?:–D\d{2})?/g)].flatMap(([token]) => {
    const [from, to] = token.split('–').map((value) => Number(value.slice(1)));
    return range(from, to ?? from).map((number) => `D${pad(number)}`);
  });
  families = [...new Set(families)];
  dx.set(match[2], { id: match[1], families });
}
check(dx.size === 52, `expected 52 DX rows, found ${dx.size}`);

// --- Appendix B.1 contracts
const contracts = new Map();
for (const line of plan) {
  const match = line.match(/^\| (B\d{2}) \/ ([^|]+) \| /);
  if (!match) continue;
  for (const token of match[2].split(',').map((value) => value.trim())) {
    const [from, to] = token.split('–').map((value) => Number(value.replace(/^A/, '')));
    for (const number of range(from, to ?? from)) contracts.set(`A${pad(number)}`, [...(contracts.get(`A${pad(number)}`) ?? []), match[1]]);
  }
}
check([...new Set([...contracts.values()].flat())].length === 24, 'expected B01-B24 contract rows');

// --- §4.2 phase overview and §4.3 tasks
const phases = [];
for (const line of plan) {
  const match = line.match(/^\| Phase (\d+) — ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/);
  if (match) phases.push({ number: Number(match[1]), title: match[2].trim(), entry: match[3].trim(), deliverable: match[4].trim(), lead: match[5].trim() });
}
const tasks = plan.map((line) => line.match(/^- \[[ x]\] \*\*(P\d{2}-T\d{2})\*\* (.+)$/)).filter(Boolean).map((match) => ({ id: match[1], text: match[2] }));
check(phases.length === 21, `expected 21 phases, found ${phases.length}`);
check(tasks.length === 162, `expected 162 tasks, found ${tasks.length}`);
const leadFor = (number) => phases.find((phase) => phase.number === number)?.lead ?? '';

// --- Checkpoint rows
const splitFor = new Map(SPLITS.flatMap(([ids, primary, supporting, note]) => ids.map((id) => [id, { primary, supporting, note }])));
const androidFor = new Map(ANDROID_STATES.flatMap(([ids, state, disposition]) => ids.map((id) => [id, { state, disposition }])));
const parityRows = [['checkpoint_id', 'section', 'section_title', 'checkpoint_text', 'breakdown_line', 'breakdown_text_match', 'primary_phase', 'supporting_phases', 'final_verification', 'split_note', 'design_families', 'dx_id', 'test_family', 'fault_tests', 'gates', 'contracts', 'android_state', 'corrective_disposition', 'ios_baseline_state', 'ios_baseline_locator', 'owner_role', 'named_owner', 'status', 'evidence']];
const perPhase = new Map();
const driftIds = new Set(drift.map((item) => item.id));
for (const item of checkpoints) {
  const [sectionPrimary, sectionSupporting] = SECTION_DELIVERY[item.section.id] ?? [];
  const split = splitFor.get(item.id);
  const primary = split?.primary ?? sectionPrimary;
  const supporting = [...new Set(split ? [...split.supporting, ...sectionSupporting.filter((number) => number !== primary)] : sectionSupporting)].filter((number) => number !== primary).sort((a, b) => a - b);
  const design = dx.get(item.section.id);
  const families = design ? [...new Set([...design.families, 'D01'])] : [];
  const gates = [...new Set([...(PHASE_GATES[primary] ?? []), 'G17', 'G22'])].sort();
  const android = androidFor.get(item.id) ?? { state: 'working-source', disposition: '' };
  const ios = IOS_BASELINE[item.section.id];
  const sectionContracts = contracts.get(item.section.id) ?? (item.section.id === 'A52' ? ['§6.8'] : []);
  const owner = leadFor(primary);
  check(Number.isInteger(primary), `${item.id} has no primary phase`);
  check(families.length > 0 && design, `${item.id} has no design family`);
  check(sectionContracts.length > 0, `${item.id} has no contract mapping`);
  check(ios, `${item.id} has no iOS baseline audit`);
  check(owner, `${item.id} has no owner role`);
  perPhase.set(primary, (perPhase.get(primary) ?? 0) + 1);
  parityRows.push([item.id, item.section.id, item.section.title, strip(item.text), item.sourceLine, driftIds.has(item.id) ? 'no' : 'yes', phaseId(primary), formatPhases(supporting), 'P19 P20', split?.note ?? '',
    families.sort().join(' '), design?.id, `T${item.section.id.slice(1)}`, PHASE_FAULTS[primary], gates.join(' '), sectionContracts.join(' '),
    android.state, android.disposition, ios?.[0], ios?.[1], owner, NAMED_OWNER, 'Planned', '']);
}
for (const id of splitFor.keys()) check(checkpoints.some((item) => item.id === id), `split references missing ${id}`);
for (const id of androidFor.keys()) check(checkpoints.some((item) => item.id === id), `android state references missing ${id}`);

// --- B.2 routes
const ROUTE_PHASES = {
  R01: [1, [2, 4]], R02: [1, [11, 19]], R03: [1, [16]], R04: [16, []], R05: [16, []], R06: [1, [18]], R07: [1, [13]], R08: [13, [14, 15]],
  R09: [15, []], R10: [15, []], R11: [18, []], R12: [15, []], R13: [1, [13]], R14: [13, []], R15: [13, [14]], R16: [13, []], R17: [1, [11]],
  R18: [12, [11]], R19: [11, [12]], R20: [12, []], R21: [1, [7]], R22: [7, [8]], R23: [7, [9]], R24: [10, []], R25: [10, []], R26: [10, []],
  R27: [10, []], R28: [8, []], R29: [9, [10]], R30: [1, [18]], R31: [18, []], R32: [4, []], R33: [4, []], R34: [18, []], R35: [18, []],
  R36: [1, [18]], R37: [5, []], R38: [5, []], R39: [18, []], R40: [1, [4]], R41: [4, []], R42: [6, []], R43: [4, []], R44: [4, []],
  R45: [4, []], R46: [6, []], R47: [4, []], R48: [4, []], R49: [6, []], R50: [6, []], R51: [4, []], R52: [4, []], R53: [4, []], R54: [1, [4]],
};
const ROUTE_RECORD = { R18: 'incident', R22: 'document_type', R24: 'service_request', R25: 'service_request', R26: 'service_request', R27: 'service_request (lookup hint only)', R28: 'document_type', R29: 'service_request', R34: 'faq_article', R05: 'medical_drive (driveId param)' };
// Existing iOS shell routes that map onto an Android route (P00-T07 backward-link mapping).
const IOS_CURRENT = {
  R01: ['src/app/_layout.tsx', 'retain; extend in Phase 1'], R02: ['src/app/(tabs)/_layout.tsx', 'replace five tabs with six destinations + More (Phase 1)'],
  R03: ['src/app/(tabs)/health/_layout.tsx', 'retain'], R04: ['/health -> src/app/(tabs)/health/index.tsx', 'retain'],
  R05: ['/health/register/[id] -> src/app/health/register/[id].tsx', 'alias to /health/register?driveId='], R06: ['src/app/(tabs)/home/_layout.tsx', 'retain'],
  R08: ['/emergency -> src/app/emergency.tsx', 'retain path; add tab/section params'], R11: ['/home -> src/app/(tabs)/home/index.tsx', 'retain'],
  R13: ['src/app/(tabs)/maps/_layout.tsx', 'retain'], R15: ['/maps -> src/app/(tabs)/maps/index.tsx', 'retain path; replace placeholder'],
  R17: ['src/app/(tabs)/reports/_layout.tsx', 'retain'], R18: ['/reports/[id] -> src/app/(tabs)/reports/[id].tsx (renders ANNOUNCEMENT)', 'do NOT reuse for incidents; alias /reports/[id] to the announcement route only'],
  R19: ['/reports -> src/app/(tabs)/reports/index.tsx', 'retain path; add tab param'], R21: ['src/app/(tabs)/services/_layout.tsx', 'retain'],
  R22: ['/services/[id] -> src/app/(tabs)/services/[id].tsx', 'alias /services/[id] -> /services/[documentId]'], R23: ['/services -> src/app/(tabs)/services/index.tsx', 'retain path; add segment param'],
  R28: ['/services/request/[id] -> src/app/services/request/[id].tsx', 'alias; replace direct-insert form (Phase 8)'],
  R29: ['/request/[id] -> src/app/request/[id].tsx', 'alias /request/[id] -> /services/requests/[requestId]'],
  R30: ['src/app/settings/_layout.tsx', 'move under Settings destination'], R32: ['/settings/change-password', 'retain'],
  R34: ['/settings/help/[id] -> src/app/settings/help/[id].tsx', 'alias -> /settings/help/[articleId]'], R35: ['/settings/help', 'retain'],
  R36: ['/settings -> src/app/settings/index.tsx', 'retain path inside Settings destination'], R38: ['/profile -> src/app/profile.tsx', 'alias /profile -> /settings/profile'],
  R41: ['/auth -> src/app/auth.tsx (login form + guest link)', 'alias /auth -> /auth/choice'], R43: ['/recovery -> src/app/recovery.tsx', 'alias /recovery -> /auth/recovery'],
  R44: ['/auth (login form)', 'split login into /auth/login'], R47: ['/register -> src/app/register.tsx (defective direct signUp)', 'alias /register -> /auth/register; replace flow (Phase 4)'],
  R54: ['/ -> src/app/index.tsx (always redirects Home)', 'replace with session/setup-aware root redirect'],
};
const routeRows = [['route_id', 'android_file', 'android_file_exists', 'kind', 'required_ios_destination', 'record_type', 'current_ios_route', 'current_ios_disposition', 'primary_phase', 'supporting_phases', 'test_family', 'fault_tests', 'design_families', 'owner_role', 'named_owner', 'status']];
const androidRouteFiles = [];
for (const line of plan) {
  const match = line.match(/^\| (R\d{2}) \| \[.+?\]\(\/C:\/Users\/User\/barangayan\/(.+?):\d+\) \| (.+) \|$/);
  if (!match) continue;
  const [, id, file, destination] = match;
  const exists = fs.existsSync(path.join(root, file));
  check(exists, `${id} source ${file} is missing`);
  androidRouteFiles.push(file);
  const [primary, supporting] = ROUTE_PHASES[id];
  const layout = file.endsWith('_layout.tsx');
  const currentIos = IOS_CURRENT[id] ?? ['none', 'create in owning phase'];
  routeRows.push([id, file, exists ? 'yes' : 'no', layout ? 'layout' : 'screen', destination, ROUTE_RECORD[id] ?? '', currentIos[0], currentIos[1], phaseId(primary), formatPhases(supporting), 'T01 + owning family', 'F01', 'D01', leadFor(primary), NAMED_OWNER, 'Planned']);
}
check(routeRows.length === 55, `expected 54 routes, found ${routeRows.length - 1}`);
const onDisk = [];
(function walk(folder) {
  for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
    const name = `${folder}/${entry.name}`;
    if (entry.isDirectory()) walk(name); else if (entry.name.endsWith('.tsx')) onDisk.push(name);
  }
})('apps/resident-android-mobile/src/app');
// Android route files added after the 2026-10-13 baseline (uncommitted concurrent work found on 2026-10-14).
// They are recorded as untriaged deltas, never as approved scope; triage moves them into Appendix B.2.
const POST_BASELINE_ROUTES = [
  ['RD01', 'apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx', 'Valid ID wizard (ID type, front photo only, extraction-assisted details)', 5],
  ['RD02', 'apps/resident-android-mobile/src/app/emergency-centers.tsx', 'Public emergency Centers map/offline routes outside auth guards (DRRM routing plan R6)', 14],
];
const unlisted = onDisk.filter((file) => !androidRouteFiles.includes(file) && !POST_BASELINE_ROUTES.some(([, delta]) => delta === file));
check(unlisted.length === 0, `Android route files missing from R01-R54 and the delta list: ${unlisted.join(', ')}`);
for (const [id, file, meaning, primary] of POST_BASELINE_ROUTES) {
  const exists = fs.existsSync(path.join(root, file));
  routeRows.push([id, file, exists ? 'yes' : 'no (delta withdrawn; remove row)', 'screen', `UNTRIAGED post-baseline delta — ${meaning}`, '', 'none', 'scope decision required before assignment', phaseId(primary), '', 'T01 + owning family', 'F01', 'D01', leadFor(primary), NAMED_OWNER, 'Untriaged']);
}

// iOS-only route contracts required by plan B.2 (approved 2026-10-13; see decision register §3).
const IOS_ONLY = [
  ['IR01', 'Typed announcement detail', '/reports/announcements/[announcementId]', 'announcement', '/reports/[id] (current shell)', 11, [17]],
  ['IR02', 'Server inbox list', '/inbox', 'inbox_entry list', 'none', 17, [18]],
  ['IR03', 'Server inbox entry -> validated record destination', '/inbox/[entryId]', 'inbox_entry', 'none', 17, []],
  ['IR04', 'Native Apple sign-in continuation (no URL; shares /auth/callback state machine)', 'native + /auth/callback', 'auth attempt', 'none', 4, []],
  ['IR05', 'Document application review', '/services/request/[documentId]/review', 'owned submission attempt', 'none', 8, []],
  ['IR06', 'Submitted request receipt (not a paid receipt)', '/services/requests/[requestId]/receipt', 'service_request', 'none', 8, [9]],
  ['IR07', 'Download My Data result/share', '/settings/privacy/export', 'export job', 'none', 18, []],
  ['IR08', 'Medical drive detail', '/health/drives/[driveId]', 'medical_drive', '/health/[id] (current shell)', 16, []],
  ['IR09', 'Resident information (current shell; fold into Terms/Privacy/About content)', '/settings/terms-privacy or /settings/about', 'site_content', '/settings/information (current shell)', 18, []],
  ['IR10', 'Services Requests segment (current shell list)', '/services?segment=requests', 'service_request list', '/requests (current shell)', 9, []],
];
for (const [id, name, destination, record, currentIos, primary, supporting] of IOS_ONLY) routeRows.push([id, 'iOS-only (plan B.2 addition)', 'n/a', 'screen', `${destination} — ${name}`, record, currentIos, 'approved 2026-10-13 (P00-T07)', phaseId(primary), formatPhases(supporting), 'T01 + owning family', 'F01', 'D01', leadFor(primary), NAMED_OWNER, 'Planned']);

// --- B.3 modal families
const MODAL_MAP = [
  ['Onboarding feedback', 'D02 D03', 4, [6]], ['Purpose selector', 'D06', 8, [7]], ['Request/payment cancellation', 'D08', 9, [10]],
  ['DRRM draggable panel', 'D09 D11', 13, [14]], ['QR permission explanation', 'D12', 15, []], ['Family add/edit/remove', 'D13', 5, [15]],
  ['Emergency alert filters', 'D10 D15', 13, [11]], ['Health month/date/type', 'D14', 16, []], ['Incident location picker', 'D15 D11', 12, []],
  ['Announcement modal', 'D15', 11, []], ['Profile field selectors', 'D16 D13', 5, []], ['Password show/hide', 'D17 D03', 4, []],
  ['Appearance color', 'D18', 6, []], ['Export PDF/JSON chooser', 'D20', 18, [4]], ['Legal/help accordions', 'D21', 18, []], ['Generic loading/skeleton', 'D01', 1, [6]],
];
const modalRows = [['modal_id', 'family', 'required_ios_presentation', 'test_families', 'design_families', 'primary_phase', 'supporting_phases', 'owner_role', 'named_owner', 'status']];
let inModalTable = false;
for (const line of plan) {
  if (line.startsWith('### B.3')) inModalTable = true; else if (line.startsWith('### B.4')) inModalTable = false;
  const match = inModalTable && line.match(/^\| ([^|]+) \| ([^|]+) \| (T[^|]+) \|$/);
  if (!match || match[1].startsWith('Modal/control family')) continue;
  const mapped = MODAL_MAP.find(([prefix]) => match[1].startsWith(prefix));
  check(mapped, `unmapped modal family ${match[1]}`);
  if (!mapped) continue;
  modalRows.push([`M${pad(modalRows.length)}`, match[1].trim(), match[2].trim(), match[3].trim(), mapped[1], phaseId(mapped[2]), formatPhases(mapped[3]), leadFor(mapped[2]), NAMED_OWNER, 'Planned']);
}
check(modalRows.length - 1 === MODAL_MAP.length, `expected ${MODAL_MAP.length} modal families, found ${modalRows.length - 1}`);

// --- Execution ledger (21 phases, 162 tasks). Phase 0 states reflect this execution; see phase-00/README.md.
const P00_STATUS = {
  P00: ['Verified', 'Exit verified 2026-10-14 for the 2026-10-13 baseline. Owned follow-ups: PR-20 triage of post-baseline Android delta (RD01/RD02, offline routing, valid-ID wizard); PR-21 remaining captures before P19-T05.', '2026-10-14'],
  'P00-T01': ['Verified', ''],
  'P00-T02': ['Verified', ''],
  'P00-T03': ['Verified', ''],
  'P00-T04': ['Verified', ''],
  'P00-T05': ['Verified', ''],
  'P00-T06': ['Verified', '', '2026-10-14'],
  'P00-T07': ['Verified', ''],
};
const executionRows = [['id', 'type', 'phase', 'title_or_task', 'entry_dependencies', 'lead_owner_role', 'named_owner', 'status', 'start', 'finish', 'blocker', 'implementation_commit', 'native_build', 'backend_environment', 'evidence', 'approver']];
for (const phase of phases) {
  const id = phaseId(phase.number);
  const [status, blocker, phaseFinish] = P00_STATUS[id] ?? ['Planned', ''];
  executionRows.push([id, 'phase', id, `Phase ${phase.number} — ${phase.title}`, phase.entry, phase.lead, NAMED_OWNER, status, phase.number === 0 ? '2026-10-13' : '', phaseFinish ?? '', blocker, '', '', '', `plans/evidence/resident-ios-parity/phase-${pad(phase.number)}/`, phaseFinish ? NAMED_OWNER : '']);
  for (const task of tasks.filter((item) => item.id.startsWith(`${id}-`))) {
    const [taskStatus, taskBlocker, taskFinish] = P00_STATUS[task.id] ?? ['Planned', ''];
    const done = phase.number === 0 && taskStatus === 'Verified';
    executionRows.push([task.id, 'task', id, strip(task.text), '', phase.lead, NAMED_OWNER, taskStatus, phase.number === 0 ? '2026-10-13' : '', done ? taskFinish ?? '2026-10-13' : '', taskBlocker, phase.number === 0 ? 'uncommitted (base 2e5681c)' : '', phase.number === 0 ? 'n/a (documentation phase)' : '', phase.number === 0 ? 'hosted pwjbucnyqexiepoinoke read-only' : '', phase.number === 0 ? 'plans/evidence/resident-ios-parity/phase-00/README.md' : '', done ? NAMED_OWNER : '']);
  }
}

// --- Section summary (markdown)
const summary = ['# Section parity summary (generated)', '', 'Generated by `build-ledgers.mjs` from plan Appendix A, handoff §12 and the iOS baseline audit. Per-checkpoint rows are in `parity-ledger.csv`. "Primary" counts each checkpoint once; split sections list every contributing phase.', '',
  '| Section | Checkpoints | Primary phase(s) | Supporting | DX / design | Contracts | Android non-working | iOS baseline | iOS locator / note |', '|---|---:|---|---|---|---|---:|---|---|'];
for (const section of sections.values()) {
  const rows = parityRows.slice(1).filter((row) => row[1] === section.id);
  const primaries = [...new Set(rows.map((row) => row[6]))].sort().join(' ');
  const supporting = [...new Set(rows.flatMap((row) => row[7].split(' ')).filter(Boolean))].sort().join(' ');
  const nonWorking = rows.filter((row) => row[16] !== 'working-source').length;
  const ios = IOS_BASELINE[section.id];
  summary.push(`| ${section.id} — ${section.title} | ${rows.length} | ${primaries} | ${supporting} | ${dx.get(section.id)?.id} / ${rows[0][10]} | ${rows[0][15]} | ${nonWorking} | ${ios[0]} | ${[ios[1], ios[2]].filter(Boolean).join(' — ').replaceAll('|', '\\|')} |`);
}
summary.push('', '## Primary checkpoints per phase', '', '| Phase | Checkpoints |', '|---|---:|');
for (const number of [...perPhase.keys()].sort((a, b) => a - b)) summary.push(`| ${phaseId(number)} | ${perPhase.get(number)} |`);

fs.writeFileSync(path.join(here, 'parity-ledger.csv'), csv(parityRows));
fs.writeFileSync(path.join(here, 'route-ledger.csv'), csv(routeRows));
fs.writeFileSync(path.join(here, 'modal-ledger.csv'), csv(modalRows));
fs.writeFileSync(path.join(evidenceRoot, 'execution-ledger.csv'), csv(executionRows));
fs.writeFileSync(path.join(here, 'section-summary.md'), `${summary.join('\n')}\n`);
const result = {
  sections: sections.size, checkpoints: checkpoints.length, breakdownBulletLines: bulletLines, wordingDrift: drift,
  androidRoutes: routeRows.filter((row) => /^R\d{2}$/.test(row[0])).length, iosOnlyRoutes: IOS_ONLY.length, modalFamilies: modalRows.length - 1,
  postBaselineDelta: POST_BASELINE_ROUTES.map(([id, file]) => `${id} ${file} (untriaged)`),
  phases: phases.length, tasks: tasks.length, dxRows: dx.size, contractRows: 24,
  primaryPerPhase: Object.fromEntries([...perPhase.entries()].sort((a, b) => a[0] - b[0]).map(([number, count]) => [phaseId(number), count])),
  nonWorkingAndroidCheckpoints: parityRows.slice(1).filter((row) => row[16] !== 'working-source').length,
  namedOwner: NAMED_OWNER,
  rowsWithoutNamedOwner: [...parityRows, ...routeRows, ...modalRows].slice(1).filter((row) => row[0] !== 'route_id' && row[0] !== 'modal_id' && !row.includes(NAMED_OWNER)).length,
  failures,
};
fs.writeFileSync(path.join(here, 'ledger-check.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`${result.checkpoints} checkpoints / ${result.sections} sections; ${result.androidRoutes}+${result.iosOnlyRoutes} routes; ${result.modalFamilies} modal families; ${result.tasks} tasks; drift ${drift.length}; failures ${failures.length}`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
