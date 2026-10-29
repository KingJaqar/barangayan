import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild'); const { chromium } = require('playwright');
const root = path.join(app, 'src').replaceAll('\\', '/');
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-notifications-phase3-20261028/ui');
fs.mkdirSync(out, { recursive: true });
// Real screen, hub hook, data layer, rows, sheets and unread provider. Synthetic: the transport (a JS mirror of the
// phase-1 RPC scope rules, so counts/pages/bulk read behave like the server) and the native/router adapters.
// This fixture does not qualify native gestures, TalkBack, frame timing or the real database (I1/I3).
const mocks = {
  '@/global.css': '',
  'react-native': `import React from 'react';import {Animated as A,View as V,Pressable as P} from 'react-native-web';export * from 'react-native-web';export const Pressable=React.forwardRef(({accessibilityState,...p},ref)=><P {...p} ref={ref} aria-selected={accessibilityState?.selected} aria-expanded={accessibilityState?.expanded} aria-busy={accessibilityState?.busy}/>);export const View=React.forwardRef(({accessibilityViewIsModal,accessibilityElementsHidden,importantForAccessibility,...p},ref)=><V {...p} ref={ref}/>);export const Animated={...A,timing:(v,o)=>A.timing(v,{...o,useNativeDriver:false})};export const RefreshControl=({children,style,...p})=>{const ref=React.useRef(p);ref.current=p;React.useEffect(()=>{(window.pullControls??=new Set()).add(ref);return()=>{window.pullControls.delete(ref)}},[]);return <View style={style}>{children}</View>};`,
  'react-native-safe-area-context': `import React from 'react';import {View} from 'react-native';export const SafeAreaView=({edges,...p})=><View {...p}/>;export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
  'react-native-reanimated': `import React,{useRef} from 'react';import {View,Easing} from 'react-native';export default {View,createAnimatedComponent:c=>c};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=fn=>fn();export const withTiming=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({size,name})=><View data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;`,
  'expo-image': `import React from 'react';import {Image as I} from 'react-native';export const Image=({contentFit,...p})=><I {...p} resizeMode={contentFit}/>;`,
  '@barangayan/shared': `export * from '${shared}/constants/announcement-categories.ts';export {ACCENT_COLORS} from '${shared}/constants/theme-colors.ts';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts.ts';`,
  'expo-router': `import React,{useEffect} from 'react';export const router={setParams:p=>{Object.assign(window.fixture.params,p);window.render(false)},push:p=>window.fixture.routes.push({push:p}),navigate:p=>window.fixture.routes.push({navigate:p}),replace:p=>window.fixture.routes.push(p),back:()=>window.fixture.routes.push('back')};export const Link=({children})=>children;export const useRouter=()=>router;export const useLocalSearchParams=()=>window.fixture.params;export const useFocusEffect=fn=>useEffect(fn,[fn]);`,
  '@/hooks/use-theme': `import {getResidentTheme} from '${root}/constants/resident-theme.ts';import {Colors} from '${root}/constants/theme.ts';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@/hooks/use-theme-preference': `export const useThemePreference=()=>({scheme:window.fixture.mode,accentColor:window.fixture.accent});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.font});`,
  '@/hooks/use-resident-reduced-motion': `export const useResidentReducedMotion=()=>window.fixture.reduced;`,
  '@/hooks/use-floating-tab-inset': `export const useFloatingTabInset=()=>80;`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:window.fixture.session});`,
  '@/lib/supabase': String.raw`
const KIND={request_status:['account','document_requests'],payment:['account','document_requests'],incident_status:['account','incident_reports'],account_verification:['account','verification'],account_security:['account','security'],account_profile:['account','profile'],system_service:['system','service_status'],system_update:['system','app_updates'],system_policy:['system','policies']};
const inboxIn=(row,view,chip)=>{const k=KIND[row.kind];if(!k)return false;return view==='all'?chip==='all'||chip===k[0]:view===k[0]&&(chip==='all'||chip===k[1])};
const annIn=(a,view,chip)=>['all','barangay'].includes(view)&&(chip==='all'||chip===a.category);
const mine=f=>f.inbox.filter(r=>r.recipient_id===f.session?.user.id);
const unreadAnn=f=>f.news.filter(a=>!f.reads.some(r=>r.announcement_id===a.id));
function emit(table){queueMicrotask(()=>window.fixture.channels.filter(c=>c.table===table).forEach(c=>c.fn()))}
function rpcRun(name,a){
  const f=window.fixture;
  if(f.failRpc===name)return {data:null,error:{message:'Synthetic rpc failure'}};
  if(name==='notification_hub_summary'){
    if(!f.session)return {data:null,error:{message:'permission denied'}};
    const rows=[{source:'barangay',total:f.news.length,unread:unreadAnn(f).length,scope_total:f.news.filter(x=>annIn(x,a.p_view,a.p_filter)).length,scope_unread:unreadAnn(f).filter(x=>annIn(x,a.p_view,a.p_filter)).length}];
    for(const s of ['account','system']){const own=mine(f).filter(r=>KIND[r.kind]?.[0]===s);if(f.noProfile){rows[0].unread=null;rows[0].scope_unread=null}
    rows.push(f.noProfile?{source:s,total:null,unread:null,scope_total:null,scope_unread:null}:{source:s,total:own.length,unread:own.filter(r=>!r.read_at).length,scope_total:own.filter(r=>inboxIn(r,a.p_view,a.p_filter)).length,scope_unread:own.filter(r=>!r.read_at&&inboxIn(r,a.p_view,a.p_filter)).length})}
    return {data:rows,error:null};
  }
  if(name==='notification_inbox_page'){
    let rows=mine(f).filter(r=>KIND[r.kind]?.[0]===a.p_source&&inboxIn(r,a.p_view,a.p_filter)).sort((x,y)=>x.created_at<y.created_at?1:x.created_at>y.created_at?-1:x.id<y.id?1:-1);
    if(a.p_before_created_at)rows=rows.filter(r=>r.created_at<a.p_before_created_at||r.created_at===a.p_before_created_at&&r.id<a.p_before_id);
    return {data:rows.slice(0,Math.min(a.p_limit??25,50)).map(({recipient_id,...r})=>({...r,filter:KIND[r.kind][1]})),error:null};
  }
  if(name==='notification_mark_scope_read'){
    if(!f.session)return {data:null,error:{message:'authentication_required'}};
    const anns=unreadAnn(f).filter(x=>annIn(x,a.p_view,a.p_filter));anns.forEach(x=>f.reads.push({resident_id:f.session.user.id,announcement_id:x.id}));
    const inb=mine(f).filter(r=>!r.read_at&&inboxIn(r,a.p_view,a.p_filter));inb.forEach(r=>r.read_at=new Date().toISOString());
    f.bulk.push({view:a.p_view,chip:a.p_filter,announcements:anns.length,notifications:inb.length});emit('announcement_reads');emit('notification_inbox');
    return {data:[{announcements_marked:anns.length,notifications_marked:inb.length}],error:null};
  }
  return {data:null,error:{message:'unknown rpc'}};
}
export const supabase={
  from(table){
    let action='select',values,filters=[],options={},take=Infinity,skip=0,orders=[],cursor=null;
    const q={select(c,o={}){options=o;return q},is(k,v){filters.push([k,v]);return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},order(k,o={}){orders.push([k,o]);return q},limit(n){take=n;return q},range(a,b){skip=a;take=b-a+1;return q},or(e){cursor=e;return q},abortSignal(){return q},update(v){action='update';values=v;return q},upsert(v){action='upsert';values=v;return q},delete(){action='delete';return q},maybeSingle(){return execute(true)},single(){return execute(true)},then(ok,fail){return execute(false).then(ok,fail)}};
    function run(single){
      const f=window.fixture;f.queries.push({table,action,filters,head:options.head,count:options.count,cursor});
      if(f.failTable===table&&(action==='select'||f.failWrite)||action!=='select'&&f.failWrite)return {data:null,error:{message:'Synthetic failure'}};
      let rows={announcements:f.news,announcement_reads:f.reads,notification_inbox:f.inbox,system_notices:f.notices,incidents:f.incidents}[table]??[];
      const match=row=>filters.every(([k,v])=>v===null?row[k]==null:Array.isArray(v)?v.includes(row[k]):row[k]===v);
      if(action==='select'){
        rows=rows.filter(match);
        rows=[...rows].sort((x,y)=>{for(const [k,o] of orders){if(x[k]!==y[k])return (x[k]<y[k]?-1:1)*(o.ascending===false?-1:1)}return 0});
        if(cursor){const m=cursor.match(/^(created_at|updated_at|published_at)\.lt\.([^,]+),and\([^,]+,id\.lt\.([^)]+)\)$/);if(!m)throw Error('Invalid cursor');rows=rows.filter(r=>r[m[1]]<m[2]||r[m[1]]===m[2]&&r.id<m[3])}
        const count=options.count?rows.length:null;
        return {data:options.head?null:single?(rows[0]??null):rows.slice(skip,skip+take),count,error:null};
      }
      f.writes.push({table,action,values,filters});
      if(table==='notification_inbox'&&action==='update'){rows.filter(match).forEach(r=>Object.assign(r,values))}
      if(table==='announcement_reads'){const items=Array.isArray(values)?values:[values];if(action==='upsert')items.forEach(i=>{if(!f.reads.some(r=>r.announcement_id===i.announcement_id))f.reads.push(i)});if(action==='delete')f.reads=f.reads.filter(r=>!match(r))}
      emit(table);return {data:null,error:null};
    }
    function execute(single){return Promise.resolve().then(()=>{if(window.fixture.hold&&action!=='select')return new Promise(resolve=>window.fixture.waiting.push(()=>resolve(run(single))));return run(single)})}
    return q;
  },
  channel(name){const f=window.fixture;f.topics??=new Map();if(f.topics.has(name))return f.topics.get(name);const channel={on(event,filter,fn){if(channel.subscribed)throw Error('Channel reused while subscribed');f.channels.push({channel,table:filter.table,fn});return channel},subscribe(){channel.subscribed=true;return channel}};f.topics.set(name,channel);return channel},
  removeChannel(channel){const f=window.fixture;f.channels=f.channels.filter(c=>c.channel!==channel);return new Promise(resolve=>setTimeout(()=>{for(const [n,i] of f.topics??[])if(i===channel)f.topics.delete(n);resolve('ok')},40))},
  rpc(name,args){const f=window.fixture;f.rpcs.push({name,args});const go=()=>f.hold&&name==='notification_mark_scope_read'?new Promise(resolve=>f.waiting.push(()=>resolve(rpcRun(name,args)))):Promise.resolve(rpcRun(name,args));const p={abortSignal(){return p},then(ok,fail){return go().then(ok,fail)}};return p},
};`,
};
await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import News from '${root}/app/(app)/announcements.tsx';import {UnreadCountsProvider,useUnreadCounts} from '${root}/hooks/use-unread-counts.tsx';function Bell(){const c=useUnreadCounts();return <output data-testid="bell">{c.announcementsUnreadCount}</output>};const r=createRoot(document.getElementById('root'));let key=0;window.render=(remount=true)=>{if(remount)key++;r.render(<UnreadCountsProvider key={key}><Bell/><News/></UnreadCountsProvider>)}`, resolveDir: app, loader: 'tsx' },
  outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"', __DEV__: 'false' },
  plugins: [{ name: 'adapters', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: 'mock' };
      if (args.path.startsWith('@/')) { const p = path.join(app, 'src', args.path.slice(2)); return { path: p + (fs.existsSync(p + '.tsx') ? '.tsx' : '.ts') }; }
    });
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: app }));
  } }],
});
const options = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE };
if (!options.executablePath && !fs.existsSync(chromium.executablePath())) options.channel = 'chrome';
const browser = await chromium.launch(options);
const errors = [], passed = [];
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.evaluate(() => {
    const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
    const at = minutes => new Date(Date.UTC(2026, 9, 20, 12, 0) - minutes * 60000).toISOString().replace('Z', '000+00:00').replace('.000000+00:00', '.000000+00:00');
    const cats = ['general', 'emergency', 'health', 'events'];
    const ann = (n, i) => ({ id: uuid(n), barangay_id: 'b1', category: cats[i % 4], title: 'News ' + n, body: 'Summary ' + n, detailed_description: 'Full body ' + n, image_url: null, published_at: at(i), deleted_at: null });
    const inbox = (n, kind, title, destination, minutes, owner = 'resident') => ({ id: uuid(n), event_id: uuid(n + 5000), recipient_id: owner, kind, title, body: 'Body of ' + title, destination, created_at: at(minutes), read_at: null });
    const notice = (n, subtype, state, action, extra = {}) => ({ id: uuid(n), subtype, title: 'Notice ' + n, body: 'Notice body ' + n, state, starts_at: null, ends_at: null, expires_at: null, action, policy_key: subtype === 'policy' ? 'privacy_policy' : null, policy_effective_on: null, app_version_code: null, revision: 1, published_at: at(1), resolved_at: state === 'resolved' ? at(0) : null, cancelled_at: state === 'cancelled' ? at(0) : null, updated_at: at(0), ...extra });
    window.fixture = {
      params: {}, mode: 'light', accent: '#0F6E5B', font: 'system', reduced: true, session: { user: { id: 'resident' } }, noProfile: false,
      news: [ann(1, 0), ann(2, 1), ann(3, 2)],
      reads: [],
      inbox: [
        inbox(101, 'request_status', 'Request approved', { v: 1, kind: 'request', id: uuid(901) }, 10),
        inbox(102, 'payment', 'Payment received', { v: 1, kind: 'request', id: uuid(901) }, 11),
        inbox(103, 'incident_status', 'Report in progress', { v: 1, kind: 'incident', id: uuid(902) }, 12),
        inbox(104, 'account_verification', 'Valid ID approved', { v: 2, kind: 'account', screen: 'valid_id' }, 13),
        inbox(105, 'account_security', 'Password updated', { v: 2, kind: 'account', screen: 'change_password' }, 14),
        inbox(106, 'account_profile', 'Profile changed', { v: 2, kind: 'account', screen: 'profile' }, 15),
        inbox(201, 'system_service', 'Maintenance tonight', { v: 2, kind: 'notice', id: uuid(801) }, 20),
        inbox(202, 'system_update', 'Update available', { v: 2, kind: 'notice', id: uuid(802) }, 21),
        inbox(203, 'system_policy', 'Policy changed', { v: 2, kind: 'notice', id: uuid(803) }, 22),
        inbox(204, 'system_service', 'Old outage', { v: 2, kind: 'notice', id: uuid(804) }, 23),
        inbox(205, 'system_service', 'Removed notice', { v: 2, kind: 'notice', id: uuid(899) }, 24),
        inbox(301, 'account_profile', 'Another resident secret', { v: 2, kind: 'account', screen: 'profile' }, 5, 'other'),
      ],
      notices: [notice(801, 'service_status', 'published', 'services'), notice(802, 'app_update', 'published', 'health'), notice(803, 'policy', 'published', 'terms_privacy'), notice(804, 'service_status', 'resolved', 'maps')],
      incidents: [], writes: [], rpcs: [], bulk: [], routes: [], queries: [], channels: [], hold: false, waiting: [], failWrite: false, failTable: null, failRpc: null,
      helpers: { uuid, at, ann, inbox },
    };
  });
  await page.addScriptTag({ path: path.join(out, 'bundle.js') });
  const render = async (values = {}, remount = true) => { await page.evaluate(({ values, remount }) => { Object.assign(window.fixture, values); window.render(remount); }, { values, remount }); };
  const count = (name, exact = true) => page.getByText(name, { exact }).count();
  const cards = async () => (await page.getByRole('tab').allTextContents()).map(t => t.replace(/^\d+/, '').trim());
  const chipLabels = () => page.evaluate(() => [...document.querySelectorAll('[role="button"][aria-selected]')].map(e => e.textContent.trim()));
  const tab = name => page.getByRole('tab', { name: new RegExp('^' + name + '(,|$)') });
  const writes = table => page.evaluate(t => window.fixture.writes.filter(w => w.table === t), table);
  const bell = n => page.waitForFunction(v => document.querySelector('[data-testid=bell]').textContent === v, String(n));
  const settled = () => page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0);

  // R01: four cards in order, no heading, chips in the fixed order, All / All by default.
  await render();
  await page.getByText('News 1', { exact: true }).waitFor();
  assert.deepEqual(await cards(), ['All', 'Barangay', 'Account', 'System']);
  assert.equal(await count("What's New"), 0);
  assert.equal(await tab('All').getAttribute('aria-selected'), 'true');
  assert.deepEqual(await chipLabels(), ['All', 'General', 'Emergency', 'Health', 'Events', 'Account', 'System']);
  passed.push('four cards in order, no "What\'s New", All/All default and its seven chips');

  // Disjoint groups in fixed order Barangay → Account → System.
  await page.getByText('Request approved', { exact: true }).waitFor(); await page.getByText('Maintenance tonight', { exact: true }).waitFor();
  const order = await page.evaluate(() => ['Barangay · 3', 'Account · 6', 'System · 5'].map(t => document.body.innerText.indexOf(t)));
  assert.ok(order.every(i => i >= 0) && order[0] < order[1] && order[1] < order[2], 'group order ' + order);
  assert.equal(await count('Another resident secret'), 0);
  passed.push('All lists disjoint Barangay, Account, System groups with full counts and no foreign row');

  // R02: the card and chip switches use the server scope; the chip resets to All with the card.
  await tab('Account').click(); await page.getByText('Request approved', { exact: true }).waitFor();
  assert.deepEqual(await chipLabels(), ['All', 'Document Requests', 'Incident Reports', 'Verification', 'Security', 'Profile']);
  assert.equal(await count('News 1'), 0); assert.equal(await count('Maintenance tonight'), 0);
  assert.equal(await count('Account · 6'), 0, 'a single-group view has no redundant heading');
  await page.getByRole('button', { name: 'Security', exact: true }).click(); await page.getByText('Password updated', { exact: true }).waitFor();
  assert.equal(await count('Request approved'), 0);
  await tab('System').click(); await page.getByText('Maintenance tonight', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'All', exact: true }).getAttribute('aria-selected'), 'true', 'a card switch resets the chip');
  assert.deepEqual(await chipLabels(), ['All', 'Service Status', 'App Updates', 'Policies']);
  await tab('Barangay').click(); await page.getByRole('button', { name: 'Events', exact: true }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('News 1'));
  await tab('All').click(); await page.getByRole('button', { name: 'System', exact: true }).click(); await page.getByText('Old outage', { exact: true }).waitFor();
  assert.equal(await count('Request approved'), 0);
  passed.push('card switches reset the chip; every view lists exactly its own source and chip membership');

  // R05/R06: individual read, no business write.
  await render(); await page.getByText('Request approved', { exact: true }).waitFor();
  await bell(14); // the bell counts announcements + account + system (3 + 6 + 5)
  await page.getByRole('button', { name: 'Mark Request approved as read' }).click(); await page.getByRole('button', { name: 'Mark Request approved as unread' }).waitFor();
  await bell(13);
  await page.getByRole('button', { name: 'Mark Request approved as unread' }).click(); await page.getByRole('button', { name: 'Mark Request approved as read' }).waitFor();
  await bell(14);
  await page.getByRole('button', { name: 'Mark News 1 as read' }).click(); await page.getByRole('button', { name: 'Mark News 1 as unread' }).waitFor();
  assert.deepEqual((await writes('incidents')).concat(await writes('service_requests')), [], 'a read never touches request or report rows');
  await page.getByRole('button', { name: 'Mark News 1 as unread' }).click(); await page.getByRole('button', { name: 'Mark News 1 as read' }).waitFor();
  await render({ failWrite: true }, false);
  await page.getByRole('button', { name: 'Mark Report in progress as read' }).click(); await page.getByText('Could not update read status. Try again.').waitFor();
  await render({ failWrite: false }, false);
  passed.push('inbox/announcement read and unread converge in the bell, touch no business row, and a failed write is readable');

  // R04: bulk read covers the whole scope, collapsed and unloaded included.
  const writesBeforeBulk = await page.evaluate(() => window.fixture.writes.length);
  await page.getByRole('button', { name: /^Account, 6, expanded$/ }).click();
  assert.equal(await count('Request approved'), 0, 'collapsing hides rows');
  assert.equal(await page.evaluate(() => window.fixture.writes.length), writesBeforeBulk, 'collapsing writes nothing');
  await page.evaluate(() => { window.fixture.hold = true; });
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Mark all as read' }).dispatchEvent('click');
  await page.waitForFunction(() => window.fixture.waiting.length === 1);
  assert.equal(await page.evaluate(() => window.fixture.rpcs.filter(r => r.name === 'notification_mark_scope_read').length), 1, 'rapid taps start one bulk operation');
  await page.evaluate(() => { window.fixture.hold = false; window.fixture.waiting.splice(0).forEach(fn => fn()); });
  await page.getByText('You’re all caught up').waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.bulk), [{ view: 'all', chip: 'all', announcements: 3, notifications: 11 }], 'the collapsed Account rows were included');
  await bell(0);
  assert.equal(await page.evaluate(() => window.fixture.writes.length), writesBeforeBulk, 'bulk read is one RPC, not row writes');
  await page.getByRole('button', { name: /^Account, 6, collapsed$/ }).click(); await page.getByText('Request approved', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Mark all as read' }).isDisabled(), true);
  passed.push('bulk read: one atomic server scope call (collapsed groups included), rapid taps coalesce, counts reach zero, collapse writes nothing');
  await page.evaluate(() => { window.fixture.reads = []; window.fixture.inbox.forEach(r => { r.read_at = null; }); window.fixture.failRpc = 'notification_mark_scope_read'; });
  await render({});
  await page.getByText('14 unread').waitFor();
  await page.getByRole('button', { name: 'Mark all as read' }).click(); await page.getByText('Could not update read status. Try again.').waitFor();
  assert.equal(await page.getByText('14 unread').count(), 1, 'a failed bulk read keeps the true unread state');
  assert.equal(await page.getByText('You’re all caught up').count(), 0, 'a failed bulk read never reports success');
  passed.push('failed bulk read keeps the true unread state and shows a readable retry');

  // R08: opening rows.
  await render({ failRpc: null }); await page.getByText('Request approved', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.routes = []; });
  await page.getByRole('button', { name: /^Open notification: Request approved/ }).click();
  await page.waitForFunction(() => window.fixture.routes.length === 1);
  assert.deepEqual(await page.evaluate(() => window.fixture.routes), [{ push: '/services/requests/00000000-0000-4000-8000-000000000901' }]);
  await page.getByRole('button', { name: /^Open notification: Report in progress/ }).click();
  await page.waitForFunction(() => window.fixture.routes.length === 2);
  assert.deepEqual(await page.evaluate(() => window.fixture.routes[1]), { push: '/reports/00000000-0000-4000-8000-000000000902' });
  assert.equal(await page.evaluate(() => window.fixture.inbox.find(r => r.id.endsWith('101')).read_at !== null), true, 'opening marks only that event read');
  assert.equal(await page.evaluate(() => window.fixture.inbox.find(r => r.id.endsWith('102')).read_at), null);
  await page.getByRole('button', { name: /^Open notification: Valid ID approved/ }).click();
  await page.getByRole('heading', { name: 'Valid ID approved' }).waitFor();
  await page.getByRole('button', { name: 'Open Valid ID', exact: true }).click();
  await page.waitForFunction(() => window.fixture.routes.length === 3);
  assert.deepEqual(await page.evaluate(() => window.fixture.routes[2]), { navigate: '/settings/valid-id' });
  await page.getByRole('heading', { name: 'Valid ID approved' }).waitFor({ state: 'hidden' });
  passed.push('request/incident rows open their existing record and read only themselves; account events open one allowlisted screen action');

  // System notices: current state is re-read.
  await page.getByRole('button', { name: /^Open notification: Maintenance tonight/ }).click();
  await page.getByRole('button', { name: 'Open Services', exact: true }).waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^Open notification: Policy changed/ }).click();
  await page.getByRole('button', { name: 'Read Terms and Privacy', exact: true }).waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^Open notification: Old outage/ }).click();
  await page.getByText(/^Resolved /).waitFor(); assert.equal(await page.getByRole('button', { name: 'Open Maps', exact: true }).count(), 0, 'a resolved notice has no action');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^Open notification: Removed notice/ }).click();
  await page.getByText('This notice is no longer available.').waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => { window.fixture.failTable = 'system_notices'; });
  await page.getByRole('button', { name: /^Open notification: Update available/ }).click();
  await page.getByText('The current status could not be loaded.').waitFor(); assert.equal(await page.getByRole('button', { name: 'Open Health', exact: true }).count(), 0);
  await page.evaluate(() => { window.fixture.failTable = null; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('button', { name: 'Open Health', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  passed.push('System detail re-reads the notice: published action shown, resolved/missing/failed states have none, retry recovers');

  // Original announcement sheet, five open/close cycles.
  const readsBefore = (await writes('announcement_reads')).length;
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /^View announcement: News 2/ }).click(); await page.getByText('Full body 2').waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByText('Full body 2').waitFor({ state: 'hidden' });
  }
  assert.equal((await writes('announcement_reads')).length, readsBefore + 1, 'News 2 is marked read once, not on every open');
  passed.push('original announcement sheet opens/closes five times and marks read once');

  // Deep links beyond the loaded page and owner-checked notification entry.
  await page.evaluate(() => { const { ann, at } = window.fixture.helpers; window.fixture.news = Array.from({ length: 60 }, (_, i) => ann(1000 - i, i)); });
  await render({ params: { announcementId: '00000000-0000-4000-8000-000000000960' } });
  await page.getByText('Full body 960').waitFor(); assert.equal(await page.evaluate(() => window.fixture.params.announcementId), undefined);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await render({ params: { notificationId: '00000000-0000-4000-8000-000000000104' } });
  await page.getByRole('heading', { name: 'Valid ID approved' }).waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  await render({ params: { notificationId: '00000000-0000-4000-8000-000000000301' } });
  await page.getByText('This item is no longer available.').waitFor(); assert.equal(await count('Another resident secret'), 0);
  await render({ params: { announcementId: '00000000-0000-4000-8000-000000009999' } });
  await page.getByText('This item is no longer available.').waitFor();
  passed.push('announcement links resolve beyond the loaded page; a foreign or missing notification/announcement is unavailable, never disclosed');

  // F49: a failed fetch is a retryable load failure, never "no longer available"; the retry opens the item.
  await page.evaluate(() => { window.fixture.failTable = 'notification_inbox'; });
  await render({ params: { notificationId: '00000000-0000-4000-8000-000000000104' } });
  await page.getByText('This item could not be loaded. Check your connection and try again.').waitFor();
  assert.equal(await count('This item is no longer available.'), 0, 'a failed fetch must not claim the item is gone');
  await page.evaluate(() => { window.fixture.failTable = null; });
  await page.getByRole('button', { name: 'Retry loading item', exact: true }).click();
  await page.getByRole('heading', { name: 'Valid ID approved' }).waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await count('This item could not be loaded. Check your connection and try again.'), 0, 'the failure notice clears after a successful retry');
  passed.push('F49: a failed notification fetch shows a retryable load failure (not "no longer available") and the retry opens the item');

  // R02/R14: keyset paging, 25 rows per source, ties, and counts independent of loaded rows.
  await page.evaluate(() => { const { ann, at } = window.fixture.helpers; window.fixture.params = {};
    window.fixture.news = Array.from({ length: 1003 }, (_, i) => ({ ...ann(5000 + i, 0), category: 'general', published_at: '2026-10-20T00:00:00.123456+00:00', title: 'Bulk ' + i })); window.fixture.queries = []; window.fixture.rpcs = []; });
  await render({}); await page.getByText('Barangay · 1003').waitFor();
  const first = await page.evaluate(() => window.fixture.queries.filter(q => q.table === 'announcements' && q.count === 'exact' && !q.cursor).length);
  assert.ok(first >= 1);
  const loadMore = page.getByRole('button', { name: 'Load older announcements', exact: true });
  await loadMore.scrollIntoViewIfNeeded(); await settled();
  await loadMore.press('Enter');
  await page.waitForFunction(() => window.fixture.queries.filter(q => q.table === 'announcements' && q.cursor).length === 1);
  const cursor = await page.evaluate(() => window.fixture.queries.find(q => q.cursor).cursor);
  assert.match(cursor, /^published_at\.lt\.2026-10-20T00:00:00\.123456\+00:00,and\(published_at\.eq\./, 'keyset on (published_at, id), no offset');
  const limits = await page.evaluate(() => window.fixture.rpcs.filter(r => r.name === 'notification_inbox_page').map(r => r.args.p_limit));
  assert.ok(limits.length > 0 && limits.every(l => l === 25));
  passed.push('1003 tied-timestamp announcements: full count shown with 25 loaded, older page uses the (published_at, id) keyset, inbox pages request 25');

  // R11: one failed source does not hide the others; summary failure is unknown, not zero.
  await render({ failRpc: 'notification_inbox_page' });
  await page.getByText('Account notifications could not be loaded. Please try again.').waitFor();
  await page.getByText('System notices could not be loaded. Please try again.').waitFor();
  await page.getByText('Bulk 1002', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.failRpc = null; });
  await page.getByRole('button', { name: 'Retry loading' }).first().click(); await page.getByText('Request approved', { exact: true }).waitFor();
  await render({ failRpc: 'notification_hub_summary' });
  await page.getByText('Unread count unavailable').waitFor(); assert.equal(await page.getByRole('button', { name: 'Mark all as read' }).isDisabled(), true);
  await page.getByText('Bulk 1002', { exact: true }).waitFor();
  await render({ failRpc: null, noProfile: true });
  await page.getByText('Unread count unavailable').waitFor();
  passed.push('partial source failure keeps healthy groups and offers retry; a failed or unknown summary says "unavailable", never zero');

  // Guest.
  await page.evaluate(() => { window.fixture.rpcs = []; });
  await render({ session: null, noProfile: false, failRpc: null });
  await page.getByText('Bulk 1002', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Mark all as read' }).count(), 0); assert.equal(await count('Barangay · 1003'), 0);
  assert.equal(await page.evaluate(() => window.fixture.rpcs.some(r => r.name === 'notification_hub_summary')), false, 'guests call no private hub RPC');
  assert.deepEqual(await cards(), ['All', 'Barangay']);
  assert.deepEqual(await chipLabels(), ['All', 'General', 'Emergency', 'Health', 'Events']);
  await tab('Barangay').click(); await page.getByText('Bulk 1002', { exact: true }).waitFor();
  assert.equal(await tab('Barangay').getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => window.fixture.rpcs.some(r => r.name === 'notification_inbox_page')), false);
  passed.push('guest sees only All/Barangay cards and public filters, without private RPCs, counts or bulk read');

  // Signing out from either private card or All-view filter immediately returns to public All.
  for (const selection of ['Account', 'System']) {
    for (const control of ['card', 'chip']) {
      await render({ session: { user: { id: 'resident' } } });
      await page.getByText('Request approved', { exact: true }).waitFor();
      if (control === 'card') await tab(selection).click();
      else await page.getByRole('button', { name: selection, exact: true }).click();
      await render({ session: null }, false);
      await page.getByText('Bulk 1002', { exact: true }).waitFor();
      assert.deepEqual(await cards(), ['All', 'Barangay']);
      assert.equal(await tab('All').getAttribute('aria-selected'), 'true');
      assert.deepEqual(await chipLabels(), ['All', 'General', 'Emergency', 'Health', 'Events']);
    }
  }
  passed.push('signing out from Account/System cards or filters resets to public All without remounting');

  // Account switch and stale responses.
  await page.evaluate(() => { window.fixture.news = window.fixture.news.slice(0, 3); });
  await render({ session: { user: { id: 'resident' } } }); await page.getByText('Request approved', { exact: true }).waitFor();
  await render({ session: { user: { id: 'other' } } }, false); await page.getByText('Another resident secret', { exact: true }).waitFor();
  assert.equal(await count('Request approved'), 0, 'rows of the previous resident are replaced');
  await render({ session: { user: { id: 'resident' } } }, false);

  // Realtime invalidation and subscription ownership under rapid switching.
  await render({}); await page.getByText('Request approved', { exact: true }).waitFor();
  for (let i = 0; i < 5; i++) for (const name of ['Account', 'System', 'Barangay', 'All']) await tab(name).click();
  await page.getByText('Request approved', { exact: true }).waitFor(); await page.waitForTimeout(150);
  const channels = await page.evaluate(() => ({ n: window.fixture.channels.length, topics: window.fixture.topics.size }));
  assert.equal(channels.n, 7, 'hub channel (3 listeners) + provider channels (4), no accumulation');
  await page.evaluate(() => { window.fixture.inbox.push(window.fixture.helpers.inbox(120, 'account_profile', 'Arrived later', { v: 2, kind: 'account', screen: 'profile' }, 1)); window.fixture.channels.filter(c => c.table === 'notification_inbox').forEach(c => c.fn()); });
  await page.getByText('Arrived later', { exact: true }).waitFor();
  // A bulk read reports one realtime event per changed row: 100 events on every listener refetch the hub and the unread provider once each.
  await page.evaluate(() => { window.fixture.rpcs = []; window.fixture.queries = []; for (let row = 0; row < 100; row++) window.fixture.channels.forEach(c => c.fn()); });
  await page.waitForTimeout(1500);
  const burst = await page.evaluate(() => ({ summaries: window.fixture.rpcs.filter(r => r.name === 'notification_hub_summary').length, pages: window.fixture.rpcs.filter(r => r.name === 'notification_inbox_page').length, reads: window.fixture.queries.filter(q => q.table === 'announcement_reads').length }));
  assert.ok(burst.summaries >= 1 && burst.summaries <= 5 && burst.pages <= 2 && burst.reads <= 1, `one refetch per burst, not per row (${JSON.stringify(burst)})`);
  assert.equal(await page.evaluate(() => window.pullControls.size), 1, 'the hub list is the only pull scroller');
  await page.evaluate(() => { window.fixture.queries = []; window.fixture.rpcs = []; [...window.pullControls][0].current.onRefresh(); });
  await page.waitForFunction(() => ![...window.pullControls][0].current.refreshing);
  assert.equal(await page.evaluate(() => window.fixture.channels.length), channels.n, 'a pull opens no realtime channel');
  assert.equal(await page.evaluate(() => window.fixture.rpcs.filter(r => r.name === 'notification_mark_scope_read').length), 0, 'refresh never writes read state');
  passed.push('account replacement, five rapid card cycles keep one hub channel, realtime arrival appears, 700 row events cause one refetch per owner, a pull reloads without writes or new channels');

  // R12 subset: themes, font, accent, widths.
  for (const [mode, accent, font] of [['dark', '#ffffff', 'georgia'], ['light', '#cc3366', 'system']]) {
    await render({ mode, accent, font }); await page.getByText('Request approved', { exact: true }).waitFor();
    for (const width of [320, 360, 400, 412]) { await page.setViewportSize({ width, height: 800 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${mode} ${width}px overflow`); }
    await page.screenshot({ path: path.join(out, `hub-${mode}.png`) });
  }
  passed.push('light/dark, custom accent and selected font at 320–412px without page overflow');

  // Confirmed-empty sources are omitted; a wholly empty view says so per view.
  await page.setViewportSize({ width: 400, height: 900 });
  await page.evaluate(() => { window.fixture.news = []; window.fixture.inbox = []; });
  await render({ mode: 'light', accent: '#0F6E5B', font: 'system' });
  await page.getByText('Nothing here yet.').waitFor(); assert.equal(await count('Barangay · 0'), 0);
  await tab('Account').click(); await page.getByText('No account notifications yet.').waitFor();
  await tab('System').click(); await page.getByText('No system notices yet.').waitFor();
  await tab('Barangay').click(); await page.getByText('No announcements yet.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Mark all as read' }).isDisabled(), true);
  passed.push('empty sources are omitted and each view reports its own empty state with bulk read disabled');

  const baselineWarnings = ['"shadow*" style props are deprecated. Use "boxShadow".', 'props.pointerEvents is deprecated. Use style.pointerEvents'];
  const newDiagnostics = errors.filter(value => !baselineWarnings.includes(value));
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed, diagnostics: errors, newDiagnostics }, null, 2));
  assert.deepEqual(newDiagnostics, []);
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  const pages = browser.contexts().flatMap(context => context.pages());
  if (pages[0]) fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ text: await pages[0].evaluate(() => document.body.innerText).catch(() => null), fixture: await pages[0].evaluate(() => ({ rpcs: window.fixture.rpcs.slice(-6), bulk: window.fixture.bulk, params: window.fixture.params })).catch(() => null), errors }, null, 2));
  throw error;
} finally { await browser.close(); }
