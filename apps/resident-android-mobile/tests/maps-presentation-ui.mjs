import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const app=path.resolve(import.meta.dirname,'..'), repo=path.resolve(app,'../..');
const require=createRequire(path.join(app,'package.json'));
const {build}=require('esbuild'), {chromium}=require('playwright');
const root=path.join(app,'src').replaceAll('\\','/'), shared=path.join(repo,'packages/shared/src').replaceAll('\\','/');
const out=process.env.TEST_ARTIFACTS_DIR??path.join(repo,'tmp/resident-android-magicpatterns-phase-8-20261019/ui');
fs.mkdirSync(out,{recursive:true});
// Real Maps + data hooks + native wrapper + bundled Leaflet. Browser/native/transport
// adapters are synthetic; this is supplementary evidence, never Android qualification.
const mocks={
 '@/global.css':'',
 'react-native':`import {Animated as A,Platform as P,View as V,Pressable as B,AppState as S} from 'react-native-web';import React,{useEffect} from 'react';export * from 'react-native-web';export const Platform={...P,OS:'android'};export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...p},r)=><V {...p} ref={r} aria-hidden={accessibilityElementsHidden}/>);export const Pressable=React.forwardRef(({accessibilityState:s,...p},r)=><B {...p} ref={r} aria-checked={s?.checked} aria-selected={s?.selected} aria-expanded={s?.expanded} aria-busy={s?.busy} aria-disabled={s?.disabled}/>);export const AppState={...S,addEventListener:(event,fn)=>{window.fixture.appListeners.add(fn);return{remove:()=>window.fixture.appListeners.delete(fn)}}};export const Animated={...A,timing:(v,o)=>{window.fixture.durations.push(o.duration);return A.timing(v,{...o,useNativeDriver:false})}};`,
 'react-native-webview':`import React,{useEffect,useImperativeHandle,useMemo,useRef} from 'react';import {View} from 'react-native';export const WebView=React.forwardRef(({source,onMessage,style},ref)=>{const frame=useRef(null);const receive=useRef(onMessage);receive.current=onMessage;const html=useMemo(()=>source.html.replace('<head>','<head><script>window.ReactNativeWebView={postMessage(data){parent.postMessage({mapMessage:data},"*")}};<'+ '/script>'),[source.html]);useImperativeHandle(ref,()=>({injectJavaScript:js=>frame.current?.contentWindow.eval(js)}));useEffect(()=>{const fn=e=>{if(e.source===frame.current?.contentWindow&&e.data?.mapMessage){window.fixture.messages.push(JSON.parse(e.data.mapMessage));receive.current({nativeEvent:{data:e.data.mapMessage}})}};window.addEventListener('message',fn);return()=>window.removeEventListener('message',fn)},[]);return <View style={style}><iframe title="Synthetic native WebView" ref={frame} srcDoc={html} style={{border:0,position:'absolute',width:'100%',height:'100%'}}/></View>});`,
 'react-native-safe-area-context':`import React from 'react';import {View} from 'react-native';export const useSafeAreaInsets=()=>({top:0,bottom:window.fixture.systemBottom??0,left:0,right:0});export const SafeAreaView=({edges,...p})=><View {...p}/>;`,
 'react-native-reanimated':`import {View,Easing} from 'react-native';import {useRef} from 'react';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=f=>f();export const withTiming=v=>v;export const withSpring=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
 '@expo/vector-icons':`import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={'alert-circle-outline':1};`,
 '@barangayan/shared':`export * from '${shared}/lib/point-in-polygon.ts';export * from '${shared}/lib/haversine.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';`,
 '@react-native-async-storage/async-storage':`export default{getItem:async k=>window.fixture.storage[k]??null,setItem:async(k,v)=>{window.fixture.storage[k]=v},removeItem:async k=>{delete window.fixture.storage[k]}};`,
 'expo-location':`export const getForegroundPermissionsAsync=async()=>({status:window.fixture.permission});export const requestForegroundPermissionsAsync=async()=>{window.fixture.permissionCalls++;return{status:window.fixture.permission}};export const getCurrentPositionAsync=async()=>{window.fixture.gpsCalls++;if(window.fixture.gpsError)throw Error('Synthetic GPS failure');return{coords:{latitude:14.68,longitude:121.12,accuracy:15}}};`,
 'expo-router':`import {useEffect} from 'react';export const useFocusEffect=fn=>useEffect(fn,[fn]);`,
 '@/hooks/use-theme':`import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
 '@/hooks/use-theme-preference':`export const useThemePreference=()=>({scheme:window.fixture.mode});`,
 '@/hooks/use-font-preference':`export const useFontPreference=()=>({fontId:window.fixture.font});`,
 '@/hooks/use-floating-tab-layout':`import React,{createContext,useContext,useState} from 'react';const Context=createContext(null);export function FloatingTabLayoutProvider({children}){const[hidden,setHidden]=useState(false);window.fixture.navHidden=hidden;return <Context.Provider value={{mapNavHidden:hidden,setMapNavHidden:setHidden,mapNavProgress:{value:Number(hidden)}}}>{children}</Context.Provider>}export const useFloatingTabLayout=()=>useContext(Context);`,
 '@/hooks/use-floating-tab-inset':`import{useFloatingTabLayout}from'@/hooks/use-floating-tab-layout';export const useFloatingTabInset=(ignoreMapHide=false)=>{const{mapNavHidden}=useFloatingTabLayout();return !ignoreMapHide&&mapNavHidden?0:window.fixture.inset};`,
 '@/hooks/use-resident-reduced-motion':`export const useResidentReducedMotion=()=>window.fixture.reduced;`,
 '@/hooks/use-profile':`export const useProfile=()=>({profile:window.fixture.profile});`,
 '@/lib/supabase':`export const supabase={from(table){const filters={};const q={select(){return q},is(){return q},order(){return q},eq(k,v){filters[k]=v;return q},in(k,v){filters[k]=v;return q},ilike(k,v){filters[k]=v;return q},then(resolve,reject){window.fixture.queries.push({table,filters});let rows=window.fixture[table]??[];if(table==='incidents'){if(filters.category_id)rows=rows.filter(r=>filters.category_id.includes(r.category_id));if(filters.title)rows=rows.filter(r=>r.title.toLowerCase().includes(filters.title.replaceAll('%','').toLowerCase()))}return Promise.resolve({data:rows,error:window.fixture.failTable===table?{message:'Synthetic source unavailable'}:null}).then(resolve,reject)}};return q},channel(name){const ch={name,on(){return ch},subscribe(){window.fixture.channels.push(name);return ch}};return ch},removeChannel(ch){window.fixture.channels=window.fixture.channels.filter(n=>n!==ch.name);return Promise.resolve()}};`,
};
mocks['react-native']+=`export const Keyboard={metrics:()=>window.fixture.keyboardFrame,addListener:(event,fn)=>{const listeners=(window.fixture.keyboardListeners??={})[event]??=new Set();listeners.add(fn);return{remove:()=>listeners.delete(fn)}}};`;
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{FloatingTabLayoutProvider}from'@/hooks/use-floating-tab-layout';import Maps from '${root}/app/(app)/maps/index.tsx';import{MapView}from'${root}/components/map-view.tsx';let generation=0;const root=createRoot(document.getElementById('root'));window.render=(remount=false)=>{if(remount)generation++;root.render(window.fixture.wrapper?<MapView key={generation} {...window.fixture.wrapper} onMarkerTap={id=>window.fixture.callbacks.push(['marker',id])} onMapTap={window.fixture.routing?pos=>window.fixture.callbacks.push(['route',pos]):null} onBackgroundTap={()=>window.fixture.callbacks.push(['background'])} onPickerMoved={pos=>window.fixture.callbacks.push(['picker',pos])} onPickerRejected={pos=>window.fixture.callbacks.push(['rejected',pos])}/>:<FloatingTabLayoutProvider><Maps key={generation}/></FloatingTabLayoutProvider>)};window.render();`,resolveDir:app,loader:'tsx'},bundle:true,define:{global:'globalThis'},format:'iife',platform:'browser',outfile:path.join(out,'bundle.js'),jsx:'automatic',plugins:[{name:'adapters',setup(b){b.onResolve({filter:/.*/},a=>{if(Object.hasOwn(mocks,a.path))return{path:a.path,namespace:'adapter'};if(a.path.startsWith('@/'))return{path:path.join(app,'src',a.path.slice(2))+ (fs.existsSync(path.join(app,'src',a.path.slice(2))+'.tsx')?'.tsx':'.ts')}});b.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:app}))}}]});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'});const page=await browser.newPage({viewport:{width:400,height:760}});const diagnostics=[];const passed=[];
page.on('pageerror',e=>diagnostics.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))diagnostics.push(m.text())});
await page.route('**/*tile.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMZkAAAAASUVORK5CYII=','base64')}));
try{
 await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}#root{width:100%}</style></head><body><div id="root"></div></body></html>');
 await page.evaluate(()=>{const boundary={type:'Polygon',coordinates:[[[121.11,14.67],[121.13,14.67],[121.13,14.69],[121.11,14.69],[121.11,14.67]]]};window.fixture={mode:'light',accent:'#0F6E5B',font:'system',inset:80,reduced:false,permission:'denied',permissionCalls:0,gpsCalls:0,gpsError:false,appListeners:new Set(),profile:{barangay_id:'synthetic',barangays:{boundary}},incident_categories:[{id:'c1',name:'Synthetic flooding',color:'#ffcc00',icon:'alert-circle-outline'},{id:'c2',name:'Synthetic road issue',color:'#3344ee',icon:null}],incidents:[{id:'i1',title:'Synthetic first incident',category_id:'c1',location:{lat:14.678,lng:121.118},created_at:'2026-10-19T01:00:00Z'},{id:'i2',title:'Synthetic second incident',category_id:'c2',location:{lat:14.6783,lng:121.1183},created_at:'2026-10-19T02:00:00Z'}],evacuation_centers:[{id:'e1',name:'Synthetic center',position:{lat:14.677,lng:121.122},address:'Synthetic center address'}],queries:[],channels:[],messages:[],durations:[],callbacks:[],storage:{}}});
 await page.addScriptTag({path:path.join(out,'bundle.js')});
 const render=async(values,remount=false)=>{const ready=await page.evaluate(()=>window.fixture.messages.filter(m=>m.type==='MAP_READY').length);await page.evaluate(({values,remount})=>{Object.assign(window.fixture,values);window.render(remount)},{values,remount});if(remount)await page.waitForFunction(n=>window.fixture.messages.filter(m=>m.type==='MAP_READY').length>n,ready)};
 const frame=()=>page.frames().find(f=>f.parentFrame());
 await page.getByRole('button',{name:'Setup Later',exact:true}).click();
 await page.waitForFunction(()=>window.fixture.messages.some(m=>m.type==='MAP_READY'));
 await frame().locator('[title="Synthetic first incident"]').waitFor();
 assert.equal(await page.evaluate(()=>window.fixture.navHidden),true);
 const hiddenReveal=await page.getByRole('button',{name:'Show bottom tabs',exact:true}).boundingBox();
 assert(Math.abs(page.viewportSize().height-hiddenReveal.y-hiddenReveal.height-12)<=1);
 const hiddenControls=await page.getByRole('button',{name:'Zoom in',exact:true}).boundingBox();
 await page.getByRole('button',{name:'Show bottom tabs',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.fixture.navHidden),false);
 const visibleControls=await page.getByRole('button',{name:'Zoom in',exact:true}).boundingBox();
 assert(visibleControls.y<hiddenControls.y);
 await page.getByRole('button',{name:'Hide bottom tabs',exact:true}).click();
 for(const systemBottom of [0,24,48]){
  await render({systemBottom,inset:80+systemBottom});
  const reveal=await page.getByRole('button',{name:'Show bottom tabs',exact:true}).boundingBox();
  assert(Math.abs(page.viewportSize().height-reveal.y-reveal.height-systemBottom-12)<=1);
  for(const label of ['Show bottom tabs','Hide bottom tabs']){
   const chevron=await page.getByRole('button',{name:label,exact:true}).boundingBox();
   const zoom=await page.getByRole('button',{name:'Zoom in',exact:true}).boundingBox();
   assert(zoom.y+zoom.height+12<=chevron.y,'map controls stay above the chevron');
   await page.getByRole('button',{name:label,exact:true}).click();
  }
 }
 await render({systemBottom:0,inset:80});
 passed.push('0/24/48dp system navigation insets: chevron clears navigation by 12dp; map controls stay clear with tabs hidden and visible');
 await page.getByRole('button',{name:'Show bottom tabs',exact:true}).click();
 await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(14.68,121.12)}));
 await page.getByRole('button',{name:'Show bottom tabs',exact:true}).waitFor();
 passed.push('Maps hides tabs on entry; chevron reveals/hides tabs and moves controls; background tap hides tabs again');
 assert.equal(await page.evaluate(()=>window.fixture.channels.length),1);
 const initialZoom=await frame().evaluate(()=>map.getZoom());await page.getByRole('button',{name:'Zoom in',exact:true}).click();await frame().waitForFunction(z=>map.getZoom()===z+1,initialZoom);
 const zoom=await frame().evaluate(()=>map.getZoom());await page.getByRole('button',{name:'Zoom out',exact:true}).click();await frame().waitForFunction(z=>map.getZoom()===z-1,zoom);
 await frame().locator('[title="Synthetic first incident"]').click();await page.getByRole('button',{name:'Close selected location'}).waitFor();
 await frame().waitForFunction(()=>map.getZoom()===17);assert.equal(await frame().locator('[title="Synthetic first incident"]').evaluate(e=>e.style.width),'40px');
 await frame().locator('[title="Synthetic second incident"]').click();await page.getByText('Synthetic second incident',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close selected location'}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.fixture.messages.filter(m=>m.type==='MAP_TAPPED'||m.type==='PICKER_MOVED').length),0);
 passed.push('actual Leaflet zoom/selected pin/500ms target and latest card; no picker/routing event from selection or close');
 for(let i=0;i<5;i++){await frame().locator('[title="Synthetic first incident"]').click();await page.getByRole('button',{name:'Close selected location'}).waitFor();await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(14.68,121.12)}));await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor()}
 passed.push('five marker/background-dismiss cycles return operable controls');
 await frame().evaluate(()=>{markerEntries[0].marker.fire('click');markerEntries[1].marker.fire('click')});
 await page.getByText('Synthetic second incident',{exact:true}).waitFor();assert.equal(await page.getByText('Synthetic first incident',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Close selected location'}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
 const rapidZoom=await frame().evaluate(()=>map.getZoom());
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Zoom out',exact:true}).dispatchEvent('click');
 await frame().waitForFunction(z=>map.getZoom()===Math.max(0,z-5),rapidZoom);
 passed.push('rapid selection keeps only latest card; five rapid zoom taps retain cumulative target');
 await page.getByRole('checkbox',{name:'Synthetic flooding filter'}).click();await page.getByRole('checkbox',{name:'Synthetic road issue filter'}).click();
 assert.equal(await page.getByRole('checkbox',{checked:true}).count(),2);
 await page.getByRole('button',{name:'Incident filters'}).click();await page.getByRole('checkbox').first().waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Incident filters'}).click();assert.equal(await page.getByRole('checkbox',{checked:true}).count(),2);
 await page.getByRole('textbox',{name:'Search incidents'}).fill('first');await frame().locator('[title="Synthetic second incident"]').waitFor({state:'hidden'});
 const queries=await page.evaluate(()=>window.fixture.queries);assert.deepEqual(queries.filter(q=>q.table==='incidents').at(-1).filters.category_id,['c1','c2']);
 await page.getByRole('tab',{name:'Evacuation',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Evacuation search unavailable'}).isEditable(),false);
 assert.equal(await page.evaluate(()=>window.fixture.navHidden),true);
 await page.getByRole('button',{name:'Show bottom tabs',exact:true}).click();
 await page.getByRole('button',{name:'Reset map to barangay boundary'}).click();await frame().waitForFunction(()=>map.getZoom()<17);
 await frame().locator('[title="Synthetic center"]').click();await page.getByText('Synthetic center address',{exact:true}).waitFor();await page.getByRole('button',{name:'Close selected location'}).click();
 await page.getByRole('button',{name:'Show bottom tabs',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Incidents',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Search incidents'}).inputValue(),'first');
 passed.push('multi-select/filter visibility retains predicates; incident search preserved through layer switch; truthful unavailable center search');
 const search=page.getByRole('textbox',{name:'Search incidents'});
 const originalSearch=await search.boundingBox();
 await page.evaluate(screenY=>{window.fixture.keyboardFrame={screenY};for(const fn of window.fixture.keyboardListeners.keyboardDidShow)fn()},originalSearch.y+originalSearch.height+100);
 await page.waitForTimeout(100);
 assert.equal(await page.getByRole('tab',{name:'Incidents',exact:true}).count(),1,'visible search retains layers');
 await page.evaluate(screenY=>{window.fixture.keyboardFrame={screenY};for(const fn of window.fixture.keyboardListeners.keyboardDidShow)fn()},originalSearch.y+originalSearch.height-16);
 await page.getByRole('tab',{name:'Incidents',exact:true}).waitFor({state:'detached'});
 const revealedSearch=await search.boundingBox();assert(revealedSearch.height>=originalSearch.height-1&&revealedSearch.y+revealedSearch.height<=originalSearch.y+originalSearch.height-24,'complete search clears measured keyboard');
 await page.evaluate(()=>{window.fixture.keyboardFrame=undefined;for(const fn of window.fixture.keyboardListeners.keyboardDidHide)fn()});
 await page.getByRole('tab',{name:'Incidents',exact:true}).waitFor();
 assert(Math.abs((await search.boundingBox()).y-originalSearch.y)<=1,'dismissal restores search geometry');
 assert.equal(await search.inputValue(),'first','draft survives measured avoidance');
 passed.push('measured keyboard obstruction releases layer row only when needed; full editor and draft retained; dismissal restores layers and geometry');
 await render({mode:'dark',accent:'#ffffff',font:'georgia'});await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
 const before=await frame().evaluate(()=>({center:map.getCenter(),zoom:map.getZoom()}));const count=await page.evaluate(()=>window.fixture.queries.length);
 await render({accent:'#000000',inset:100});await page.waitForTimeout(300);
 assert.deepEqual(await frame().evaluate(()=>({center:map.getCenter(),zoom:map.getZoom()})),before);assert.equal(await page.evaluate(()=>window.fixture.queries.length),count);
 const attr=await frame().locator('.leaflet-control-attribution').boundingBox();const controls=await page.getByRole('button',{name:'Zoom in',exact:true}).boundingBox();assert(attr.y>=controls.y+controls.height);
 for(const width of [320,360,400,412]){await page.setViewportSize({width,height:640});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 await page.screenshot({path:path.join(out,'maps-dark.png')});passed.push('dark/extreme accents/selected serif/320–412px; measured attribution, no theme/layout refit or query fan-out');
 await render({permission:'granted',gpsError:true});await page.getByRole('button',{name:'Center map on your location'}).click();await page.getByText(/Unable to get your location/).waitFor();
 const locationMessage='Unable to get your location. Try You again, or browse the map.';
 for(const values of [{mode:'dark',accent:'#ffffff',font:'georgia'},{mode:'light',accent:'#6d28d9',font:'system'}]){
  await render(values);
  for(const width of [320,412]){
   await page.setViewportSize({width,height:640});
   const dismiss=page.getByRole('button',{name:'Dismiss location message',exact:true});
   const notice=await dismiss.locator('..').boundingBox(),target=await dismiss.boundingBox();
   assert(notice.height<=90,`compact full location notice at ${width}px: ${notice.height}`);
   assert(target.width>=44&&target.height>=44);
   assert.equal(await page.getByText(locationMessage,{exact:true}).count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.screenshot({path:path.join(out,`maps-notice-${values.mode}.png`)});
 }
 await page.getByRole('button',{name:'Dismiss location message',exact:true}).click();
 await page.getByText(locationMessage,{exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Center map on your location'}).click();await page.getByText(locationMessage,{exact:true}).waitFor();
 const gpsBeforeRetry=await page.evaluate(()=>window.fixture.gpsCalls);
 passed.push('full location message fits a compact inline notice at 320/412px in light/dark with custom accents/fonts; 44px dismiss target; dismiss and reopen work');
 await render({gpsError:false});await page.getByRole('button',{name:'Center map on your location'}).click();await frame().waitForFunction(()=>userLayer.getLayers().length===3);assert.equal(await page.evaluate(()=>window.fixture.gpsCalls),gpsBeforeRetry+1);
 await page.evaluate(()=>{for(const fn of window.fixture.appListeners)fn('background');for(const fn of window.fixture.appListeners)fn('active')});
 await page.getByRole('button',{name:'Hide bottom tabs',exact:true}).waitFor();
 passed.push('GPS failure visible, explicit retry/user dot/accuracy circle, foreground permission recheck');
 await page.getByRole('textbox',{name:'Search incidents'}).fill('missing');await page.getByText('No incidents reported in this area',{exact:true}).waitFor();
 await render({failTable:'incidents'});await page.getByRole('textbox',{name:'Search incidents'}).fill('missing again');await page.getByText('Synthetic source unavailable',{exact:true}).waitFor();await render({failTable:null});await page.getByRole('button',{name:'Retry locations'}).click();await page.getByText('Synthetic source unavailable',{exact:true}).waitFor({state:'hidden'});
 passed.push('empty and source-error/retry remain visible and operable');
 await render({reduced:true});await page.waitForTimeout(120);const durationStart=await page.evaluate(()=>window.fixture.durations.length);
 await page.getByRole('textbox',{name:'Search incidents'}).fill('first');await frame().waitForFunction(()=>markerEntries.some(e=>e.id==='i1'));
 await frame().evaluate(()=>markerEntries.find(e=>e.id==='i1').marker.fire('click'));await page.getByRole('button',{name:'Close selected location'}).waitFor();
 await page.getByRole('button',{name:'Close selected location'}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
 assert.equal(await page.evaluate(n=>window.fixture.durations.slice(n).every(d=>d<=100),durationStart),true);
 await render({permission:'denied'},true);await page.getByRole('button',{name:'Set Location',exact:true}).waitFor();
 await page.getByRole('button',{name:'Set Location',exact:true}).waitFor({state:'hidden',timeout:12000});
 const settledQueries=await page.evaluate(()=>window.fixture.queries.length);
 await page.evaluate(()=>{for(let i=0;i<2;i++){for(const fn of window.fixture.appListeners)fn('background');for(const fn of window.fixture.appListeners)fn('active')}});
 assert.equal(await page.evaluate(()=>window.fixture.channels.length),1);assert.equal(await page.evaluate(()=>window.fixture.appListeners.size),1);assert.equal(await page.evaluate(()=>window.fixture.queries.length),settledQueries);
 passed.push('reduced overlay durations <=100ms; permission tooltip unmounts after fade; two foreground cycles keep one channel/listener without extra queries');
 // Regression harness uses the actual wrapper, including legacy default presentation.
 const boundary=await page.evaluate(()=>window.fixture.profile.barangays.boundary);
 const legacyWrapper={markers:[{id:'legacy',kind:'incident',position:{lat:14.68,lng:121.12},label:'<img src=x onerror=alert(1)>'}],kindColors:{incident:'#123456'},boundary,picker:{enabled:true,position:{lat:14.68,lng:121.12}}};
 await render({wrapper:legacyWrapper},true);
 await frame().waitForFunction(()=>typeof map!=='undefined'&&map!==null&&pickerEnabled);
 await frame().evaluate(()=>{window.retainedMarker=markerEntries[0].marker;window.retainedBoundary=boundaryLayer.getLayers()[0];map.setView([14.681,121.121],17,{animate:false})});
 const retainedView=await frame().evaluate(()=>({center:map.getCenter(),zoom:map.getZoom()}));
 for(let i=0;i<10;i++)await render({wrapper:legacyWrapper});
 assert.equal(await frame().evaluate(()=>markerEntries[0].marker===window.retainedMarker&&boundaryLayer.getLayers()[0]===window.retainedBoundary),true);
 assert.deepEqual(await frame().evaluate(()=>({center:map.getCenter(),zoom:map.getZoom()})),retainedView);
 await render({wrapper:{...legacyWrapper,kindColors:{}}});
 await frame().waitForFunction(()=>!Object.hasOwn(kindColors,'incident'));
 passed.push('ten equal-content wrapper updates retain actual Leaflet marker/boundary identities and panned viewport; removed color hints clear');
 await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(14.681,121.121)}));await page.waitForFunction(()=>window.fixture.callbacks.some(c=>c[0]==='picker'));
 await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(0,0)}));await page.waitForFunction(()=>window.fixture.callbacks.some(c=>c[0]==='rejected'));
 assert.deepEqual(await frame().evaluate(()=>{const p=pickerMarker.getLatLng();return[p.lat,p.lng]}),[14.681,121.121]);
 await render({routing:true},false);await page.waitForTimeout(100);await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(14.682,121.122)}));await page.waitForFunction(()=>window.fixture.callbacks.some(c=>c[0]==='route'));
 assert.equal(await page.evaluate(()=>window.fixture.callbacks.filter(c=>c[0]==='background').length),0);
 assert.equal(await frame().locator('.leaflet-control-zoom').count(),1);passed.push('legacy picker accepts/rejects/snaps correctly; routing priority; no background event; default zoom controls retained');
 await render({routing:false,wrapper:{markers:[],showTiles:false,packMap:{type:'FeatureCollection',features:[{type:'Feature',properties:{layer:'road',kind:'residential',walkable:true},geometry:{type:'LineString',coordinates:[[121.11,14.67],[121.12,14.68]]}}]},roadMarks:{closures:[[[121.11,14.67],[121.12,14.68]]],avoided:[],selected:null},route:[{lat:14.67,lng:121.11},{lat:14.68,lng:121.12}],routePadding:{top:100,bottom:100}}},true);
 await frame().waitForFunction(()=>typeof map!=='undefined'&&map!==null&&basemapLayer.getLayers().length===1&&routeLayer.getLayers().length===1);
 assert.equal(await frame().evaluate(()=>map.hasLayer(tileLayer)),false);assert.equal(await frame().evaluate(()=>roadMarksLayer.getLayers().length),1);
 passed.push('offline vector basemap/route/closures render without tiles; shared/public default path preserved');
 await render({wrapper:{markers:[]}},true);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.fixture.channels.length),0);assert.equal(await page.evaluate(()=>window.fixture.appListeners.size),0);
 const baselineWarnings=['props.pointerEvents is deprecated. Use style.pointerEvents','"shadow*" style props are deprecated. Use "boxShadow"'];const unexpected=diagnostics.filter(m=>!baselineWarnings.some(w=>m.includes(w)));assert.deepEqual(unexpected,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,diagnostics,unexpected},null,2));console.log(JSON.stringify({passed,diagnostics,unexpected}));
}catch(error){await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed,diagnostics},null,2));throw error}finally{await browser.close()}
