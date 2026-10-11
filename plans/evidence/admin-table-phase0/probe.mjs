// Read-only, bounded environment/API probes. Never prints keys or returned rows.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../..');
const report = { timestamp: new Date().toISOString(), operations: [] };
function command(name, args, timeout = 15000) {
  const result = spawnSync(name, args, { cwd: root, timeout, encoding: 'utf8', windowsHide: true });
  report.operations.push({ command: [name, ...args], status: result.status, error: result.error?.code, stdout: result.stdout?.slice(0, 6000), stderr: result.stderr?.slice(0, 2000) });
}
command('docker', ['info', '--format', '{{.ServerVersion}}']);
command('supabase', ['--version']);
command('psql', ['--version']);
// .env only read to obtain public client credentials. No auth sessions or service role.
const envFile = path.join(root, 'apps/admin-web/.env.local');
if (fs.existsSync(envFile)) {
  const text = fs.readFileSync(envFile, 'utf8');
  const value = (name) => text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  const url = value('NEXT_PUBLIC_SUPABASE_URL'); const key = value('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (url && key && new URL(url).hostname === 'pwjbucnyqexiepoinoke.supabase.co') {
    const queries = [
      ['requests-resident-parent-order', 'service_requests', 'id,resident:profiles!service_requests_resident_id_fkey(full_name)', 'resident(full_name).asc.nullslast,id.asc'],
      ['requests-cross-relation-or', 'service_requests', 'id,resident:profiles!service_requests_resident_id_fkey(full_name),r:profiles!service_requests_resident_id_fkey(),d:document_types()', 'id.asc', { 'r.full_name':'ilike.*synthetic-no-match*', 'd.name':'ilike.*synthetic-no-match*', or:'(reference_number.ilike.*synthetic-no-match*,r.not.is.null,d.not.is.null)' }],
      ['transactions-nested-parent-order', 'payments', 'id,request:service_requests(resident:profiles!service_requests_resident_id_fkey(full_name))', 'request(resident(full_name)).asc,id.asc'],
      ['transactions-spread-alias-order', 'payments', 'id,...service_requests(reference_number,...profiles!service_requests_resident_id_fkey(resident_name:full_name))', 'resident_name.asc,id.asc'],
      ['transactions-spread-related-order', 'payments', 'id,service_requests(reference_number,...profiles!service_requests_resident_id_fkey(resident_name:full_name))', 'service_requests(resident_name).asc,id.asc'],
      ['directory-base-order', 'profiles', 'id,full_name,updated_at', 'full_name.asc.nullslast,id.asc'],
      ['incident-category-parent-order', 'incidents', 'id,category:incident_categories(name)', 'category(name).asc.nullslast,id.asc'],
      ['health-base-order', 'medical_drives', 'id,created_at', 'created_at.desc.nullslast,id.asc'],
      ['health-registration-aggregate', 'medical_drives', 'id,drive_registrations(count())', 'id.asc'],
      ['applicant-score-parent-order', 'drive_registrations', 'id,score:drive_registration_scores!inner(priority_score)', 'score(priority_score).desc.nullslast,id.asc'],
      ['applicant-direct-profile-embed', 'drive_registrations', 'id,profiles(full_name)', 'id.asc'],
      ['household-head-parent-order', 'household_members', 'id,head:profiles!household_members_profile_id_fkey(full_name),updated_at', 'head(full_name).asc.nullslast,id.asc'],
      ['staff-profile-parent-order', 'barangay_officials', 'id,profile:profiles!inner(full_name)', 'profile(full_name).asc.nullslast,id.asc'],
    ];
    for (const [name, table, select, order, filters = {}] of queries) {
      const query = new URLSearchParams({ select, order, limit:'0', ...filters });
      try {
        const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: { apikey:key, Authorization:`Bearer ${key}`, Prefer:'count=exact' }, signal:AbortSignal.timeout(10000) });
        const payload = await response.json();
        report.operations.push({ probe:name, role:'anon', query:query.toString(), status:response.status, contentRange:response.headers.get('content-range'), error:response.ok ? null : { code:payload.code, message:payload.message, hint:payload.hint }, returnedRows:Array.isArray(payload) ? payload.length : null });
      } catch (error) {
        report.operations.push({ probe:name, error:error.name + ': ' + error.message, cause:error.cause?.code });
        // A transport failure invalidates all API probes; do not repeat it per query.
        report.operations.push({ remainingApiProbes:'not run after transport failure' });
        break;
      }
    }
  } else report.operations.push({ api:'unavailable: expected public URL/key configuration absent or URL mismatches inspected project' });
} else report.operations.push({ api:'unavailable: admin .env.local absent' });
try {
  const response = await fetch('https://supabase.com/changelog.md', { signal:AbortSignal.timeout(10000) });
  const text = await response.text();
  report.operations.push({ documentation:'supabase changelog markdown', status:response.status, breakingChangeLines:text.split('\n').filter((line) => /breaking.change/i.test(line)).slice(0, 20) });
} catch (error) { report.operations.push({ documentation:'supabase changelog markdown', error:error.name + ': ' + error.message }); }
fs.writeFileSync(path.join(import.meta.dirname, 'environment-api-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
