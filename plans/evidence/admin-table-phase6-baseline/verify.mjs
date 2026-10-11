import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { rows, sizes, pageSizes, edgeValues, permissions, concurrency } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript'); // Existing repository dependency; no installation.
const root = path.resolve(import.meta.dirname, '../../..');
const admin = 'apps/admin-web/src/app/(admin)/';
const screens = ['requests', 'transactions', 'residents', 'incident-reports', 'health', 'health/applicants', 'households-residents', 'staff'];
const tableNames = ['service_requests', 'payments', 'profiles', 'incidents', 'medical_drives', 'drive_registrations', 'household_members', 'barangay_officials'];
const props = ['requests', 'payments', 'residents', 'rows', 'rows', 'rows', 'rows', 'rows'];
const components = ['RequestsTable', 'TransactionsTable', 'ResidentDirectory', 'IncidentTable', 'DriveTable', 'ApplicantsTable', 'HouseholdsTable', 'StaffTable'];
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fixedInstant = '2026-10-11T04:00:00Z';
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedInstant])); }
  static now() { return new Date(fixedInstant).getTime(); }
}
function evaluate(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const load = (name) => {
    if (name in imports) return imports[name];
    if (name === './types') return evaluate(file.replace(/page\.tsx$/, 'types.ts'));
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '@barangayan/shared') return { DRIVE_TYPE_CONFIG: { dental: { label: 'Dental Care' } }, formatCentavosAsPHP: (n) => String(n / 100) };
    return Object.fromEntries(components.map((name) => [name, name]));
  };
  vm.runInNewContext(code, { exports: module.exports, module, require: load, Date: FixtureDate }, { timeout: 2000 });
  return module.exports;
}
function find(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node.props;
  for (const child of [].concat(node.props?.children ?? [])) {
    const hit = find(child, type);
    if (hit) return hit;
  }
  return null;
}
async function page(index, data, params = { tab: 'all' }, cap = 1000, fail = false, secondary = {}, secondaryFailures = []) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-admin' } } }) },
    from(table) {
      let selection = ''; let predicates = []; let single = false; let queryCap = cap;
      const call = { table, operations: [] }; calls.push(call);
      const builder = {
        select(s, options) { selection = s; call.operations.push(['select', s, options]); return this; },
        eq(k, v) { predicates.push((r) => r[k] === v); call.operations.push(['eq', k, v]); return this; },
        is(k, v) { predicates.push((r) => r[k] === v); return this; },
        in(k, v) { predicates.push((r) => v.includes(r[k])); return this; },
        order(k, o) { call.operations.push(['order', k, o]); return this; },
        limit(n) { queryCap = Math.min(queryCap, n); return this; },
        single() { single = true; return this; },
        then(resolve, reject) {
          if (single) return Promise.resolve({ data: { barangay_id: 'a', role: 'admin' }, error: null }).then(resolve, reject);
          let result = table === tableNames[index] ? data : [];
          if (table in secondary) result = secondary[table];
          if (table === 'profiles' && index === 5) result = data.map((r) => ({ id: r.user_id, full_name: r.profiles?.full_name }));
          result = result.filter((r) => predicates.every((predicate) => predicate(r))).slice(0, queryCap);
          call.selection = selection;
          const failed = (fail && table === tableNames[index]) || secondaryFailures.includes(table);
          return Promise.resolve({ data: failed ? null : result, error: failed ? { message: 'synthetic query failure' } : null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const mod = evaluate(admin + screens[index] + '/page.tsx', { '@/lib/supabase/server': { createSupabaseServerClient: async () => client } });
  const tree = await mod.default({ searchParams: Promise.resolve(params) });
  return { table: find(tree, components[index]), calls, tree };
}

test('synthetic sizes and page slices: independent future-contract oracle only', () => {
  for (const size of sizes) for (const pageSize of pageSizes) {
    const data = rows(size); const combined = [];
    for (let page = 0; page < Math.ceil(size / pageSize); page++) {
      const chunk = data.slice(page * pageSize, (page + 1) * pageSize);
      assert.equal(chunk.length, Math.min(pageSize, size - page * pageSize)); combined.push(...chunk);
    }
    assert.deepEqual(combined.map((r) => r.id), data.map((r) => r.id));
    assert.equal(new Set(combined.map((r) => r.id)).size, size);
  }
});
for (let i = 0; i < screens.length; i++) {
  test(`${screens[i]} actual server page: baseline 1505 rows truncated to 1000 by simulated API cap`, async () => {
    const data = rows(1505);
    if (i === 0) data.forEach((r) => r.status = 'submitted');
    const result = await page(i, data);
    assert.equal(result.table[props[i]].length, 1000);
    assert.ok(result.calls.every((c) => !c.operations.some(([op]) => op === 'range')));
    assert.ok(result.calls.every((c) => !c.operations.some(([op, , options]) => op === 'select' && options?.count === 'exact')));
  });
  test(`${screens[i]} actual server page: literal punctuation and search trimming`, async () => {
    const data = rows(1); const token = '100%_literal,(x)';
    if (i === 0) data[0].reference_number = token;
    if (i === 1) data[0].service_requests.reference_number = token;
    if (i === 2) data[0].full_name = token;
    if (i === 3 || i === 4) data[0].title = token;
    if (i === 5) data[0].applicant_number = token;
    if (i === 6) data[0].name = token;
    if (i === 7) data[0].profile.full_name = token;
    const exact = await page(i, data, { tab: 'all', q: token });
    assert.equal(exact.table[props[i]].length, 1);
    const spaced = await page(i, data, { tab: 'all', q: ` ${token} ` });
    assert.equal(spaced.table[props[i]].length, i < 2 ? 0 : 1);
  });
  test(`${screens[i]} actual server page: query error handling baseline`, async () => {
    const result = await page(i, rows(1), { tab: 'all' }, 1000, true);
    if ([0, 1, 7].includes(i)) assert.equal(result.table[props[i]].length, 0);
    else assert.equal(result.table, null);
  });
}
test('actual Requests search cannot find match beyond simulated cap', async () => {
  const data = rows(1505); data.at(-1).reference_number = 'beyond-cap-needle';
  assert.equal((await page(0, data, { tab: 'all', q: 'beyond-cap-needle' })).table.requests.length, 0);
  assert.equal((await page(0, data, { tab: 'all', q: 'beyond-cap-needle' }, 2000)).table.requests.length, 1);
});
test('actual Applicants search excludes resident names; preserves score inner projection', async () => {
  const data = rows(1); data[0].profiles.full_name = 'resident-name-only';
  const result = await page(5, data, { tab: 'all', q: 'resident-name-only' });
  assert.equal(result.table.rows.length, 0);
  assert.match(result.calls[0].selection, /drive_registration_scores!inner/);
});
test('actual Staff server excludes missing profiles', async () => {
  const data = rows(2); data[0].profile = null;
  assert.equal((await page(7, data)).table.rows.length, 1);
});
test('actual Health Upcoming includes Today and excludes inactive', async () => {
  const data = rows(2); data[0].is_active = false;
  const local = new FixtureDate(); const day = `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
  data.forEach((r) => r.drive_date = day);
  assert.equal((await page(4, data, { tab: 'upcoming' })).table.rows.length, 1);
  assert.equal((await page(4, data, { tab: 'today' })).table.rows.length, 1);
});
test('comparison/permission/concurrency fixture coverage exists; no runtime pass claim', () => {
  assert.ok(edgeValues.includes(null) && edgeValues.includes('REF-2') && edgeValues.includes('REF-10'));
  assert.equal(permissions.length, 4); assert.equal(concurrency.length, 8);
  assert.equal(rows(1505).at(-1).full_name, 'beyond-cap-needle');
});

test('actual client sort expressions: default keys and absence of unique tie-break', () => {
  const files = ['requests-table', 'transactions-table', 'resident-directory', 'incident-table', 'drive-table', 'applicants-table', 'households-table', 'staff-table'];
  const state = ['referenceOrder', 'dateOrder', 'nameOrder', 'submittedOrder', 'dateOrder', 'registeredOrder', 'nameOrder', 'nameOrder'];
  for (let i = 0; i < screens.length; i++) {
    const file = admin + screens[i] + '/' + files[i] + '.tsx';
    const sf = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let expression;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && /^sorted/.test(node.name.getText(sf))) expression = node.initializer.getText(sf);
      ts.forEachChild(node, visit);
    }
    visit(sf); assert.ok(expression);
    const data = rows(2); data[0].id = 'z'; data[1].id = 'a';
    for (const row of data) { row.name = 'same'; row.full_name = 'same'; row.profile.full_name = 'same'; row.reference_number = 'same'; }
    data[1].created_at = data[0].created_at;
    const result = vm.runInNewContext(expression, { rows:data, requests:data, payments:data, residents:data, [state[i]]:[1,3,4,5].includes(i) ? 'desc' : 'asc' }, { timeout:2000 });
    assert.equal(result[0].id, 'z'); // Current sort retains input tie order, not base ID ascending.
  }
});
test('actual Requests reference comparator is lexical, not the proposed numeric-token comparator', () => {
  const text = source(admin + 'requests/requests-table.tsx');
  assert.match(text, /reference_number\.localeCompare\(b\.reference_number\)/);
  assert.deepEqual(['REF-2','REF-10'].sort((a,b) => a.localeCompare(b)), ['REF-10','REF-2']);
});
test('actual search predicates: each existing searchable field independently matches', async () => {
  const fields = [
    ['reference_number','profiles.full_name','document_types.name'],
    ['service_requests.reference_number','service_requests.profiles.full_name','service_requests.document_types.name','collector.full_name'],
    ['full_name','first_name','last_name','middle_name','email','mobile_number','home_address','house_no','street','city','occupation','id_type'],
    ['title','description','incident_categories.name','profiles.full_name','profiles.email'],
    ['title','location','eligible_criteria'],
    ['applicant_number','medical_drives.title','comorbidities'],
    ['name','profiles.full_name','relation','role'],
    ['profile.full_name','profile.email','profile.mobile_number','profile.home_address','official_role'],
  ];
  for (let i=0;i<screens.length;i++) for (const field of fields[i]) {
    const data=rows(1); const parts=field.split('.'); let object=data[0];
    for (const part of parts.slice(0,-1)) object=object[part];
    object[parts.at(-1)] = field==='comorbidities' ? ['unique-search-token'] : 'unique-search-token';
    assert.equal((await page(i,data,{tab:'all',q:'unique-search-token'})).table[props[i]].length,1, `${screens[i]} ${field}`);
  }
  assert.equal((await page(4,rows(1),{tab:'all',q:'Dental Care'})).table.rows.length,1);
});
test('missing optional embeds remain table members, except Staff missing-profile exclusion', async () => {
  for (const i of [0,1,3,5,6]) {
    const data=rows(1);
    data[0].profiles=null; data[0].document_types=null; data[0].incident_categories=null;
    data[0].collector=null; data[0].service_requests=null; data[0].medical_drives=null;
    assert.equal((await page(i,data)).table[props[i]].length,1);
  }
});
test('actual segmented defaults and separate filters', async () => {
  const defaults=['active','all','all','open','upcoming','all','all','all'];
  for (let i=0;i<screens.length;i++) assert.equal((await page(i,[],{})).table.tab,defaults[i]);
  assert.equal((await page(0,rows(1),{tab:'all',doc:'missing'})).table.requests.length,0);
  assert.equal((await page(1,rows(1),{tab:'all',method:'qrph'})).table.payments.length,0);
  assert.equal((await page(2,rows(1),{tab:'all',verification:'with_id'})).table.residents.length,0);
  assert.equal((await page(3,rows(1),{tab:'all',category:'missing'})).table.rows.length,0);
  assert.equal((await page(4,rows(1),{tab:'all',type:'missing'})).table.rows.length,0);
  assert.equal((await page(5,rows(1),{tab:'all',type:'missing'})).table.rows.length,0);
  assert.equal((await page(6,rows(1),{tab:'all',relation:'spouse'})).table.rows.length,0);
  assert.equal((await page(7,rows(1),{tab:'all',role:'admin'})).table.rows.length,0);
});

function summaries(tree) {
  const result = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.props?.label !== undefined && node.props?.value !== undefined) result.push({ label: node.props.label, value: node.props.value });
    for (const child of [].concat(node.props?.children ?? [])) visit(child);
  }
  visit(tree);
  return result;
}

test('all eight actual pages keep summary membership independent of search', async () => {
  for (let i = 0; i < screens.length; i++) {
    const data = rows(7);
    const all = await page(i, data);
    const none = await page(i, data, { tab: 'all', q: 'no-synthetic-row-matches-this' });
    assert.equal(none.table[props[i]].length, 0);
    assert.ok(summaries(all.tree).length > 0);
    assert.deepEqual(summaries(none.tree), summaries(all.tree), screens[i]);
  }
});

test('Health actual counts include cancelled registrations, zero drives and registrations for omitted drives', async () => {
  const data = rows(2);
  const registrations = [{ drive_id: data[0].id, status: 'cancelled' }, { drive_id: 'omitted-drive', status: 'pending' }];
  const result = await page(4, data, { tab: 'all' }, 1000, false, { drive_registrations: registrations });
  assert.deepEqual(result.table.rows.map(row => row.registration_count), [1, 0]);
  assert.equal(summaries(result.tree).find(item => item.label === 'Registrations').value, 2);
});

test('Health secondary registration scan is also capped and undercounts a drive', async () => {
  const data = rows(1);
  const registrations = Array.from({ length: 1505 }, () => ({ drive_id: data[0].id }));
  const result = await page(4, data, { tab: 'all' }, 1000, false, { drive_registrations: registrations });
  assert.equal(result.table.rows[0].registration_count, 1000);
  assert.equal(summaries(result.tree).find(item => item.label === 'Registrations').value, 1000);
});

test('Households Parent / Other card excludes parents in actual baseline', async () => {
  const data = rows(2); data[0].relation = 'parent'; data[1].relation = 'other';
  assert.equal(summaries((await page(6, data)).tree).find(item => item.label === 'Parent / Other').value, 1);
});

test('Applicants actual joined-array substring search matches across a separator', async () => {
  const data = rows(1); data[0].comorbidities = ['Asthma', 'Diabetes'];
  assert.equal((await page(5, data, { tab: 'all', q: 'ma, dia' })).table.rows.length, 1);
});

test('Directory ID presence is independent of ID review decision', async () => {
  const data = rows(2);
  data[0].id_photo_urls = ['synthetic://photo']; data[0].id_verification_status = 'verification_failed';
  data[1].id_verification_status = 'verified';
  assert.deepEqual((await page(2, data, { tab: 'all', verification: 'with_id' })).table.residents.map(row => row.id), [data[0].id]);
});

test('each status segment retains its existing membership, including payment cancelled in All', async () => {
  const cases = [
    { index: 0, statuses: ['submitted', 'in_progress', 'ready_for_pickup', 'completed', 'cancelled'], tabs: ['active', 'processing', 'pickup', 'completed', 'cancelled'] },
    { index: 1, statuses: ['pending', 'paid', 'failed', 'expired', 'refunded', 'cancelled'], tabs: ['pending', 'paid', 'failed', 'expired', 'refunded'] },
    { index: 3, statuses: ['open', 'in_progress', 'resolved', 'withdrawn', 'unresolved'], tabs: ['open', 'in_progress', 'resolved', 'withdrawn', 'unresolved'] },
    { index: 5, statuses: ['pending', 'confirmed', 'attended', 'cancelled'], tabs: ['pending', 'confirmed', 'attended', 'cancelled'] },
  ];
  for (const { index, statuses, tabs } of cases) {
    const data = rows(statuses.length);
    data.forEach((row, n) => row.status = statuses[n]);
    assert.equal((await page(index, data)).table[props[index]].length, statuses.length);
    for (let n = 0; n < tabs.length; n++) {
      assert.deepEqual((await page(index, data, { tab: tabs[n] })).table[props[index]].map(row => row.id), [data[n].id]);
    }
  }
});

test('secondary registration failure retains Health rows but substitutes zero counts', async () => {
  const data = rows(1);
  const result = await page(4, data, { tab: 'all' }, 1000, false,
    { drive_registrations: [{ drive_id: data[0].id }] }, ['drive_registrations']);
  assert.equal(result.table.rows.length, 1);
  assert.equal(result.table.rows[0].registration_count, 0);
  assert.equal(summaries(result.tree).find(item => item.label === 'Registrations').value, 0);
});

test('failed applicant profile lookup keeps inner-score DTO row with a null profile', async () => {
  const data = rows(1);
  data[0].score.priority_score = 73;
  const result = await page(5, data, { tab: 'all' }, 1000, false, {}, ['profiles']);
  assert.equal(result.table.rows.length, 1);
  assert.equal(result.table.rows[0].profiles, null);
  assert.equal(result.table.rows[0].priority_score, data[0].score.priority_score);
});

test('Directory verification segments include every non-verified state in Unverified', async () => {
  const data = rows(4);
  data.forEach((row, n) => row.email_verification_status = ['verified', 'unverified', 'pending', 'unavailable'][n]);
  assert.deepEqual((await page(2, data, { tab: 'verified' })).table.residents.map(row => row.id), [data[0].id]);
  assert.deepEqual((await page(2, data, { tab: 'unverified' })).table.residents.map(row => row.id), data.slice(1).map(row => row.id));
});

test('Household check-in and Staff role segments preserve raw-value membership', async () => {
  const members = rows(2); members[1].is_checked_in = true;
  for (const [tab, n] of [['checked_in', 1], ['not_checked_in', 0]]) {
    assert.deepEqual((await page(6, members, { tab })).table.rows.map(row => row.id), [members[n].id]);
  }
  const officials = rows(3);
  officials.forEach((row, n) => row.official_role = ['admin', 'staff', 'captain'][n]);
  assert.deepEqual((await page(7, officials, { tab: 'admin' })).table.rows.map(row => row.id), [officials[0].id]);
  assert.deepEqual(new Set((await page(7, officials, { tab: 'staff' })).table.rows.map(row => row.id)), new Set(officials.slice(1).map(row => row.id)));
});

test('Health every date bucket uses scheduled date and inactive takes precedence', async () => {
  const data = rows(4);
  const now = new FixtureDate();
  const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  data[0].drive_date = '2000-01-01'; data[1].drive_date = day;
  data[2].drive_date = '2099-01-01'; data[3].drive_date = day; data[3].is_active = false;
  for (const [tab, indices] of [['all',[0,1,2,3]], ['upcoming',[1,2]], ['today',[1]], ['past',[0]], ['inactive',[3]]]) {
    assert.deepEqual((await page(4, data, { tab })).table.rows.map(row => row.id), indices.map(n => data[n].id));
  }
});

test('invalid tab parameters resolve to each documented existing default', async () => {
  const defaults = ['active','all','all','open','upcoming','all','all','all'];
  for (let n = 0; n < screens.length; n++) {
    assert.equal((await page(n, [], { tab: 'not-a-real-tab' })).table.tab, defaults[n]);
  }
});

test('displayed excluded fields do not silently expand actual search predicates', async () => {
  for (const [index, fields] of [[2,['suffix','sex','employment_status']], [3,['address','specific_area_details']]]) {
    const data = rows(1);
    fields.forEach(field => data[0][field] = 'excluded-field-needle');
    assert.equal((await page(index, data, { tab: 'all', q: 'excluded-field-needle' })).table[props[index]].length, 0);
  }
});

test('Directory household summary uses JSON entries, independent of normalized member rows', async () => {
  const data = rows(2);
  data[0].household_members = [{ id: 'json-only-a' }, { id: 'json-only-b' }];
  data[1].household_members = null;
  const result = await page(2, data, { tab: 'all' }, 1000, false,
    { household_members: rows(7) });
  assert.equal(summaries(result.tree).find(item => item.label === 'Household').value, 2);
  assert.ok(!result.calls.some(call => call.table === 'household_members'));
});

test('Transactions summaries sum centavos by ledger method/status before table filters', async () => {
  const data = rows(4);
  data.forEach((row, n) => { row.amount_centavos = (n + 1) * 100; });
  data[0].status = 'paid'; data[1].status = 'paid'; data[1].method = 'qrph';
  data[2].status = 'pending'; data[3].status = 'refunded';
  const result = await page(1, data, { tab: 'paid', method: 'qrph' });
  assert.deepEqual(result.table.payments.map(row => row.id), [data[1].id]);
  assert.deepEqual(summaries(result.tree).map(item => item.value), ['1', '2', '3']);
});

test('Requests failed option queries retain rows and silently substitute empty options', async () => {
  const result = await page(0, rows(1), { tab: 'all' }, 1000, false, {}, ['document_types']);
  assert.equal(result.table.requests.length, 1);
  assert.deepEqual(Array.from(result.table.documentTypes), []);
});

test('Health actual query lacks tenant filtering; mocked cross-tenant rows survive', async () => {
  const data = rows(2);
  data.forEach((row, n) => row.barangay_id = n ? 'foreign' : 'a');
  const result = await page(4, data);
  assert.equal(result.table.rows.length, 2);
  const main = result.calls.find(call => call.table === 'medical_drives');
  assert.ok(!main.operations.some(([op, key]) => op === 'eq' && key === 'barangay_id'));
  // This is a source-query predicate check; real RLS behavior is retained separately.
});

test('every actual page misses a searchable sentinel beyond the simulated cap', async () => {
  const fields = ['reference_number', 'service_requests.reference_number', 'full_name', 'title', 'title', 'applicant_number', 'name', 'profile.full_name'];
  for (let index = 0; index < screens.length; index++) {
    const data = rows(1505); const parts = fields[index].split('.');
    let target = data.at(-1);
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts.at(-1)] = 'unique-beyond-cap-sentinel';
    const params = { tab: 'all', q: 'unique-beyond-cap-sentinel' };
    assert.equal((await page(index, data, params)).table[props[index]].length, 0, screens[index]);
    assert.equal((await page(index, data, params, 2000)).table[props[index]].length, 1, screens[index]);
  }
});

test('Incident category filters the main query while status summaries keep independent membership', async () => {
  const data = rows(2);
  data[0].status = 'open'; data[1].status = 'resolved';
  data[1].category_id = 'other-category';
  const all = await page(3, data);
  const filtered = await page(3, data, { tab: 'all', category: 'category' });
  assert.equal(filtered.table.rows.length, 1);
  assert.deepEqual(summaries(filtered.tree), summaries(all.tree));
  assert.ok(filtered.calls.some(call => call.table === 'incidents' && call.operations.some(([op, key]) => op === 'eq' && key === 'category_id')));
});
