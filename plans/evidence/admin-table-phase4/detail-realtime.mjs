import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';
import { sql, privateDir, statePath } from './runtime-stack.mjs';
const state = JSON.parse(fs.readFileSync(statePath)), users = JSON.parse(fs.readFileSync(privateDir + '/users.json'));
const trusted = createClient(state.api, state.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { passed: false, checks: [], errors: [], samples: [], mounts: [], refreshes: null };
const save = () => fs.writeFileSync(new URL('./detail-realtime.json', import.meta.url), JSON.stringify(report, null, 2));
const check = async (label, run) => {
  if (process.argv.includes('--id-only') && !label.startsWith('real ID')) return;
  if (process.argv.includes('--remaining') && ['three actual', 'selected member'].some(prefix => label.startsWith(prefix))) return;
  await run(); report.checks.push(label); console.log('Passed: ' + label); save(); };
const fault = value => fs.writeFileSync(privateDir + '/faults.json', JSON.stringify(value));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  window.phase4 = { events: [], active: [], observers: { resize: 0, mutation: 0 } };
  const Socket = window.WebSocket;
  window.WebSocket = class extends Socket {
    constructor(...args) { super(...args); this.addEventListener('message', e => { try { const a = JSON.parse(e.data); const m = Array.isArray(a) ? { topic: a[2], event: a[3], payload: a[4] } : a; window.phase4.events.push({ topic: m.topic, event: m.event, status: m.payload?.status }); } catch {} }); }
    send(data) { try { const a = JSON.parse(data); const m = Array.isArray(a) ? { topic: a[2], event: a[3] } : a; if (m.event === 'phx_join') window.phase4.active.push(m.topic); if (m.event === 'phx_leave') window.phase4.active = window.phase4.active.filter(t => t !== m.topic); } catch {} return super.send(data); }
  };
  for (const [name, key] of [['ResizeObserver', 'resize'], ['MutationObserver', 'mutation']]) {
    const Native = window[name]; window[name] = class extends Native {
      observe(target, ...args) { if (!this.counted && target.tagName === 'TABLE') { this.counted = true; window.phase4.observers[key]++; } return super.observe(target, ...args); }
      disconnect() { if (this.counted) { this.counted = false; window.phase4.observers[key]--; } return super.disconnect(); }
    };
  }
});
let cookies = []; const login = await trusted.auth.signInWithPassword(users.admin); assert.ifError(login.error);
const session = createServerClient(state.api, state.anonKey, { cookies: { getAll: () => cookies, setAll: next => { cookies = next; } } });
assert.ifError((await session.auth.setSession({ access_token: login.data.session.access_token, refresh_token: login.data.session.refresh_token })).error);
await context.addCookies(cookies.map(c => ({ name: c.name, value: c.value, url: 'http://127.0.0.1:3140' })));
// A separate service client is retained for fixture mutations; logging in on the
// Auth client above changes its bearer token to the administrator's session.
const writer = createClient(state.api, state.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => { report.errors.push(e.message); save(); });
let refreshes = 0; page.on('request', r => { if (new URL(r.url()).pathname === '/households-residents' && r.headers().rsc === '1' && r.method() === 'GET') refreshes++; });
async function ready() {
  await page.waitForFunction(() => document.querySelector('.table-browse-panel')?.getAttribute('aria-busy') === 'false');
  await page.waitForFunction(() => Object.keys(document.querySelector('input[type=search]') ?? {}).some(k => k.startsWith('__reactProps')));
  await page.waitForFunction(() => window.phase4.observers.resize === 1 && window.phase4.observers.mutation === 1);
}
async function go(route) { await page.goto('http://127.0.0.1:3140' + route, { timeout: 60000 }); await ready(); }
async function patch(id, values) { const r = await writer.from('household_members').update(values).eq('id', id).select('id'); assert.ifError(r.error); assert.equal(r.data.length, 1); }
const id = '95000000-0000-4000-8000-000000000001';
const deadline = setTimeout(() => { save(); process.exit(1); }, 300000);
try {
  fault({}); const notification = page.waitForResponse(r => r.url().includes('/rest/v1/admin_audit_log?') && r.status() === 200);
  await page.goto('http://127.0.0.1:3140/dashboard', { timeout: 60000 }); await notification;
  if (!process.argv.includes('--remaining') && !process.argv.includes('--id-only')) sql(`insert into public.household_members(id,profile_id,name,relation,role) values('${id}','20000000-0000-4000-8000-000000001503','Phase4 Realtime Member','child','member');`);
  await check('three actual member Realtime events defer while editing and coalesce after cancel', async () => {
    await go('/households-residents?q=Phase4%20Realtime%20Member');
    await page.waitForFunction(() => window.phase4.events.some(e => e.topic?.includes('admin-household-members') && e.event === 'phx_reply' && e.status === 'ok'));
    const cell = page.locator('tbody tr td').first(); await cell.focus(); await cell.press('Enter'); await cell.locator('input').fill('Retained member draft');
    const before = refreshes, received = await page.evaluate(() => window.phase4.events.filter(e => e.event === 'postgres_changes').length);
    for (let i = 0; i < 3; i++) await patch(id, { checked_in_center_name: 'Burst ' + i });
    await page.waitForFunction(n => window.phase4.events.filter(e => e.event === 'postgres_changes').length >= n + 3, received); await page.waitForTimeout(250);
    assert.equal(refreshes, before); assert.equal(await cell.locator('input').inputValue(), 'Retained member draft');
    await cell.getByRole('button', { name: 'Cancel edit', exact: true }).click(); await page.waitForFunction(() => document.querySelector('tbody tr td:nth-child(6)')?.textContent === 'Burst 2'); await ready();
    report.refreshes = { events: 3, whileEditing: 0, afterCancel: refreshes - before }; assert.ok(refreshes - before >= 1 && refreshes - before <= 2);
  });
  await check('selected member stays the same ID off-page, reloads Realtime changes, handles errors and deletion', async () => {
    await page.getByRole('button', { name: 'View household member Phase4 Realtime Member' }).click();
    const dialog = page.getByRole('dialog', { name: 'Household member details' }); await dialog.getByRole('heading', { name: 'Phase4 Realtime Member' }).waitFor();
    await patch(id, { name: 'Selected Member Updated' }); await dialog.getByRole('heading', { name: 'Selected Member Updated' }).waitFor();
    assert.ok((await page.locator('.table-browse-pagination').first().innerText()).includes('Showing 0–0 of 0'));
    fault({ fail: ['admin_households_browse'] }); await patch(id, { checked_in_center_name: 'Error trigger' });
    await dialog.getByText(/Could not reload this record/).waitFor(); fault({}); await dialog.getByRole('button', { name: 'Retry details' }).click(); await dialog.getByRole('heading', { name: 'Selected Member Updated' }).waitFor();
    const deleted = await writer.from('household_members').delete().eq('id', id).select('id'); assert.ifError(deleted.error); assert.equal(deleted.data.length, 1);
    await dialog.getByText(/This record is no longer available/).waitFor(); await dialog.getByRole('button', { name: 'Close details' }).click();
    assert.equal(await page.getByLabel('Search', { exact: true }).evaluate(e => e === document.activeElement), true);
  });
  await check('ten route mount cycles preserve one household channel and baseline table observers', async () => {
    await go('/households-residents'); const initial = await page.evaluate(() => ({ ...window.phase4.observers }));
    for (let i = 0; i < 10; i++) {
      await page.locator('a[href="/staff"]').first().click(); await page.waitForURL('**/staff'); await ready(); await page.waitForFunction(() => window.phase4.active.filter(t => t.includes('admin-household-members')).length === 0);
      await page.locator('a[href="/households-residents"]').first().click(); await page.waitForURL('**/households-residents'); await ready(); await page.waitForFunction(() => window.phase4.active.filter(t => t.includes('admin-household-members')).length === 1);
      const sample = await page.evaluate(() => ({ observers: { ...window.phase4.observers }, channels: window.phase4.active.filter(t => t.includes('admin-household-members')).length })); report.mounts.push(sample); assert.deepEqual(sample.observers, initial); assert.equal(sample.channels, 1); save();
    }
  });
  await check('thirty warm committed-result timings meet the recorded loopback target', async () => {
    for (const route of ['residents', 'households-residents', 'staff']) {
      await go('/' + route);
      for (let i = 0; i < 10; i++) { const start = performance.now(), before = page.url(); await page.getByRole('button', { name: i % 2 === 0 ? 'Next' : 'Previous', exact: true }).click(); await page.waitForURL(u => u.toString() !== before); await ready(); report.samples.push({ route, ms: performance.now() - start }); save(); }
    }
    for (const route of ['residents', 'households-residents', 'staff']) { const values = report.samples.filter(s => s.route === route).map(s => s.ms).sort((a,b) => a-b); assert.ok(values[Math.ceil(values.length * .95) - 1] <= 1500, route + ' p95'); }
  });
  await check('real ID verification/revocation RPC, request history and audits retain the selected resident', async () => {
    const resident = '20000000-0000-4000-8000-000000001504', submission = '94000000-0000-4000-8000-000000000001';
    sql(`set session_replication_role=replica;
      insert into public.id_submissions(id,resident_id,barangay_id,version,id_type,front_path,back_path,decision) values('${submission}','${resident}','10000000-0000-4000-8000-000000000001',1,'Fixture ID','phase4-front','phase4-back','pending') on conflict(id) do nothing;
      update public.profiles set current_id_submission_id='${submission}',id_verification_status='pending',id_type='Fixture ID',id_photo_urls=array['phase4-front','phase4-back'],household_members='[{"id":"json-only","name":"JSON Member","relation":"child","role":"member"}]' where id='${resident}';`);
    await context.route('**/storage/v1/object/sign/id-documents', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([
      { path: 'phase4-front', signedURL: '/object/sign/id-documents/phase4-front?token=fixture', error: null },
      { path: 'phase4-back', signedURL: '/object/sign/id-documents/phase4-back?token=fixture', error: null }
    ]) }));
    await context.route('**/storage/v1/object/sign/id-documents/*?token=fixture', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>' }));
    await go('/residents?q=phase0-resident-1504%40example.invalid'); await page.getByRole('button', { name: /^View resident / }).click();
    const dialog = page.getByRole('dialog', { name: 'Resident details' }); await dialog.getByText('JSON Member', { exact: true }).waitFor(); await dialog.getByText(/REQ-PHASE0-01504/).waitFor();
    const verify = dialog.getByRole('button', { name: '✅ Mark as Verified', exact: true }); await verify.waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('dialog button')].some(b => b.textContent.includes('Mark as Verified') && !b.disabled));
    await verify.click(); await dialog.getByRole('button', { name: 'Confirm verification?', exact: true }).click(); await dialog.getByRole('button', { name: '↩ Revoke Verification', exact: true }).waitFor();
    let result = await writer.from('profiles').select('id_verification_status,approved_id_submission_id').eq('id', resident).single(); assert.ifError(result.error); assert.equal(result.data.id_verification_status, 'verified'); assert.equal(result.data.approved_id_submission_id, submission);
    await dialog.getByLabel('Reason for rejection or revocation').fill('Fixture revocation reason'); await dialog.getByRole('button', { name: '↩ Revoke Verification', exact: true }).click(); await dialog.getByRole('button', { name: 'Revoke this reviewed ID approval?', exact: true }).click();
    await dialog.getByText('Decision reason: Fixture revocation reason').waitFor(); result = await writer.from('profiles').select('id_verification_status,approved_id_submission_id').eq('id', resident).single(); assert.ifError(result.error); assert.equal(result.data.id_verification_status, 'verification_failed'); assert.equal(result.data.approved_id_submission_id, null);
    const audits = await writer.from('admin_audit_log').select('id').eq('entity_id', resident).eq('action', 'status_change'); assert.ifError(audits.error); assert.ok(audits.data.length >= 2);
    await dialog.getByRole('button', { name: 'Close details', exact: true }).click();
  });
  report.passed = report.errors.length === 0; assert.ok(report.passed, JSON.stringify(report.errors));
} catch (e) { report.failure = e.stack; process.exitCode = 1; console.error(e); }
finally { clearTimeout(deadline); fault({}); save(); await context.close(); await browser.close(); }
