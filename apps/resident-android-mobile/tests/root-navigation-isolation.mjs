import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const app=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(app,'package.json'));
const {build}=require('esbuild'),{chromium}=require('playwright');
const src=path.join(app,'src').replaceAll('\\','/'),out=process.env.TEST_ARTIFACTS_DIR??fs.mkdtempSync(path.join(os.tmpdir(),'resident-root-'));
fs.mkdirSync(out,{recursive:true});
// Actual root/guard/overlay composition; controlled auth, pathname and native adapters.
const mocks={
 'expo-router':`import React,{createContext,useContext} from 'react';export const Path=createContext('/home');export const usePathname=()=>useContext(Path);export const useRouter=()=>({replace:()=>{}});export const DarkTheme={},DefaultTheme={};export const ThemeProvider=({children})=>children;export function Stack({children}){window.fx.navigatorRenders++;return <div data-testid="navigator">{children}</div>}Stack.Screen=({name})=><div data-screen={name}/>;Stack.Protected=({guard,children})=>guard?children:null;`,
 'expo-linking':`export const useLinkingURL=()=>null;`,
 'expo-splash-screen':`export const preventAutoHideAsync=()=>{};export const hideAsync=()=>{};`,
 'expo-font':`export const useFonts=()=>[true,null];`,
 'react-native':`export {View} from 'react-native-web';`,
 'react-native-safe-area-context':`export const SafeAreaProvider=({children})=>children;`,
 '@/components/animated-icon':`import React from 'react';export const AnimatedSplashOverlay=({ready})=><div data-testid="overlay">{String(ready)}</div>;`,
 '@/hooks/use-auth':`export const AuthProvider=({children})=>children;export const useAuth=()=>window.fx.auth;`,
 '@/hooks/use-notification-preferences':`export const NotificationPreferencesProvider=({children})=>children;export const useNotificationPreferences=()=>({pushEnabled:false});`,
 '@/hooks/use-notification-realtime':`export const useNotificationRealtime=()=>{};`,
 '@/hooks/use-font-preference':`export const FontPreferenceProvider=({children})=>children;`,
 '@/hooks/use-profile':`export const ProfileProvider=({children})=>children;export const useProfile=()=>({profile:null});`,
 '@/hooks/use-theme-preference':`export const ThemePreferenceProvider=({children})=>children;export const useThemePreference=()=>({scheme:'light'});`,
 '@/hooks/use-theme':`export const useTheme=()=>({background:'#fff'});`,
 '@/lib/push-notifications':`export const registerPushToken=async()=>{};`,
 '@/components/primary-button':`import React from 'react';export const PrimaryButton=({label,onPress})=><button onClick={onPress}>{label}</button>;`,
 '@/components/themed-text':`import React from 'react';export const ThemedText=({children})=><span>{children}</span>;`,
 '@/components/emergency-entry-link':`export const EmergencyEntryLink=()=>null;`,
};
await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {Path} from 'expo-router';import RootLayout from '${src}/app/_layout.tsx';const stable=<RootLayout/>;function App(){const[n,set]=useState(0);window.render=()=>set(v=>v+1);return <Path.Provider value={window.fx.path}>{stable}</Path.Provider>}const root=createRoot(document.getElementById('root'));root.render(<App/>);`,resolveDir:app,loader:'tsx'},bundle:true,format:'iife',outfile:path.join(out,'bundle.js'),jsx:'automatic',loader:{'.ttf':'dataurl'},define:{__DEV__:'false','process.env.NODE_ENV':'"production"','process.env.EXPO_OS':'"web"'},plugins:[{name:'root-fixtures',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'jsx',resolveDir:app}));}}]});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.clock.install();await page.setContent('<div id="root"></div>');
 await page.evaluate(()=>{window.fx={path:'/home',navigatorRenders:0,auth:{session:null,isGuest:true,isLoading:true,restorationError:null,isPasswordRecovery:false,setupRoute:{destination:'home'},setup:{state:'loading'},retryRestoration:()=>{}}};});
 await page.addScriptTag({path:path.join(out,'bundle.js')});await page.getByTestId('navigator').waitFor({state:'attached'});
 assert.equal(await page.getByTestId('overlay').textContent(),'false');
 const renders=await page.evaluate(()=>window.fx.navigatorRenders);
 for(const route of ['/services','/maps','/health','/reports','/emergency-centers','/home']){
  await page.evaluate(path=>{window.fx.path=path;window.render()},route);
  await page.waitForFunction(({route})=>document.querySelector('[data-testid="overlay"]').textContent===String(route==='/emergency-centers'),{route});
 }
 assert.equal(await page.evaluate(()=>window.fx.navigatorRenders),renders);
 await page.clock.runFor(3001);await page.waitForFunction(()=>document.querySelector('[data-testid="overlay"]').textContent==='true');
 assert.equal(await page.evaluate(()=>window.fx.navigatorRenders),renders);
 assert.equal(await page.locator('[data-screen="emergency-centers"]').count(),1);
 assert.equal(await page.locator('[data-screen="(app)"]').count(),1);
 assert.equal(await page.locator('[data-screen="(auth)"]').count(),1);
 await page.evaluate(()=>{window.fx.auth.isLoading=false;window.fx.auth.restorationError='Synthetic session restoration failure';window.fx.path='/settings';window.render()});
 await page.getByText('Synthetic session restoration failure').waitFor();
 assert.equal(await page.evaluate(()=>{const navigator=document.querySelector('[data-testid="navigator"]'),retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry session restoration');return !!(navigator.compareDocumentPosition(retry)&Node.DOCUMENT_POSITION_FOLLOWING)}),true);
 await page.evaluate(()=>{window.fx.path='/emergency-centers';window.render()});
 await page.getByText('Synthetic session restoration failure').waitFor({state:'detached'});
 assert.deepEqual(errors,[]);
 const result={passed:['root navigator remains mounted without renders on six pathname changes','public emergency bypasses restoration overlay','slow restoration lifts overlay after existing 3000ms timeout','guest app/auth and public emergency admission preserved','restoration error follows navigator for correct overlay stacking and is excluded on public emergency route'],errors,nativePerformanceVerified:false};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
