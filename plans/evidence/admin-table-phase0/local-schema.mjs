// Inspect the already-running local database. Never starts/resets/applies migrations.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const query = fs.readFileSync(new URL('./hosted-schema-query.sql', import.meta.url), 'utf8');
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input:query, encoding:'utf8', timeout:15000, windowsHide:true });
if (result.status !== 0) {
  fs.writeFileSync(new URL('./local-schema-error.json', import.meta.url), JSON.stringify({ status:result.status, error:result.error?.code, stderr:result.stderr }, null, 2));
  process.exitCode = 1;
} else {
  const local = JSON.parse(result.stdout.trim());
  fs.writeFileSync(new URL('./local-schema.json', import.meta.url), JSON.stringify(local, null, 2) + '\n');
  const hosted = JSON.parse(fs.readFileSync(new URL('./hosted-schema.json', import.meta.url), 'utf8'));
  const normalize = (data) => JSON.stringify(data.map((item) => JSON.stringify(item)).sort());
  const alignment = Object.fromEntries(['columns', 'constraints', 'indexes', 'policies', 'rls', 'collations', 'migrations'].map((key) => [key, normalize(local[key]) === normalize(hosted[key])]));
  const report = { localVersion:local.version, hostedVersion:hosted.version, alignment, localScaleEstimates:local.scale_estimates, note:'Catalog comparison only; migration numbers alone do not prove file-content identity. Live row estimates are approximate and not tenant counts.' };
  fs.writeFileSync(new URL('./schema-alignment.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
