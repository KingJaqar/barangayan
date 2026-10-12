import {createClient} from '@supabase/supabase-js';
import {state,token,root,bundle} from './runtime.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
await bundle();
const {browseTable,parseTableState,literalPattern}=await import(pathToFileURL(path.join(root,'dist/admin-table-phase2/adapter.mjs')));
const db=createClient(state().rest,token('anon'),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token('authenticated','21000000-0000-4000-8000-000000001505')}`},fetch:(url,opts)=>fetch(String(url).replace('/rest/v1/','/'),opts)}});
for(const q of ['%','_','*','\\','"',',','(',')']){
 const result=await browseTable('incidents',parseTableState('incidents',new URLSearchParams({tab:'all',q})),db);
 console.log(q,literalPattern(q),result.status==='success'?result.value.total:result);
}
