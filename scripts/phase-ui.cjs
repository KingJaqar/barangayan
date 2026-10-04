/* global __dirname, Buffer */
// Test-only launcher: ephemeral local keys remain in memory, never in source/.env.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync,spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const status=spawnSync('wsl.exe',['--distribution','barangayan-phase1','--user','root','--cd','/mnt/c/Users/User/barangayan','--exec','/opt/barangayan-tools/supabase','status','--output','json'],{encoding:'utf8',timeout:30000});
assert.equal(status.status,0,'Isolated local runtime must be healthy');
const config=JSON.parse(status.stdout);
assert.equal(config.API_URL,'http://127.0.0.1:54321');
const mode=process.argv[2];
async function seed(){
  const trusted=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const fixtures={};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
  for(const role of ['resident','admin']){
    const email=`phase-ui-${role}-${randomUUID()}@test.local`,password='PhaseLocalOnly!2026';
    const {data,error}=await trusted.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Test ${role}`}});assert.ifError(error);
    const id=data.user.id;
    const {error:profileError}=await trusted.from('profiles').insert({id,role,barangay_id:'00000000-0000-0000-0000-000000000001',full_name:`Test ${role}`,first_name:'Test',last_name:role==='resident'?'Resident':'Admin',house_no:'12',street:'Main Street',sex:'female',employment_status:'student',birth_date:'2000-01-01',mobile_number:'09171234567',email});assert.ifError(profileError);
    fixtures[role]={id,email,password};
    if(role==='resident'){
      const submissionId=randomUUID();
      const frontPath=`${id}/versions/${submissionId}/id-front.png`,backPath=`${id}/versions/${submissionId}/id-back.png`;
      for(const name of [frontPath,backPath]){const {error:uploadError}=await trusted.storage.from('id-documents').upload(name,png,{contentType:'image/png',upsert:false});assert.ifError(uploadError);}
      const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      await client.auth.signInWithPassword({email,password});
      const {error:publicationError}=await client.rpc('publish_id_submission',{p_input:{submissionId,idType:'Passport',frontPath,backPath}});assert.ifError(publicationError);
    }
  }
  const output=path.join(root,'dist/phase2-tools');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'ui-users.json'),JSON.stringify(fixtures,null,2));
  fs.writeFileSync(path.join(output,'sample-id.png'),png);
  console.log('Prepared synthetic local resident/admin fixtures.');
}
if(mode==='seed') seed().catch(error=>{console.error(error.message);process.exitCode=1;});
else {
  const apps={web:['resident-web','3100'],admin:['admin-web','3101'],android:['resident-android-mobile','3102'],native:['resident-android-mobile','8082']};
  if(!apps[mode]) throw new Error('Choose a local web/admin/android launcher or seed');
  const [app,port]=apps[mode];
  // Direct WSL address is test-only fallback when Windows loopback forwarding stops.
  const testHost=process.env.BARANGAYAN_LOCAL_TEST_HOST;
  if(testHost && !/^172\.(1[6-9]|2\d|3[01])\.[0-9]{1,3}\.[0-9]{1,3}$/.test(testHost)) throw new Error('Only a private local WSL test host is allowed');
  const apiUrl=testHost ? `http://${testHost}:54321` : config.API_URL;
  const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:apiUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,EXPO_PUBLIC_SUPABASE_URL:apiUrl,EXPO_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,NEXT_TELEMETRY_DISABLED:'1',EXPO_NO_TELEMETRY:'1',REACT_NATIVE_PACKAGER_HOSTNAME:'127.0.0.1',ANDROID_HOME:'C:/Users/User/AppData/Local/Android/Sdk'};
  // Android emulator's host alias avoids unreliable adb reverse into WSL ports.
  if(mode==='native') {
    env.EXPO_PUBLIC_SUPABASE_URL='http://10.0.2.2:54321';
    env.REACT_NATIVE_PACKAGER_HOSTNAME='10.0.2.2';
  }
  const file=['android','native'].includes(mode)?path.join(root,'node_modules/expo/bin/cli'):path.join(root,'node_modules/next/dist/bin/next');
  const args=mode==='native'?['start','--clear','--host','lan','--port',port]:mode==='android'?['start','--web','--port',port]:['dev','--hostname','127.0.0.1','--port',port];
  const child=spawn(process.execPath,[file,...args],{cwd:path.join(root,'apps',app),env,stdio:'inherit'});
  child.on('exit',code=>{process.exitCode=code;});
}
