import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const mig = readFileSync('supabase/migrations/0120_flood_shadow_runs.sql', 'utf8');
const test = readFileSync('supabase/tests/flood_shadow_runs.test.sql', 'utf8');
const psql = (input, tuples = false) => spawnSync('docker', ['exec', '-i', 'supabase_db_barangayan', 'psql', '-U', 'postgres', '-d', 'r8_disposable', '-v', 'ON_ERROR_STOP=0', '-q', ...(tuples ? ['-At'] : [])], { input, encoding: 'utf8', env });
const reset = () => psql('drop function if exists public.publish_flood_shadow_run(text,text,text,timestamptz,text,jsonb); drop function if exists public.get_flood_shadow_history(text,integer); drop table if exists public.flood_shadow_runs cascade;');
const mutants = [
  ['no supersession check', "if v_latest is not null and p_evaluated_at <= v_latest then", "if false then"],
  ['no active-graph check', "if v_active is distinct from p_graph_version then", "if false then"],
  ['publish granted to authenticated', "grant execute on function public.publish_flood_shadow_run(text, text, text, timestamptz, text, jsonb) to service_role;", "grant execute on function public.publish_flood_shadow_run(text, text, text, timestamptz, text, jsonb) to service_role, authenticated;"],
  ['resident influence not checked', "     or p_report->>'residentInfluence' is distinct from 'none' then", "     or false then"],
  ['no retention pruning', "  delete from public.flood_shadow_runs r\n   where r.area_id = p_area_id", "  delete from public.flood_shadow_runs r\n   where false and r.area_id = p_area_id"],
  ['direct insert left open to service_role', "revoke insert, update, delete, truncate on public.flood_shadow_runs from authenticated, service_role;", "revoke insert, update, delete, truncate on public.flood_shadow_runs from authenticated;"],
  ['admin read not scoped to own barangay', "a.barangay_id = public.current_barangay_id()))", "true))"],
  ['duplicate not detected', "  if found then\n    return jsonb_build_object('status', 'duplicate', 'id', v_existing);\n  end if;", ""],
];
let killed = 0;
for (const [name, from, to] of mutants) {
  if (!mig.includes(from)) { console.log('SKIP', name); continue; }
  reset();
  const applied = psql(mig.replace(from, to));
  const out = psql(test, true);
  const text = out.stdout + out.stderr;
  const notOk = (text.match(/^not ok/gm) || []).length;
  const errors = (text.match(/ERROR/g) || []).length;
  const dead = notOk > 0 || errors > 0;
  if (dead) killed++;
  console.log(`${dead ? 'KILLED  ' : 'SURVIVED'} ${name} (not ok: ${notOk}, errors: ${errors})`);
}
reset();
const restored = psql(mig);
const final = psql(test, true);
const finalText = final.stdout + final.stderr;
console.log(`${killed}/${mutants.length} killed; original restored: ok=${(finalText.match(/^ok/gm) || []).length} notok=${(finalText.match(/^not ok/gm) || []).length}`);
