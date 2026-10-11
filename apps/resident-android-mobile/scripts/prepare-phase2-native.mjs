// Native shell for the real app's development build. Metro serves the actual
// Android workspace; generated Gradle files stay in an owned, ignored directory.
import assert from 'node:assert/strict';
import { copyFile, mkdir, stat, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const nativeRoot=resolve(appRoot,'../..','.expo','phase2-native');
assert.equal(await stat(nativeRoot).then(()=>true,()=>false),false,'Owned native directory already exists. Reuse its running/completed build; do not overwrite it.');
await mkdir(resolve(nativeRoot,'assets','logo'),{recursive:true});
const inputs=['app.json','app.config.js','package.json','assets/logo/barangayan-logo-1024.png'];
const hashes={};
for(const input of inputs) {
  const source=resolve(appRoot,input); await copyFile(source,resolve(nativeRoot,input));
  hashes[input]=createHash('sha256').update(await readFile(source)).digest('hex');
}
await writeFile(resolve(nativeRoot,'.phase2-owned-build.json'),JSON.stringify({appRoot,applicationId:'com.barangayan.resident.dev',inputs:hashes},null,2)+'\n');
console.log('Prepared owned native shell in .expo/phase2-native. Use BARANGAYAN_PHASE2_DEV_BUILD=1; serve JavaScript from apps/resident-android-mobile.');
