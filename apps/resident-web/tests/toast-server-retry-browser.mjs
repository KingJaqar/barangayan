// Actual Next 16.3 RSC refresh/retry transport, with local synthetic read outcomes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const require = createRequire(path.join(root, 'package.json'));
const fixture = path.join(root, 'tmp/toast-phases67-continuation/server-fixture');
const evidence = path.join(root, 'plans/evidence/resident-web-toast-coverage/phases-6-7/server-retries');
fs.mkdirSync(evidence, { recursive: true });
function write(name, source) {
  const file = path.join(fixture, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}
write('package.json', JSON.stringify({ private: true, type: 'module' }));
write('tsconfig.json', JSON.stringify({ compilerOptions: {
  target: 'ES2017', lib: ['dom', 'esnext'], strict: true, skipLibCheck: true,
  esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', jsx: 'react-jsx',
  paths: { '@/*': [path.relative(fixture, path.join(app, 'src/*')).replaceAll('\\', '/')] },
}, include: ['**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }));
write('next.config.mjs', 'export default {reactStrictMode:true};');
write('public/favicon.ico', fs.readFileSync(path.join(app, 'src/app/icon.png')));
write('app/layout.tsx', `import {ReadRetryProvider} from '@/components/shared/read-failure';
import {ThemeControllerProvider} from '@/components/theme/theme-controller';
import {Toaster} from '@/components/ui/sonner';import Controls from './controls';
export default function Layout({children}:{children:React.ReactNode}){return <html><body>
<ThemeControllerProvider><ReadRetryProvider><Controls/>{children}</ReadRetryProvider><Toaster/></ThemeControllerProvider>
</body></html>}`);
write('app/controls.tsx', `'use client';import {useEffect} from 'react';import {useRouter} from 'next/navigation';import Link from 'next/link';import {setNotificationSession} from '@/lib/notify';
export default function Controls(){const router=useRouter();useEffect(()=>setNotificationSession('resident-a'),[]);return <nav style={{marginTop:150}}>
<button onClick={()=>router.refresh()}>Background refresh</button><button onClick={()=>setNotificationSession('resident-b')}>Switch account</button>
<Link prefetch={false} href="/away">Leave page</Link></nav>}`);
write('app/error.tsx', `'use client';export {default} from './route-error';`);
write('app/route-error.tsx', `'use client';import {RouteError} from '@/components/shared/route-error';
export default function ErrorPage(p:{error:Error&{digest?:string};retry:()=>void}){return <RouteError {...p} returnHref="/away" returnLabel="Leave error"/>}`);
const stateFile = path.join(fixture, 'state.json');
const stateLiteral = JSON.stringify(stateFile);
write('app/page.tsx', `import fs from 'node:fs/promises';import {connection} from 'next/server';
import {ReadFailure,ReadRetryLink} from '@/components/shared/read-failure';import {ProfileSetupNotice} from '@/components/auth/profile-setup-notice';
export default async function Page(){await connection();const state=JSON.parse(await fs.readFile(${stateLiteral},'utf8'));
await new Promise(resolve=>setTimeout(resolve,state.delay??0));if(state.boundary)throw new Error('fixture-route-failure');
if(state.success)return <p>Content ready</p>;if(state.profile)return <ProfileSetupNotice resultId={crypto.randomUUID()}/>;
if(state.link)return <><p role="alert">Account unavailable.</p><ReadRetryLink href="/" resultId={crypto.randomUUID()} contentName="your account information"/></>;
return <><section aria-label="Requests"><ReadFailure resultId={crypto.randomUUID()} contentName="your requests" message="Requests unavailable."/></section>
<section aria-label="Reports"><ReadFailure resultId={crypto.randomUUID()} contentName="your reports" message="Reports unavailable."/></section></>}`);
write('app/away/page.tsx', 'export default function Away(){return <p>Away from retries</p>}');
const state = value => fs.writeFileSync(stateFile, JSON.stringify(value));
state({});
const next = require.resolve('next/dist/bin/next');
function run(args, logName) {
  const log = fs.openSync(path.join(fixture, logName), 'w');
  const child = spawn(process.execPath, [next, ...args], {
    cwd: fixture, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', log, log], windowsHide: true,
  });
  fs.closeSync(log);
  return child;
}
const report = { passed: false, checks: [], pageErrors: [], consoleErrors: [], warnings: [], expectedBoundaryErrors: [], limitations: ['Local synthetic reads; actual installed Next RSC transport. No hosted resident credentials, physical APIs or spoken screen reader.'] };
let browser;
let server;
let expectedBoundary = false;
try {
  const build = run(['build', '--webpack'], 'build.log');
  const exit = await new Promise((resolve, reject) => { build.on('error', reject); build.on('exit', resolve); });
  assert.equal(exit, 0, fs.readFileSync(path.join(fixture, 'build.log'), 'utf8'));
  // Port zero lets the OS choose an unused local port; Next logs the chosen URL.
  server = run(['start', '--hostname', '127.0.0.1', '--port', '0'], 'server.log');
  let origin;
  for (let i = 0; i < 200; i++) {
    const log = fs.readFileSync(path.join(fixture, 'server.log'), 'utf8');
    origin = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    if (origin && log.includes('Ready')) break;
    if (server.exitCode !== null) throw new Error(log);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(origin, 'Next did not announce a local URL');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const expectedError = message => expectedBoundary && (message.includes('Minified React error #441;') || message === 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)');
  page.on('pageerror', error => (expectedError(error.message) ? report.expectedBoundaryErrors : report.pageErrors).push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') (expectedError(message.text()) ? report.expectedBoundaryErrors : report.consoleErrors).push(message.text());
    if (message.type() === 'warning') report.warnings.push(message.text());
  });
  const toasts = () => page.locator('[data-sonner-toast]');
  async function open(value = {}) {
    state(value); expectedBoundary = !!value.boundary;
    await page.goto(origin);
    await page.getByRole('button', { name: 'Background refresh', exact: true }).waitFor();
    if (value.boundary) await page.getByRole('heading', { name: "This page couldn't load" }).waitFor();
    else if (value.profile) await page.getByRole('button', { name: 'Retry account setup' }).waitFor();
    else if (value.link) await page.getByRole('link', { name: 'Try again', exact: true }).waitFor();
    else await page.getByRole('region', { name: 'Requests', exact: true }).waitFor();
    await page.waitForTimeout(100);
  }
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const retry = () => page.getByRole('region', { name: 'Requests', exact: true }).getByRole('button', { name: 'Try again' }).click();
  async function count(expected) { await page.waitForTimeout(150); assert.equal(await toasts().count(), expected); }
  async function failure(name, expectedCount = 1) {
    await toasts().filter({ hasText: `Couldn't refresh ${name}. Please try again.` }).first().waitFor();
    await count(expectedCount);
  }
  async function check(name, action) { await action(); report.checks.push(name); }
  await check('initial server failures and background refresh are quiet', async () => {
    await open(); await count(0); await click('Background refresh'); await page.waitForTimeout(350); await count(0);
  });
  await check('only the clicked server slot reports the fresh failure, once', async () => {
    await open(); await retry(); await failure('your requests'); assert.equal(await toasts().filter({ hasText: 'your reports' }).count(), 0);
    await retry(); await failure('your requests', 2);
  });
  await check('successful server retry is quiet, later background failure has no receipt', async () => {
    await open(); state({ success: true }); await retry(); await page.getByText('Content ready', { exact: true }).waitFor(); await count(0);
    state({}); await click('Background refresh'); await page.getByRole('region', { name: 'Requests', exact: true }).waitFor(); await count(0);
  });
  await check('synchronous repeated activation makes one server retry', async () => {
    await open(); state({ delay: 500 });
    await page.getByRole('region', { name: 'Requests', exact: true }).getByRole('button').evaluate(button => { button.click(); button.click(); });
    await failure('your requests');
  });
  await check('server result from a previous account is suppressed', async () => {
    await open(); state({ delay: 500 }); await retry(); await click('Switch account'); await page.waitForTimeout(800); await count(0);
  });
  await check('navigation during retry cannot leak its result', async () => {
    await open(); state({ delay: 500 }); await retry(); await page.getByRole('link', { name: 'Leave page' }).click();
    await page.getByText('Away from retries', { exact: true }).waitFor(); await page.waitForTimeout(700); await count(0);
  });
  await check('profile setup fresh failure versus quiet initial/success', async () => {
    await open({ profile: true }); await count(0); await click('Retry account setup'); await failure('your account details');
    assert.equal(await page.locator('aside[role="status"]').count(), 0);
    await open({ profile: true }); state({ success: true }); await click('Retry account setup'); await page.getByText('Content ready', { exact: true }).waitFor(); await count(0);
  });
  await check('account recovery link retains href and reports only a failed retry', async () => {
    await open({ link: true }); await count(0);
    const link = page.getByRole('link', { name: 'Try again', exact: true });
    assert.equal(await link.getAttribute('href'), '/'); await link.click(); await failure('your account information');
    await open({ link: true }); state({ success: true }); await page.getByRole('link', { name: 'Try again', exact: true }).click();
    await page.getByText('Content ready', { exact: true }).waitFor(); await count(0);
  });
  await check('real Next boundary retry suppresses cached error, reports fresh same-digest failure once', async () => {
    await open({ boundary: true }); await count(0);
    const digest = await page.getByText(/^Reference:/).textContent();
    await click('Try again'); await failure('this page');
    assert.equal(await page.getByText(/^Reference:/).textContent(), digest);
    assert.equal(await page.getByRole('heading', { name: "This page couldn't load" }).locator('..').getAttribute('role'), null);
    await click('Try again'); await failure('this page', 2);
  });
  await check('boundary success clears receipt before a later unrelated error', async () => {
    await open({ boundary: true }); state({ success: true }); await click('Try again');
    await page.getByText('Content ready', { exact: true }).waitFor(); await count(0);
    state({ boundary: true }); await click('Background refresh'); await page.getByRole('heading', { name: "This page couldn't load" }).waitFor(); await count(0);
  });
  await check('a read retry that reaches an unexpected boundary has one named outcome', async () => {
    await open(); state({ boundary: true }); expectedBoundary = true; await retry();
    await failure('your requests'); assert.equal(await page.getByRole('heading', { name: "This page couldn't load" }).locator('..').getAttribute('role'), null);
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.warnings, []);
  report.passed = true;
} finally {
  if (browser) await browser.close();
  if (server) { server.kill(); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve)); }
  fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify(report, null, 2));
}
console.log(`PASS: ${report.checks.length} actual Next server-retry scenarios; no unexpected runtime/console errors or warnings.`);
