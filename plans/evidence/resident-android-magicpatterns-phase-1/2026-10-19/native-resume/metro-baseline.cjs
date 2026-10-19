const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const config=require(path.join(root,'apps/resident-android-mobile/metro.config.js'));
const recovery=path.join(__dirname,'../before/source');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'../audit.json'),'utf8'));
const originals=new Map(audit.tracked.map(({file})=>[path.normalize(path.join(root,file)).toLowerCase(),path.join(recovery,file)]));
const existing=config.resolver.resolveRequest;
config.watchFolders=[path.join(root,'packages/shared'),path.join(root,'node_modules'),recovery];
config.resolver.resolveRequest=(context,name,platform)=>{
  const relative=path.relative(recovery,context.originModulePath);
  const originalContext=!relative.startsWith('..') && !path.isAbsolute(relative)
    ? {...context,originModulePath:path.join(root,relative)} : context;
  const result=existing(originalContext,name,platform);
  if(result.type==='sourceFile') {
    const before=originals.get(path.normalize(result.filePath).toLowerCase());
    if(before) return {...result,filePath:before};
  }
  return result;
};
module.exports=config;
