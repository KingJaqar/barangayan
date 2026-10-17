// Actual Settings/Valid ID/Profile components and real shared publication helper.
// All authentication, Realtime, Storage, OCR and RPC replies are local fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve(process.env.VALID_ID_TEST_OUTPUT ?? 'tmp/valid-id-execution/browser');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({href,children,scroll,prefetch,...props}){return <a {...props} href={href} onClick={event=>{event.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('routechange'));}}>{children}</a>;}`,
  'next/navigation': `import {useSyncExternalStore} from 'react'; const route=()=>{window.dispatchEvent(new Event('routechange'));};const router={replace:href=>{history.replaceState({},'',href);route();},refresh:()=>{window.__routeRefreshes=(window.__routeRefreshes??0)+1;},push:href=>{history.pushState({},'',href);route();}};export const useRouter=()=>router;export const usePathname=()=>useSyncExternalStore(cb=>{window.addEventListener('routechange',cb);return()=>window.removeEventListener('routechange',cb);},()=>location.pathname);`,
  'next/image': `import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>;}`,
  '@/hooks/use-sign-out': `export const useSignOut=()=>({pending:false,signOut:async()=>window.__idFixture.switchOwner(null)});`,
  '@/hooks/use-unread-counts': `export const useUnreadCounts=()=>({activeReportsCount:0,resolvedUnreadCount:0,announcementsUnreadCount:0});`,
  '@/lib/supabase/client': `
    import {createClient} from '@supabase/supabase-js';
    const id='b1180000-0000-4000-8000-000000000001';let owner=id;const listeners=new Set(),channels=new Set();
    const dataClient=createClient('https://fixture-supabase.test','public-fixture-key',{accessToken:async()=>owner?'fixture-token':null,db:{retry:false}});
    window.__idFixture={switchOwner(next){owner=next;for(const listener of listeners)listener(next?'SIGNED_IN':'SIGNED_OUT',next?{user:{id:next}}:null);},refresh(){for(const callback of channels)callback();},channelCount:()=>channels.size};
    const auth={getSession:async()=>({data:{session:owner?{access_token:'fixture-token',user:{id:owner}}:null},error:null}),getUser:async()=>({data:{user:owner?{id:owner,is_anonymous:false}:null},error:null}),onAuthStateChange(callback){listeners.add(callback);queueMicrotask(()=>{if(listeners.has(callback))callback('INITIAL_SESSION',owner?{user:{id:owner}}:null);});return{data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}};}};
    export const createSupabaseBrowserClient=()=>({auth,from:dataClient.from.bind(dataClient),rpc:dataClient.rpc.bind(dataClient),storage:dataClient.storage,channel(){let callback;const channel={on(_event,_filter,fn){callback=fn;return channel},subscribe(){channels.add(callback);return channel},unsubscribe(){channels.delete(callback)}};return channel},removeChannel(channel){channel.unsubscribe();}});
  `,
};
const bundle = await build({ entryPoints: [path.join(import.meta.dirname, 'valid-id-fixture.jsx')], bundle: true, write: false, outdir: 'fixture', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://fixture-supabase.test"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"public-fixture-key"' },
  plugins: [{ name: 'fixture-boundaries', setup(build) {
    build.onResolve({ filter: /^(next\/|@\/)/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const userId = 'b1180000-0000-4000-8000-000000000001';
const profile = () => ({ id: userId, role: 'resident', deleted_at: null, id_verification_status: null, current_id_submission_id: null, approved_id_submission_id: null, id_repair_required: false });
const report = { passed: false, browser: '', checks: [], dateBoundaries: [], errors: [], pageErrors: [], consoleErrors: [], warnings: [], networkHosts: [], limitations: ['Fixture-backed browser/component checks. No live authentication, database publication, OCR.space call, staff approval, physical camera or real service request.'] };
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Manila' });
  const page = await context.newPage();
  await page.clock.install();
  page.on('pageerror', error => { report.errors.push(error.message); report.pageErrors.push(error.message); });
  page.on('console', message => {
    if (message.type() === 'error') { report.errors.push(message.text()); report.consoleErrors.push({ text: message.text(), url: message.location().url }); }
    if (message.type() === 'warning') report.warnings.push(message.text());
  });
  let currentProfile = profile(), statusFails = false, uploadFails = false, loseReply = false, skipCommitOnce = false, ocrMode = 'success', ocrCount = 0;
  let ocrDelay = 0, uploadDelay = 0;
  let profileFields = { household_members: [] }, writeFailure = null, avatarBytes = null;
  let statusGate = null, photoFails = false;
  const profileWrites = [];
  let rowMode = 'normal', publishMode = 'normal', commitAfterMissing = null, heldPublication = null;
  const objects = new Map(), submissions = new Map(), publications = [], requests = [];
  const networkHosts = new Set(), injectedFailures = new Map();
  page.on('request', request => networkHosts.add(new URL(request.url()).hostname));
  const recordFailure = (url, failure) => {
    const failures = injectedFailures.get(url) ?? new Set(); failures.add(failure); injectedFailures.set(url, failures);
  };
  const abortFixture = route => { recordFailure(route.request().url(), 'net::ERR_CONNECTION_FAILED'); return route.abort('connectionfailed'); };
  const commit = payload => {
    const saved = submissions.get(payload.submissionId);
    if (saved) {
      assert.equal(saved.id_type, payload.idType);
      assert.equal(saved.front_path, payload.frontPath);
      assert.deepEqual(saved.confirmed_details, payload.confirmedDetails);
      return; // A retry must not make an older version current again (migration 0118).
    }
    submissions.set(payload.submissionId, { id: payload.submissionId, id_type: payload.idType, front_path: payload.frontPath, confirmed_details: payload.confirmedDetails });
    currentProfile = { ...currentProfile, current_id_submission_id: payload.submissionId, approved_id_submission_id: null, id_verification_status: 'pending' };
  };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    assert.ok(['valid-id.test', 'fixture-supabase.test'].includes(url.hostname), `Unexpected network destination: ${url.origin}`);
    if (url.hostname === 'valid-id.test' && url.pathname === '/assets/logo/barangayan-logo-1024.png') return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(app, 'public/assets/logo/barangayan-logo-1024.png')) });
    if (url.hostname === 'valid-id.test' && url.searchParams.get('layout') === '1') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en" class="h-full"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="flex h-full flex-col overflow-hidden"><div id="root" class="flex min-h-0 flex-1 flex-col"></div><script src="/fixture.js"></script></body></html>' });
    if (url.hostname === 'valid-id.test') return route.fulfill({ contentType: url.pathname === '/fixture.js' ? 'text/javascript' : url.pathname === '/fixture.css' ? 'text/css' : 'text/html', body: url.pathname === '/fixture.js' ? js : url.pathname === '/fixture.css' ? css : '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' });
    requests.push({ path: url.pathname, method: request.method() });
    const json = (body, status = 200) => {
      if (status >= 400) recordFailure(request.url(), `status:${status}`);
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    };
    if (url.pathname === '/rest/v1/profiles') {
      assert.ok(url.searchParams.get('id')?.startsWith('eq.b1180000-0000-4000-8000-00000000000'));
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON(); profileWrites.push(payload);
        if (writeFailure === ('household_members' in payload ? 'household' : 'profile')) return json({ message: 'Synthetic write rejected' }, 400);
        profileFields = { ...profileFields, ...payload };
        return json(null);
      }
      if (statusGate && url.searchParams.get('select')?.includes('current_id_submission_id')) await statusGate;
      return statusFails ? json({ message: 'fixture unavailable' }, 503) : json({ ...currentProfile, ...profileFields });
    }
    if (url.pathname === '/rest/v1/id_submissions') {
      assert.equal(url.searchParams.get('resident_id'), `eq.${userId}`);
      const row = submissions.get(url.searchParams.get('id')?.replace('eq.', '')) ?? null;
      if (rowMode === 'error') return json({ message: 'fixture read unavailable' }, 503);
      if (rowMode === 'mismatch') return json({ ...row, confirmed_details: { ...row.confirmed_details, fullName: 'Different payload' } });
      if (commitAfterMissing) { commit(commitAfterMissing); commitAfterMissing = null; return json(null); }
      return json(row);
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (url.pathname.includes('/profile-photos/')) {
        assert.ok(url.pathname.includes(`/${userId}/avatar.png`));
        if (request.method() === 'POST') return writeFailure === 'avatar' ? json({ message: 'Synthetic avatar rejected', statusCode: '400' }, 400) : json({ Key: 'avatar.png' });
        assert.ok(avatarBytes); return route.fulfill({ contentType: 'image/png', body: avatarBytes });
      }
      const objectPath = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\/(?:authenticated\/|sign\/)?id-documents\//, ''));
      if (request.method() === 'POST' && url.pathname.includes('/object/sign/')) return photoFails ? json({ message: 'fixture photo unavailable' }, 503) : json({ signedURL: `/object/sign/id-documents/${objectPath}?token=synthetic` });
      if (request.method() === 'POST') {
        if (uploadDelay) await new Promise(resolve => setTimeout(resolve, uploadDelay));
        if (uploadFails) return json({ message: 'fixture upload failed', statusCode: '503' }, 503);
        if (objects.has(objectPath)) return json({ message: 'Already exists', statusCode: '409' }, 409);
        let bytes = request.postDataBuffer(), mime = request.headers()['content-type'];
        // Storage unwraps the SDK's File/Blob multipart upload before saving bytes.
        if (mime?.startsWith('multipart/form-data')) {
          const form = await new Response(bytes, { headers: { 'Content-Type': mime } }).formData();
          const image = form.get(''); assert.ok(image instanceof Blob);
          bytes = Buffer.from(await image.arrayBuffer()); mime = image.type;
        }
        objects.set(objectPath, { bytes, mime }); return json({ Key: objectPath });
      }
      const object = objects.get(objectPath);
      return object ? route.fulfill({ contentType: object.mime, body: object.bytes }) : json({ message: 'not found' }, 404);
    }
    if (url.pathname === '/rest/v1/rpc/publish_id_submission') {
      const payload = request.postDataJSON().p_input; publications.push(payload);
      if (publishMode === 'denied' || publishMode === 'invalid') return json({ code: publishMode === 'denied' ? '42501' : '22023', message: 'fixture rejection' }, 400);
      if (publishMode === 'timeout') { heldPublication = { payload, route }; await page.evaluate(() => { window.__rpcHeld = true; }); return; }
      if (publishMode === 'late-commit') { publishMode = 'normal'; commitAfterMissing = payload; return abortFixture(route); }
      if (skipCommitOnce) { skipCommitOnce = false; return abortFixture(route); }
      commit(payload);
      if (publishMode === 'reviewed') currentProfile = { ...currentProfile, approved_id_submission_id: payload.submissionId, id_verification_status: 'verified' };
      if (loseReply) { loseReply = false; return abortFixture(route); }
      return json(payload.submissionId);
    }
    if (url.pathname === '/functions/v1/extract-resident-id-ocrspace') {
      const derivative = objects.get(request.postDataJSON().frontPath);
      assert.ok(derivative && derivative.mime === 'image/jpeg' && derivative.bytes.length > 0 && derivative.bytes.length <= 900000);
      ocrCount++; if (ocrDelay) await new Promise(resolve => setTimeout(resolve, ocrDelay));
      if (ocrMode === 'quota') return json({ error: 'fixture limit' }, 429);
      if (ocrMode === 'unavailable') return json({ error: 'fixture missing key' }, 503);
      if (ocrMode === 'malformed') return json({ details: { fullName: 123 } });
      if (ocrMode === 'empty') return json({ details: { fullName: '', idNumber: '', birthDate: '', address: '' } });
      if (ocrMode === 'partial') return json({ details: { fullName: 'x'.repeat(201), idNumber: 'PARTIAL-123', birthDate: '2001-02-29', address: '' } });
      return json({ details: { fullName: 'Photo Name', idNumber: 'PHOTO-123', birthDate: '2000-02-29', address: 'Photo address' }, warnings: [] });
    }
    throw new Error(`Unexpected fixture request: ${request.method()} ${url.pathname}`);
  });
  const button = name => page.getByRole('button', { name, exact: true });
  const field = name => page.getByLabel(name, { exact: true });
  const retryReady = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === 'Retry same submission' && !node.disabled));
  const reset = async (role = 'resident') => { currentProfile = { ...profile(), role }; statusFails = uploadFails = loseReply = skipCommitOnce = false; ocrMode = 'success'; rowMode = publishMode = 'normal'; commitAfterMissing = heldPublication = null; ocrDelay = uploadDelay = 0; publications.length = 0; await page.goto('https://valid-id.test/settings/valid-id'); await button('Continue').waitFor(); await page.waitForFunction(() => window.__idFixture.channelCount() === 1); };
  await reset();
  const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 500; const c = canvas.getContext('2d'); c.fillStyle = 'white'; c.fillRect(0, 0, 800, 500); c.fillStyle = 'black'; c.font = '32px sans-serif'; c.fillText('SYNTHETIC TEST IMAGE', 60, 150); return canvas.toDataURL('image/png').split(',')[1]; });
  const file = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') };
  const upload = async (candidate = file) => {
    await page.getByLabel('Choose front ID photo').setInputFiles(candidate);
    await page.getByText('Uploaded. Continue to enter your details.', { exact: false }).waitFor();
    // The test clock is paused; allow temporary notifications to expire naturally.
    await page.mouse.move(1, 1);
    await page.clock.fastForward(10000);
    await page.clock.runFor(500);
  };
  const toDetails = async () => {
    await field('ID type').selectOption('PhilSys');
    await button('Continue').evaluate(node => { node.click(); node.click(); });
    await page.getByRole('heading', { name: 'Provide an ID photo', exact: true }).waitFor();
    await upload(); await button('Continue').click(); await field('Full name (required)').waitFor();
  };
  const assertNoOverflow = async label => {
    const measure = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(-12).map(node => ({ tag: node.tagName, text: node.textContent.slice(0, 60), classes: node.className, right: node.getBoundingClientRect().right, whitespace: getComputedStyle(node).whiteSpace })) }));
    if (measure.scroll > measure.width) { fs.writeFileSync(path.join(output, 'overflow.json'), JSON.stringify(measure, null, 2)); await page.screenshot({ path: path.join(output, 'overflow.png'), fullPage: true }); }
    assert.ok(measure.scroll <= measure.width, `${label}: ${JSON.stringify(measure)}`);
  };
  for (const { incomplete, replacement, width } of [
    { incomplete: true, replacement: true, width: 1440 },
    { incomplete: false, replacement: false, width: 1440 },
    { incomplete: true, replacement: false, width: 1024 },
    { incomplete: true, replacement: false, width: 390 },
  ]) {
    await reset();
    await page.setViewportSize({ width, height: 1000 });
    if (replacement) {
      const shellPath = `${userId}/versions/shell-approved/id-front.png`;
      objects.set(shellPath, { bytes: file.buffer, mime: file.mimeType });
      submissions.set('shell-approved', { id: 'shell-approved', id_type: 'PhilSys', front_path: shellPath, confirmed_details: { fullName: 'Approved resident', idNumber: 'SHELL-123', birthDate: '', address: '' } });
      currentProfile = { ...currentProfile, id_verification_status: 'verified', current_id_submission_id: 'shell-approved', approved_id_submission_id: 'shell-approved' };
    }
    await page.goto(`https://valid-id.test/settings/valid-id?layout=1&incomplete=${incomplete ? '1' : '0'}`);
    if (replacement) await button('Submit a replacement ID').click();
    const shellPositions = () => page.evaluate(() => {
      const header = document.querySelector('header');
      const banner = document.querySelector('aside[aria-label="Complete your resident profile"]');
      const bounds = node => node ? ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom }) : null;
      return { header: bounds(header), banner: bounds(banner), body: document.body.scrollTop, root: document.documentElement.scrollTop, main: document.querySelector('main').scrollTop };
    });
    await button('Continue').waitFor();
    const initialShell = await shellPositions();
    const assertShell = async (step, focus = true) => {
      await page.clock.runFor(900);
      const measured = await shellPositions();
      if (width >= 1024 || step === 'submitted') assert.deepEqual(measured, initialShell, `Step ${step}, incomplete=${incomplete}, replacement=${replacement}, width=${width}: outer shell must not scroll`);
      else {
        assert.deepEqual(measured.header, initialShell.header);
        assert.equal(measured.body, initialShell.body);
        assert.equal(measured.root, initialShell.root);
      }
      assert.ok(measured.header.top >= 0 && measured.header.bottom <= 1000, `Step ${step}: header stays visible`);
      if (incomplete && (width >= 1024 || step === 'submitted')) assert.ok(measured.banner.top >= measured.header.bottom && measured.banner.bottom <= 1000, `Step ${step}: incomplete-profile warning stays visible`);
      else if (incomplete) assert.ok(measured.banner);
      else assert.equal(measured.banner, null);
      if (step !== 'submitted') {
        const detailsBounds = await page.locator('[data-id-details]').evaluate(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom }));
        assert.ok(detailsBounds.top >= measured.header.bottom && detailsBounds.top < 1000, `Step ${step}: ID details are automatically brought into view`);
      }
      if (focus) assert.equal(await page.getByRole('heading', { level: 1 }).evaluate(node => node === document.activeElement), true);
    };
    await toDetails();
    await page.clock.runFor(200);
    const intermediateDetailsTop = await page.locator('[data-id-details]').evaluate(node => node.getBoundingClientRect().top);
    await assertShell(3);
    const finalDetailsTop = await page.locator('[data-id-details]').evaluate(node => node.getBoundingClientRect().top);
    assert.notEqual(intermediateDetailsTop, finalDetailsTop, 'The details scroll animates gradually rather than jumping immediately');
    await page.screenshot({ path: path.join(output, `shell-step3-${incomplete ? 'incomplete' : 'complete'}-${width}.png`), fullPage: true });
    await field('Full name (required)').fill('Shell regression');
    await button('Continue').click();
    await page.getByRole('heading', { name: 'Review and submit', exact: true }).waitFor();
    await assertShell(4);
    await page.screenshot({ path: path.join(output, `shell-step4-${incomplete ? 'incomplete' : 'complete'}-${width}.png`), fullPage: true });
    await button('Previous').click();
    await field('Full name (required)').waitFor(); await assertShell('Previous to 3');
    await button('Continue').click(); await button('Submit').click();
    await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
    await assertShell('submitted');
  }
  report.checks.push('Steps 3/4 gently animate to the ID details in the Settings pane; desktop header/banner and outer ancestors remain stationary; narrow screens scroll only the main content; first submissions, replacements and Previous preserve heading focus');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reset();
  assert.equal(await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).count(), 1);
  const accountLinks = await page.locator('nav[aria-label="Settings"] a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  assert.deepEqual(accountLinks.slice(0, 2), ['/settings/profile', '/settings/valid-id']);
  const verifiedPath = `${userId}/versions/current/id-front.png`;
  const verifiedDetails = { fullName: 'Ana Reyes', idNumber: 'VERIFIED-123', birthDate: '2000-02-29', address: '12 Main Street, San Mateo, Rizal' };
  objects.set(verifiedPath, { bytes: file.buffer, mime: file.mimeType });
  submissions.set('current', { id: 'current', id_type: 'PhilSys', front_path: verifiedPath, confirmed_details: verifiedDetails });
  currentProfile = { ...currentProfile, id_verification_status: 'pending', current_id_submission_id: 'current' };
  await page.evaluate(() => window.__idFixture.refresh());
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('img[alt="Front of your submitted valid ID"]')?.naturalWidth > 0);
  assert.deepEqual(await page.locator('dd').allTextContents(), ['PhilSys', ...Object.values(verifiedDetails)]);
  assert.equal(await page.getByText(/Step \d of 4/).count(), 0);
  assert.equal(await button('Continue').count(), 0);
  assert.equal(await page.getByText('Your valid ID has been verified', { exact: true }).count(), 0);
  await assertNoOverflow('Pending ID desktop');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(output, 'pending-id-desktop-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow('Pending ID narrow web');
  await page.screenshot({ path: path.join(output, 'pending-id-narrow-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await button('Submit a replacement ID').click();
  await page.getByRole('heading', { name: 'Select ID type', exact: true }).waitFor();
  await button('Back to submitted ID').click();
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  await page.getByText(verifiedDetails.idNumber, { exact: true }).waitFor();
  assert.equal(await page.getByText(/Step \d of 4/).count(), 0);
  assert.equal(publications.length, 0);
  statusFails = true; await page.evaluate(() => window.__idFixture.refresh());
  await page.getByRole('link', { name: 'Valid ID: Verification unavailable', exact: true }).waitFor();
  assert.equal(await page.getByText(/Step \d of 4/).count(), 0);
  assert.equal(await button('Continue').count(), 0);
  statusFails = false; await button('Try again').click();
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  await page.getByText(verifiedDetails.idNumber, { exact: true }).waitFor();
  report.checks.push('Existing pending submissions show saved ID details and a private photo without submission steps on first load or reload; pending status never implies approval; explicit replacement is cancellable; desktop and narrow dark layouts fit');
  currentProfile = { ...currentProfile, id_verification_status: 'verified', current_id_submission_id: 'current', approved_id_submission_id: 'current' };
  await page.evaluate(() => window.__idFixture.refresh()); await page.getByRole('link', { name: 'Valid ID: Verified', exact: true }).waitFor();
  await page.getByText('Your valid ID has been verified', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('img[alt="Front of your verified valid ID"]')?.naturalWidth > 0);
  assert.deepEqual(await page.locator('dd').allTextContents(), ['PhilSys', ...Object.values(verifiedDetails)]);
  assert.equal(await button('Continue').count(), 0);
  assert.equal(await page.getByAltText('Front of your verified valid ID').evaluate(image => getComputedStyle(image).objectFit), 'contain');
  assert.equal(publications.length, 0);
  await assertNoOverflow('Verified ID desktop');
  await page.screenshot({ path: path.join(output, 'verified-id-desktop.png'), fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(output, 'verified-id-desktop-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow('Verified ID narrow web');
  await page.screenshot({ path: path.join(output, 'verified-id-narrow-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await button('Submit a replacement ID').click();
  await page.getByRole('heading', { name: 'Select ID type', exact: true }).waitFor();
  await button('Back to verified ID').click();
  await page.getByText('Your valid ID has been verified', { exact: true }).waitFor();
  assert.equal(publications.length, 0);
  photoFails = true;
  await page.evaluate(() => window.__idFixture.refresh());
  await page.getByText('Your ID photo could not be loaded. Your ID is still verified.').waitFor();
  assert.deepEqual(await page.locator('dd').allTextContents(), ['PhilSys', ...Object.values(verifiedDetails)]);
  photoFails = false; await button('Try again').click();
  await page.waitForFunction(() => document.querySelector('img[alt="Front of your verified valid ID"]')?.naturalWidth > 0);
  rowMode = 'error'; await page.evaluate(() => window.__idFixture.refresh());
  await page.getByText('Your ID is verified, but its saved details and photo could not be loaded.').waitFor();
  rowMode = 'normal'; await button('Try again').click();
  await page.getByText(verifiedDetails.idNumber, { exact: true }).waitFor();
  submissions.get('current').confirmed_details = null;
  await page.evaluate(() => window.__idFixture.refresh());
  await page.getByText('Not recorded', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('Not recorded', { exact: true }).count(), 4);
  submissions.get('current').confirmed_details = verifiedDetails;
  await page.goto('https://valid-id.test/settings/valid-id');
  await page.getByText(verifiedDetails.idNumber, { exact: true }).waitFor();
  assert.equal(await button('Continue').count(), 0);
  report.checks.push('Verified IDs open a read-only summary on refresh and revisit with saved details and an uncropped private photo; desktop/light/dark/narrow layouts fit; replacement is explicit and cancellable; failed reads/photos retry without losing verification; legacy missing details are not invented');
  let releaseStatus;
  statusGate = new Promise(resolve => { releaseStatus = resolve; });
  const beforeRefresh = requests.filter(request => request.path === '/rest/v1/profiles').length;
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.__idFixture.refresh(); window.__idFixture.refresh(); });
  await page.getByRole('link', { name: 'Valid ID: Checking verification', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Valid ID: Verified', exact: true }).count(), 0);
  releaseStatus(); statusGate = null;
  await page.getByRole('link', { name: 'Valid ID: Verified', exact: true }).waitFor();
  assert.equal(requests.filter(request => request.path === '/rest/v1/profiles').length - beforeRefresh, 2);
  assert.equal(await page.evaluate(() => window.__idFixture.channelCount()), 1);
  for (const state of ['pending', 'verification_failed', null]) {
    currentProfile = { ...currentProfile, id_verification_status: state };
    await page.evaluate(() => window.__idFixture.refresh());
    await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).waitFor();
  }
  currentProfile = { ...currentProfile, id_verification_status: 'verified' };
  currentProfile = { ...currentProfile, current_id_submission_id: 'replacement' };
  await page.evaluate(() => window.__idFixture.refresh()); await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).waitFor();
  currentProfile = { ...currentProfile, current_id_submission_id: 'current', id_repair_required: true };
  await page.evaluate(() => window.__idFixture.refresh()); await page.getByText('Your current ID needs attention.', { exact: false }).waitFor();
  statusFails = true; await page.evaluate(() => window.__idFixture.refresh()); await page.getByRole('link', { name: 'Valid ID: Verification unavailable', exact: true }).waitFor();
  currentProfile = profile(); statusFails = false; await button('Try again').click(); await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).waitFor();
  report.checks.push('Status requires matching current/approved evidence; repair and failed refresh clear approval; accessible badge refresh recovers');
  report.checks.push('Loading immediately removes a verified badge; focus/Realtime bursts coalesce to one read plus one follow-up; pending/failed/revoked statuses warn with one Settings channel');
  await toDetails(); assert.equal(ocrCount, 0);
  await button('Continue').click(); await page.getByText('Enter the full name shown on your ID.').waitFor();
  await field('Full name (required)').fill('  Resident Correction  ');
  await button('Birthday (optional)').click(); await page.getByRole('dialog').waitFor();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('dialog').evaluate(node => node.contains(document.activeElement)), true);
  }
  await page.getByRole('spinbutton', { name: 'Month' }).press('ArrowDown'); await button('Cancel').click();
  assert.equal(await button('Birthday (optional)').textContent(), 'Select date of birth');
  await page.waitForFunction(() => document.activeElement?.id === 'valid-id-birthDate');
  await button('Birthday (optional)').click(); await page.mouse.click(5, 5);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await button('Birthday (optional)').textContent(), 'Select date of birth');
  await button('Birthday (optional)').click();
  await page.getByRole('spinbutton', { name: 'Year' }).press('ArrowUp');
  await page.getByRole('spinbutton', { name: 'Month' }).press('ArrowDown');
  await button('Use date').click();
  assert.match(await button('Birthday (optional)').textContent(), /^\d{4}-02-01$/);
  await button('Birthday (optional)').click(); await button('Not shown on ID').click();
  await button('Birthday (optional)').click();
  await page.evaluate(() => {
    document.querySelector('[role="spinbutton"][aria-label="Year"]').scrollTop = 1999 * 40;
    document.querySelector('[role="spinbutton"][aria-label="Month"]').scrollTop = 40;
    document.querySelector('[role="spinbutton"][aria-label="Day"]').scrollTop = 28 * 40;
    [...document.querySelectorAll('[role="dialog"] button')].find(node => node.textContent === 'Use date').click();
  });
  assert.equal(await button('Birthday (optional)').textContent(), '2000-02-29');
  await button('Birthday (optional)').click();
  await page.getByRole('spinbutton', { name: 'Year' }).press('ArrowDown');
  await button('Use date').click();
  assert.equal(await button('Birthday (optional)').textContent(), '2001-02-28');
  await button('Birthday (optional)').click();
  await page.getByRole('spinbutton', { name: 'Year' }).press('ArrowUp');
  await page.getByRole('spinbutton', { name: 'Day' }).press('End');
  await button('Use date').click();
  assert.equal(await button('Birthday (optional)').textContent(), '2000-02-29');
  await button('Birthday (optional)').click(); await page.keyboard.press('Escape');
  assert.equal(await button('Birthday (optional)').textContent(), '2000-02-29');
  await button('Birthday (optional)').click(); await button('Not shown on ID').click();
  ocrDelay = 500;
  await button('Read details from photo').click(); await button('Cancel reading').waitFor();
  await field('ID number (optional)').fill('cleared'); await field('ID number (optional)').fill('');
  await page.getByText('Suggestions are ready.', { exact: false }).waitFor();
  assert.equal(await field('Full name (required)').inputValue(), '  Resident Correction  ');
  assert.equal(await field('ID number (optional)').inputValue(), '');
  assert.equal(await button('Birthday (optional)').textContent(), 'Select date of birth');
  assert.equal(await field('Address (optional)').inputValue(), 'Photo address');
  await button('Continue').click(); await page.getByRole('heading', { name: 'Review and submit', exact: true }).waitFor();
  assert.equal(await page.locator('dd').filter({ hasText: 'Resident Correction' }).count(), 1);
  await button('Previous').click(); assert.equal(await field('Full name (required)').inputValue(), 'Resident Correction');
  assert.equal(ocrCount, 1);
  report.checks.push('Sidebar placement, four steps, shared validation, explicit-only OCR, trimmed review, Previous, edited/cleared-field protection and birthday Cancel/confirm/clear/focus');

  await button('Previous').click();
  await page.getByLabel('Choose front ID photo').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await page.getByText(/readable JPG/).waitFor();
  await button('Continue').click(); assert.equal(await field('Full name (required)').inputValue(), 'Resident Correction');
  await button('Previous').click(); uploadFails = true;
  await page.getByLabel('Choose front ID photo').setInputFiles(file);
  await page.getByText('Could not upload', { exact: false }).waitFor();
  await button('Continue').click(); assert.equal(await field('Full name (required)').inputValue(), 'Resident Correction');
  uploadFails = false; await button('Previous').click(); await upload(); await button('Continue').click();
  assert.equal(await field('Full name (required)').inputValue(), '');
  ocrMode = 'quota'; ocrDelay = 0; await button('Read details from photo').click(); await page.getByText('Photo reading is temporarily unavailable.', { exact: false }).waitFor();
  await button('Try reading again').waitFor();
  const beforeRetry = ocrCount;
  await field('ID number (optional)').fill('Manual number');
  await button('Previous').click(); await button('Continue').click();
  assert.equal(ocrCount, beforeRetry);
  ocrMode = 'unavailable'; await button('Try reading again').click();
  await page.getByText("We couldn't read your ID photo.", { exact: false }).waitFor();
  assert.equal(await field('ID number (optional)').inputValue(), 'Manual number');
  await button('Try reading again').waitFor();
  report.checks.push('Recoverable quota/key failures expose explicit retry only; typing/Previous do not retry and manual details survive');
  await field('Full name (required)').fill('Manual Name'); await button('Continue').click();
  loseReply = true; await button('Submit').click(); await button('Retry same submission').waitFor();
  const submissionId = publications[0].submissionId;
  assert.equal(await button('Previous').isDisabled(), true);
  statusFails = true; await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  await page.getByText('Your ID was submitted. Verification status is temporarily unavailable.').waitFor();
  assert.equal(publications.length, 1); assert.equal(submissions.get(submissionId).confirmed_details.fullName, 'Manual Name');
  assert.equal('backPath' in publications[0], false);
  report.checks.push('Failed/invalid and same-file replacements preserve the draft; accepted replacement resets details; quota permits manual submission; lost RPC response reconciles the same ID; confirmed success survives failed status refresh');

  await reset(); await toDetails(); await field('Full name (required)').fill('Retry manual'); await button('Continue').click();
  skipCommitOnce = true;
  await button('Submit').evaluate(node => { node.click(); node.click(); });
  await button('Retry same submission').waitFor(); assert.equal(publications.length, 1);
  await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  assert.equal(publications.length, 2); assert.equal(publications[0].submissionId, publications[1].submissionId);
  assert.equal(publications[0].frontPath, publications[1].frontPath);
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  await page.getByText('Retry manual', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('img[alt="Front of your submitted valid ID"]')?.naturalWidth > 0);
  assert.equal(await page.getByText(/Step \d of 4/).count(), 0);
  assert.equal(await button('Submit').count(), 0);
  await page.goto('https://valid-id.test/settings');
  await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).click();
  await page.getByText('Valid ID is pending verification', { exact: true }).waitFor();
  await page.getByText('Retry manual', { exact: true }).waitFor();
  assert.equal(await page.getByText(/Step \d of 4/).count(), 0);
  assert.equal(publications.length, 2);
  report.checks.push('A newly submitted ID immediately displays its saved details, photo and pending status with no steps, and the same summary returns after navigating away and back without republishing');
  report.checks.push('Synchronous double click produces one attempt; a missing reconciliation row retries the same ID and identical immutable photo');

  await reset(); await toDetails(); await field('Full name (required)').fill('Late commit'); await button('Continue').click();
  assert.deepEqual(await page.locator('dd').allTextContents(), ['PhilSys', 'Late commit', 'Not shown on ID', 'Not shown on ID', 'Not shown on ID']);
  assert.equal(await page.getByAltText('Front ID photo selected for submission').evaluate(image => image.naturalWidth > 0 && getComputedStyle(image).objectFit === 'contain'), true);
  publishMode = 'late-commit'; await button('Submit').click(); await button('Retry same submission').waitFor();
  await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  assert.equal(publications.length, 2); assert.deepEqual(publications[0], publications[1]);
  assert.equal(await page.evaluate(() => window.__routeRefreshes ?? 0), 0);
  report.checks.push('A transaction committing after a not-found read is retried with the identical payload/ID; confirmed success refreshes status without remounting the route');

  await reset(); await toDetails(); await field('Full name (required)').fill('Recover owned row'); await button('Continue').click();
  loseReply = true; await button('Submit').click(); await button('Retry same submission').waitFor();
  rowMode = 'error'; await button('Retry same submission').click(); await retryReady();
  assert.equal(await button('Previous').isDisabled(), true); assert.equal(publications.length, 1);
  rowMode = 'mismatch'; await button('Retry same submission').click(); await retryReady();
  assert.equal(await button('Previous').isDisabled(), true); assert.equal(publications.length, 1);
  assert.equal(await page.getByRole('heading', { name: 'ID submitted', exact: true }).count(), 0);
  rowMode = 'normal';
  const replacement = 'c1180000-0000-4000-8000-000000000099';
  currentProfile = { ...currentProfile, current_id_submission_id: replacement, approved_id_submission_id: null, id_verification_status: 'pending' };
  await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  await page.getByText('A newer ID submission is now current. The verification status above applies to that submission.').waitFor();
  assert.equal(currentProfile.current_id_submission_id, replacement); assert.equal(publications.length, 1);
  await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'success-current-replacement.png'), fullPage: true });
  report.checks.push('Failed or mismatched owned-row reads keep the snapshot locked without writes or false success; resolving an older version preserves and identifies the newer current submission');

  await reset(); await toDetails(); await field('Full name (required)').fill('Reviewed promptly'); await button('Continue').click();
  publishMode = 'reviewed'; await button('Submit').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  await page.getByRole('link', { name: 'Valid ID: Verified', exact: true }).waitFor();
  await page.getByText('Your valid ID has been verified', { exact: true }).waitFor();
  await page.getByText('Reviewed promptly', { exact: true }).waitFor();
  assert.equal(await page.getByText('Your current ID is awaiting staff verification.', { exact: false }).count(), 0);
  currentProfile = { ...currentProfile, id_verification_status: 'verification_failed' };
  await page.evaluate(() => window.__idFixture.refresh());
  await page.getByText('Your current ID needs attention.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'ID submitted' }).count(), 1);
  assert.equal(publications.length, 1); assert.equal(await page.evaluate(() => window.__routeRefreshes ?? 0), 0);
  report.checks.push('Confirmed success uses fresh staff decisions without forcing pending; later status refreshes preserve success and never republish or refresh the route');

  for (const rejection of ['invalid', 'denied']) {
    await reset(); await toDetails(); await field('Full name (required)').fill('Correctable name'); await button('Continue').click();
    publishMode = rejection; await button('Submit').click();
    await page.getByText(rejection === 'denied' ? 'Your account cannot submit this ID.' : 'These ID details could not be accepted.', { exact: false }).waitFor();
    assert.equal(await button('Previous').isEnabled(), true); assert.equal(await button('Retry same submission').count(), 0);
    await button('Previous').click(); assert.equal(await field('Full name (required)').inputValue(), 'Correctable name');
    await field('Full name (required)').fill('Reviewed correction'); await button('Continue').click();
    publishMode = 'normal'; await button('Submit').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
    assert.notEqual(publications[0].submissionId, publications[1].submissionId);
    assert.equal(publications[1].confirmedDetails.fullName, 'Reviewed correction');
  }
  report.checks.push('Definitive validation/access rejections show safe feedback and retain the editable draft; a deliberate correction gets a new identity only after that resolved rejection');

  await reset(); await toDetails(); await field('Full name (required)').fill('Timed out publication'); await button('Continue').click();
  publishMode = 'timeout'; await button('Submit').click(); await page.waitForFunction(() => window.__rpcHeld);
  await page.clock.fastForward(10001); await button('Retry same submission').waitFor();
  assert.equal(await button('Previous').isDisabled(), true); assert.equal(publications.length, 1);
  commit(heldPublication.payload); await abortFixture(heldPublication.route); heldPublication = null; publishMode = 'normal';
  await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  assert.equal(publications.length, 1);
  report.checks.push('Actual REST deadline ends a held publication spinner as unknown; a later committed row resolves through an explicit owned-ID read without another publication');

  await reset(); await toDetails(); await field('Full name (required)').fill('Immutable retry'); await button('Continue').click();
  skipCommitOnce = true; await button('Submit').click(); await button('Retry same submission').waitFor();
  const immutablePath = publications[0].frontPath, immutableObject = objects.get(immutablePath);
  objects.set(immutablePath, { ...immutableObject, bytes: Buffer.from('different bytes') });
  await button('Retry same submission').click(); await retryReady();
  assert.equal(publications.length, 1); assert.equal(await button('Previous').isDisabled(), true);
  assert.equal(await page.getByRole('heading', { name: 'ID submitted', exact: true }).count(), 0);
  assert.equal(objects.get(immutablePath).bytes.toString(), 'different bytes');
  objects.set(immutablePath, immutableObject);
  await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  assert.deepEqual(publications[0], publications[1]);
  report.checks.push('A same-ID retry rejects different saved image bytes without overwriting or publishing them; restoring identical bytes resolves the original snapshot');

  await reset(); await toDetails(); ocrDelay = 800;
  await button('Read details from photo').click(); await button('Cancel reading').waitFor(); await button('Cancel reading').click();
  await field('Full name (required)').fill('Keep manual'); await button('Continue').click();
  await new Promise(resolve => setTimeout(resolve, 900)); assert.equal(await page.locator('dd').filter({ hasText: 'Keep manual' }).count(), 1);
  assert.equal(await page.locator('dd').filter({ hasText: 'PHOTO-123' }).count(), 0);
  await button('Previous').click();
  await page.evaluate(() => window.__idFixture.switchOwner(null));
  await page.getByText('Your session changed.', { exact: false }).waitFor();
  await page.evaluate(id => window.__idFixture.switchOwner(id), userId);
  await button('Continue').waitFor(); assert.equal(await field('ID type').inputValue(), '');
  report.checks.push('OCR cancel/review navigation invalidates late replies; logout clears the draft and returning creates a fresh draft');

  await field('ID type').selectOption('PhilSys'); await button('Continue').click();
  await page.evaluate(() => { window.__cameraCalls = 0; Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => { window.__cameraCalls++; return Promise.reject(new DOMException('Denied', 'NotAllowedError')); } }); });
  assert.equal(await page.evaluate(() => window.__cameraCalls), 0);
  await button('Take a photo').click(); await page.getByText('Camera unavailable. Upload an existing photo.').waitFor(); await button('Cancel and use Upload').click();
  await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => new Promise(resolve => { window.__lateCamera = resolve; }) }); window.__stopped = 0; });
  await button('Take a photo').click(); await page.getByText('Waiting for camera permission… You can cancel at any time.').waitFor(); await button('Cancel and use Upload').click();
  await page.evaluate(() => window.__lateCamera({ getTracks: () => [{ stop: () => window.__stopped++ }] }));
  await page.waitForFunction(() => window.__stopped === 1);
  await upload();
  await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 500;
    canvas.getContext('2d').fillRect(0, 0, 800, 500);
    window.__captureStream = canvas.captureStream();
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => window.__captureStream });
  });
  await button('Take a photo').click(); await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(node => node.textContent.includes('Capture photo'))?.disabled);
  await button('Capture photo').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.getByText('Uploaded. Continue to enter your details.', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => window.__captureStream.getTracks().every(track => track.readyState === 'ended')), true);
  report.checks.push('Camera starts only on click, denial allows upload, ignored permission can be cancelled, late permission tracks are stopped');
  report.checks.push('Canvas-backed live video capture creates the same uploaded front-photo draft and closes its stream');

  const exact = Buffer.concat([file.buffer, Buffer.alloc(5242880 - file.buffer.length)]);
  await page.getByLabel('Choose front ID photo').setInputFiles({ ...file, buffer: exact });
  await page.waitForFunction(() => !document.body.textContent.includes('Checking and uploading photo'));
  assert.equal(await page.getByRole('alert').count(), 0);
  await page.getByLabel('Choose front ID photo').setInputFiles({ ...file, buffer: Buffer.concat([exact, Buffer.alloc(1)]) });
  await page.getByText(/readable JPG/).waitFor();
  await page.getByLabel('Choose front ID photo').setInputFiles({ ...file, buffer: Buffer.alloc(0) });
  await page.getByText(/readable JPG/).waitFor();
  await upload();
  report.checks.push('Real decoder accepts exact 5,242,880-byte evidence; empty and one-byte-over candidates preserve the accepted photo');

  const imageChecks = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 50;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp'));
    const derivative = await window.__photoHelpers.prepareOcrPhoto(blob, new AbortController().signal);
    let encodes = 0; const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback) { encodes++; callback(null); };
    let failed = false; try { await window.__photoHelpers.prepareOcrPhoto(blob, new AbortController().signal); } catch { failed = true; } finally { HTMLCanvasElement.prototype.toBlob = original; }
    return { mime: derivative.type, size: derivative.size, failed, encodes };
  });
  assert.equal(imageChecks.mime, 'image/jpeg'); assert.ok(imageChecks.size > 0 && imageChecks.size <= 900000); assert.equal(imageChecks.failed, true); assert.equal(imageChecks.encodes, 3);
  report.checks.push('Real browser WebP conversion creates a separate capped JPEG; encoding failure stops after three attempts');

  await button('Continue').click(); await field('Full name (required)').fill('Manual after conversion failure');
  const beforeConversionRead = ocrCount;
  const beforeConversionUploads = requests.filter(request => request.method === 'POST' && request.path.startsWith('/storage/')).length;
  await page.evaluate(() => {
    window.__originalEncode = HTMLCanvasElement.prototype.toBlob; window.__encodeAttempts = 0;
    HTMLCanvasElement.prototype.toBlob = function(callback) { window.__encodeAttempts++; callback(null); };
  });
  try {
    await button('Read details from photo').click();
    await page.getByText("We couldn't read your ID photo.", { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.__encodeAttempts), 3);
  } finally {
    await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window.__originalEncode; delete window.__originalEncode; });
  }
  assert.equal(ocrCount, beforeConversionRead);
  assert.equal(requests.filter(request => request.method === 'POST' && request.path.startsWith('/storage/')).length, beforeConversionUploads);
  assert.equal(await field('Full name (required)').inputValue(), 'Manual after conversion failure');
  await button('Continue').click(); await button('Submit').click();
  await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
  assert.equal(publications[0].confirmedDetails.fullName, 'Manual after conversion failure');
  assert.deepEqual(objects.get(publications[0].frontPath).bytes, file.buffer);
  report.checks.push('Three failed derivative encodes make no upload/provider request, preserve corrections and original evidence, and permit complete manual publication');

  for (const mode of ['malformed', 'empty', 'partial']) {
    await reset(); await toDetails(); ocrMode = mode;
    await field('Full name (required)').fill('Manual correction');
    const beforeRead = ocrCount;
    await button('Read details from photo').click();
    await page.getByText(mode === 'malformed' ? "We couldn't read your ID photo." : mode === 'empty' ? "We couldn't read details from this photo." : 'Suggestions are ready.', { exact: false }).waitFor();
    assert.equal(ocrCount, beforeRead + 1);
    assert.equal(await field('Full name (required)').inputValue(), 'Manual correction');
    assert.equal(await field('ID number (optional)').inputValue(), mode === 'partial' ? 'PARTIAL-123' : '');
    assert.equal(await button('Birthday (optional)').textContent(), 'Select date of birth');
    await button('Continue').click(); await button('Submit').click();
    await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
    assert.equal(publications.length, 1); assert.equal(ocrCount, beforeRead + 1);
    assert.equal(publications[0].confirmedDetails.fullName, 'Manual correction');
  }
  report.checks.push('Malformed, empty and partial OCR replies preserve manual edits, reject over-limit/invalid suggestions and allow complete publication without automatic retries');

  await reset(); await toDetails();
  const beforeTimeout = ocrCount;
  let receiveOcr;
  const heldOcr = new Promise(resolve => { receiveOcr = resolve; });
  await page.route('**/functions/v1/extract-resident-id-ocrspace', route => { ocrCount++; receiveOcr(route); });
  try {
    const requested = page.waitForRequest('**/functions/v1/extract-resident-id-ocrspace', { timeout: 10000 });
    await button('Read details from photo').click();
    // Wait for the HTTP request before advancing its actual 30-second transport deadline.
    await requested;
    const timeoutRoute = await heldOcr;
    await page.clock.fastForward(30001);
    await page.getByText("We couldn't read your ID photo.", { exact: false }).waitFor();
    assert.equal(await button('Cancel reading').count(), 0);
    await field('Full name (required)').fill('Manual after timeout');
    await timeoutRoute.fulfill({ contentType: 'application/json', body: JSON.stringify({ details: { fullName: 'Late name', idNumber: 'LATE', birthDate: '', address: '' } }) });
    await button('Continue').click(); await button('Submit').click();
    await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
    assert.equal(ocrCount, beforeTimeout + 1);
    assert.equal(publications[0].confirmedDetails.fullName, 'Manual after timeout');
    assert.equal(publications[0].confirmedDetails.idNumber, '');
  } finally {
    await page.unroute('**/functions/v1/extract-resident-id-ocrspace');
  }
  report.checks.push('Actual OCR transport timeout ends loading; a late response cannot change manual publication or start another read');

  await reset(); await field('ID type').selectOption('PhilSys'); await button('Continue').click(); await upload();

  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await assertNoOverflow(`${width}px photo step`);
    await page.screenshot({ path: path.join(output, `photo-${width}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'dark' }); await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.setViewportSize({ width: 360, height: 1000 }); await button('Continue').click(); await assertNoOverflow('dark details');
  await page.screenshot({ path: path.join(output, 'details-dark-360.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); await assertNoOverflow('200% zoom details');
  await field('Full name (required)').fill('Narrow review'); await button('Continue').click(); await assertNoOverflow('200% zoom review');
  await page.screenshot({ path: path.join(output, 'review-200-percent.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.goto('https://valid-id.test/settings/profile');
  await page.getByRole('heading', { name: 'Household Members' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Change profile photo' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Save Changes' }).count(), 1);
  assert.equal(await page.getByText('Upload Valid ID', { exact: true }).count(), 0);
  const firstName = page.getByLabel(/^First Name/);
  await firstName.fill('123');
  const beforeInvalid = profileWrites.length;
  await button('Save Changes').click();
  await page.getByText('Please fix the highlighted fields.', { exact: true }).waitFor();
  assert.equal(profileWrites.length, beforeInvalid);
  await firstName.fill('Maria');
  writeFailure = 'profile';
  await button('Save Changes').click();
  await page.getByText('Failed to save: Synthetic write rejected', { exact: true }).waitFor();
  assert.equal(await firstName.inputValue(), 'Maria');
  writeFailure = null;
  await button('Save Changes').click();
  await page.getByText('Profile updated.', { exact: true }).waitFor();
  assert.equal(profileFields.first_name, 'Maria');
  assert.deepEqual(Object.keys(profileWrites.at(-1)).sort(), ['first_name', 'last_name', 'middle_name', 'suffix', 'sex', 'birth_date', 'mobile_number', 'house_no', 'street', 'city', 'employment_status', 'occupation'].sort());
  assert.equal(new URL(page.url()).pathname, '/settings/profile');
  await button('February 29, 2000').click();
  await page.getByRole('dialog', { name: 'Select Date of Birth' }).waitFor();
  await button('2000-02-28').click();
  await button('Save Changes').click();
  await page.waitForFunction(() => window.__routeRefreshes === 2);
  assert.equal(profileFields.birth_date, '2000-02-28');
  report.checks.push('Normal Profile validates locally, preserves edits after a rejected save, writes only personal fields and retains its ordinary birthday calendar');

  avatarBytes = file.buffer;
  const avatarInput = page.locator('input[type="file"]');
  writeFailure = 'avatar';
  await avatarInput.setInputFiles(file);
  await page.getByText('Upload failed: Synthetic avatar rejected', { exact: true }).waitFor();
  assert.equal(profileFields.avatar_url, undefined);
  writeFailure = null;
  await avatarInput.setInputFiles(file);
  await page.getByText('Profile photo updated.', { exact: true }).waitFor();
  assert.equal(profileFields.avatar_url, `https://fixture-supabase.test/storage/v1/object/public/profile-photos/${userId}/avatar.png`);
  await page.waitForFunction(() => [...document.images].some(img => img.src.includes('/profile-photos/') && img.complete && img.naturalWidth > 0));
  assert.deepEqual(Object.keys(profileWrites.at(-1)), ['avatar_url']);
  report.checks.push('Retained avatar upload failure permits same-file retry; success updates only avatar_url and decodes the public profile image');

  await button('Add').click();
  const family = page.getByRole('dialog');
  await family.getByLabel('Full Name', { exact: true }).fill('Synthetic Member');
  writeFailure = 'household';
  await family.getByRole('button', { name: 'Add Member', exact: true }).click();
  await page.getByText("Couldn't add family member.", { exact: true }).waitFor();
  assert.equal(await family.getByLabel('Full Name', { exact: true }).inputValue(), 'Synthetic Member');
  writeFailure = null;
  await family.getByRole('button', { name: 'Add Member', exact: true }).click();
  await family.waitFor({ state: 'hidden' });
  await page.getByText('Synthetic Member', { exact: true }).waitFor();
  assert.equal(profileFields.household_members.length, 1);
  const memberId = profileFields.household_members[0].id;
  assert.match(memberId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await button('Edit').click();
  await family.getByLabel('Full Name', { exact: true }).fill('Updated Member');
  await family.getByRole('button', { name: 'Update', exact: true }).click();
  await family.waitFor({ state: 'hidden' });
  await page.getByText('Updated Member', { exact: true }).waitFor();
  assert.equal(profileFields.household_members[0].id, memberId);
  await button('Remove Updated Member').click();
  await page.getByText('No household members added yet.', { exact: true }).waitFor();
  assert.deepEqual(profileFields.household_members, []);
  assert.deepEqual(Object.keys(profileWrites.at(-1)), ['household_members']);
  report.checks.push('Actual household hook supports failed add with preserved dialog, explicit retry, edit and remove without writing ID approval');

  // Both verification entry points must keep personal editing separate from ID verification.
  currentProfile = profile();
  for (const route of ['/test/service', '/test/legacy-service', '/test/notice', '/test/legacy-notice']) {
    await page.goto(`https://valid-id.test${route}`);
    const legacy = route.includes('legacy');
    const verify = page.getByRole('link', { name: 'Verify Now', exact: true });
    await verify.waitFor();
    assert.equal(await verify.getAttribute('href'), legacy ? '/resident/profile#upload-valid-id' : '/settings/valid-id');
    if (route.includes('service')) assert.equal(await page.getByRole('link', { name: 'Edit in Profile', exact: true }).getAttribute('href'), legacy ? '/resident/profile' : '/settings/profile');
    const copy = await page.locator('body').innerText();
    assert.ok(copy.includes(legacy ? 'in your profile' : 'Open Valid ID in Settings'));
  }
  await page.goto('https://valid-id.test/test/attachment');
  await page.getByLabel('Valid ID (optional)', { exact: false }).waitFor();
  await page.getByLabel('Valid ID (optional)', { exact: false }).setInputFiles(file);
  assert.equal(await page.getByLabel('Valid ID (optional)', { exact: false }).evaluate(node => node.files.length), 1);
  report.checks.push('Both web verification entry points use Valid ID while Edit in Profile stays on Profile; older portal destinations/copy and legacy request attachments remain intact');

  for (const sides of ['front', 'two-sided']) {
    const submissionId = `synthetic-${sides}`;
    const front = `${userId}/versions/${submissionId}/id-front.png`, back = `${userId}/versions/${submissionId}/id-back.png`;
    objects.set(front, { bytes: file.buffer, mime: 'image/png' });
    objects.set(back, { bytes: file.buffer, mime: 'image/png' });
    submissions.set(submissionId, { id: submissionId, decision: 'verified', front_path: front, back_path: sides === 'front' ? null : back, id_type: 'PhilSys', version: 1 });
    currentProfile = { ...profile(), current_id_submission_id: submissionId, approved_id_submission_id: submissionId, id_verification_status: 'verified' };
    await page.goto('https://valid-id.test/test/service');
    await page.getByRole('img', { name: 'Approved ID front', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.getByRole('img', { name: 'Approved ID back', exact: true }).count(), sides === 'front' ? 0 : 1);
    assert.equal(await page.getByRole('link', { name: 'Verify Now', exact: true }).count(), 0);
  }
  currentProfile = profile();
  report.checks.push('Actual service evidence reader decodes front-only and historical two-sided private previews without changing stored evidence');
  for (const query of ['', '?incomplete=1']) {
    await page.goto(`https://valid-id.test/settings/profile${query}#upload-valid-id`);
    await page.getByRole('heading', { name: 'Select ID type' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/settings/valid-id');
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Household Members' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/settings/profile');
    await page.evaluate(() => { location.hash = 'upload-valid-id'; });
    await page.getByRole('heading', { name: 'Select ID type' }).waitFor();
  }
  report.checks.push('Complete and incomplete Profile component fixtures hand old fragments off once, normal navigation stays on Profile, and later hash changes hand off without a cycle');
  assert.equal(await page.evaluate(() => window.__idFixture.channelCount()), 1);
  await toDetails(); ocrDelay = 700;
  await field('Full name (required)').fill('Preserved correction'); await button('Read details from photo').click(); await button('Cancel reading').waitFor();
  await button('Previous').click(); await button('Previous').click(); await field('ID type').selectOption('Passport');
  await button('Continue').click(); await button('Continue').click(); await new Promise(resolve => setTimeout(resolve, 800));
  assert.equal(await field('Full name (required)').inputValue(), 'Preserved correction'); assert.equal(await field('ID number (optional)').inputValue(), '');
  await button('Previous').click(); uploadDelay = 600;
  await page.getByLabel('Choose front ID photo').setInputFiles(file); await button('Cancel upload').waitFor(); await button('Cancel upload').click(); await new Promise(resolve => setTimeout(resolve, 700));
  await button('Continue').click(); assert.equal(await field('Full name (required)').inputValue(), 'Preserved correction');
  await button('Previous').click();
  await page.getByLabel('Choose front ID photo').setInputFiles(file); await button('Cancel upload').waitFor();
  await page.evaluate(() => window.__idFixture.switchOwner('b1180000-0000-4000-8000-000000000002'));
  await page.getByText('Your session changed.', { exact: false }).waitFor(); await new Promise(resolve => setTimeout(resolve, 700));
  await page.evaluate(id => window.__idFixture.switchOwner(id), userId); await field('ID type').waitFor(); assert.equal(await field('ID type').inputValue(), '');
  report.checks.push('Type changes cancel stale OCR without clearing corrections; cancelled/stale uploads cannot replace the photo or restore an old account draft');
  report.checks.push('360/768/1440px and dark/200% layout, actual retained Profile/avatar/household controls, one-way old-fragment handoff and one Settings channel');
  await reset(); await toDetails(); ocrDelay = 500;
  await button('Read details from photo').click(); await button('Cancel reading').waitFor();
  await button('Birthday (optional)').click();
  const dialogYear = await page.getByRole('spinbutton', { name: 'Year' }).getAttribute('aria-valuenow');
  await page.getByText('Suggestions are ready.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('spinbutton', { name: 'Year' }).getAttribute('aria-valuenow'), dialogYear);
  await button('Cancel').click();
  assert.equal(await button('Birthday (optional)').textContent(), 'Select date of birth');
  report.checks.push('Birthday focus stays trapped; backdrop/Cancel/Escape preserve the form; leap-year changes clamp the day; an open wheel is protected from late OCR');
  // Use a fixed browser clock to exercise the real wheel on both sides of the UTC boundary.
  for (const [instant, maximum] of [['2026-10-15T16:01:00Z', '2026-10-15'], ['2026-10-16T00:01:00Z', '2026-10-16']]) {
    await page.clock.setFixedTime(new Date(instant));
    await reset(); await toDetails();
    await button('Birthday (optional)').click();
    await page.getByRole('spinbutton', { name: 'Year' }).press('End');
    await page.getByRole('spinbutton', { name: 'Month' }).press('End');
    await page.getByRole('spinbutton', { name: 'Day' }).press('End');
    await button('Use date').click();
    assert.equal(await button('Birthday (optional)').textContent(), maximum);
    await field('Full name (required)').fill('Boundary date');
    await button('Continue').click();
    assert.equal(await page.locator('dd').filter({ hasText: maximum }).count(), 1);
  }
  report.checks.push('Actual browser wheel with fixed Manila clocks at 00:01 and 08:01 caps dates at the earlier local/UTC day and passes shared review validation');
  for (const boundary of [
    { name: 'Manila midnight', before: '2026-10-16T15:59:59Z', after: '2026-10-16T16:00:01Z', beforeMaximum: '2026-10-16', afterMaximum: '2026-10-16', localDayAfter: 17 },
    { name: 'UTC midnight', before: '2026-10-16T23:59:59Z', after: '2026-10-17T00:00:01Z', beforeMaximum: '2026-10-16', afterMaximum: '2026-10-17', localDayAfter: 17 },
  ]) {
    await page.clock.setFixedTime(new Date(boundary.before));
    await reset(); await toDetails();
    await field('Full name (required)').fill('Boundary transition');
    await button('Birthday (optional)').click();
    for (const name of ['Year', 'Month', 'Day']) await page.getByRole('spinbutton', { name }).press('End');
    await page.clock.setFixedTime(new Date(boundary.after));
    assert.deepEqual(await page.evaluate(() => ({ utc: new Date().toISOString(), localDay: new Date().getDate() })), { utc: new Date(boundary.after).toISOString(), localDay: boundary.localDayAfter });
    await button('Use date').click();
    assert.equal(await button('Birthday (optional)').textContent(), boundary.beforeMaximum);
    await button('Birthday (optional)').click();
    await page.getByRole('spinbutton', { name: 'Day' }).press('Home');
    await button('Cancel').click();
    assert.equal(await button('Birthday (optional)').textContent(), boundary.beforeMaximum);
    await button('Birthday (optional)').click();
    for (const name of ['Year', 'Month', 'Day']) await page.getByRole('spinbutton', { name }).press('End');
    assert.equal(await page.getByRole('spinbutton', { name: 'Day' }).getAttribute('aria-valuemax'), String(Number(boundary.afterMaximum.slice(8, 10))));
    await button('Use date').click();
    assert.equal(await button('Birthday (optional)').textContent(), boundary.afterMaximum);
    await button('Continue').click();
    assert.equal(await page.locator('dd').filter({ hasText: boundary.afterMaximum }).count(), 1);
    await button('Submit').click(); await page.getByRole('heading', { name: 'ID submitted', exact: true }).waitFor();
    assert.equal(publications.length, 1);
    assert.equal(publications[0].confirmedDetails.birthDate, boundary.afterMaximum);

    // Revalidate a review prepared before the boundary when Submit happens after it.
    await page.clock.setFixedTime(new Date(boundary.before));
    await reset(); await toDetails(); await field('Full name (required)').fill('Review across midnight');
    await button('Birthday (optional)').click();
    for (const name of ['Year', 'Month', 'Day']) await page.getByRole('spinbutton', { name }).press('End');
    await button('Use date').click(); await button('Continue').click();
    await page.clock.setFixedTime(new Date(boundary.after));
    await button('Submit').click(); await page.getByRole('heading', { name: 'ID submitted', exact: true }).waitFor();
    assert.equal(publications.length, 1);
    assert.equal(publications[0].confirmedDetails.birthDate, boundary.beforeMaximum);

    await reset(); await toDetails();
    await button('Birthday (optional)').click(); await button('Not shown on ID').click();
    assert.equal(await button('Birthday (optional)').textContent(), 'Select date of birth');
    await field('Full name (required)').fill('Optional birthday after midnight'); await button('Continue').click();
    await button('Submit').click(); await page.getByRole('heading', { name: 'ID submitted', exact: true }).waitFor();
    assert.equal(publications[0].confirmedDetails.birthDate, '');
    report.dateBoundaries.push({ ...boundary, passed: true, clock: 'Controlled browser Date; no wall-clock attendance or hosted publication' });
    report.checks.push(`${boundary.name}: open-wheel confirmation, reopened maximum, Cancel/clear, review and one publication stay valid across the controlled clock transition`);
  }
  for (const initialRole of ['resident', 'admin']) {
    await reset(initialRole); await toDetails();
    await button('Continue').click(); await page.getByText('Enter the full name shown on your ID.').waitFor();
    await field('Full name (required)').fill('Promoted Resident');
    if (initialRole === 'resident') {
      currentProfile = { ...currentProfile, role: 'admin' };
      await page.evaluate(() => window.__idFixture.refresh());
      await page.getByRole('link', { name: 'Valid ID: Not verified', exact: true }).waitFor();
      assert.equal(await button('Continue').isEnabled(), true);
      assert.equal(await field('Full name (required)').inputValue(), 'Promoted Resident');
    }
    const beforeOcr = ocrCount;
    await button('Read details from photo').click(); await page.getByText('Suggestions are ready.', { exact: false }).waitFor();
    assert.equal(ocrCount, beforeOcr + 1);
    assert.equal(await field('Full name (required)').inputValue(), 'Promoted Resident');
    await button('Continue').click(); loseReply = true;
    await button('Submit').click(); await button('Retry same submission').waitFor();
    await button('Retry same submission').click(); await page.getByRole('heading', { name: 'ID submitted' }).waitFor();
    assert.equal(publications.length, 1);
    assert.equal(publications[0].confirmedDetails.fullName, 'Promoted Resident');
    assert.ok(publications[0].frontPath.startsWith(`${userId}/versions/`));
    assert.equal(currentProfile.role, 'admin');
    assert.equal(currentProfile.id_verification_status, 'pending');
    assert.equal(currentProfile.approved_id_submission_id, null);
  }
  report.checks.push('Existing admin and resident promoted during a draft retain the same upload, required-name validation, optional OCR, correction, publication, lost-response recovery and pending staff review');
  await reset(); await toDetails(); await field('Full name (required)').fill('First verified submission'); await button('Continue').click();
  publishMode = 'reviewed'; await button('Submit').click();
  await page.getByText('Your valid ID has been verified', { exact: true }).waitFor();
  await button('Submit a replacement ID').click();
  await page.getByRole('heading', { name: 'Select ID type', exact: true }).waitFor();
  await toDetails();
  assert.equal(await field('Full name (required)').inputValue(), '');
  await field('Full name (required)').fill('Replacement submission'); await button('Continue').click();
  publishMode = 'normal'; await button('Submit').click();
  await page.getByRole('heading', { name: 'ID submitted', exact: true }).waitFor();
  assert.equal(publications.length, 2);
  assert.notEqual(publications[0].submissionId, publications[1].submissionId);
  assert.equal(currentProfile.id_verification_status, 'pending');
  report.checks.push('Starting a replacement after a newly approved submission clears the published snapshot and creates new evidence requiring staff review');
  await reset('admin');
  currentProfile = { ...currentProfile, deleted_at: '2026-10-16T00:00:00Z' };
  await page.evaluate(() => window.__idFixture.refresh());
  await page.getByRole('alert').filter({ hasText: 'active resident account' }).waitFor();
  assert.equal(await button('Continue').count(), 0);
  report.checks.push('A deleted admin profile remains unable to submit an ID');
  report.networkHosts = [...networkHosts].sort();
  assert.deepEqual(report.networkHosts, ['fixture-supabase.test', 'valid-id.test']);
  assert.deepEqual(report.pageErrors, []);
  // Only exact browser network messages for explicitly injected URL/status pairs qualify.
  const unexpected = report.consoleErrors.filter(({ text, url }) => {
    const match = /^Failed to load resource: (?:the server responded with a status of (\d{3}) \([^)]*\)|(net::ERR_CONNECTION_FAILED))$/.exec(text);
    return !match || !injectedFailures.get(url)?.has(match[1] ? `status:${match[1]}` : match[2]);
  });
  assert.deepEqual(unexpected, []); assert.deepEqual(report.warnings, []);
  report.checks.push('No unexpected runtime/console errors or warnings; synthetic failure responses are identified separately');
  report.checks.push('Every network destination is checked; browser requests stay on the fixture app/backend with no direct provider or Google call');
  report.passed = true;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
}
console.log(JSON.stringify(report, null, 2));
