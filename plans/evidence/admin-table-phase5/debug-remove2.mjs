// Diagnostic only: reproduces the incident removal step and records toasts/requests.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js'; import { createServerClient } from '@supabase/ssr';
import { statePath, privateDir } from './runtime-stack.mjs';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('dist/admin-table-phase1-browsers');
const { chromium } = require('playwright');
const state = JSON.parse(fs.readFileSync(statePath)), users = JSON.parse(fs.readFileSync(privateDir + '/users.json'));
const browser = await chromium.launch({ channel: 'chrome', headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const auth = createClient(state.api, state.anonKey, { auth: { persistSession: false } }); const signed = await auth.auth.signInWithPassword(users.admin);
let cookies = []; const s = createServerClient(state.api, state.anonKey, { cookies: { getAll: () => cookies, setAll: n => { cookies = n; } } });
await s.auth.setSession({ access_token: signed.data.session.access_token, refresh_token: signed.data.session.refresh_token });
await page.context().addCookies(cookies.map(c => ({ name: c.name, value: c.value, url: 'http://127.0.0.1:3140' })));
page.on('response', r => { if (r.request().method() === 'PATCH') console.log('PATCH', r.status(), r.url().split('?')[0]); });
page.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });


// Diagnostic only: confirm-remove on a resolved incident, logging writes and toasts.
page.on('request', r => { if (r.method() !== 'GET') console.log('REQ', r.method(), r.url().split('?')[0]); });
page.on('response', r => { if (r.request().method() !== 'GET') r.text().then(t => console.log('RES', r.status(), r.url().split('?')[0], t.slice(0,200))).catch(()=>{}); });
await page.goto('http://127.0.0.1:3140/incident-reports?tab=all&q=Phase5+created+incidents', { timeout: 60000 });
await page.waitForFunction(() => { const t = document.querySelector('.table-browse-panel table'); return document.querySelector('.table-browse-panel')?.getAttribute('aria-busy') === 'false' && t && getComputedStyle(t).tableLayout === 'fixed'; });
await page.getByRole('button', { name: 'Remove incident: Phase5 created incidents', exact: true }).click();
await page.getByRole('button', { name: 'Remove?', exact: true }).click();
await page.waitForTimeout(4000);
console.log('range', (await page.locator('.table-browse-pagination').first().innerText()).slice(0,30));
console.log('live', JSON.stringify(await page.locator('[role=status],[role=alert],[aria-live]').allInnerTexts()));
await browser.close();