/* global __dirname */
// Runs the actual Android callback module and shared helper with isolated
// Auth/browser/storage doubles. This does not replace installed-device checks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const previous=require.extensions['.ts'];
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const shared=require('../packages/shared/src/lib/resident-auth.ts');
const source=ts.transpileModule(fs.readFileSync(path.join(root,'apps/resident-android-mobile/src/lib/google-auth.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const output=path.join(root,'plans/evidence/phase6/google-minimal-native-unit');
fs.mkdirSync(output,{recursive:true});
const report={passed:false,checks:[]};
function fixture(options={}) {
 const state={storage:new Map(),exchanges:0,reads:0,rpcs:0,oauth:[],links:[],browserCalls:[]};
 const user={app_metadata:{providers:['google']},identities:[{provider:'google'}]};
 const auth={
  async exchangeCodeForSession(code){state.exchanges++;state.code=code;await Promise.resolve();return {error:options.exchangeError?new Error('expired'):null};},
  async getUser(){state.reads++;return {data:{user:options.userErrorOnce&&state.reads===1?null:user},error:null};},
  async signInWithOAuth(input){state.oauth.push(input);return {data:{url:'https://provider.test/oauth'},error:null};},
  async linkIdentity(input){state.links.push(input);return {data:{url:'https://provider.test/link'},error:null};},
 };
 const client={auth,rpc(name){assert.equal(name,'ensure_google_resident_profile');state.rpcs++;return {abortSignal:async signal=>{assert.ok(signal instanceof AbortSignal);return {data:'test-uid',error:options.rpcErrorOnce&&state.rpcs===1?new Error('offline'):null};}};}};
 const storage={getItem:async key=>state.storage.get(key)??null,setItem:async(key,value)=>state.storage.set(key,value),removeItem:async key=>state.storage.delete(key)};
 const browser={openAuthSessionAsync:async(...args)=>{state.browserCalls.push(args);return options.browserResult??{type:'success',url:'barangayan://auth/callback?code=valid'};}};
 const module={exports:{}};
 vm.runInNewContext(source,{exports:module.exports,module,require:name=>{
  if(name==='@react-native-async-storage/async-storage')return storage;
  if(name==='expo-web-browser')return browser;
  if(name==='@barangayan/shared')return shared;
  if(name==='./supabase')return {supabase:client};
  throw new Error(`Unexpected dependency ${name}`);
 },Date,Promise,Error},{filename:'google-auth.ts'});
 return {...module.exports,state};
}
async function check(label,work){await work();report.checks.push(label);}
async function main(){
 await check('Successful browser flow exchanges PKCE and provisions before returning',async()=>{
  const f=fixture();await f.startGoogleAuth();assert.equal(f.state.exchanges,1);assert.equal(f.state.rpcs,1);
  assert.equal(f.state.oauth[0].provider,'google');assert.equal(f.state.oauth[0].options.redirectTo,shared.ANDROID_AUTH_CALLBACK);assert.equal(f.state.oauth[0].options.skipBrowserRedirect,true);
  assert.deepEqual(f.state.browserCalls[0],['https://provider.test/oauth',shared.ANDROID_AUTH_CALLBACK]);assert.equal(f.state.storage.size,0);
 });
 await check('Concurrent callbacks consume the code once and provision once',async()=>{
  const f=fixture();f.state.storage.set('resident-google-pkce-started',String(Date.now()));
  await Promise.all(Array.from({length:8},()=>f.finishGoogleAuth('barangayan://auth/callback?code=valid')));
  assert.equal(f.state.exchanges,1);assert.equal(f.state.rpcs,1);
 });
 await check('Provisioning failure retries setup without replaying a consumed PKCE code',async()=>{
  const f=fixture({rpcErrorOnce:true});await assert.rejects(f.startGoogleAuth(),/Unable to save/);
  await f.finishGoogleAuth('barangayan://auth/callback?code=valid');assert.equal(f.state.exchanges,1);assert.equal(f.state.rpcs,2);
 });
 await check('Session-read failure retries verification without replaying PKCE',async()=>{
  const f=fixture({userErrorOnce:true});await assert.rejects(f.startGoogleAuth(),/Unable to verify/);
  await f.finishGoogleAuth('barangayan://auth/callback?code=valid');assert.equal(f.state.exchanges,1);assert.equal(f.state.reads,2);assert.equal(f.state.rpcs,1);
 });
 await check('Expired pending sign-in is rejected before exchange or profile setup',async()=>{
  const f=fixture();f.state.storage.set('resident-google-pkce-started',String(Date.now()-600001));
  await assert.rejects(f.finishGoogleAuth('barangayan://auth/callback?code=valid'),/Sign-in expired/);assert.equal(f.state.exchanges,0);assert.equal(f.state.rpcs,0);
 });
 await check('Provider cancellation clears pending state without provisioning',async()=>{
  const f=fixture({browserResult:{type:'cancel'}});await assert.rejects(f.startGoogleAuth(),/cancelled/);
  assert.equal(f.state.storage.size,0);assert.equal(f.state.exchanges,0);assert.equal(f.state.rpcs,0);
 });
 await check('Failed Auth exchange cannot create a profile',async()=>{
  const f=fixture({exchangeError:true});await assert.rejects(f.startGoogleAuth(),/could not be verified/);assert.equal(f.state.rpcs,0);
 });
 await check('Existing-account linking uses supported identity operation and same setup',async()=>{
  const f=fixture();await f.startGoogleAuth(true);assert.equal(f.state.links.length,1);assert.equal(f.state.oauth.length,0);assert.equal(f.state.rpcs,1);
 });
 await check('Malformed callback cannot reach Auth or profile operation',async()=>{
  const f=fixture();await assert.rejects(f.finishGoogleAuth('https://attacker.test/auth/callback?code=valid'),/Invalid authentication callback/);assert.equal(f.state.exchanges,0);assert.equal(f.state.rpcs,0);
 });
 report.passed=true;console.log(`PASS: ${report.checks.length} Android callback checks with isolated doubles.`);
}
main().catch(error=>{report.error=error.message;console.error(error);process.exitCode=1;}).finally(()=>{
 require.extensions['.ts']=previous;fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
});
