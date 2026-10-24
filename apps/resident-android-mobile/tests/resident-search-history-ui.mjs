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
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-history-ui-'));
fs.mkdirSync(out, { recursive: true });
const mocks = {
  'expo-router': `export const usePathname=()=>window.path;export const router={push:href=>window.opened=href,navigate:href=>{window.opened=href;if(typeof href==='string'){window.path=href;window.refresh()}}};`,
  '@react-native-async-storage/async-storage': `const data=new Map();export default {getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value)}};`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:{user:{id:'resident-1'}}});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:{barangay_id:'barangay-1'},isLoading:false,error:null});`,
  '@/lib/supabase': `export const supabase={};`,
  '@/lib/resident-search': `export {normalizeSearchQuery,isSearchableQuery,SEARCH_DEADLINE_MS,SEARCH_SOURCES} from '${root}/lib/resident-search.ts';export async function queryResidentSearch(){return [{category:'documents',results:[{id:'clearance',category:'documents',title:'Barangay clearance',preview:'Request a clearance'}],more:false,failed:false}]}`,
  '@/hooks/use-theme': `export const useTheme=()=>({background:'#fff',backgroundElement:'#f1f2f6',backgroundSelected:'#e5e7eb',primary:'#127261',text:'#20242a',textSecondary:'#656971'});`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
  '@expo/vector-icons': `import React from 'react';import {Text} from 'react-native';export const Ionicons=({name,color})=><Text style={{color,fontSize:22}}>{name==='close'?'×':name==='time-outline'?'◷':'⌕'}</Text>;`,
  '@/components/themed-text': `import React from 'react';import {Text} from 'react-native';export const ThemedText=({type,themeColor,style,...props})=><Text {...props} style={[{fontFamily:'Arial',fontSize:type?.startsWith('small')?14:16,lineHeight:22,color:themeColor?'#656971':'#20242a',fontWeight:type==='smallBold'?'bold':'normal'},style]}/>;`,
};
await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{ResidentSearchProvider,useSearchDraft}from'${root}/hooks/use-resident-search.tsx';import SearchScreen from '${root}/app/(app)/search.tsx';window.path='/search';function App(){const[,render]=React.useState(0);window.refresh=()=>render(v=>v+1);const draft=useSearchDraft();window.draft=draft;return <div style={{height:'100vh',display:'flex',flexDirection:'column'}}><input aria-label="Search Barangayan" placeholder="Search Barangayan" value={draft.query} onChange={e=>draft.setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')draft.submitSearch(draft.query)}} style={{fontSize:18,padding:18,border:'8px solid #127261'}}/>{window.path==='/search'?<SearchScreen/>:null}</div>}createRoot(document.getElementById('root')).render(<ResidentSearchProvider><App/></ResidentSearchProvider>);`, resolveDir: app, loader: 'tsx' },
  bundle: true, format: 'iife', outfile: path.join(out, 'bundle.js'), jsx: 'automatic',
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'mocks', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'mock' } : args.path === 'react-native' ? { path: require.resolve('react-native-web') } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.setContent('<html><head><style>body{margin:0}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(out, 'bundle.js'), 'utf8') });
  const backToEntry = () => page.evaluate(() => { window.path = '/search'; window.refresh(); });
  assert.equal(await page.getByText('Recent searches', { exact: true }).count(), 0);
  await page.getByText('Suggested searches', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Search for Barangay clearance', exact: true }).click();
  await page.waitForFunction(() => window.path === '/explore' && window.draft.submittedQuery === 'Barangay clearance' && window.draft.history.length === 1);
  await backToEntry();
  await page.getByRole('textbox').fill('');
  await page.getByRole('button', { name: 'Search again for Barangay clearance' }).waitFor();
  const headings = await page.locator('[role="heading"]').allTextContents();
  assert.deepEqual(headings.slice(0, 2), ['Recent searches', 'Suggested searches'], 'Empty entry lists Recent before Suggested');
  await page.screenshot({ path: path.join(out, 'recent-searches.png') });
  await page.getByRole('textbox').fill('clear');
  await page.getByRole('button', { name: 'Search for Barangay clearance', exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'matching-suggestions.png') });
  await page.getByRole('button', { name: 'Remove Barangay clearance from recent searches' }).click();
  await page.waitForFunction(() => window.draft.history.length === 0);
  await page.getByRole('button', { name: 'Search for Barangay clearance', exact: true }).click();
  await page.waitForFunction(() => window.path === '/explore' && window.draft.history.length === 1);
  await backToEntry();
  await page.getByRole('textbox').fill('');
  await page.getByRole('button', { name: 'Clear all recent searches' }).click();
  await page.waitForFunction(() => window.draft.history.length === 0);
  assert.equal(await page.getByText('Recent searches', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['suggestion submission saves search and opens Explore', 'empty entry shows Recent then Suggested', 'blank input shows recent searches', 'typing filters recent suggestions', 'remove recent suggestion', 'clear all recent searches'], screenshots: out, errors }));
} finally { await browser.close(); }
