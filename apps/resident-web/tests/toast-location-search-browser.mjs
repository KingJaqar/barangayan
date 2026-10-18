// Real frontend owners and notification host; browser/service outcomes are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve('plans/evidence/resident-web-toast-coverage/phases-6-7');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  'next/font/local': `export default ()=>({className:''});`,
  'next/navigation': `export const useRouter=()=>({push:href=>window.fx.navigate(href),replace(){},refresh(){},back(){}});`,
  'next/link': `import React from 'react';export default function Link({href,children,prefetch,...p}){return <a href={href} {...p}>{children}</a>}`,
  '@/hooks/use-sign-out': `export const useSignOut=()=>({signOut:async()=>{},signingOut:false});`,
  '@/app/(resident)/settings/valid-id/transport': `export {abortable} from '${path.join(app, 'src/app/(resident)/settings/valid-id/transport.ts').replaceAll('\\', '/')}';import{createSupabaseBrowserClient}from'@/lib/supabase/client';export const createIdClient=()=>createSupabaseBrowserClient();`,
  '@/app/(resident)/settings/settings-content': `export const scrollSettingsContentToTop=()=>{};`,
  '@/app/(resident)/services/requests/[requestId]/request-tracking': `export const RequestTracking=()=>null;`,
  '@/components/emergency/centers-map-client': `import React from 'react';export const CentersMapClient=()=> <div>Route map</div>;`,
  'next/image': `import React from 'react';export default function Image({unoptimized,...p}){return <img {...p}/>}`,
  'next/dynamic': `import React from 'react';export default ()=>function Map(p){return <><button type="button" onClick={()=>p.onPositionChange(window.fx.point)}>Place pin</button><button type="button" onClick={()=>p.onRejected()}>Reject pin</button><button type="button" onClick={()=>p.onMapError?.()}>Tile error</button></>}`,
  '@/app/(resident)/settings/location-verification/location-verification-map': `export const LocationVerificationMap=()=>null;`,
  'react-leaflet': `export const useMap=()=>({flyTo:()=>window.fx.calls.push('fly')});`,
  '@/components/theme/theme-controller': `export const useThemeController=()=>({theme:document.documentElement.classList.contains('dark')?'dark':'light'});`,
  '@/app/(resident)/settings/location-verification/location-verification-map-wrapper': `import React from 'react';export function LocationVerificationMapWrapper(p){return <><button type="button" onClick={()=>p.onPositionChange(window.fx.point)}>Place pin</button><button type="button" onClick={()=>p.onRejected()}>Reject pin</button></>}`,
  '@/components/reports/location-picker-map-wrapper': `import React from 'react';export function LocationPickerMapWrapper(p){return <button type="button" onClick={()=>p.onPositionChange(window.fx.point)}>Place report pin</button>}`,
  '@barangayan/shared': `export * from '${path.resolve('packages/shared/src/index.ts').replaceAll('\\', '/')}';export const reverseGeocode=async()=>{window.fx.calls.push('address');await window.fx.wait('address');return window.fx.address};export const registrationLocality=async()=>{await window.fx.wait('locality');if(window.fx.readMode==='throw')throw new Error('synthetic');return{id:'b1180000-0000-4000-8000-000000000001',boundary:null}};`,
  '@barangayan/shared/src/lib/connected-route-client': `export {describeConnectedFailure} from '${path.resolve('packages/shared/src/lib/connected-route-client.ts').replaceAll('\\', '/')}';export async function requestConnectedRoute(options){window.fx.routeCalls.push(options.request);await window.fx.wait('route');return window.fx.routeOutcome}`,
  'html5-qrcode': `export class Html5Qrcode{isScanning=false;async start(){window.fx.calls.push('camera-start');await window.fx.wait('camera');if(window.fx.cameraError)throw new DOMException('synthetic',window.fx.cameraError);this.isScanning=true}async stop(){window.fx.calls.push('camera-stop');this.isScanning=false}pause(){}resume(){}}`,
  '@/lib/supabase/client': `
    const fx=window.fx;
    function query(table){const q={select(){return q},eq(){return q},is(){return q},order(){return q},limit(){return q},maybeSingle(){return q},single(){return q},in(){return q},abortSignal(){return q},then(resolve,reject){fx.calls.push('read-'+table);return(async()=>{await fx.wait('read');if(fx.readMode==='throw')throw new TypeError('synthetic');return{data:fx.readMode==='error'?null:fx.readData?.[table]??[],error:fx.readMode==='error'?{message:'private SQL detail'}:null}})().then(resolve,reject)}};return q}
    const client={from:query,auth:{getSession:async()=>({data:{session:fx.noSession?null:{access_token:'synthetic'}}}),getUser:async()=>({data:{user:{id:'resident-a'}},error:null}),onAuthStateChange(cb){let active=true;queueMicrotask(()=>{if(active)cb('INITIAL_SESSION',{user:{id:'resident-a'}})});return{data:{subscription:{unsubscribe(){active=false}}}}}},rpc:()=>query('rpc'),channel(){const c={on(_event,_filter,cb){fx.realtime=cb;return c},subscribe(){return c}};return c},removeChannel(){}};export const createSupabaseBrowserClient=()=>client;
  `,
};
const entry = `
import React,{StrictMode,useEffect,useRef,useState}from'react';import{createRoot}from'react-dom/client';
import{Toaster,toastAnchorRef}from'@/components/ui/sonner';import{beginAttempt,setNotificationSession}from'@/lib/notify';
import{RegistrationMap}from'@/components/auth/registration-map';import{LocationVerificationForm}from'@/app/(resident)/settings/location-verification/location-verification-form';
import{NewReportForm}from'@/app/(resident)/reports/new/new-report-form';import{LocateButton}from'@/components/maps/locate-button';
import{HouseholdQrDialog}from'@/components/emergency/household-qr-dialog';import{QrScannerDialog}from'@/components/emergency/qr-scanner-dialog';import{QrShowDialog}from'@/components/emergency/qr-show-dialog';
import{ColorPickerSwatch}from'@/components/theme/color-picker-popover';import{useFullscreen}from'@/hooks/use-fullscreen';
import{useDeviceLocation}from'@/hooks/use-device-location';import{useConnectedRoute}from'@/hooks/use-connected-route';import{useScopedRead}from'@/hooks/use-scoped-read';
import{useAnnouncements}from'@/hooks/use-announcements';import{useFaqArticles}from'@/hooks/use-faq-articles';import{useMyIncidents}from'@/hooks/use-my-incidents';
import{SearchResults}from'@/components/search/search-results';import{SearchInput}from'@/components/search/search-input';
import{RegisterForm}from'@/app/(auth)/register/register-form';import ResetPassword from'@/app/(auth)/reset-password/reset-password-form';
import{AgencySlaStatus}from'@/components/services/agency-sla-status';import{SuccessStep}from'@/components/services/document-request-modal/success-step';
import{CentersContent}from'@/components/emergency/centers-content';
import{SettingsIdStatusProvider,useSettingsIdStatus}from'@/app/(resident)/settings/settings-id-status';import{SavedId}from'@/app/(resident)/settings/valid-id/saved-id';import{RequestDrawer}from'@/app/(resident)/services/requests/request-drawer';
const fx=window.fx;
function StatusProbe(){const s=useSettingsIdStatus();return <><button onClick={()=>s.refresh(true)}>Retry status</button><output>{s.loading?'loading':s.error?'failed':'ready'}</output></>}
function Fullscreen(){const ref=useRef(null);const f=useFullscreen(ref);useEffect(()=>{ref.current.requestFullscreen=async()=>{await fx.wait('fullscreen');if(fx.fullscreenError)throw new Error('synthetic')}} ,[]);return <div ref={ref}><button onClick={f.toggle}>Fullscreen</button></div>}
function Device(){const l=useDeviceLocation();fx.location=l;return <><button onClick={l.locate}>Locate</button><button onClick={l.confirm}>Confirm</button><button onClick={l.reject}>Discard</button><button onClick={l.cancel}>Stop</button><output>{l.state.status}</output></>}
function Route(){const[centerId,setCenter]=useState(null);const[revision,setRevision]=useState(1);const[segment,setSegment]=useState(null);const[selectionNotificationId,setNotification]=useState(null);const r=useConnectedRoute({origin:{lat:14.68,lng:121.12,revision,accuracyMeters:10},centerId,segment,selectionNotificationId});fx.route=r;return <><button onClick={()=>{setNotification(beginAttempt('walking-route'));setCenter('center-a')}}>Choose center</button><button onClick={()=>{setRevision(v=>v+1);setSegment(null)}}>Automatic origin</button><button onClick={()=>{setNotification(beginAttempt('walking-route'));setSegment({graphVersion:'graph',edgeId:'street-a'})}}>Choose street</button><button onClick={r.retry}>Retry route</button><output>{r.status}</output></>}
function Read(){const[identity,setIdentity]=useState('a');const read=useScopedRead(identity,async()=>{fx.calls.push('read');await fx.wait('read');if(fx.readMode==='throw')throw new Error('synthetic');return{data:[],error:fx.readMode==='error'?{message:'private SQL detail'}:null}});fx.read=read;return <><button onClick={()=>read.refetch('test content')}>Retry read</button><button onClick={()=>read.refetch()}>Background read</button><button onClick={()=>setIdentity('b')}>Switch entity</button><output>{read.error?'failed':read.isLoading?'loading':'ready'}</output></>}
function Lists(){const a=useAnnouncements({barangayId:null});const f=useFaqArticles(null);const r=useMyIncidents();return <><button onClick={()=>a.refetch('announcements')}>Retry announcements</button><button onClick={()=>f.refetch('help articles')}>Retry help</button><button onClick={()=>r.refetch('your reports')}>Retry reports</button></>}
function Search(){const[state,setState]=useState({query:fx.query??'alpha',category:'all',page:1});fx.navigate=href=>{const u=new URL(href,location.href);setState({query:u.searchParams.get('q')??'',category:u.searchParams.get('category')??'all',page:1})};return <><button onClick={()=>{const id=beginAttempt('search');window.__residentSearchAttempt={query:'beta',id,at:Date.now()};fx.navigate('/search?q=beta')}}>Explicit search</button><button onClick={()=>fx.navigate('/search?q=alpha&category=help')}>Filter</button><SearchResults {...state} isAuthenticated={false}/></>}
function App(){const[visible,setVisible]=useState(true);fx.hide=()=>setVisible(false);fx.switchAccount=()=>setNotificationSession('resident-b');return <><header ref={toastAnchorRef} data-toast-anchor style={{height:64}}>Resident header</header><Toaster/><main style={{paddingTop:140}}>{visible&&(fx.screen==='registration'?<RegistrationMap boundary={fx.boundary} onConfirm={value=>fx.selected=value}/>:fx.screen==='verification'?<LocationVerificationForm profileId="resident-a" barangayName="Test" boundary={fx.boundary} savedLocation={fx.saved?fx.point:null} savedAddress={null}/>:fx.screen==='report'?<NewReportForm categories={[{id:'b1180000-0000-4000-8000-000000000002',name:'Road',color:null,icon:null,is_trash_related:false}]} zones={[]} barangayId="resident-a" boundary={fx.boundary}/>:fx.screen==='map'?<LocateButton onLocated={p=>fx.selected=p}/>:fx.screen==='household'?<HouseholdQrDialog open onClose={()=>{}} profileId="resident-a" residentName="Fixture Resident"/>:fx.screen==='scanner'?<QrScannerDialog open onClose={()=>setVisible(false)} userId="resident-a" barangayId="barangay-a" userBarangayId="barangay-a"/>:fx.screen==='share'?<QrShowDialog open onClose={()=>{}} barangayId="b1180000-0000-4000-8000-000000000001" centers={[{id:'b1180000-0000-4000-8000-000000000002',name:'Center',address:'Test'}]}/>:fx.screen==='color'?<div style={{paddingTop:400}}><ColorPickerSwatch color="#334455" onChange={v=>fx.selected=v}/></div>:fx.screen==='fullscreen'?<Fullscreen/>:fx.screen==='id-status'?<SettingsIdStatusProvider><StatusProbe/></SettingsIdStatusProvider>:fx.screen==='saved-id'?<SettingsIdStatusProvider><SavedId userId="resident-a" submissionId="submission-a" lastSubmittedId={null} onReplace={()=>{}}/></SettingsIdStatusProvider>:fx.screen==='request-drawer'?<RequestDrawer requestId="request-a" open onClose={()=>{}}/>:fx.screen==='centers'?<CentersContent barangayId={null} boundary={fx.boundary}/>:fx.screen==='device'?<Device/>:fx.screen==='route'?<Route/>:fx.screen==='read'?<Read/>:fx.screen==='lists'?<Lists/>:fx.screen==='search'?<Search/>:fx.screen==='suggestions'?<SearchInput/>:fx.screen==='register'?<RegisterForm/>:fx.screen==='reset'?<ResetPassword/>:fx.screen==='clock'?<AgencySlaStatus requestId="request-a"/>:fx.screen==='receipt'?<SuccessStep requestId="request-a" referenceNumber="REQ-A"/>:null)}</main></>}
setNotificationSession('resident-a');createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`;
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: app }, bundle: true, write: false, outdir: 'fixture', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://fixture.supabase.test"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"fixture"' },
  plugins: [{ name: 'synthetic-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      const key = args.path.startsWith('.') ? '@/' + path.relative(path.join(app, 'src'), path.resolve(args.resolveDir, args.path)).replaceAll('\\', '/') : args.path;
      return Object.hasOwn(mocks, key) ? { path: key, namespace: 'fixture' } : undefined;
    });
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(js); }
  else if (request.url === '/fixture.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div></body></html>'); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { passed: false, checks: [], pageErrors: [], consoleErrors: [], warnings: [], limitations: ['Real frontend/controller/adapter/host with synthetic APIs; no physical GPS/camera, external route service, native share sheet or spoken screen reader.'] };
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
  async function open(screen, options = {}) {
    await page.goto(origin);
    await page.evaluate(({ screen, options }) => {
      const fx = window.fx = { screen, point: { lat: 14.68, lng: 121.12 }, boundary: { type: 'Polygon', coordinates: [[[121,14],[122,14],[122,15],[121,15],[121,14]]] }, address: 'Test address', readMode: 'success', searchMode: 'success', calls: [], routeCalls: [], gps: [], watches: [], held: {}, releases: {}, async wait(name) { if (this.held[name]) await new Promise(resolve => this.releases[name] = resolve); }, release(name) { this.held[name] = false; this.releases[name]?.(); }, routeOutcome: { kind: 'route', result: { status: 'no_route_within_coverage', provenance: { conditionsRevision: 1 }, centers: [] }, service: { attribution: 'fixture' } }, ...options };
      sessionStorage.clear();
      document.documentElement.classList.toggle('dark', !!fx.dark);
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success, error) { fx.calls.push('gps'); fx.gps.push({ success, error }); }, watchPosition(success, error) { fx.calls.push('watch'); fx.watches.push({ success, error }); return fx.watches.length; }, clearWatch() { fx.calls.push('clear-watch'); } } });
      Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: fx.permission ?? 'prompt', addEventListener(_event,callback){fx.permissionChanged=callback}, removeEventListener(){} }) } });
      window.EyeDropper = class { async open() { await fx.wait('eyedropper'); if (fx.eyedropperError) throw new DOMException('synthetic', fx.eyedropperError); return { sRGBHex: '#123456' }; } };
      navigator.share = async () => { if (fx.shareError) throw new DOMException('synthetic', fx.shareError); };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { fx.calls.push('clipboard'); } } });
      window.fetch = async url => {
        const value = String(url);
        if (value.includes('generate-household-qr')) { fx.calls.push('qr'); await fx.wait('qr'); if (fx.qrError) throw new Error('synthetic'); return new Response(new Blob(['synthetic']), { status: 200 }); }
        if (value.includes('/api/search')) {
          fx.calls.push('search'); await fx.wait('search');
          if (fx.searchMode === 'throw') throw new TypeError('synthetic');
          const u = new URL(value, location.href); const query = u.searchParams.get('q');
          return new Response(JSON.stringify({ query, groups: [{ category: 'help', count: 0, results: [], failed: fx.searchMode === 'partial' }], page: 1, pageSize: 10, isAuthenticated: false }));
        }
        throw new Error('Unexpected fixture URL: ' + value);
      };
      const script = document.createElement('script'); script.src = '/fixture.js'; document.body.append(script);
    }, { screen, options });
    await page.waitForFunction(() => !!window.fx.hide);
    await page.waitForTimeout(100);
  }
  const toasts = () => page.locator('[data-sonner-toast]');
  const click = name => page.getByRole('button', { name, exact: true }).click();
  async function toast(title, kind) { const match = toasts().filter({ hasText: title }); await match.first().waitFor(); assert.equal(await match.first().getAttribute('data-type'), kind); }
  async function quiet() { await page.waitForTimeout(150); assert.equal(await toasts().count(), 0); }
  async function check(name, action) { if (process.argv[2] && !new RegExp(process.argv[2]).test(name)) return; await action(); report.checks.push(name); }
  async function fix(kind = 'gps', options = {}) { await page.evaluate(({ kind, options }) => { const callbacks = kind === 'watch' ? fx.watches.at(-1) : fx.gps.at(-1); callbacks.success({ coords: { latitude: fx.point.lat, longitude: fx.point.lng, accuracy: 10, ...options }, timestamp: Date.now() }); }, { kind, options }); }
  async function denied(kind = 'gps') { await page.evaluate(kind => (kind === 'watch' ? fx.watches.at(-1) : fx.gps.at(-1)).error({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }), kind); }
  await check('registration GPS success, double activation, home confirmation and quiet gestures', async () => {
    await open('registration'); await click('Detect My Location'); await page.evaluate(() => document.querySelector('button').click()); assert.equal(await page.evaluate(() => fx.gps.length), 1);
    await fix(); await toast('Device location found.', 'success'); await click('Place pin'); assert.equal(await toasts().count(), 1); await click('Confirm Location'); await toast('Home location selected for registration.', 'success');
  });
  await check('registration permission denial and later attempt', async () => { await open('registration'); await click('Detect My Location'); await denied(); await toast('Location access is blocked.', 'error'); await click('Detect My Location'); await denied(); assert.equal(await toasts().count(), 2); });
  await check('registration tile bursts notify only after explicit retry', async () => { await open('registration'); await click('Tile error'); await quiet(); await click('Retry map'); await click('Tile error'); await click('Tile error'); await toast("Couldn't load the map.", 'error'); assert.equal(await toasts().count(), 1); });
  await check('registration closed/account-changed acquisition is suppressed', async () => { await open('registration'); await click('Detect My Location'); await page.evaluate(() => { fx.switchAccount(); fx.hide(); }); await fix(); await quiet(); });
  await check('general map location success and denial', async () => { await open('map'); await page.getByRole('button').click(); await fix(); await toast('Your location is shown on the map.', 'success'); await open('map'); await page.getByRole('button').click(); await denied(); await toast('Location access is blocked.', 'error'); });
  await check('automatic verification acquisition/address stays quiet', async () => { await open('verification', { address: null }); await fix(); await quiet(); });
  await check('verification explicit location and failed address are distinct results', async () => { await open('verification', { saved: true, address: null }); await page.getByRole('button', { name: /Detect Your Location/ }).click(); await fix(); await toast('Location found. Review the pin and save it.', 'success'); await toast("Couldn't find the address.", 'warning'); assert.equal(await toasts().count(), 2); });
  await check('verification rejected selections warn once per completed selection', async () => { await open('verification', { saved: true }); await click('Reject pin'); await toast('This location is outside', 'warning'); assert.equal(await toasts().count(), 1); await click('Reject pin'); assert.equal(await toasts().count(), 2); });
  await check('verification automatic outside-boundary point stays quiet', async () => { await open('verification', { point: { lat: 0, lng: 0 } }); await fix(); await quiet(); });
  await check('report explicit GPS and address lookup', async () => { await open('report'); await page.getByRole('button', { name: /Use My Location/ }).click(); await fix(); await toast('Location found. Check the report pin', 'success'); assert.equal(await page.evaluate(() => fx.calls.filter(c => c === 'gps').length), 1); });
  await check('report current failed address warns, stale lookup is dropped', async () => { await open('report', { address: null }); await click('Place report pin'); await toast("Couldn't find the address.", 'warning'); await open('report', { held: { address: true }, address: null }); await click('Place report pin'); assert.deepEqual(await page.evaluate(() => ({held:fx.held, calls:fx.calls, toasts:Array.from(document.querySelectorAll('[data-sonner-toast]')).map(x=>x.textContent)})), {held:{address:true},calls:['address'],toasts:[]}); await page.evaluate(() => fx.hide()); await page.getByRole('button',{name:'Place report pin',exact:true}).waitFor({state:'detached'}); await page.evaluate(() => fx.release('address')); await quiet(); });
  await check('device automatic denial stays quiet', async () => { await open('device', { permission: 'denied' }); await quiet(); });
  await check('device explicit acquisition, pending fix, confirmation and watch silence', async () => { await open('device'); await click('Locate'); await page.waitForFunction(() => fx.watches.length > 0); await fix('watch', { accuracy: 100 }); await toast('Location found. Review it before continuing.', 'success'); await fix('watch', { accuracy: 90 }); assert.equal(await toasts().count(), 1); await click('Confirm'); await toast('Location selected for route planning.', 'success'); await click('Confirm'); assert.equal(await toasts().count(), 2); });
  await check('device discard is one information result and retains no fake location', async () => { await open('device'); await click('Locate'); await page.waitForFunction(() => fx.watches.length > 0); await fix('watch', { accuracy: 100 }); await click('Discard'); await toast('Location discarded.', 'info'); await click('Discard'); assert.equal(await toasts().count(), 2); });
  await check('permission grant during explicit acquisition retains its attempt', async () => { await open('device'); await click('Locate'); await page.waitForFunction(()=>fx.watches.length>0); await page.evaluate(()=>{fx.permission='granted';fx.permissionChanged()}); await page.waitForFunction(()=>fx.watches.length>1); await fix('watch'); await toast('Location found. Review it before continuing.','success'); assert.equal(await toasts().count(),1); });
  await check('device explicit denied acquisition errors once', async () => { await open('device'); await click('Locate'); await page.waitForFunction(() => fx.watches.length > 0); await denied('watch'); await toast("Couldn't find your location.", 'error'); assert.equal(await toasts().count(), 1); });
  await check('route automatic origin and polling are quiet', async () => { await open('route'); await quiet(); await click('Automatic origin'); await quiet(); });
  for (const status of ['ok', 'no_route_within_coverage', 'attachment_ambiguous']) await check('explicit route ' + status, async () => {
    await open('route', { routeOutcome: { kind: 'route', result: { status, provenance: { conditionsRevision: 1 }, centers: [], best: { centerId: 'center-a' } }, service: {} } }); await click('Choose center');
    if (status === 'attachment_ambiguous') await quiet(); else await toast(status === 'ok' ? 'Walking route ready.' : 'No available walking route was found.', status === 'ok' ? 'success' : 'warning');
  });
  await check('explicit route failure retry and superseded response suppression', async () => { await open('route', { routeOutcome: { kind: 'failure', failure: { kind: 'network' } } }); await click('Choose center'); await toast("Couldn't calculate the route.", 'error'); await click('Retry route'); await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 2); await open('route', { held: { route: true } }); await click('Choose center'); await page.evaluate(() => fx.hide()); await page.waitForTimeout(30); await page.evaluate(() => fx.release('route')); await quiet(); });
  await check('automatic origin clearing a street does not inherit its aborted attempt', async () => { await open('route'); await page.evaluate(()=>fx.held.route=true); await click('Choose street'); await click('Automatic origin'); await page.evaluate(()=>fx.release('route')); await quiet(); });
  await check('actual Centers street action and persistent route guidance', async () => {
    await open('centers', { routeOutcome: { kind: 'route', result: { status: 'attachment_ambiguous', provenance: { conditionsRevision: 1, graphVersion: 'graph' }, candidates: [{ edgeId: 'edge-a', name: 'Test street', distanceMeters: 10 }], warnings: [] }, service: {} } });
    await click('Use my location'); await page.waitForFunction(() => fx.watches.length > 0); await fix('watch'); await toast('Location found. Review it before continuing.', 'success'); await page.getByRole('button',{name:/Test street/}).waitFor();
    await page.evaluate(() => fx.routeOutcome={kind:'route',result:{status:'ok',provenance:{conditionsRevision:1},centers:[],best:{centerId:'center-a'},shortest:null,warnings:[{code:'unknown_center_availability'}]},service:{}});
    await page.getByRole('button',{name:/Test street/}).click(); await toast('Street selected. Updating your route.', 'info'); await toast('Walking route ready. Review the route guidance.', 'success');
    await page.getByText('No center is confirmed open on a safe route, so this one has unconfirmed availability.',{exact:true}).waitFor();
    assert.equal(await toasts().filter({hasText:'Street selected.'}).count(),1);
  });
  for (const cameraError of ['NotAllowedError', 'NotReadableError']) await check('camera ' + cameraError, async () => { await open('scanner', { cameraError }); await toast(cameraError === 'NotAllowedError' ? 'Camera access is blocked.' : "Couldn't start the camera.", 'error'); await click('Try again'); await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 2); });
  await check('late ready camera is stopped after closure; readiness stays quiet', async () => { await open('scanner', { held: { camera: true } }); await page.waitForFunction(() => fx.calls.includes('camera-start')); await page.evaluate(() => fx.hide()); await page.waitForTimeout(30); await page.evaluate(() => fx.release('camera')); await page.waitForFunction(() => fx.calls.includes('camera-stop')); await quiet(); });
  for (const noSession of [true, false]) await check('household QR ' + (noSession ? 'session' : 'read failure'), async () => { await open('household', { noSession, qrError: true }); await toast(noSession ? 'Log in again to view your household QR code.' : "Couldn't load your household QR code.", 'error'); assert.equal(await toasts().count(), 1); });
  await check('household closed read stays quiet', async () => { await open('household', { held: { qr: true }, qrError: true }); await page.evaluate(() => fx.hide()); await page.waitForTimeout(30); await page.evaluate(() => fx.release('qr')); await quiet(); });
  for (const shareError of [null, 'AbortError']) await check('native share ' + (shareError ?? 'success') + ' stays quiet', async () => { await open('share', { shareError }); await click('Share'); await quiet(); });
  await check('fullscreen success stays quiet and rejection is caught', async () => { await open('fullscreen'); await click('Fullscreen'); await quiet(); await open('fullscreen', { fullscreenError: true }); await click('Fullscreen'); await toast("Couldn't change fullscreen mode.", 'error'); });
  for (const eyedropperError of [null, 'AbortError', 'InvalidStateError']) await check('eyedropper ' + (eyedropperError ?? 'success'), async () => { await open('color', { eyedropperError }); await page.getByRole('button').first().click(); await page.getByRole('button', { name: /Pick.*screen/i }).click(); if (eyedropperError === 'InvalidStateError') await toast("Couldn't pick a screen color.", 'error'); else await quiet(); });
  for (const readMode of ['error', 'throw']) await check('read retry ' + readMode + ' versus automatic read', async () => { await open('read', { readMode }); await quiet(); await click('Background read'); await quiet(); await click('Retry read'); await toast("Couldn't refresh test content.", 'error'); assert.equal(await toasts().count(), 1); });
  await check('read retry old entity/account/unmount suppression', async () => { await open('read', { readMode: 'error' }); await page.evaluate(() => fx.held.read = true); await click('Retry read'); await click('Switch entity'); await page.evaluate(() => { fx.switchAccount(); fx.hide(); }); await page.waitForTimeout(30); await page.evaluate(() => fx.release('read')); await quiet(); });
  await check('list retries have their own controlled names; realtime is quiet', async () => { await open('lists', { readMode: 'error' }); await quiet(); for (const name of ['Retry announcements', 'Retry help', 'Retry reports']) await click(name); await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 3); await page.evaluate(() => fx.realtime?.()); assert.equal(await toasts().count(), 3); });
  await check('explicit search error, later retry, and filter silence', async () => { await open('search', { searchMode: 'throw' }); await quiet(); await click('Explicit search'); await toast("Couldn't complete the search.", 'error'); await click('Filter'); assert.equal(await toasts().count(), 1); await click('Try again'); await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 2); });
  await check('partial and empty search results are quiet', async () => { for (const searchMode of ['partial', 'success']) { await open('search', { searchMode }); await click('Explicit search'); await quiet(); } });
  await check('typeahead failure and partial suggestion retry are quiet', async () => { await open('suggestions', { searchMode: 'partial' }); await page.getByRole('combobox').fill('alpha'); await click('Try again'); await quiet(); await open('suggestions', { searchMode: 'throw' }); await page.getByRole('combobox').fill('alpha'); await page.waitForTimeout(350); await quiet(); });
  await check('aborted explicit search never reports stale failure', async () => { await open('search', { held: { search: true }, searchMode: 'throw' }); await click('Explicit search'); await page.evaluate(() => fx.hide()); await page.waitForTimeout(30); await page.evaluate(() => fx.release('search')); await quiet(); });
  await check('registration invalid submit retains first-field focus and field guidance', async () => { await open('register'); await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); await toast('Check the highlighted registration details.', 'error'); assert.equal(await page.evaluate(() => document.activeElement.id), 'firstName'); assert.equal(await page.locator('[aria-invalid="true"]').count() > 0, true); });
  await check('password invalid submit keeps guidance and focus', async () => { await open('reset'); await page.locator('#password').fill('weak'); await page.locator('#confirmPassword').fill('different'); await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); await toast('Check the password requirements and confirmation.', 'error'); assert.equal(await page.evaluate(() => document.activeElement.id), 'password'); });
  await check('receipt and processing-clock retry failures; background failures quiet', async () => { for (const screen of ['receipt', 'clock']) { await open(screen, { readMode: 'error' }); await quiet(); await click(screen === 'receipt' ? 'Retry receipt' : 'Retry'); await toast(screen === 'receipt' ? "Couldn't refresh your payment receipt." : "Couldn't refresh the processing clock.", 'error'); } });
  await check('ID status retry is explicit and uses the existing coalesced read', async () => { await open('id-status',{readMode:'error'}); await page.getByText('failed',{exact:true}).waitFor(); await quiet(); await click('Retry status'); await toast("Couldn't refresh ID verification status.",'error'); assert.equal(await toasts().count(),1); });
  await check('saved ID and request drawer retries preserve inline recovery', async () => { await open('saved-id',{readMode:'error'}); await quiet(); await page.getByRole('button',{name:/Try again/}).last().click(); await toast("Couldn't refresh your saved ID.",'error'); await open('request-drawer',{readMode:'error'}); await quiet(); await click('Try again'); await toast("Couldn't refresh your request.",'error'); });
  await check('dark narrow shared host stays above open dialog', async () => { await page.setViewportSize({ width: 390, height: 844 }); await open('household', { dark: true, noSession: true }); await toast('Log in again', 'error'); await page.waitForTimeout(400); await page.screenshot({ path: path.join(output, 'dark-narrow-qr.png'), fullPage: true }); assert.equal(await page.getByRole('dialog').count(), 1); });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.warnings, []);
  report.passed = true;
} finally {
  if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2));
}
console.log(`PASS: ${report.checks.length} Phase 6/7 scenarios; no runtime/console errors or warnings.`);
