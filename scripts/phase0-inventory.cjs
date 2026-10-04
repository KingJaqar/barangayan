// Exhaustive source index complements the manually reviewed journey inventory.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'plans/evidence/phase0');
const directories = ['apps', 'packages', 'supabase'];
const excluded = new Set(['node_modules', '.next', '.expo', 'dist', 'android', 'ios']);
function walk(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : walk(file);
    return /\.(tsx?|sql|json|toml|[cm]?js)$/.test(entry.name) && !entry.name.includes('lock') ? [file] : [];
  });
}
const areaRules = {
  catalog: /document_types|documentTypeSchema|processing_target_hours|formatProcessingTime/,
  requests: /service_requests|requestFormSchema|id_document_path|begin_processing_request|complete_service_request|cancel_.*service_request|mark_request_ready/,
  identity: /id_verification_status|id_photo_urls|id_type|id-documents|SignedUrl|SignedUrls/,
  payments: /\bpayments\b|paymongo|PAYMENT_SETTLEMENT|payment_status|payment_method|fee_centavos|refund-payment|cancel-payment/,
  sla: /getSlaFlag|getCompletionHours|computeDocumentTypeTrends|progressFraction|estimateLabel|targetHours|target_hours|status_history|sla_/,
  locality: /house_no|home_address|\bcity\b|province|barangays|boundary|location_verified|registration_location|verified_location|isPointInPolygon/,
  auth: /\.auth\.|handle_new_user|current_role|current_barangay_id|PKCE|OAuth|signInWith|signUp|requireUser|requireRole/,
  scores: /priority_score|register_for_drive|applicant_number|PRIORITY_WEIGHTS|computePriorityScore/,
  realtime: /postgres_changes|supabase_realtime|replica identity|\.channel\(/i,
  exports: /export-my-data|exportCsv|exportCSV|download.*csv|\.csv|\.pdf|export.*data/i,
};
const files = [];
const references = [];
const sqlDefinitions = [];
for (const file of directories.flatMap(walk).sort()) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = contents.split(/\r?\n/);
  const areas = Object.entries(areaRules).filter(([, rule]) => rule.test(contents)).map(([area]) => area);
  const route = /\/src\/app\//.test(file) && /(?:page|route|\[.*\]|index|profile|requests|auth|register|emergency|recovery)\.tsx?$/.test(file);
  const androidUi = file.startsWith('apps/resident-android-mobile/src/') && /\/(app|components)\//.test(file);
  files.push({ file, sha256: crypto.createHash('sha256').update(contents).digest('hex'), areas, route, androidUi });
  lines.forEach((source, index) => {
    const calls = [...source.matchAll(/\.(from|rpc|invoke)\(\s*['"]([^'"]+)['"]/g)].map(match => ({ kind: match[1], name: match[2] }));
    const lineAreas = Object.entries(areaRules).filter(([, rule]) => rule.test(source)).map(([area]) => area);
    if (calls.length || lineAreas.length) references.push({ file, line: index + 1, areas: lineAreas, calls });
    if (file.endsWith('.sql') && /(?:create(?: or replace)? (?:function|trigger|policy|table|view)|drop (?:policy|function|trigger)|alter publication|grant |revoke )/i.test(source)) {
      sqlDefinitions.push({ file, line: index + 1, declaration: source.trim() });
    }
  });
}
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'source-index.json'), JSON.stringify({ head, files, references, sqlDefinitions }, null, 2) + '\n');
const summary = ['# Phase 0 source inventory', '', 'Generated with `node scripts/phase0-inventory.cjs`. Complements `../../Phase_0_Baseline_and_Change_Boundaries.md`.', '', `HEAD: ${head}. ${files.length} source/config files scanned; ${references.length} line references; ${sqlDefinitions.length} SQL declarations.`, '', 'This is a candidate and call-site index, not proof of runtime authorization. Paths below are relative to the repository root.', ''];
for (const area of Object.keys(areaRules)) {
  summary.push(`## ${area}`, '');
  for (const item of files.filter(item => item.areas.includes(area))) {
    const hits = references.filter(ref => ref.file === item.file && ref.areas.includes(area)).map(ref => ref.line);
    summary.push(`- \`${item.file}\`: ${hits.join(', ')}`);
  }
  summary.push('');
}
summary.push('## All UI routes and Android interaction surfaces', '');
files.filter(item => item.route || item.androidUi).forEach(item => summary.push(`- \`${item.file}\``));
fs.writeFileSync(path.join(destination, 'source-inventory.md'), summary.join('\n') + '\n');
console.log(`${files.length} files, ${references.length} references, ${sqlDefinitions.length} SQL declarations indexed.`);
