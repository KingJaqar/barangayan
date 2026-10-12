import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { createRequire } from 'node:module';
import { sql, statePath, privateDir } from './runtime-stack.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('dist/admin-table-phase1-browsers');
const { chromium, firefox, webkit } = createRequire(import.meta.url)('playwright');
const state = JSON.parse(fs.readFileSync(statePath)), users = JSON.parse(fs.readFileSync(privateDir + '/users.json'));
const report = { passed: false, checks: [], browsers: [], errors: [], geometry: [] };
const save = () => fs.writeFileSync(new URL('./final-flows.json', import.meta.url), JSON.stringify(report, null, 2));
async function ready(page) { await page.waitForFunction(() => document.querySelector('.table-browse-panel')?.getAttribute('aria-busy') === 'false'); await page.waitForFunction(() => Object.keys(document.querySelector('input[type=search]') ?? {}).some(k => k.startsWith('__reactProps'))); }
async function range(page, text) { await page.waitForFunction(t => document.querySelector('.table-browse-pagination')?.textContent.includes(t), text); await ready(page); }
async function go(page, route) { await page.goto('http://127.0.0.1:3140' + route, { timeout: 60000 }); await ready(page); }
async function auth(context) {
  const client = createClient(state.api, state.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); const result = await client.auth.signInWithPassword(users.admin); assert.ifError(result.error);
  let cookies = []; const session = createServerClient(state.api, state.anonKey, { cookies: { getAll: () => cookies, setAll: next => { cookies = next; } } });
  assert.ifError((await session.auth.setSession({ access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token })).error);
  await context.addCookies(cookies.map(c => ({ name: c.name, value: c.value, url: 'http://127.0.0.1:3140' })));
}
const check = async (label, fn) => { await fn(); report.checks.push(label); console.log('Passed: ' + label); save(); };
const deadline = setTimeout(() => { save(); process.exit(1); }, 300000);
try {
  if (!process.argv.includes('--details-only')) sql("update public.household_members set name='Phase4 Page Clamp '||right(id::text,4) where id::text like '80000000-%' and right(id::text,4)::integer between 1000 and 1022;");
  sql("update public.profiles set full_name='Long Profile Fixture '||repeat('UnbrokenName',30) where id='20000000-0000-4000-8000-000000000100'; set session_replication_role=replica; update public.profiles set household_members='[{\"id\":\"94000000-0000-4000-8000-000000000002\",\"name\":\"JSON Member\",\"relation\":\"child\",\"role\":\"member\"},{\"id\":\"94000000-0000-4000-8000-000000000003\",\"name\":\"JSON Second\",\"relation\":\"child\",\"role\":\"member\"}]' where id='20000000-0000-4000-8000-000000001504';");
  for (const [name, launch] of [['chrome', () => chromium.launch({ channel: 'chrome', headless: true })], ['firefox', () => firefox.launch({ headless: true })], ['webkit', () => webkit.launch({ headless: true })]]) {
    const browser = await launch(); report.browsers.push({ name, version: browser.version() }); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await auth(context);
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => report.errors.push(e.message));
    try {
      const notifications = page.waitForResponse(r => r.url().includes('/rest/v1/admin_audit_log?') && r.status() === 200); await page.goto('http://127.0.0.1:3140/dashboard'); await notifications;
      if (name === 'chrome' && !process.argv.includes('--details-only')) await check('23-row last-page removals clamp page 3 to page 2 without a refresh loop; seven rows at size 100', async () => {
        await go(page, '/households-residents?q=Phase4%20Page%20Clamp&page=3'); await range(page, 'Showing 21–23 of 23');
        let requests = 0; const listener = r => { if (new URL(r.url()).pathname === '/households-residents' && r.headers().rsc === '1') requests++; }; page.on('request', listener);
        for (let total = 22; total >= 20; total--) { await page.getByRole('button', { name: /^Remove household member / }).first().click(); await page.getByRole('button', { name: 'Remove this member?', exact: true }).click(); await range(page, total === 20 ? 'Showing 11–20 of 20' : `of ${total}`); }
        await page.waitForURL(u => u.searchParams.get('page') === '2'); await page.waitForTimeout(400); assert.ok(requests <= 10); page.off('request', listener); report.clampRequests = requests;
        sql("update public.household_members set name='Phase4 Seven '||right(id::text,4) where id::text like '80000000-%' and right(id::text,4)::integer between 1000 and 1006;");
        await go(page, '/households-residents?q=Phase4%20Seven&pageSize=100'); await range(page, 'Showing 1–7 of 7'); assert.equal(await page.locator('tbody tr').count(), 7);
      });
      await check(name + ': JSON household counts remain independent of normalized members', async () => {
        await go(page, '/residents?q=phase0-resident-1504%40example.invalid'); assert.equal((await page.locator('tbody tr td').nth(15).innerText()).trim(), '2');
        assert.equal(sql("select count(*) from public.household_members where profile_id='20000000-0000-4000-8000-000000001504';"), '1');
      });
      await check(name + ': long-name details stay contained and keyboard focus returns to the trigger', async () => {
        for (const [route, needle, buttonName, label] of [['residents', 'Long Profile Fixture', /^View resident /, 'Resident details'], ['households-residents', 'Long Name Ω', /^View household member /, 'Household member details']]) {
          await page.setViewportSize({ width: 600, height: 450 }); await go(page, '/' + route + '?q=' + encodeURIComponent(needle));
          const trigger = page.getByRole('button', { name: buttonName }).first(); await trigger.click(); const dialog = page.getByRole('dialog', { name: label }); await dialog.getByRole('heading').first().waitFor();
          const geometry = await dialog.evaluate(e => ({ width: e.clientWidth, overflow: e.scrollWidth - e.clientWidth, height: e.getBoundingClientRect().height })); report.geometry.push({ name, route, geometry }); assert.ok(geometry.overflow <= 1);
          const title = await dialog.getByRole('heading').first().evaluate(e => ({ width: e.getBoundingClientRect().width, overflow: e.scrollWidth - e.clientWidth, right: e.getBoundingClientRect().right })); report.geometry.push({ name, route, title });
          assert.ok(title.width <= geometry.width && title.overflow <= 1, 'Long detail title must wrap within its dialog');
          await page.screenshot({ path: path.join(import.meta.dirname, name + '-dialog-' + route + '-' + Date.now() + '.png') });
          await dialog.getByRole('button', { name: 'Close details', exact: true }).click(); assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
          await trigger.focus(); await trigger.press('Enter'); await dialog.getByRole('heading').first().waitFor(); await dialog.press('Escape'); assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
          await page.screenshot({ path: path.join(import.meta.dirname, name + '-long-' + route + '-' + Date.now() + '.png') });
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
      });
    } finally { await context.close(); await browser.close(); }
  }
  report.passed = report.errors.length === 0; assert.ok(report.passed, JSON.stringify(report.errors));
} catch (e) { report.failure = e.stack; process.exitCode = 1; console.error(e); }
finally { clearTimeout(deadline); save(); }
