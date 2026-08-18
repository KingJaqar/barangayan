// Metro config for the npm-workspaces monorepo.
// Metro's default config only watches apps/resident-android-mobile, so it can't resolve
// @barangayan/shared out of the box — this is the fix (see the plan's
// "Pre-Development Technical Risk Mitigations").
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// `disableHierarchicalLookup` stops Metro from walking nested node_modules, so it
// only sees the hoisted `entities@4` at the workspace root — which dropped the old
// `lib/maps/*.json` layout that `markdown-it@10` (pulled in by
// react-native-markdown-display) still `require`s. Redirect that legacy subpath to
// markdown-it's own nested `entities@2` copy, leaving entities@4 consumers untouched.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('entities/lib/')) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(`markdown-it/node_modules/${moduleName}`, {
        paths: [workspaceRoot],
      }),
    };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
