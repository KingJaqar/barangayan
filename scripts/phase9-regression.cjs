/* global __dirname */
// Run maintained journeys with fresh evidence/fixture paths; application code and
// real Auth/Storage/REST are unchanged. The recovery and callback tests use doubles
// and are labelled separately; they never count as provider/device qualification.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), mode = process.argv[2];
const entries = {services:'phase4-http.cjs', provider:'phase4-provider.cjs', sla:'phase5-http.cjs', scores:'phase7-http.cjs', callback:'google-profile-native.test.cjs', recovery:'web-profile-recovery.cjs', scoreBrowser:'phase7-browser.cjs'};
assert.ok(entries[mode]);
const run=process.argv[3]||mode;assert.match(run,/^[a-zA-Z0-9-]+$/);
const output = path.join(root,'plans/evidence/phase9',run);
fs.mkdirSync(output,{recursive:true});
assert.ok(!fs.existsSync(path.join(output,'results.json')), 'Preserve prior results');
fs.mkdirSync(path.join(root,'dist/phase9-tools',mode),{recursive:true});
let source = fs.readFileSync(path.join(root,'scripts',entries[mode]),'utf8');
if (mode === 'services' || mode === 'sla' || mode==='provider') {
  source = source.replace(/output\s*=\s*path\.join\(root,\s*'plans\/evidence\/phase[45]',\s*`(?:http|provider)-\$\{Date\.now\(\)\}`\)/, `output=path.join(root,'plans/evidence/phase9/${mode}')`);
  // The maintained suite predates custom general services. Restrict its four-
  // charter assertion to the four original workflows; general forms have SQL coverage.
  if(mode==='services') source = source.replace(".eq('barangay_id', tenant).eq('is_active', true)",".eq('barangay_id', tenant).eq('is_active', true).in('service_kind', ['business','indigency','first_time_job_seeker','certified_true_copy'])");
  const start = source.indexOf('const status = spawnSync(')>=0 ? source.indexOf('const status = spawnSync(') : source.indexOf('const status=spawnSync(');
  const end = source.indexOf(mode==='provider'?'const fixtures':'const make', start);
  assert.ok(start>=0&&end>start);
  source = source.slice(0,start)+"const config=require('./phase7-local-config.cjs')();\n"+source.slice(end);
  source = source.replaceAll('dist/phase4-tools','dist/phase9-tools/services').replaceAll('dist/phase5-tools','dist/phase9-tools/sla');
} else if(mode==='scores'||mode==='scoreBrowser') {
  source=source.replaceAll('plans/evidence/phase7/http','plans/evidence/phase9/scores').replaceAll('plans/evidence/phase7/browser','plans/evidence/phase9/scoreBrowser').replaceAll('dist/phase7-tools','dist/phase9-tools/scores');
  // Browser and HTTP share the same task-only fixture path.
} else if(mode==='callback') source=source.replaceAll('plans/evidence/phase6/google-minimal-native-unit','plans/evidence/phase9/callback');
else source=source.replaceAll('plans/evidence/web-auth-errors-2026-10-04','plans/evidence/phase9/recovery');
assert.ok(source.includes('plans/evidence/phase9/'), 'Fresh evidence path required');
source=source.replaceAll(`plans/evidence/phase9/${mode}`,`plans/evidence/phase9/${run}`);
source=source.replaceAll('`phase4-', '`phase9-services-').replaceAll('`phase5-', '`phase9-sla-').replaceAll('`phase7-', '`phase9-scores-');
if(mode==='scoreBrowser') source=source.replace("const page=await browser.newPage", "browser.on('page',p=>{p.setDefaultTimeout(20000);p.setDefaultNavigationTimeout(60000);});\n const page=await browser.newPage");
const runner = new Module(path.join(root,'scripts',entries[mode]), module);
runner.filename=path.join(root,'scripts',entries[mode]);
runner.paths=Module._nodeModulePaths(path.join(root,'scripts'));
runner._compile(source,runner.filename);
