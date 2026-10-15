const fs = require('node:fs');
const path = require('node:path');
const run = __dirname;
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]);
}
const beforeDir = path.join(run, 'dc-00/web-export-unrestricted');
const afterDir = path.join(run, 'dc-05/web-export-unrestricted');
const beforeFiles = files(beforeDir), afterFiles = files(afterDir);
const entry = file => /[\\/]_expo[\\/]static[\\/]js[\\/]web[\\/]entry-.*\.js$/.test(file);
const beforeEntry = beforeFiles.find(entry), afterEntry = afterFiles.find(entry);
if (!beforeEntry || !afterEntry) throw new Error('Missing web entry');
const before = fs.statSync(beforeEntry).size, after = fs.statSync(afterEntry).size;
const chunksIdentical = beforeFiles.filter(file => file.includes(path.sep + '_expo' + path.sep) && !entry(file)).every(file => {
  const target = path.join(afterDir, path.relative(beforeDir, file));
  return fs.existsSync(target) && fs.readFileSync(file).equals(fs.readFileSync(target));
});
const beforeAndroid = JSON.parse(fs.readFileSync(path.join(run, 'dc-00/android-export-temp/metadata.json'), 'utf8')).fileMetadata.android;
const afterAndroid = JSON.parse(fs.readFileSync(path.join(run, 'dc-05/android-export-temp/metadata.json'), 'utf8')).fileMetadata.android;
const result = { web: { before, after, delta: after - before, retainedChunksIdentical: chunksIdentical }, android: JSON.parse(fs.readFileSync(path.join(run, 'dc-05/android-bundle.json'), 'utf8')), source: JSON.parse(fs.readFileSync(path.join(run, 'dc-05/warnings-and-source-bytes.json'), 'utf8')), apkMeasurement: 'Not performed', androidAssetsIdentical: JSON.stringify(beforeAndroid.assets) === JSON.stringify(afterAndroid.assets) };
fs.writeFileSync(path.join(run, 'dc-06/metrics.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
