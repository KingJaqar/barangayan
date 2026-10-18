import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = path.join(app, 'src').replaceAll('\\', '/');
const shared = path.resolve(app, '../../packages/shared/src/lib/service-catalog.ts').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'resident-tab-stability-'));
fs.mkdirSync(out, { recursive: true });

// Render the real Services screen and shared verification rules. Only data hooks,
// navigation and the document feeds are fixtures; layout uses React Native Web.
const mocks = {
  'expo-router': `export const useRouter=()=>({push:()=>{}});export const useLocalSearchParams=()=>({});export const useFocusEffect=()=>{};`,
  '@barangayan/shared': `export {idVerificationState,idVerificationMessages} from '${shared}';`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:{user:{id:'resident'}},needsCompletion:false});`,
  '@/hooks/use-profile': `export const useProfile=()=>window.profileState;`,
  '@/hooks/use-theme': `export const useTheme=()=>({background:'#fff',backgroundElement:'#f2f3f6',backgroundSelected:'#ddd',text:'#111',textSecondary:'#666',primary:'#0f6e5b',onPrimary:'#fff'});`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>82;`,
  '@/components/profile-completion-banner': `export const ProfileCompletionBanner=()=>null;`,
  '@/constants/theme': `export const Spacing={one:4,two:8,three:16,four:24,five:32};`,
  '@/components/themed-text': `import React from 'react';import {Text} from 'react-native';export const ThemedText=({type,themeColor,style,...props})=><Text {...props} style={[{fontSize:type?.startsWith('small')?14:16,lineHeight:type?.startsWith('small')?20:24,fontWeight:type==='smallBold'?700:500},style]}/>;`,
  '@/components/services/documents-list': `import React from 'react';import {View,Text} from 'react-native';export const DocumentsList=()=> <View testID="document-list" style={{height:600,padding:16}}><Text>Available documents</Text></View>;`,
  '@/components/services/logs-list': `export const LogsList=()=>null;`,
  '@/components/services/requests-list': `export const RequestsList=()=>null;`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size}}/>;`,
  'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native';`,
};

await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Services from '${root}/app/(app)/services/index.tsx';window.profileState={profile:{id:'resident',id_verification_status:'verified',approved_id_submission_id:'id-1',current_id_submission_id:'id-1',id_repair_required:false},isLoading:false,error:null,refetch:()=>{}};const root=createRoot(document.getElementById('root'));window.renderServices=()=>root.render(<Services/>);window.renderServices();`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic',
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : args.path === 'react-native' ? { path: require.resolve('react-native-web') } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});

const browserOptions = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!browserOptions.executablePath && !fs.existsSync(chromium.executablePath())) browserOptions.channel = 'chrome';
const browser = await chromium.launch(browserOptions);
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const documents = page.getByTestId('document-list');
  await page.getByText('Valid ID Verified', { exact: true }).waitFor();
  const before = await documents.boundingBox();

  for (let visit = 0; visit < 3; visit++) {
    await page.evaluate(() => { window.profileState = { ...window.profileState, isLoading: true }; window.renderServices(); });
    await page.getByText('Checking ID verification…', { exact: true }).waitFor();
    const during = await documents.boundingBox();
    assert.equal(during.y, before.y, 'Tab-focus profile refresh must not move the document list');
    assert.equal(await page.getByRole('button', { name: 'Verify Now', exact: true }).count(), 0);
    await page.evaluate(() => { window.profileState = { ...window.profileState, isLoading: false }; window.renderServices(); });
    await page.getByText('Valid ID Verified', { exact: true }).waitFor();
    assert.equal((await documents.boundingBox()).y, before.y);
  }

  // Real changes and failures must still replace the compact status with guidance.
  await page.evaluate(() => { window.profileState = { ...window.profileState, error: 'Could not refresh your profile.' }; window.renderServices(); });
  await page.getByText('Could not refresh your profile.', { exact: true }).waitFor();
  await page.getByText('Retry verification check', { exact: true }).waitFor({ state: 'attached' });
  assert.equal(await page.getByText('Valid ID Verified', { exact: true }).count(), 0);
  await page.evaluate(() => { window.profileState = { ...window.profileState, error: null, profile: { ...window.profileState.profile, id_verification_status: 'pending' } }; window.renderServices(); });
  await page.getByText('Your ID is awaiting verification. Requests are available after approval.', { exact: true }).waitFor();
  await page.getByText('Verify Now', { exact: true }).waitFor({ state: 'attached' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['Three background refreshes keep the document list at the same position', 'Refresh failures still show retry guidance', 'Changed verification status still shows verification guidance'], documentListY: before.y }));
} finally { await browser.close(); }
