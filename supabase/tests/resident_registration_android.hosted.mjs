// Bounded Phase 2 proof on the explicitly authorized production/owned-mailbox target.
// One fresh Gmail alias only; no admin key, original-account writes or secret output.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
assert.equal(process.argv[2], '--authorized-phase2-production-test');
const environment = Object.fromEntries(readFileSync('apps/resident-android-mobile/.env', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
  const index = line.indexOf('='); return [line.slice(0,index),line.slice(index+1).replace(/^['"]|['"]$/g,'')];
}));
const url=environment.EXPO_PUBLIC_SUPABASE_URL, key=environment.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname,'pwjbucnyqexiepoinoke.supabase.co');
const boundedFetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)});
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});
const auth=client(), restored=client(), credential=client();
const must=result=>{if(result.error) throw Object.assign(new Error('Auth/API check failed'),{code:result.error.code||result.error.status||result.error.name});return result.data;};
const emit=(event,detail={})=>console.log(JSON.stringify({event,...detail}));
const email=`lospollosmaestros+phase2-${randomUUID().slice(0,8)}@gmail.com`;
if(process.stdin.isTTY) process.stdin.setRawMode(true);
const input=createInterface({input:process.stdin,terminal:false});
const timer=setTimeout(()=>{emit('FAIL',{check:'Input timeout'});process.exit(2);},300000);
try {
  assert.ok((await client().rpc('complete_resident_profile_if_unchanged',{p_input:{},p_expected:null})).error);
  must(await auth.auth.signInWithOtp({email,options:{shouldCreateUser:true,data:{resident_registration_origin:'email_otp'}}}));
  emit('OTP_SENT',{email});
  for await(const line of input) {
    const command=JSON.parse(line); assert.match(command.code,/^\d{6}$/);
    const verified=must(await auth.auth.verifyOtp({email,token:command.code,type:'email'}));
    const id=verified.user.id; assert.ok(verified.session);
    const status=()=>auth.rpc('get_resident_account_setup_status').then(must);
    assert.deepEqual(await status(),{registrationOrigin:'email_otp',profileComplete:false,passwordSet:false,hasGoogleIdentity:false});
    const details={firstName:'Phase',lastName:'Resident',houseNo:'12',street:'Main',sex:'female',employmentStatus:'student',mobileNumber:'09171234567',birthDate:'2000-01-01',location:{gps:null,home:null}};
    must(await auth.rpc('complete_resident_profile_if_unchanged',{p_input:details,p_expected:null}));
    const snapshot=must(await auth.from('profiles').select('*').eq('id',id).single());
    must(await auth.rpc('complete_resident_profile_if_unchanged',{p_input:{...details,houseNo:'13'},p_expected:snapshot}));
    const stale=await auth.rpc('complete_resident_profile_if_unchanged',{p_input:{...details,houseNo:'overwrite'},p_expected:snapshot});
    assert.equal(stale.status,409); assert.equal(stale.error?.code,'PT409');
    assert.equal(must(await auth.from('profiles').select('house_no').eq('id',id).single()).house_no,'13');
    const current=must(await auth.from('profiles').select('*').eq('id',id).single());
    const races=await Promise.all(['14','15'].map(houseNo=>auth.rpc('complete_resident_profile_if_unchanged',{p_input:{...details,houseNo},p_expected:current})));
    assert.equal(races.filter(result=>!result.error).length,1); assert.equal(races.filter(result=>result.error?.code==='PT409').length,1);
    const password=`Chosen1!${randomUUID()}`; must(await auth.auth.updateUser({password}));
    assert.equal((await status()).passwordSet,true); assert.equal((await status()).profileComplete,true);
    const session=must(await auth.auth.getSession()).session; assert.equal(session.user.id,id);
    must(await restored.auth.setSession(session)); assert.equal(must(await restored.auth.getUser()).user.id,id);
    assert.equal(must(await credential.auth.signInWithPassword({email,password})).user.id,id);
    emit('PASS',{checks:'real OTP; snapshot create/save; stale HTTP 409 without overwrite; one-winner concurrent saves; password creation; retained/restored same-user session; exact credential confirmation; anonymous denied',retainedTestAccount:email});
    break;
  }
} catch(error) {emit('FAIL',{check:error.code||error.name||'unknown'});process.exitCode=1;}
finally {
  for(const instance of [auth,restored,credential]) if((await instance.auth.getSession()).data.session) await instance.auth.signOut({scope:'local'});
  clearTimeout(timer);input.close();if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();
}
