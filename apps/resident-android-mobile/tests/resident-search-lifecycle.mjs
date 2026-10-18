import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = path.join(app, 'src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-search-check-'));
fs.mkdirSync(out, { recursive: true });
const mocks = {
  '@react-native-async-storage/async-storage': `const data=new Map();export default {getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value)}};`,
  'expo-router': `export const usePathname=()=>window.fx.path;`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fx.user?{user:{id:window.fx.user}}:null});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:window.fx.tenant?{barangay_id:window.fx.tenant}:null,isLoading:false,error:null});`,
  '@/lib/supabase': `export const supabase={};`,
  '@/lib/resident-search': `export {normalizeSearchQuery} from '${root}/lib/resident-search.ts';export async function queryResidentSearch(client,scope,query,signal){return new Promise((resolve,reject)=>{const call={query,scope,aborted:false,resolve,reject};window.fx.calls.push(call);signal.addEventListener('abort',()=>call.aborted=true)})}`,
};
await build({ stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ResidentSearchProvider,useSearchDraft,useResidentSearch}from'${root}/hooks/use-resident-search.tsx';window.fx={path:'/search',user:'u1',tenant:'b1',calls:[]};function Inner(){const draft=useSearchDraft();const result=useResidentSearch();window.draft=draft;window.result=result;return <pre>{JSON.stringify(result)}</pre>}function App(){const[n,render]=useState(0);window.refresh=()=>render(v=>v+1);return <ResidentSearchProvider><Inner/></ResidentSearchProvider>}createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: app, loader: 'tsx' }, bundle: true, format: 'iife', outfile: path.join(out, 'bundle.js'), plugins: [{ name: 'mocks', setup(b) { b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'mock' } : undefined); b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: app })); } }] });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({content:fs.readFileSync(path.join(out, 'bundle.js'),'utf8')});
  await page.waitForFunction(() => window.draft);
  const set = q => page.evaluate(q => window.draft.setQuery(q), q);
  const wait = () => page.waitForTimeout(400);
  const count = () => page.evaluate(() => window.fx.calls.length);
  assert.equal(await count(), 0);
  await set('alpha'); await page.waitForTimeout(90); await set('beta'); await wait(); assert.equal(await count(), 1);
  assert.equal(await page.evaluate(() => window.fx.calls[0].query), 'beta');
  await page.evaluate(() => window.fx.calls[0].resolve([{ category: 'documents', results: [{ id: 'beta' }], more: false, failed: false }]));
  await page.waitForFunction(() => !window.result.loading);
  await set('  beta  '); await wait(); assert.equal(await count(), 1);
  await set('alpha'); await wait(); await set('gamma'); await wait();
  assert.equal(await page.evaluate(() => window.fx.calls[1].aborted), true);
  await page.evaluate(() => { window.fx.calls[1].resolve([{ category: 'documents', results: [{ id: 'old' }] }]); window.fx.calls[2].resolve([{ category: 'documents', results: [{ id: 'gamma' }] }]); });
  await page.waitForFunction(() => window.result.groups[0]?.results[0]?.id === 'gamma');
  await set('beta'); await page.waitForTimeout(20); assert.equal(await page.evaluate(() => window.result.groups.length), 0); await wait();
  await page.evaluate(() => window.fx.calls.at(-1).reject(new Error('offline')));
  await page.waitForFunction(() => window.result.error);
  await page.evaluate(() => window.result.retry()); await wait(); assert.equal(await count(), 5);
  await page.evaluate(() => { window.fx.path = '/home'; window.refresh(); }); await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.fx.calls.at(-1).aborted), true);
  await page.evaluate(() => { window.fx.path = '/search'; window.fx.tenant = null; window.refresh(); }); await wait();
  assert.equal(await count(), 5); assert.ok(await page.evaluate(() => window.result.error));
  await page.evaluate(() => window.draft.rememberSearch('Barangay clearance'));
  await page.waitForFunction(() => window.draft.history[0] === 'Barangay clearance');
  await page.evaluate(() => window.draft.rememberSearch('Medical drive'));
  await page.waitForFunction(() => window.draft.history.length === 2);
  await page.evaluate(() => { window.fx.user = 'u2'; window.fx.tenant = 'b2'; window.refresh(); });
  await page.waitForFunction(() => window.draft.query === '' && window.draft.history.length === 0);
  await page.evaluate(() => window.draft.rememberSearch('Resident two'));
  await page.waitForFunction(() => window.draft.history[0] === 'Resident two');
  await page.evaluate(() => { window.fx.user = 'u1'; window.fx.tenant = 'b1'; window.refresh(); });
  await page.waitForFunction(() => window.draft.history[0] === 'Medical drive');
  await page.evaluate(() => window.draft.selectSearch('Barangay clearance'));
  await page.waitForFunction(() => window.draft.query === 'Barangay clearance' && window.draft.history[0] === 'Barangay clearance');
  await page.evaluate(() => window.draft.removeSearch('Medical drive'));
  await page.waitForFunction(() => window.draft.history.length === 1);
  await page.evaluate(() => window.draft.clearHistory());
  await page.waitForFunction(() => window.draft.history.length === 0);
  await page.evaluate(() => { window.fx.user = null; window.refresh(); }); await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.draft.query), '');
  await page.evaluate(() => window.draft.rememberSearch('Guest search'));
  assert.deepEqual(await page.evaluate(() => window.draft.history), []);
  assert.deepEqual(errors, []);
  const result = { passed: ['blank query makes no calls', 'typing debounce', 'normalized-query deduplication', 'abort old request', 'late response ignored', 'revisiting query hides stale results', 'error and explicit retry', 'leaving search cancels', 'missing tenant fails closed', 'account change clears draft', 'history restores per account', 'recent selection promotes query', 'remove and clear history', 'guest searches are not saved'], errors };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close();  }

