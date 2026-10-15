/* Browser rehearsal of the real Android screen through React Native Web.
 * Auth, storage, OCR, and hardware camera are fixtures; no external writes. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist/valid-id-qa/browser');
fs.mkdirSync(output, { recursive: true });
const app = path.join(root, 'apps/resident-android-mobile/src');
const glyphs = require('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" rx="24" fill="#e7eeeb"/><rect x="24" y="24" width="592" height="64" rx="12" fill="#0f6e5b"/><text x="44" y="66" font-family="Arial" font-size="26" fill="white">SAMPLE FRONT ID</text><rect x="40" y="120" width="136" height="180" rx="12" fill="#c4d2cb"/><text x="206" y="150" font-family="Arial" font-size="28">ANA REYES</text><text x="206" y="198" font-family="Arial" font-size="20">Birth date: 2000-02-29</text><text x="206" y="242" font-family="Arial" font-size="20">ID number: 12345</text><text x="40" y="354" font-family="Arial" font-size="18">Sample data for interface testing</text></svg>';
const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const mocks = {
  'expo-router': `import {useEffect} from 'react'; export const useRouter=()=>({back:()=>window.fixture.back++,dismissTo:()=>window.fixture.back++}); export const useFocusEffect=cb=>useEffect(cb,[cb]); export const Link=({children})=>children;`,
  'expo-crypto': 'export const randomUUID=()=>crypto.randomUUID();',
  '@expo/vector-icons': `import {Text} from 'react-native'; export function Ionicons({name,size,color,...props}){return <Text {...props} style={{fontFamily:'Ionicons',fontSize:size,color}}>{String.fromCodePoint((${JSON.stringify(glyphs)})[name]||0)}</Text>} Ionicons.glyphMap=${JSON.stringify(glyphs)};`,
  'expo-image': `import {Image as NativeImage} from 'react-native'; export const Image=({contentFit, ...props})=><NativeImage {...props} resizeMode={contentFit==='contain'?'contain':'cover'}/>;`,
  'expo-camera': `import {forwardRef,useEffect,useImperativeHandle} from 'react'; import {View} from 'react-native'; export const useCameraPermissions=()=>[{granted:false,canAskAgain:true},async()=>({granted:window.fixture.mode!=='deny',canAskAgain:true})]; export const CameraView=forwardRef(({onCameraReady,style},ref)=>{useEffect(()=>{onCameraReady()},[]);useImperativeHandle(ref,()=>({takePictureAsync:async()=>({uri:${JSON.stringify(uri)},base64:'AQID'})}));return <View style={[style,{backgroundColor:'#ccd6d0'}]}/>});`,
  'react-native-safe-area-context': `import {View} from 'react-native'; export const SafeAreaView=({edges,...props})=><View {...props}/>; export const useSafeAreaInsets=()=>({top:24,bottom:24,left:0,right:0});`,
  '@/hooks/use-auth': `export const useAuth=()=>({session:{user:{id:'b1180000-0000-4000-8000-000000000001'}}});`,
  '@/hooks/use-profile': `export const useProfile=()=>({profile:{id:'b1180000-0000-4000-8000-000000000001',id_verification_status:null},isLoading:false,error:null,refetch:()=>window.fixture.refetch++});`,
  '@/hooks/use-font-preference': `export const useFontPreference=()=>({fontId:'system'});`,
  '@/hooks/use-theme-preference': `export const useThemePreference=()=>({scheme:new URLSearchParams(location.search).get('theme')||'light',accentColor:'#0F6E5B'});`,
  '@/lib/image-upload': `export const ACCEPTED_IMAGE_MIME_TYPES=['image/jpeg','image/png','image/webp']; export const imageExtension=mime=>mime==='image/png'?'png':'jpg'; export const pickImageAsset=async()=>window.fixture.mode==='cancel'?null:({uri:${JSON.stringify(uri)},mimeType:window.fixture.mode==='unsupported'?'image/gif':'image/png',size:window.fixture.mode==='oversize'?5242881:3,name:'front.png'});export const readImageBytes=async()=>new Uint8Array([1,2,3]);`,
  '@/lib/supabase': `const files=new Map();const bucket={upload:async(path,bytes)=>{files.set(path,bytes);window.fixture.uploads.push(path);return {error:null}},download:async(path)=>({data:window.fixture.mode==='native-blob'?{fixtureBytes:files.get(path),size:files.get(path).length}:new Blob([files.get(path)]),error:null})};export const supabase={auth:{getUser:async()=>({data:{user:{id:'b1180000-0000-4000-8000-000000000001'}},error:null})},storage:{from:()=>bucket},functions:{invoke:async()=>window.fixture.mode==='failed'?({error:new Error('OCR offline')}):({data:{details:{fullName:'Ana Reyes',idNumber:'12345',birthDate:'2000-02-29',address:'12 Main St'}},error:null})},rpc:async(name,{p_input})=>{window.fixture.submissions.push(p_input);if(window.fixture.mode==='submit-failed'&&window.fixture.submissions.length===1)return {error:new Error('Submission interrupted. Retry.')};return {data:p_input.submissionId,error:null}}};`,
};
async function main() {
  await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Screen from ${JSON.stringify(path.join(app,'app/(app)/settings/valid-id.tsx'))};window.fixture={mode:new URLSearchParams(location.search).get('mode')||'',uploads:[],submissions:[],back:0,refetch:0};const BrowserReader=window.FileReader;window.FileReader=class extends BrowserReader{readAsArrayBuffer(blob){super.readAsArrayBuffer(blob.fixtureBytes?new Blob([blob.fixtureBytes]):blob)}};createRoot(document.getElementById('root')).render(<Screen/>);`, resolveDir: root, loader: 'tsx' },
    bundle: true, outfile: path.join(output, 'app.js'), platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"', '__DEV__': 'false' },
    plugins: [{ name: 'test-fixtures', setup(build) {
      build.onResolve({filter:/.*/}, args => {
        if (mocks[args.path]) return {path:args.path,namespace:'fixtures'};
        if (args.path==='./supabase' && args.importer.endsWith('valid-id.ts')) return {path:'@/lib/supabase',namespace:'fixtures'};
        if (args.path==='react-native') return {path:require.resolve('react-native-web')};
        if (args.path.endsWith('.css')) return {path:args.path,namespace:'empty-css'};
        if (args.path.startsWith('@/')) return {path:resolveSource(args.path.slice(2))};
      });
      build.onLoad({filter:/.*/,namespace:'fixtures'}, args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));
      build.onLoad({filter:/.*/,namespace:'empty-css'}, ()=>({contents:'',loader:'js'}));
    }}],
  });
  fs.copyFileSync(path.join(root,'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),path.join(output,'icons.ttf'));
  fs.copyFileSync(path.join(app,'../assets/fonts/GideonRoman-Regular.ttf'),path.join(output,'header.ttf'));
  fs.writeFileSync(path.join(output,'index.html'), '<!DOCTYPE html><meta name="viewport" content="width=device-width, initial-scale=1"><style>@font-face{font-family:Ionicons;src:url(/icons.ttf)}@font-face{font-family:GideonRoman;src:url(/header.ttf)}html,body,#root{margin:0;height:100%;font-family:Arial}#root{display:flex;flex-direction:column}</style><div id="root"></div><script src="/app.js"></script>');
  const server=http.createServer((req,res)=>{const name=req.url.split('?')[0];const file=path.join(output,name==='/'?'index.html':name.slice(1));if(!file.startsWith(output)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'font/ttf');res.end(fs.readFileSync(file))});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true}).catch(error=>{server.close();throw error;});
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  const button=label=>page.getByRole('button',{name:label,exact:true});
  const begin=async query=>{await page.goto(url+'/'+(query||''));await button('Select ID type').click();await page.getByRole('radio',{name:'PhilSys',exact:true}).click();await button('Continue').click();};
  try {
    await page.goto(url);await page.screenshot({path:path.join(output,'step1.png')});
    await begin();await button('Upload a photo').click();await button('Continue').click();
    await page.getByRole('textbox',{name:'Full name',exact:true}).fill('Ana Maria Reyes');
    assert.equal(await page.getByRole('textbox',{name:'Date of birth (if shown)',exact:true}).count(),0);
    await button('Date of birth (if shown)').click();
    await page.getByText('Use date',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState!=='running'));
    await page.screenshot({path:path.join(output,'birthday-wheel.png')});
    await page.getByTestId('birthday-year-wheel').getByText('2001',{exact:true}).click();
    await button('Use date').click();await page.getByText('February 28, 2001',{exact:true}).waitFor();
    await button('Date of birth (if shown)').click();await page.getByTestId('birthday-month-wheel').getByText('March',{exact:true}).click();
    await button('Cancel birthday selection').last().click();await page.getByText('February 28, 2001',{exact:true}).waitFor();
    await page.screenshot({path:path.join(output,'step3.png')});
    await button('Previous step').click();await page.screenshot({path:path.join(output,'step2.png')});await button('Continue').click();
    assert.equal(await page.getByRole('textbox',{name:'Full name',exact:true}).inputValue(),'Ana Maria Reyes');
    await button('Continue').click();assert.equal(await page.getByRole('textbox').count(),0);
    await page.screenshot({path:path.join(output,'step4.png')});await button('Submit').click();await page.getByText('ID submitted',{exact:true}).waitFor();
    const publication=await page.evaluate(()=>window.fixture.submissions[0]);
    assert.equal(publication.confirmedDetails.fullName,'Ana Maria Reyes');assert.equal(publication.backPath,undefined);
    assert.equal(publication.confirmedDetails.birthDate,'2001-02-28');
    await begin('?mode=native-blob');await button('Upload a photo').click();await button('Continue').click();await button('Continue').click();await button('Submit').click();await page.getByText('ID submitted',{exact:true}).waitFor();
    await begin('?mode=failed');await button('Upload a photo').click();await button('Enter details manually').click();await page.getByRole('textbox',{name:'Full name',exact:true}).fill('Manual Name');await button('Continue').click();await button('Submit').click();await page.getByText('ID submitted',{exact:true}).waitFor();
    await begin();await button('Upload a photo').click();await button('Continue').click();await button('Date of birth (if shown)').click();await button('Date of birth not shown on ID').click();await button('Continue').click();await button('Submit').click();await page.getByText('ID submitted',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.fixture.submissions[0].confirmedDetails.birthDate),'');
    await begin('?mode=cancel');await button('Upload a photo').click();assert.equal(await page.evaluate(()=>window.fixture.uploads.length),0);assert.equal(await button('Continue').getAttribute('aria-disabled'),'true');
    for(const mode of ['oversize','unsupported']){await begin('?mode='+mode);await button('Upload a photo').click();assert.equal(await page.evaluate(()=>window.fixture.uploads.length),0);}
    await begin('?mode=deny');await button('Take a photo').click();await page.getByText('Allow camera access to take an ID photo, or upload an existing photo.').waitFor();
    await begin();await button('Take a photo').click();await button('Take photo').click();await button('Continue').click();await page.getByRole('textbox',{name:'Full name',exact:true}).waitFor();
    await begin('?mode=submit-failed');await button('Upload a photo').click();await button('Continue').click();await button('Continue').click();await button('Submit').click();await page.getByText('Submission interrupted. Retry.').waitFor();await button('Submit').click();await page.getByText('ID submitted',{exact:true}).waitFor();
    const retries=await page.evaluate(()=>window.fixture.submissions);assert.equal(retries.length,2);assert.equal(retries[0].submissionId,retries[1].submissionId);
    await page.setViewportSize({width:320,height:740});await begin('?theme=dark');await button('Upload a photo').click();await button('Continue').click();await page.screenshot({path:path.join(output,'small-dark.png')});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,scenarios:['four steps','photo extraction','corrected name persists backwards','read-only summary','front-only submit','manual fallback','cancelled picker','size and type validation','denied camera','camera capture fixture','safe retry','small dark screen','Android Blob publication','birthday wheel confirmation','leap day clamp','birthday cancellation','optional birthday clearing'],publication},null,2));
    console.log('PASS: 17 browser flow scenarios (auth, storage, OCR, and camera fixtures)');
  } catch(error) {
    await page.screenshot({path:path.join(output,'failure.png')});
    fs.writeFileSync(path.join(output,'failure.html'),await page.content());
    throw error;
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
function resolveSource(name){for(const extension of ['.ts','.tsx','.js']){const file=path.join(app,name+extension);if(fs.existsSync(file))return file;}throw new Error('Missing source '+name)}
main().catch(error=>{console.error(error);process.exitCode=1});
