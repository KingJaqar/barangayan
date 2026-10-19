const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const root = path.resolve(__dirname, '../../..');
const app = path.join(root, 'apps/resident-android-mobile');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(app, 'src'), path.join(root, 'packages/shared'), path.join(root, 'node_modules')];
config.resolver.nodeModulesPaths = [path.join(root, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === '@/hooks/use-font-preference' || name === '@/hooks/use-theme-preference') return {type:'sourceFile',filePath:path.join(__dirname,'preferences.tsx')};
  if (name === 'expo-router') return {type:'sourceFile',filePath:path.join(__dirname,'router.ts')};
  return context.resolveRequest(context, name.startsWith('@/') ? path.join(app,'src',name.slice(2)) : name, platform);
};
module.exports = config;
