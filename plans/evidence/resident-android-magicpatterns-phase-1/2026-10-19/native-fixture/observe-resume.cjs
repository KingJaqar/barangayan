// ADB observation only. Inputs are issued separately from fresh inspected screenshots.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Provide a unique observation name');
const target = path.join(__dirname, 'native-resume', name);
if (fs.existsSync(target)) throw new Error('Do not overwrite earlier evidence');
fs.mkdirSync(target);
const serial = '127.0.0.1:16384';
function adb(args, binary = false) {
  const result = spawnSync('C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe', ['-s', serial, ...args], { maxBuffer: 16_000_000, ...(binary ? {} : { encoding: 'utf8' }) });
  if (result.status !== 0) throw new Error(String(result.stderr));
  return result.stdout;
}
const started = new Date().toISOString();
const remote = '/sdcard/phase1-resume-ui.xml';
const dump = adb(['shell', 'uiautomator', 'dump', remote]);
fs.writeFileSync(path.join(target, 'ui.xml'), adb(['exec-out', 'cat', remote]));
fs.writeFileSync(path.join(target, 'screen.png'), adb(['exec-out', 'screencap', '-p'], true));
fs.writeFileSync(path.join(target, 'observation.json'), JSON.stringify({ serial, started, completed: new Date().toISOString(), dump }, null, 2));
console.log(path.join(target, 'screen.png'));

