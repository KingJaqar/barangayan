import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const app=path.resolve(import.meta.dirname,'..'), repo=path.resolve(app,'../..');
const require=createRequire(path.join(app,'package.json'));
const {build}=require('esbuild'), {chromium}=require('playwright');
const root=path.join(app,'src').replaceAll('\\','/'), shared=path.join(repo,'packages/shared/src').replaceAll('\\','/');
const out=process.env.TEST_ARTIFACTS_DIR??path.join(repo,'tmp/resident-android-magicpatterns-phase-10-20261020/ui');
fs.mkdirSync(out,{recursive:true});
// Real Centers, shell, native wrapper and bundled Leaflet. Location/routing/native
// adapters are synthetic; this is supplementary evidence, never Android qualification.
const mocks={
 '@/global.css':'',
 '@/components/drrm-tab-icon':`export const DrrmTabIcon=()=>null;`,
 '@/hooks/use-unread-counts':`export const useUnreadCounts=()=>({activeReportsCount:1,resolvedUnreadCount:1});`,
 '@/components/home-tab-icon':`export const HomeTabIcon=()=>null;`,
 '@/components/services-tab-icon':`export const ServicesTabIcon=()=>null;`,
 '@/hooks/use-ampid1-boundary':`export const useAmpid1Boundary=()=>window.fixture.boundary;`,
 '@react-native-community/netinfo':`export const useNetInfo=()=>({isInternetReachable:false});`,
 '@/hooks/use-offline-routing':`export const useOfflineRouting=active=>{window.fixture.offlineActive=active;return{state:window.fixture.routingState,markSegment:async id=>{window.fixture.actions.push(['mark',id]);return{ok:true}},unmarkSegment:async id=>{window.fixture.actions.push(['remove',id])}}};`,
 '@/hooks/use-resident-route':`export const useResidentRoute=options=>{window.fixture.routeOptions=options;return{route:window.fixture.route,mode:'local',connectedFailure:window.fixture.connectedFailure,connectedPending:false,ranking:window.fixture.ranking}};`,
 '@/lib/offline-routing':`export const nearestEdge=()=>window.fixture.edge;`,

 'react-native':`import {Animated as A,Platform as P,View as V,Pressable as B,AppState as S} from 'react-native-web';import React,{useEffect} from 'react';export * from 'react-native-web';export const Platform={...P,OS:'android',select:options=>options.android??options.default};export const View=React.forwardRef(({accessibilityElementsHidden,importantForAccessibility,...p},r)=><V {...p} ref={r} aria-hidden={accessibilityElementsHidden}/>);export const Pressable=React.forwardRef(({accessibilityState:s,...p},r)=><B {...p} ref={r} aria-checked={s?.checked} aria-selected={s?.selected} aria-expanded={s?.expanded} aria-busy={s?.busy} aria-disabled={s?.disabled}/>);export const AppState={...S,addEventListener:(event,fn)=>{window.fixture.appListeners.add(fn);return{remove:()=>window.fixture.appListeners.delete(fn)}}};export const Animated={...A,timing:(v,o)=>{window.fixture.durations.push(o.duration);return A.timing(v,{...o,useNativeDriver:false})}};`,
 'react-native-webview':`import React,{useEffect,useImperativeHandle,useMemo,useRef} from 'react';import {View} from 'react-native';export const WebView=React.forwardRef(({source,onMessage,style},ref)=>{const frame=useRef(null);const receive=useRef(onMessage);receive.current=onMessage;const html=useMemo(()=>source.html.replace('<head>','<head><script>window.ReactNativeWebView={postMessage(data){parent.postMessage({mapMessage:data},"*")}};<'+ '/script>'),[source.html]);useImperativeHandle(ref,()=>({injectJavaScript:js=>frame.current?.contentWindow.eval(js)}));useEffect(()=>{const fn=e=>{if(e.source===frame.current?.contentWindow&&e.data?.mapMessage){window.fixture.messages.push(JSON.parse(e.data.mapMessage));receive.current({nativeEvent:{data:e.data.mapMessage}})}};window.addEventListener('message',fn);return()=>window.removeEventListener('message',fn)},[]);return <View style={style}><iframe title="Synthetic native WebView" ref={frame} srcDoc={html} style={{border:0,position:'absolute',width:'100%',height:'100%'}}/></View>});`,
 'react-native-safe-area-context':`export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});import React from 'react';import {View} from 'react-native';export const SafeAreaView=({edges,...p})=><View {...p}/>;`,
 // Shared values notify subscribers; timings are recorded, not native frame measurements.
 'react-native-reanimated':`import {View,Text,Easing} from 'react-native';import {useRef,useEffect,useReducer} from 'react';export default {View,Text};export const useSharedValue=v=>{const r=useRef(null);if(!r.current){let value=v;r.current={get value(){return value},set value(next){if(value===next)return;value=next;window.dispatchEvent(new Event('synthetic-animation'))}}}return r.current};export const useAnimatedStyle=f=>{const[,render]=useReducer(v=>v+1,0);useEffect(()=>{const fn=()=>render();window.addEventListener('synthetic-animation',fn);return()=>window.removeEventListener('synthetic-animation',fn)},[]);return f()};export const withTiming=(v,options)=>{window.fixture.durations.push(options?.duration);return v};export const withSpring=v=>v;export const cancelAnimation=()=>{};export const interpolateColor=(value,range,colors)=>colors[value>=0.5?1:0];export {Easing};`,
 '@expo/vector-icons':`import React from 'react';import {View} from 'react-native';export const Ionicons=({size})=><View style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={'alert-circle-outline':1};`,
 '@barangayan/shared':`export * from '${shared}/lib/point-in-polygon.ts';export * from '${shared}/lib/haversine.ts';export * from '${shared}/lib/device-location.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';`,
 'expo-router':`import React,{useEffect} from 'react';export const usePathname=()=>window.fixture.pathname;export const useIsFocused=()=>window.fixture.focused;export const useFocusEffect=fn=>useEffect(()=>window.fixture.focused?fn():undefined,[fn,window.fixture.focused]);export const Tabs=({tabBar})=>tabBar({state:{index:2,routes:['home','services','drrm','maps','health','reports'].map(name=>({name,key:name}))},navigation:{emit:()=>({defaultPrevented:false}),navigate:()=>{}}});Tabs.Screen=()=>null;`,
 '@/hooks/use-theme':`import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
 '@/hooks/use-theme-preference':`export const useThemePreference=()=>({scheme:window.fixture.mode});`,
 '@/hooks/use-font-preference':`export const useFontPreference=()=>({fontId:window.fixture.font});`,
 '@/hooks/use-resident-reduced-motion':`export const useResidentReducedMotion=()=>window.fixture.reduced;`,
};
await build({stdin:{contents:`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{CentersContent}from'${root}/components/evacuation-centers-panel.tsx';import ResidentTabs from'${root}/components/app-tabs.tsx';import{FloatingTabLayoutProvider,useFloatingTabLayout}from'${root}/hooks/use-floating-tab-layout.tsx';import{useTheme}from'${root}/hooks/use-theme.ts';let generation=0;const root=createRoot(document.getElementById('root'));function Harness(){const[view,setView]=useState('list');const[nearest,setNearest]=useState(true);const theme=useTheme();const layout=useFloatingTabLayout();window.fixture.navHidden=layout.mapNavHidden;return <><div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,padding:'16px 24px',backgroundColor:theme.background}}><CentersContent resident={!window.fixture.public} theme={theme} centers={window.fixture.centers} isLoading={window.fixture.loading} error={window.fixture.error} refetch={()=>window.fixture.actions.push(['retry'])} view={view} onViewChange={setView} nearestFirst={nearest} onNearestToggle={setNearest} userPosition={window.fixture.location.origin} location={{state:window.fixture.location,locate:()=>window.fixture.actions.push(['locate']),cancel:()=>window.fixture.actions.push(['cancel']),confirm:()=>window.fixture.actions.push(['confirm']),reject:()=>window.fixture.actions.push(['reject']),openSettings:()=>window.fixture.actions.push(['settings'])}}/></div>{window.fixture.public?null:<ResidentTabs/>}</>};window.render=(remount=false)=>{if(remount)generation++;root.render(window.fixture.public?<Harness key={generation}/>:<FloatingTabLayoutProvider key={generation}><Harness/></FloatingTabLayoutProvider>)};window.render();`,resolveDir:app,loader:'tsx'},bundle:true,define:{global:'globalThis'},format:'iife',platform:'browser',outfile:path.join(out,'bundle.js'),jsx:'automatic',plugins:[{name:'adapters',setup(b){b.onResolve({filter:/.*/},a=>{if(Object.hasOwn(mocks,a.path))return{path:a.path,namespace:'adapter'};if(a.path.startsWith('@/'))return{path:path.join(app,'src',a.path.slice(2))+(fs.existsSync(path.join(app,'src',a.path.slice(2))+'.tsx')?'.tsx':'.ts')}});b.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:app}))}}]});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'});
const page=await browser.newPage({viewport:{width:400,height:844}}),diagnostics=[],passed=[];
page.on('pageerror',e=>diagnostics.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))diagnostics.push(m.text())});
try{
 await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}#root{width:100%}</style></head><body><div id="root"></div></body></html>');
 await page.evaluate(()=>{
 const centers=[{id:'e1',name:'Synthetic unknown-capacity center',address:'Synthetic complete address',position:{lat:14.678,lng:121.118},current_occupancy:0,capacity:null,facilities:['medical','custom_facility'],verified:true},{id:'e2',name:'Synthetic full center',address:'Another address',position:{lat:14.679,lng:121.119},current_occupancy:100,capacity:100,facilities:[],verified:false}];
 const boundary={type:'Polygon',coordinates:[[[121.11,14.67],[121.13,14.67],[121.13,14.69],[121.11,14.69],[121.11,14.67]]]};
 window.fixture={mode:'light',accent:'#0F6E5B',font:'system',reduced:false,pathname:'/drrm',focused:true,public:false,loading:false,error:null,centers,boundary,location:{status:'idle',activeRequestId:null,slow:false,pending:null,origin:null,canAskAgain:true,approximate:false,unavailableReason:null},route:{status:'idle'},ranking:null,connectedFailure:null,routingState:{phase:'ready',pack:null,conditions:null,avoidance:[],unresolvedAvoidanceIds:[],avoidanceUnreadable:false,conditionsFailures:0,conditionsCheckedAt:null,pendingUpdate:null},messages:[],durations:[],actions:[],appListeners:new Set(),storage:{}};
 });
 await page.addScriptTag({path:path.join(out,'bundle.js')});
 const viewToggle=page.getByRole('tab',{name:'List',exact:true});
 await viewToggle.waitFor();
 const toggleBounds=await viewToggle.boundingBox();
 const nearestBounds=await page.getByRole('button',{name:'Sorted by nearest. Change sort'}).boundingBox();
 assert.ok(toggleBounds.width<=84&&toggleBounds.height>=44,'compact toggle retains a 44px target');
 assert.ok(nearestBounds.height>=44&&nearestBounds.width<130,'compact Nearest action');
 const render=async(values,remount=false)=>{await page.evaluate(({values,remount})=>{Object.assign(window.fixture,values);window.render(remount)},{values,remount});};
 const frame=()=>page.frames().find(f=>f.parentFrame());
 await page.getByText('Capacity unknown',{exact:true}).waitFor();assert.equal(await page.getByText('0%').count(),0);await page.getByText('custom facility',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Sorted by nearest. Change sort'}).click();await page.getByRole('button',{name:'Default order. Change sort'}).waitFor();
 passed.push('grouped real center rows; unknown/full occupancy; managed extra facility; existing sort semantics');
 await page.getByRole('button',{name:'Hide routing status'}).click();await page.getByText('The offline map could not be loaded on this phone. Routes are unavailable.',{exact:true}).waitFor();await page.getByRole('button',{name:'Show full routing status'}).click();
 await page.getByRole('button',{name:'View Synthetic unknown-capacity center on map'}).click();await page.getByRole('button',{name:'Close center details'}).waitFor();await page.getByRole('button',{name:'Show bottom tabs'}).waitFor();assert.equal(await page.getByRole('tab',{name:'Home',exact:true}).count(),0);
 await page.waitForFunction(()=>window.fixture.messages.some(m=>m.type==='MAP_READY'));
 await page.getByRole('button',{name:'Show bottom tabs'}).click();await page.getByRole('tab',{name:'Home',exact:true}).waitFor();
 await page.getByRole('button',{name:'Hide bottom tabs'}).click();await page.getByRole('button',{name:'Show bottom tabs'}).waitFor();
 passed.push('row opens same selected route/map state; shared provider hides/reveals actual bar with accessibility exclusion');
 await page.getByRole('button',{name:'Close center details'}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
 const zoom=await frame().evaluate(()=>map.getZoom());await page.getByRole('button',{name:'Zoom in',exact:true}).click();await frame().waitForFunction(z=>map.getZoom()===z+1,zoom);
 for(let i=0;i<5;i++){await frame().evaluate(()=>markerLayer.getLayers().find(marker=>marker.options.title==='Synthetic full center').fire('click'));await page.getByRole('button',{name:'Close center details'}).waitFor();await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(14.68,121.12)}));await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor()}
 assert.equal(await page.evaluate(()=>window.fixture.messages.filter(m=>m.type==='MAP_TAPPED'||m.type==='PICKER_MOVED').length),0);
 passed.push('actual bundled Leaflet zoom/marker/background; five M07 cycles; no routing/picker dispatch from dismissals');
 await page.getByRole('textbox',{name:'Search evacuation centers'}).fill('missing');await page.getByText('No matching centers found.',{exact:true}).waitFor();await page.getByRole('button',{name:'Clear center search'}).click();
 await render({error:'Synthetic source unavailable'});await page.getByText('Synthetic source unavailable',{exact:true}).waitFor();await page.getByRole('button',{name:'Retry',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.fixture.actions.at(-1)),['retry']);await render({error:null});
 passed.push('empty/search/error and retry stay visible without suppressing routing diagnostics');
 await render({focused:false});await page.waitForFunction(()=>window.fixture.navHidden===false);assert.equal(await page.evaluate(()=>window.fixture.offlineActive),false);await render({focused:true});await page.waitForFunction(()=>window.fixture.navHidden===true);
 for(let i=0;i<2;i++){await page.evaluate(()=>{for(const fn of window.fixture.appListeners)fn('background')});await page.waitForFunction(()=>window.fixture.navHidden===false);await page.getByRole('button',{name:'Hide bottom tabs'}).click()}
 await page.getByRole('tab',{name:'List',exact:true}).click();await page.waitForFunction(()=>window.fixture.navHidden===false);await page.getByRole('tab',{name:'Home',exact:true}).waitFor();
 passed.push('blur/list reset, focus restoration, two background cycles; offline refresh visibility follows focus');
 await page.evaluate(()=>{window.fixture.location={...window.fixture.location,status:'confirmation-required',pending:{fix:{lat:14.678,lng:121.118,accuracyMeters:200,deviceTimestamp:Date.now(),receivedAt:Date.now(),source:'current'},concerns:['inaccurate']}};window.render()});
 await page.getByRole('button',{name:'Use this location',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.fixture.actions.at(-1)),['confirm']);await page.getByRole('button',{name:'Discard',exact:true}).waitFor();
 await page.evaluate(()=>{window.fixture.location={...window.fixture.location,status:'denied',pending:null,canAskAgain:false};window.render()});await page.getByRole('button',{name:'Open settings',exact:true}).waitFor();
 passed.push('actual location-status pending/poor accuracy confirmation, rejection and denied-permission recovery actions');
 await page.getByRole('tab',{name:'Map',exact:true}).click();
 await page.evaluate(()=>{
  const edge={id:'edge-1',from:'a',to:'b',geometry:[[121.118,14.678],[121.119,14.679]],lengthMeters:100,name:'Synthetic road',pedestrianAccess:'both',stairs:false,bridge:false,sourceRef:'synthetic'};
  window.fixture.edge=edge;
  window.fixture.location={...window.fixture.location,status:'ready',origin:{lat:14.678,lng:121.118,accuracyMeters:15,deviceTimestamp:Date.now(),source:'device-confirmed',fixSource:'current',revision:1}};
  window.fixture.routingState={...window.fixture.routingState,pack:{graph:{version:'synthetic',edges:[edge]},map:{type:'FeatureCollection',features:[]},manifest:{osmBaseTimestamp:null,attribution:'Synthetic attribution'}},conditions:{storedAt:new Date(Date.now()-3600000).toISOString(),snapshot:{closures:[]}},avoidance:[{id:'saved-road',name:'Saved synthetic road',createdAt:new Date().toISOString(),edges:[edge]}],unresolvedAvoidanceIds:['saved-road'],avoidanceUnreadable:true};
  window.fixture.route={status:'done',result:{status:'outside_coverage'}};window.fixture.connectedFailure={reason:'timeout'};window.render();
 });
 await page.getByText('You are outside the Ampid I route area. Walking routes are only available inside Ampid I.',{exact:true}).waitFor();
 await page.getByText('Your saved blocked roads could not be read and were set aside.',{exact:true}).waitFor();await page.getByText(/Offline: road closures and center status from/).waitFor();
 await page.getByRole('button',{name:'Block a road you cannot pass',exact:true}).click();
 await frame().evaluate(()=>map.fire('click',{latlng:L.latLng(14.678,121.118)}));await page.getByRole('button',{name:'Block road',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.fixture.actions.at(-1)),['mark','edge-1']);
 await page.getByRole('button',{name:'Remove',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.fixture.actions.at(-1)),['remove','saved-road']);
 await page.getByRole('button',{name:'Close road blocking',exact:true}).click();
 await page.evaluate(()=>{window.fixture.route={status:'done',result:{status:'attachment_ambiguous',candidates:[{edgeId:'edge-1',name:'Synthetic street choice',distanceMeters:12}]}};window.render()});
 await page.getByRole('button',{name:'Synthetic street choice',exact:false}).click();await page.waitForFunction(()=>window.fixture.routeOptions.originEdgeId==='edge-1');
 await page.evaluate(()=>{window.fixture.route={status:'done',result:{status:'no_route_within_coverage'}};window.render()});await page.getByText('No open walking route reaches this center. Closures or your blocked roads cut it off.',{exact:true}).waitFor();
 passed.push('all simultaneous stale/closure/blocked-road/service warnings survive collapse; real street-choice and mark/remove action dispatch; no-route text');
 await page.getByRole('tab',{name:'List',exact:true}).click();
 for(const width of [320,360,400,412]){await page.setViewportSize({width,height:640});await render({mode:'dark',accent:'#FFFFEE',font:'georgia',reduced:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 await page.screenshot({path:path.join(out,'centers-dark-list.png')});
 await render({public:true,mode:'light',accent:'#0F6E5B',font:'system',focused:true},true);await page.getByRole('tab',{name:'Map',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/bottom tabs/}).count(),0);assert.equal(await page.getByRole('tab',{name:'Home',exact:true}).count(),0);
 passed.push('320–412 widths/dark/extreme accent/serif/reduced mode; public shared Centers has no resident bar or reveal');
 const unexpected=diagnostics.filter(d=>!d.includes('props.pointerEvents is deprecated')&&!d.includes('shadow*'));
 assert.deepEqual(unexpected,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,diagnostics,unexpected},null,2));console.log(JSON.stringify({passed,diagnostics},null,2));
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({diagnostics,passed,dom:await page.locator('body').innerText(),state:await page.evaluate(()=>({hidden:window.fixture.navHidden,options:window.fixture.routeOptions,messages:window.fixture.messages}))},null,2));await page.screenshot({path:path.join(out,'failure.png')});throw error}finally{await browser.close()}
