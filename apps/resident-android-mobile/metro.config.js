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

// Local verification tools and web build caches are not mobile source. Watching
// them can stall Metro while web previews/builds write thousands of generated files.
// The file watcher matches these against forward-slash paths even on Windows, so the
// root and separators must accept both `\` and `/`, and directory patterns must also
// match the bare directory path (no trailing separator) to stop the watcher walking in.
const escapedWorkspaceRoot = workspaceRoot
  .split(/[\\/]/)
  .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[\\\\/]');
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : existingBlockList ? [existingBlockList] : []),
  // Other tools create and delete short-lived refs under .git; if one vanishes while
  // the fallback (non-Watchman) watcher is attaching, Metro crashes with ENOENT.
  /[\\/]\.git(?:[\\/]|$)/,
  new RegExp(`^${escapedWorkspaceRoot}[\\\\/]dist(?:[\\\\/]|$)`),
  new RegExp(`^${escapedWorkspaceRoot}[\\\\/]apps[\\\\/][^\\\\/]+[\\\\/](?:\\.next(?:-[^\\\\/]+)?|dist)(?:[\\\\/]|$)`),
];

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
