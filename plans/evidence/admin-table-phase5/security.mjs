import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { privateDir, statePath } from './runtime-stack.mjs';
const state = JSON.parse(fs.readFileSync(statePath)), users = JSON.parse(fs.readFileSync(privateDir + '/users.json'));
const report = { passed: false, cases: [] };
try {
  for (const name of ['anon', 'resident', 'removedAdmin', 'foreignAdmin', 'admin']) {
    const db = createClient(state.api, state.anonKey, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } });
    if (name !== 'anon') assert.ifError((await db.auth.signInWithPassword(users[name])).error);
    for (const table of ['incidents', 'health', 'applicants']) {
      const result = await db.from('admin_' + table + '_browse').select('id,row', { count: 'exact' }).range(0, 99);
      if (name === 'anon') assert.ok(result.error || result.data.length === 0);
      else {
        assert.ifError(result.error);
        if (name === 'resident' || name === 'removedAdmin') assert.equal(result.data.length, 0);
        if (name === 'foreignAdmin') assert.ok(result.data.every(item => !item.id.startsWith('61000000-') && !item.id.startsWith('71000000-') && (!item.id.startsWith('70000000-') || item.row.title.startsWith('Foreign'))));
        if (name === 'admin') assert.ok(result.count > 1000 && result.data.length === 100);
      }
      report.cases.push({ identity: name, table, rows: result.data?.length ?? null, allowed: !result.error, total: result.count });
    }
    if (name === 'anon' || name === 'resident' || name === 'admin') {
      const scores = await db.from('drive_registration_scores').select('priority_score').limit(1);
      if (name === 'admin') { assert.ifError(scores.error); assert.equal(scores.data.length, 1); }
      else assert.ok(scores.error || scores.data.length === 0);
      report.cases.push({ identity: name, table: 'protected score source', exposedRows: scores.data?.length ?? 0 });
    }
  }
  report.passed = true;
} catch (e) { report.error = e.stack; process.exitCode = 1; }
finally { fs.writeFileSync(new URL('./security.json', import.meta.url), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
