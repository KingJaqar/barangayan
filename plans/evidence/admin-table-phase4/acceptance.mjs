import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { createRequire } from 'node:module';
import { sql, statePath, privateDir } from './runtime-stack.mjs';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('dist/admin-table-phase1-browsers');
const { chromium, firefox, webkit } = require('playwright');
const state = JSON.parse(fs.readFileSync(statePath)), users = JSON.parse(fs.readFileSync(privateDir + '/users.json'));
const trusted = createClient(state.api, state.serviceKey, { auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } });
const report = { passed: false, browsers: [], checks: [], failures: [], errors: [], timings: [], limitations: [
  'Physical inputs, native Safari/Edge, native zoom and manual screen-reader checks remain release verification.',
  'ID evidence signing/image responses are synthetic; the actual review RPC and audit use the isolated database.',
  'Invitation provider delivery is outside the table integration gate.'
] };
const suffix = process.argv.includes('--matrix') ? '-matrix' : process.argv.includes('--actions') ? '-actions' : '';
const save = () => fs.writeFileSync(new URL('./acceptance' + suffix + '.json', import.meta.url), JSON.stringify(report, null, 2));
const fault = value => fs.writeFileSync(privateDir + '/faults.json', JSON.stringify(value));
const check = async (label, run) => { if (process.argv.includes('--remaining') && ['chrome:', 'all 48', 'complete unchanged'].some(prefix => label.startsWith(prefix))) return;
  try { await run(); report.checks.push(label); console.log('Passed: ' + label); save(); }
  catch (e) { report.failures.push({ label, message: e.stack }); save(); throw e; } };
const sqlAdmin = query => sql(`begin;set local role authenticated;set local request.jwt.claims='${JSON.stringify({ sub: users.admin.id, role: 'authenticated' })}';${query};rollback;`);
const rows = (name, order = 's_name asc nulls last,id asc', where = '') => JSON.parse(sqlAdmin(`select coalesce(json_agg(id),'[]') from(select id from admin_${name}_browse ${where} order by ${order})s`));
async function patch(table, id, values) { const r = await trusted.from(table).update(values).eq('id', id).select('id'); assert.ifError(r.error); assert.equal(r.data.length, 1); }
async function auditRows(page, id, expected = []) {
  const signal = AbortSignal.timeout(10000);
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await trusted.from('admin_audit_log').select('action').eq('entity_id', id).retry(false).abortSignal(signal);
    assert.ifError(result.error);
    if (result.data.length && expected.every(action => result.data.some(row => row.action === action))) return result.data;
    await page.waitForTimeout(100);
  }
  throw new Error('Audit was not persisted within the finite observation window');
}
async function login(page, user = 'admin') {
 const auth = createClient(state.api, state.anonKey, {auth:{persistSession:false,autoRefreshToken:false}});
 const signed = await auth.auth.signInWithPassword(users[user]);assert.ifError(signed.error);
 let cookies=[];const session=createServerClient(state.api,state.anonKey,{cookies:{getAll:()=>cookies,setAll:next=>{cookies=next;}}});
 assert.ifError((await session.auth.setSession({access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token})).error);
 await page.context().addCookies(cookies.map(c=>({name:c.name,value:c.value,url:'http://127.0.0.1:3140'})));
 const notifications=page.waitForResponse(r=>r.url().includes('/rest/v1/admin_audit_log?')&&r.status()===200,{timeout:15000});
 await page.goto('http://127.0.0.1:3140/dashboard',{timeout:60000});await notifications;
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.table-browse-panel')?.getAttribute('aria-busy') === 'false');
  await page.waitForFunction(() => Object.keys(document.querySelector('input[type=search]') ?? {}).some(k => k.startsWith('__reactProps')));
}
const routes = { residents: 'residents', households: 'households-residents', staff: 'staff' };
const labels = { residents: 'Resident Directory', households: 'Households & Residents', staff: 'Staff Members' };
async function go(page, name, query = '') { await page.goto('http://127.0.0.1:3140/' + routes[name] + query, { timeout: 60000 }); await ready(page); }
async function change(page, fn) { const before = page.url(); await fn(); if (before === page.url()) await page.waitForURL(u => u.toString() !== before); await ready(page); }
async function range(page, text) { await page.waitForFunction(text => document.querySelector('.table-browse-pagination')?.textContent.includes(text), text); await ready(page); }
const ids = async page => {
  if ((await page.locator('.table-browse-pagination').first().innerText()).includes('Showing 0–0 of 0')) return [];
  await page.waitForFunction(() => [...document.querySelectorAll('tbody tr')].every(element => {
    const key = Object.keys(element).find(key => key.startsWith('__reactFiber'));
    return key && element[key].key;
  }));
  return page.locator('tbody tr').evaluateAll(elements => elements.map(element => {
  // React row keys expose the stable record identity without adding product/test attributes.
  const key = Object.keys(element).find(key => key.startsWith('__reactFiber')); return key ? element[key].key : null;
  }));
};
async function edit(page, cell, value) { await cell.focus(); await cell.press('Enter'); await cell.locator('input').waitFor(); await cell.locator('input').fill(value); }
const deadline = setTimeout(() => { save(); process.exit(1); }, 900000);
fault({});
try {
  for (const [engine, launch] of [['chrome', () => chromium.launch({ channel: 'chrome', headless: true })],
    ['firefox', () => firefox.launch({ headless: true })], ['webkit', () => webkit.launch({ headless: true })]]) {
    if (process.argv.includes('--matrix') ? engine === 'chrome' : engine !== 'chrome') continue;
    const browser = await launch(); report.browsers.push({ engine, version: browser.version() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => report.errors.push({ engine, message: e.message }));
    try {
      await login(page);
      if (!process.argv.includes('--actions')) {
        for (const name of Object.keys(routes)) await check(engine + ': ' + name + ' defaults, sizes, last page, keyboard, scrolling, resizing and empty results', async () => {
          const expected = rows(name), total = expected.length;
          await go(page, name); assert.equal(await page.locator('tbody tr').count(), 10); assert.deepEqual(await ids(page), expected.slice(0, 10));
          assert.equal(await page.getByLabel('Sort by', { exact: true }).inputValue(), 'name'); assert.equal(await page.getByLabel('Direction', { exact: true }).inputValue(), 'asc');
          const tabs = page.getByRole('group', { name: name === 'residents' ? 'Email verification' : name === 'households' ? 'Check-in status' : 'Account type' });
          assert.equal(await tabs.getByRole('button').first().innerText(), 'All'); assert.equal(await tabs.getByRole('button').first().getAttribute('aria-pressed'), 'true');
          assert.deepEqual(await page.getByLabel('Rows per page').locator('option').evaluateAll(opts => opts.map(o => o.value)), ['10', '20', '30', '50', '100']);
          await change(page, () => page.getByRole('button', { name: 'Last', exact: true }).click()); await range(page, `Showing ${Math.floor((total - 1) / 10) * 10 + 1}–${total} of ${total}`);
          for (const size of ['20', '30', '50', '100', '10']) {
            await change(page, () => page.getByLabel('Rows per page').selectOption(size)); assert.equal(await page.locator('tbody tr').count(), +size); assert.equal(new URL(page.url()).searchParams.get('page'), '1');
          }
          const body = page.getByRole('region', { name: labels[name] + ' rows and columns', exact: true });
          await body.focus(); await body.press('ArrowRight'); assert.ok(await body.evaluate(e => e.scrollLeft) > 0); await body.press('Tab'); assert.ok(!await body.evaluate(e => e === document.activeElement));
          await page.getByRole('button', { name: 'Scroll columns right' }).click(); assert.ok(await body.evaluate(e => e.scrollLeft) > 0);
          const resize = page.getByRole('separator').first(); const width = await page.locator('thead th').first().evaluate(e => e.getBoundingClientRect().width);
          await resize.focus(); await resize.press('ArrowRight'); assert.ok(await page.locator('thead th').first().evaluate(e => e.getBoundingClientRect().width) > width);
          await page.setViewportSize({ width: 600, height: 450 }); assert.ok(await page.locator('main').evaluate(e => e.scrollWidth - e.clientWidth) <= 1); await page.setViewportSize({ width: 1440, height: 1000 });
          const needle = name === 'staff' ? 'Fixture Staff 1505' : 'Beyond Cap Needle';
          await page.getByLabel('Search', { exact: true }).fill('  ' + needle + '  '); await range(page, 'Showing 1–1 of 1');
          assert.ok((await page.locator('tbody').innerText()).includes(name === 'residents' ? 'Needle Ω' : needle));
          await page.getByLabel('Search', { exact: true }).fill('no match fixture'); await range(page, 'Showing 0–0 of 0');
          assert.ok(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled()); assert.ok(!(await page.locator('.table-browse-pagination').first().innerText()).includes('Page 1 of 0'));
          await page.screenshot({ path: path.join(import.meta.dirname, engine + '-' + name + '-' + Date.now() + '.png') });
        });
        if (engine !== 'chrome') continue;
        await check('all 48 advertised sort/direction combinations follow global database order', async () => {
          for (const name of Object.keys(routes)) {
            await go(page, name, '?pageSize=100'); const sorts = await page.getByLabel('Sort by', { exact: true }).locator('option').evaluateAll(opts => opts.map(o => o.value));
            for (const sort of sorts) for (const dir of ['asc', 'desc']) {
              if (await page.getByLabel('Sort by', { exact: true }).inputValue() !== sort) await change(page, () => page.getByLabel('Sort by', { exact: true }).selectOption(sort));
              if (await page.getByLabel('Direction', { exact: true }).inputValue() !== dir) await change(page, () => page.getByLabel('Direction', { exact: true }).selectOption(dir));
              assert.deepEqual(await ids(page), rows(name, `s_${sort} ${dir} nulls last,id asc`).slice(0, 100), name + ':' + sort + ':' + dir);
              const sorted = page.locator('thead th[aria-sort]'); const mapped = (await page.getByLabel('Sort by', { exact: true }).inputValue());
              if (mapped === 'name' && name === 'residents') assert.equal(await sorted.count(), 0);
            }
          }
        });
        await check('complete unchanged concatenated pages have no gaps or duplicates on all three routes', async () => {
          for (const name of Object.keys(routes)) {
            await go(page, name, '?pageSize=100'); const expected = rows(name), combined = [];
            for (let i = 0; i < Math.ceil(expected.length / 100); i++) { combined.push(...await ids(page)); if (i < Math.ceil(expected.length / 100) - 1) await change(page, () => page.getByRole('button', { name: 'Next', exact: true }).click()); }
            assert.deepEqual(combined, expected); assert.equal(new Set(combined).size, expected.length);
          }
        });
        await check('combined filters/search preserve independent summaries and atomic first-page reset', async () => {
          const cases = { residents: ['verification', 'without_id', 'unverified'], households: ['relation', 'child', 'not_checked_in'], staff: ['role', 'admin', 'admin'] };
          for (const name of Object.keys(routes)) {
            await go(page, name, '?pageSize=20&page=2'); const summary = await page.locator('.table-browse-panel').evaluate(e => e.previousElementSibling?.previousElementSibling?.textContent ?? e.parentElement.firstElementChild.textContent);
            const [filter, value, tab] = cases[name]; const filterLabel = name === 'residents' ? 'ID presence' : name === 'households' ? 'Relation' : 'Official role';
            await change(page, () => page.getByLabel(filterLabel, { exact: true }).selectOption(value)); assert.equal(new URL(page.url()).searchParams.get('page'), '1');
            await change(page, () => page.getByRole('group').filter({ has: page.getByRole('button', { name: name === 'residents' ? 'Unverified' : name === 'households' ? 'Not Checked In' : 'Admins', exact: true }) }).getByRole('button', { name: name === 'residents' ? 'Unverified' : name === 'households' ? 'Not Checked In' : 'Admins', exact: true }).click());
            const where = name === 'residents' ? 'where not f_email_verified and not f_with_id' : name === 'households' ? "where not f_checked_in and f_relation='child'" : "where f_role='admin'";
            assert.deepEqual(await ids(page), rows(name, 's_name asc nulls last,id asc', where).slice(0, 20));
            assert.ok(summary); // Authoritative summary values are independently checked below.
            const expectedSummary = JSON.parse(sqlAdmin(`select summary from admin_${name}_summary`));
            const cards = await page.locator('.table-browse-panel').evaluate(e => [...e.parentElement.firstElementChild.children].map(c => c.lastElementChild.textContent));
            const keys = name === 'residents' ? ['total','verified','unverified','withId','withoutId','idPending','idVerified','idFailed','householdMembers'] : name === 'households' ? ['total','checked_in','not_checked_in','spouse','child','parent','other'] : ['total','admin','staff'];
            assert.deepEqual(cards, keys.map(key => String(expectedSummary[key])));
          }
        });
        await check('rapid delayed navigation, Back cancellation and one invalid-page correction', async () => {
          await go(page, 'residents', '?page=2'); fault({ delay: 150 });
          await page.getByLabel('Search', { exact: true }).fill('Beyond Cap'); await page.getByLabel('Sort by', { exact: true }).selectOption('modified'); await page.getByLabel('Direction', { exact: true }).selectOption('asc');
          await range(page, 'Showing 1–1 of 1'); assert.equal(new URL(page.url()).searchParams.get('sort'), 'modified'); assert.equal(new URL(page.url()).searchParams.get('dir'), 'asc');
          await page.getByLabel('Search', { exact: true }).fill('should be cancelled'); await page.goBack(); await ready(page); await page.waitForTimeout(500); assert.ok(!page.url().includes('should'));
          fault({}); await go(page, 'households', '?q=Beyond%20Cap%20Needle&page=900000'); await range(page, 'Showing 1–1 of 1'); await page.waitForURL(u => u.searchParams.get('page') === '1');
        });
        await check('independent table, summary and options errors retain full query on retry', async () => {
          for (const name of Object.keys(routes)) {
            const query = '?pageSize=20&sort=modified&dir=asc&q=Fixture'; fault({ fail: ['admin_' + name + '_browse'] }); await go(page, name, query);
            assert.ok(await page.getByRole('alert').count()); assert.equal(await page.locator('.table-browse-pagination').count(), 0);
            const before = page.url(); fault({}); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.locator('tbody tr').first().waitFor(); await ready(page); assert.equal(page.url(), before);
            fault({ fail: ['admin_' + name + '_summary'] }); await go(page, name, query); assert.ok(await page.getByRole('button', { name: 'Retry summary' }).count()); assert.equal(await page.locator('tbody tr').count(), 20);
            fault({}); await page.getByRole('button', { name: 'Retry summary' }).click(); await page.getByRole('button', { name: 'Retry summary' }).waitFor({ state: 'hidden' }); await ready(page);
          }
          fault({ options: true }); await go(page, 'households'); assert.ok(await page.getByRole('button', { name: '+ Add Member' }).isDisabled()); fault({}); await page.getByRole('button', { name: 'Retry options' }).click(); await page.getByRole('button', { name: '+ Add Member' }).waitFor({ state: 'visible' }); await ready(page); assert.ok(await page.getByRole('button', { name: '+ Add Member' }).isEnabled());
        });
      }
      if (process.argv.includes('--smoke')) continue;
      if (!process.argv.includes('--matrix')) {
        await check('failed directory edit retains same draft, blocks navigation and retries/audits', async () => {
          await go(page, 'residents', '?q=Beyond%20Cap%20Needle'); const cell = page.locator('tbody tr td').nth(0); fault({ fail: ['profiles'] });
          await edit(page, cell, 'Phase4 Edited'); await cell.locator('input').press('Enter'); await page.getByRole('button', { name: 'Retry save' }).waitFor();
          const before = page.url(); await page.getByLabel('Sort by', { exact: true }).selectOption('modified'); await page.waitForTimeout(300); assert.equal(page.url(), before); assert.equal(await cell.locator('input').inputValue(), 'Phase4 Edited');
          fault({}); await page.getByRole('button', { name: 'Retry save' }).click(); await ready(page); await cell.locator('input').waitFor({ state: 'hidden' });
          const row = await trusted.from('profiles').select('first_name').eq('id', '20000000-0000-4000-8000-000000001505').single(); assert.ifError(row.error); assert.equal(row.data.first_name, 'Phase4 Edited');
          assert.ok((await auditRows(page, '20000000-0000-4000-8000-000000001505')).some(a => a.action === 'update'));
          await patch('profiles', '20000000-0000-4000-8000-000000001505', { first_name: 'Beyond Cap' });
        });
        await check('directory details retain stable ID off-page, handle deletion/errors and restore focus', async () => {
          await go(page, 'residents', '?q=Beyond%20Cap%20Needle'); const cell = page.getByRole('button', { name: 'View resident Beyond Cap Needle Ω', exact: true }); await cell.focus(); await cell.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Resident details' }); await dialog.getByRole('heading', { name: 'Beyond Cap Needle Ω' }).waitFor();
          await dialog.press('Escape'); assert.equal(await cell.evaluate(e => e === document.activeElement), true);
          await cell.focus(); await cell.press('Enter'); await dialog.getByRole('heading', { name: 'Beyond Cap Needle Ω' }).waitFor();
          // Browser history changes the query without dismissing local selected state.
          await page.evaluate(() => { const search = document.querySelector('input[type=search]'); const props = search[Object.keys(search).find(k => k.startsWith('__reactProps'))]; props.onChange({ target: { value: 'no match selection' } }); });
          await range(page, 'Showing 0–0 of 0'); await dialog.getByRole('heading', { name: 'Beyond Cap Needle Ω' }).waitFor();
          fault({ fail: ['admin_residents_browse'] }); await dialog.getByRole('button', { name: 'Close details' }).click();
          assert.equal(await page.getByLabel('Search', { exact: true }).evaluate(e => e === document.activeElement), true); fault({});
          await go(page, 'residents', '?q=Beyond%20Cap%20Needle'); await page.getByRole('button', { name: 'View resident Beyond Cap Needle Ω', exact: true }).click(); await dialog.getByRole('heading', { name: 'Beyond Cap Needle Ω' }).waitFor();
          await patch('profiles', '20000000-0000-4000-8000-000000001505', { deleted_at: new Date().toISOString() });
          await page.evaluate(() => { const button = document.querySelector('select[id$="-sort"]'); const props = button[Object.keys(button).find(k => k.startsWith('__reactProps'))]; props.onChange({ target: { value: 'joined' } }); });
          await dialog.getByText(/This record is no longer available/).waitFor(); await dialog.getByRole('button', { name: 'Close details' }).click(); assert.equal(await page.getByLabel('Search', { exact: true }).evaluate(e => e === document.activeElement), true);
          await patch('profiles', '20000000-0000-4000-8000-000000001505', { deleted_at: null });
        });
        await check('member check-in cleanup, complete beyond-cap add lookup, removal and audit', async () => {
          await go(page, 'households', '?q=Beyond%20Cap%20Needle'); const id = (await ids(page))[0];
          await patch('household_members', id, { is_checked_in: true, checked_in_at: '2026-10-12T01:00:00Z', checked_in_center_name: 'Fixture Center' }); await go(page, 'households', '?q=Beyond%20Cap%20Needle');
          const cell = page.locator('tbody tr td').nth(4); await cell.focus(); await cell.press('Enter'); await cell.locator('select').selectOption('false'); await ready(page);
          await page.waitForFunction(() => document.querySelector('tbody tr td:nth-child(5)')?.textContent.trim() === 'No');
          const row = await trusted.from('household_members').select('is_checked_in,checked_in_at,checked_in_center_id,checked_in_center_name,updated_at').eq('id', id).single(); assert.ifError(row.error);
          assert.equal(row.data.is_checked_in, false); for (const field of ['checked_in_at','checked_in_center_id','checked_in_center_name']) assert.equal(row.data[field], null);
          await page.getByRole('button', { name: '+ Add Member' }).click(); const form = page.locator('form');
          assert.ok(await form.getByLabel('Resident (Head) *').locator('option').count() > 1000);
          await form.getByLabel('Resident (Head) *').selectOption('20000000-0000-4000-8000-000000001505'); await form.getByLabel('Name *').fill('Phase4 Created Member');
          await form.getByRole('button', { name: 'Add Member', exact: true }).click(); await form.waitFor({ state: 'hidden' }); await ready(page);
          await page.getByLabel('Search', { exact: true }).fill('Phase4 Created Member'); await range(page, 'Showing 1–1 of 1');
          const newId = (await ids(page))[0]; await page.getByRole('button', { name: 'View household member Phase4 Created Member' }).click(); const dialog = page.getByRole('dialog', { name: 'Household member details' }); await dialog.getByRole('heading', { name: 'Phase4 Created Member' }).waitFor();
          await dialog.getByRole('button', { name: /Remove Member/ }).click(); await dialog.getByRole('button', { name: 'Permanently remove this household member?' }).click(); await dialog.waitFor({ state: 'hidden' }); await range(page, 'Showing 0–0 of 0');
          const removed = await trusted.from('household_members').select('id').eq('id', newId); assert.ifError(removed.error); assert.equal(removed.data.length, 0);
          const audits = await auditRows(page, newId, ['create', 'delete']); assert.ok(audits.some(a => a.action === 'create')); assert.ok(audits.some(a => a.action === 'delete'));
        });
        await check('staff self-edit/removal guards and profile/role changes preserve current user', async () => {
          await go(page, 'staff', '?q=Runtime%20admin'); const own = page.locator('tbody tr'); assert.equal(await own.count(), 1); assert.ok((await own.innerText()).includes('current user'));
          for (const index of [0,1,3,4]) assert.equal(await own.locator('td').nth(index).getAttribute('tabindex'), null); assert.equal(await own.getByRole('button', { name: /Remove staff/ }).count(), 0);
          await go(page, 'staff', '?q=Fixture%20Staff%201505'); const id = (await ids(page))[0]; const name = page.locator('tbody tr td').nth(0); await edit(page, name, 'Phase4 Edited Staff'); await name.locator('input').press('Enter'); await range(page, 'Showing 0–0 of 0');
          await page.getByLabel('Search', { exact: true }).fill('Phase4 Edited Staff'); await range(page, 'Showing 1–1 of 1'); const role = page.locator('tbody tr td').nth(1); await role.focus(); await role.press('Enter'); await role.locator('select').selectOption('health_worker'); await ready(page); await role.locator('select').waitFor({ state: 'hidden' });
          const record = await trusted.from('barangay_officials').select('official_role').eq('id', id).single(); assert.ifError(record.error); assert.equal(record.data.official_role, 'health_worker');
          await page.getByRole('button', { name: 'Remove staff account for Phase4 Edited Staff' }).click(); await page.getByRole('button', { name: 'Remove?', exact: true }).click(); await range(page, 'Showing 0–0 of 0');
          const removed = await trusted.from('barangay_officials').select('deleted_at,is_active').eq('id', id).single(); assert.ifError(removed.error); assert.ok(removed.data.deleted_at); assert.equal(removed.data.is_active, false);
        });
      }
    } finally { fault({}); await context.close(); await browser.close(); }
  }
  report.passed = report.failures.length === 0 && report.errors.length === 0; save(); assert.ok(report.passed, JSON.stringify(report.errors));
} finally { clearTimeout(deadline); fault({}); save(); }
