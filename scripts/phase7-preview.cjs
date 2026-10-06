/* global __dirname */
const path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),config=require('./phase7-local-config.cjs')();
const mode=process.argv[2];assert.ok(['web','admin','android'].includes(mode));
const app=mode==='web'?'resident-web':mode==='admin'?'admin-web':'resident-android-mobile';
const previewHost=process.env.BARANGAYAN_PREVIEW_HOST||'127.0.0.1';
assert.match(previewHost,/^(127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})$/);
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,
 EXPO_PUBLIC_SUPABASE_URL:config.API_URL,EXPO_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,
 NEXT_TELEMETRY_DISABLED:'1',EXPO_NO_TELEMETRY:'1',BARANGAYAN_PREVIEW_DIST_DIR:'.next-phase7',REACT_NATIVE_PACKAGER_HOSTNAME:previewHost};
const exe=path.join(root,'node_modules',mode==='android'?'expo/bin/cli':'next/dist/bin/next');
const args=mode==='android'?['start','--host','lan','--port','8087']:['dev','--hostname','127.0.0.1','--port',mode==='web'?'3117':'3118'];
const child=spawn(process.execPath,[exe,...args],{cwd:path.join(root,'apps',app),env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code;});
