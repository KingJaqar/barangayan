import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const src = path.join(app, 'src').replaceAll('\\', '/');
const shared = path.resolve(app, '../../packages/shared/src').replaceAll('\\', '/');
const development = process.env.TEST_REACT_MODE === 'development';
const out = process.env.TEST_ARTIFACTS_DIR ?? path.resolve(app, '../../tmp/resident-android-magicpatterns-phase-15-20261021/ui');
fs.mkdirSync(out, { recursive: true });

// Real routes, content hooks, Markdown renderer, primitives and motion controller.
// Only remote/device boundaries are synthetic; this does not qualify Android rendering.
const adapters = {
  'react-native': `import React from 'react';import * as R from 'react-native-web';export * from 'react-native-web';
    const clean=({pointerEvents,style,...p})=>({...p,style:[style,pointerEvents?{pointerEvents}:null]});
    export const View=React.forwardRef((p,r)=><R.View {...clean(p)} ref={r}/>);
    export const Animated={...R.Animated,View:React.forwardRef((p,r)=><R.Animated.View {...clean(p)} ref={r}/>),timing:(v,o)=>{window.fixture.durations.push(o.duration);return R.Animated.timing(v,{...o,useNativeDriver:false})}};
    export const Pressable=React.forwardRef(({accessibilityState,...p},r)=><R.Pressable {...p} ref={r} aria-selected={accessibilityState?.selected} aria-expanded={accessibilityState?.expanded}/>);
    export const Platform={...R.Platform,OS:'android',select:o=>o.android??o.default};
    export const Linking={openURL:async url=>{window.fixture.links.push(url)}};
    export const AccessibilityInfo={isReduceMotionEnabled:async()=>window.fixture.reduced,addEventListener:(e,fn)=>{window.fixture.listeners.add(fn);return{remove:()=>window.fixture.listeners.delete(fn)}}};`,
  'expo-router': `export const useRouter=()=>({back:()=>window.go(window.fixture.origin),push:r=>{window.fixture.origin=window.fixture.screen;window.fixture.articleId=r.params.articleId;window.go('article')}});export const useLocalSearchParams=()=>({articleId:window.fixture.articleId});`,
  'react-native-safe-area-context': `import {View} from 'react-native';export const SafeAreaView=({edges,...p})=><View {...p}/>;export const useSafeAreaInsets=()=>({top:0,left:0,right:0,bottom:24});`,
  'expo-image': `import React from 'react';import {View} from 'react-native';export const Image=({source,contentFit,...p})=><View {...p} data-photo={source?.uri} data-fit={contentFit}/>;`,
  'expo-constants': `export default {expoConfig:{version:'9.8.7'}};`,
  '@expo/vector-icons': `import React from 'react';import {View} from 'react-native';export const Ionicons=({name,size})=><View aria-hidden="true" data-icon={name} style={{width:size,height:size,flexShrink:0}}/>;Ionicons.glyphMap={};`,
  'react-native-reanimated': `import {useRef} from 'react';import {View,Easing} from 'react-native';export default {View};export const useSharedValue=v=>useRef({value:v}).current;export const useAnimatedStyle=f=>f();export const withTiming=(v,o)=>{window.fixture.durations.push(o?.duration);return v};export const withSpring=v=>v;export const cancelAnimation=()=>{};export {Easing};`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:{barangay_id:window.fixture.tenant}});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:window.fixture.font});`,
  '@/hooks/use-theme': `import {Colors} from '${src}/constants/theme';import {getResidentTheme} from '${src}/constants/resident-theme';export const useTheme=()=>({...Colors[window.fixture.mode],primary:window.fixture.accent,resident:getResidentTheme(window.fixture.mode,window.fixture.accent)});`,
  '@barangayan/shared': `export {FAQ_CATEGORIES,FAQ_CATEGORY_META} from '${shared}/schemas/faq';export {SITE_CONTENT_SECTION_META} from '${shared}/schemas/site-content';export {ACCENT_COLORS} from '${shared}/constants/theme-colors';export {FONT_OPTIONS,DEFAULT_FONT_ID} from '${shared}/constants/theme-fonts';`,
  '@/lib/supabase': `export const supabase={from:table=>{
    const call={table,ops:[]};window.fixture.reads.push(call);const q={};
    for(const method of ['select','eq','is','order','single','maybeSingle'])q[method]=(...args)=>{call.ops.push([method,...args]);return q};
    q.then=resolve=>new Promise(r=>setTimeout(r,window.fixture.delay)).then(()=>{
      const error=window.fixture.errors[table];let data=window.fixture.rows[table]??[];
      for(const [method,column,value] of call.ops)if(method==='eq'||method==='is')data=data.filter(row=>row[column]===value);
      if(call.ops.some(op=>op[0]==='single'||op[0]==='maybeSingle'))data=data[0]??null;
      return resolve({data,error:error?{message:error}:null});});return q;},
    channel:name=>{const c={name,events:[],on:(type,filter,fn)=>{c.events.push({filter,fn});return c},subscribe:()=>{window.fixture.channels.add(c);return c}};return c},
    removeChannel:c=>window.fixture.channels.delete(c)};`,
};

await build({loader:{'.js':'jsx'},stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
import Help from '${src}/app/(app)/settings/help/index';import Article from '${src}/app/(app)/settings/help/[articleId]';
import Legal from '${src}/app/(app)/settings/terms-privacy';import About from '${src}/app/(app)/settings/about';
import {MOBILE_FONT_OPTIONS,getMobileFontFamily} from '${src}/constants/fonts';
const categories=['general','services','emergency','health','billing','account'];
const common={barangay_id:'tenant',is_active:true,deleted_at:null};
window.fixture={screen:'help',origin:'help',tenant:'tenant',font:'system',mode:'light',accent:'#0F6E5B',reduced:false,listeners:new Set(),channels:new Set(),reads:[],links:[],durations:[],delay:40,errors:{},fonts:MOBILE_FONT_OPTIONS.map(f=>f.id),rows:{
faq_articles:categories.map((category,i)=>({...common,id:'faq'+i,category,question:'Question '+category,answer:'First line\\nSecond line '+category,sort_order:i})).concat([
{...common,id:'long',category:'general',question:'Long managed question '.repeat(8),answer:'Long answer '.repeat(140)+'ARTICLE END',sort_order:9},
{...common,id:'other',barangay_id:'other',question:'Foreign tenant'}, {...common,id:'deleted',deleted_at:'gone',question:'Deleted article'}, {...common,id:'inactive',is_active:false,question:'Inactive article'}]),
site_content:[{...common,id:'terms',section:'terms_of_service',title:'Managed terms title',body:'# Stored heading\\n\\n1. First rule\\n2. Second rule\\n\\n**Bold content** and *italic content*.\\n\\n[Policy link](https://example.invalid/policy)\\n\\n'+('Long stored text '.repeat(160))+'POLICY END'},
{...common,id:'privacy',section:'privacy_policy',title:'Managed privacy title',body:'## Privacy heading\\n\\n- One\\n- Two\\n\\nPRIVACY END'}],
about_us:[{...common,id:'about',title:'Managed barangay title',mission:'Mission managed text',vision:'Vision managed text',history:'Undated managed history '.repeat(40)+'HISTORY END',contact_email:'office@example.invalid',contact_phone:'000-000',address:'Managed address',logo_url:null,logo_size:80}],
developer_profiles:Array.from({length:17},(_,i)=>({id:'dev'+i,about_us_id:'about',barangay_id:'tenant',deleted_at:null,name:'Developer '+i,role:'Managed role '+i,bio:'Full biography '+i,photo_url:null,sort_order:i}))}};
window.expectedFont=getMobileFontFamily;window.initialRows=structuredClone(window.fixture.rows);
const root=createRoot(document.getElementById('root'));const screens={help:Help,article:Article,legal:Legal,about:About};
window.renderFixture=()=>{const C=screens[window.fixture.screen];root.render(C?<C/>:null)};window.go=s=>{window.fixture.screen=s;window.renderFixture()};
window.notify=table=>{for(const c of window.fixture.channels)for(const e of c.events)if(e.filter.table===table)e.fn()};window.renderFixture();`,loader:'jsx',resolveDir:app},outfile:path.join(out,'bundle.js'),bundle:true,format:'iife',jsx:'automatic',define:{__DEV__:String(development),global:'globalThis','process.env.NODE_ENV':JSON.stringify(development?'development':'production')},plugins:[{name:'synthetic-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path in adapters?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:adapters[a.path],loader:'jsx',resolveDir:app}));}}]});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'});
const errors=[],passed=[];let page;
// Exact pre-existing RN Web diagnostic retained in the development baseline, not suppressed.
const expectedDiagnostics=development?['"shadow*" style props are deprecated. Use "boxShadow".']:[];
try {
  page=await browser.newPage({viewport:{width:400,height:844}});page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
  await page.setContent('<html><head><style>html,body,#root{margin:0;height:100%;display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({path:path.join(out,'bundle.js')});
  const settle=()=>page.waitForTimeout(420);
  const go=async s=>{await page.evaluate(s=>window.go(s),s);await settle()};
  const tab=name=>page.getByRole('tab',{name,exact:true});
  const button=name=>page.getByRole('button',{name,exact:true});
  if(development){
    await go('about');await page.getByText('Mission managed text',{exact:true}).waitFor();
    assert.deepEqual(errors,expectedDiagnostics);
    await tab('Vision').click();await page.getByText('Vision managed text',{exact:true}).waitFor();
    await button('Read full story').click();await page.evaluate(()=>window.notify('about_us'));await settle();
    await page.getByText('Vision managed text',{exact:true}).waitFor();await button('Show less history').waitFor();
    for(let i=0;i<5;i++){await go('help');await go('about');await page.getByText('Mission managed text',{exact:true}).waitFor()}
    await go('none');assert.equal(await page.evaluate(()=>window.fixture.channels.size),0);assert.equal(await page.evaluate(()=>window.fixture.listeners.size),0);
    passed.push('React development build: no duplicate-key or new console diagnostics across About navigation/refresh/repeated visits; purpose/history identity survives refresh; known RN Web shadow warning retained');
  }else{
  await page.getByText('7 articles',{exact:true}).waitFor();
  for(const label of ['All','General','Services','Emergency','Health','Billing','Account']){
    await tab(label).scrollIntoViewIfNeeded();await tab(label).click();await settle();assert.equal(await tab(label).getAttribute('aria-selected'),'true');
    if(label!=='All')await page.getByText('Question '+label.toLowerCase(),{exact:true}).waitFor();
  }
  assert.equal(await page.getByText('Foreign tenant',{exact:true}).count(),0);assert.equal(await page.getByText('Deleted article',{exact:true}).count(),0);
  const call=await page.evaluate(()=>window.fixture.reads[0]);assert.ok(call.ops.some(op=>JSON.stringify(op)==='["eq","barangay_id","tenant"]'));assert.ok(call.ops.some(op=>op[0]==='order'&&op[1]==='sort_order'));
  passed.push('all seven labels/filter selections and overflow reachable; real FAQ hook retains tenant/active/deleted/order constraints');
  await tab('General').scrollIntoViewIfNeeded();await tab('General').click();await button('Read article: '+('Long managed question '.repeat(8))).click();await page.getByText(/ARTICLE END/).waitFor();
  await button('Go back').click();await settle();await page.getByText('7 articles',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.articleId='deleted';window.go('article')});await settle();await page.getByText('Article not found',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.articleId='faq0';window.fixture.origin='search';window.go('none')});await go('article');await button('Go back').click();assert.equal(await page.evaluate(()=>window.fixture.screen),'search');
  passed.push('long full article/newlines, deleted article and Back to originating Help/Search');
  await go('help');await page.evaluate(()=>{window.fixture.errors.faq_articles='offline';window.notify('faq_articles')});await page.getByText('Unable to load help articles',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.errors.faq_articles=null});await button('Retry').click();await page.getByText('7 articles',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.rows.faq_articles=[];window.notify('faq_articles')});await page.getByText('No articles available yet.',{exact:true}).waitFor();
  passed.push('Help loading/error/manual retry and empty data');
  await go('legal');await page.getByText(/POLICY END/).waitFor();await page.getByText('Stored heading',{exact:true}).waitFor();await page.getByText('Policy link',{exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.fixture.links),['https://example.invalid/policy']);
  await tab('Privacy Policy').click();await page.getByText('PRIVACY END',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.rows.site_content=window.fixture.rows.site_content.filter(r=>r.section!=='terms_of_service');window.notify('site_content')});await settle();await tab('Terms of Service').click();await page.getByText('Terms of Service content is not yet available.',{exact:true}).waitFor();
  await tab('Privacy Policy').click();await page.getByText('PRIVACY END',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.errors.site_content='offline';window.notify('site_content')});await page.getByText('Unable to load policies',{exact:true}).waitFor();await page.evaluate(()=>{window.fixture.errors.site_content=null});await button('Retry').click();await page.getByText('PRIVACY END',{exact:true}).waitFor();
  passed.push('full stored Markdown including tail/headings/list/emphasis/link dispatch; both legal tabs; missing body; explicit error/retry');
  await go('about');await page.getByText('Mission managed text',{exact:true}).waitFor();const reads=await page.evaluate(()=>window.fixture.reads.length);
  await tab('Vision').click();await page.getByText('Vision managed text',{exact:true}).waitFor();
  for(let i=0;i<5;i++){await tab('Mission').click();await page.waitForTimeout(45);await tab('Vision').click()}
  await settle();await page.getByText('Vision managed text',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.fixture.reads.length),reads);
  assert.ok((await page.evaluate(()=>window.fixture.durations)).includes(160));assert.ok((await page.evaluate(()=>window.fixture.durations)).includes(220));
  for(let i=0;i<5;i++){await button('Read full story').click();await page.getByText(/HISTORY END/).waitFor();await button('Show less history').click()}
  for(const text of ['office@example.invalid','000-000','Managed address','Developer 16','Full biography 16','v9.8.7'])await page.getByText(text,{exact:true}).waitFor();
  assert.equal(await page.getByText(/Developer \d+$/).count(),17);assert.equal(await page.evaluate(()=>window.fixture.reads.length),reads);
  passed.push('Mission/Vision wait sequence/rapid reversal settles on latest choice; history expands immediately; all17developers/bios/contacts/actual version; presentation dispatches no extra queries');
  await button('Read full story').click();await page.evaluate(()=>window.notify('about_us'));await settle();
  await page.getByText('Vision managed text',{exact:true}).waitFor();await button('Show less history').waitFor();await button('Show less history').click();
  passed.push('same-record content refresh preserves selected purpose and expanded history without remounting them');
  await page.screenshot({path:path.join(out,'about-light.png')});
  await page.evaluate(()=>{window.fixture.reduced=true;for(const fn of window.fixture.listeners)fn(true)});await settle();const durationStart=await page.evaluate(()=>window.fixture.durations.length);
  await tab('Mission').click();await page.getByText('Mission managed text',{exact:true}).waitFor();await button('Read full story').click();await settle();
  assert.ok((await page.evaluate(n=>window.fixture.durations.slice(n),durationStart)).every(d=>d<=100));
  const fonts=await page.evaluate(()=>window.fixture.fonts);
  for(const width of [320,360,412]){await page.setViewportSize({width,height:740});for(const mode of ['light','dark'])for(const font of fonts){await page.evaluate(({mode,font})=>{window.fixture.mode=mode;window.fixture.font=font;window.fixture.accent=mode==='dark'?'#FFFFFF':'#000000';window.renderFixture()},{mode,font});await page.getByText('Mission managed text',{exact:true}).waitFor()}}
  await page.screenshot({path:path.join(out,'about-dark-long.png')});
  passed.push('reduced motion removes purpose/history geometric animation;10font choices in light/dark extreme accents at320/360/412browser widths remain rendered (native font scale/fidelity unqualified)');
  await page.evaluate(()=>{window.fixture.rows=structuredClone(window.initialRows);window.fixture.articleId='faq0'});
  for(const [screen,text] of [['help','Question general'],['article','First line\nSecond line general'],['legal','Stored heading'],['about','Mission managed text']]){
    await go(screen);
    for(const mode of ['light','dark'])for(const font of fonts){
      await page.evaluate(({mode,font})=>{window.fixture.mode=mode;window.fixture.font=font;window.fixture.accent=mode==='dark'?'#FFFFFF':'#000000';window.renderFixture()},{mode,font});
      const label=page.getByText(text,{exact:true});await label.waitFor();
      const actual=await label.evaluate(el=>getComputedStyle(el).fontFamily);const expected=await page.evaluate(font=>window.expectedFont(font),font);
      if(expected)assert.equal(actual,expected);assert.equal(await button('Go back').count(),1);
    }
    const header=page.getByRole('heading').first();assert.equal(await header.evaluate(el=>getComputedStyle(el).fontFamily),'GideonRoman');
    await page.screenshot({path:path.join(out,screen+'-dark-font.png')});
  }
  passed.push('each route and rendered Markdown headings inherit all10selected font mappings in both themes; header keeps Gideon; one Back header per route');
  await page.evaluate(()=>{window.fixture.rows.about_us[0].mission='';window.notify('about_us')});await settle();await tab('Vision').waitFor();assert.equal(await tab('Mission').count(),0);await page.getByText('Vision managed text',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.errors.developer_profiles='offline';window.notify('developer_profiles')});await page.getByText('Unable to load all About Us content',{exact:true}).waitFor();await page.evaluate(()=>{window.fixture.errors.developer_profiles=null});await button('Retry').click();await page.getByText('Developer 16',{exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.rows.about_us=[];window.notify('about_us')});await page.getByText('About Us content is not yet available.',{exact:true}).waitFor();
  for(let i=0;i<5;i++){await go('legal');await go('about');await go('help')}
  await go('none');assert.equal(await page.evaluate(()=>window.fixture.channels.size),0);assert.equal(await page.evaluate(()=>window.fixture.listeners.size),0);
  passed.push('single purpose, About partial failure/retry and empty state; repeated route mount/unmount removes all channels and motion listeners');
  }
  assert.deepEqual(errors,expectedDiagnostics);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,errors,native:false},null,2));console.log(JSON.stringify({passed,errors},null,2));
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({passed,errors,error:String(error)},null,2));if(page){fs.writeFileSync(path.join(out,'failure.html'),await page.content());await page.screenshot({path:path.join(out,'failure.png')})}throw error}finally{await browser.close()}
