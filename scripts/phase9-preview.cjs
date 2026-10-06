/* global __dirname */
// Preview with only synthetic local credentials; no hosted .env overrides escape.
const path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),mode=process.argv[2];assert.ok(['web','admin'].includes(mode));
const config=require('./phase7-local-config.cjs')();
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',mode==='web'?'3117':'3118'],{
 cwd:path.join(root,'apps',mode==='web'?'resident-web':'admin-web'),windowsHide:true,stdio:'inherit',
 env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,BARANGAYAN_PREVIEW_DIST_DIR:'.next-phase9',NEXT_TELEMETRY_DISABLED:'1'}
});
child.on('exit',code=>{process.exitCode=code;});
