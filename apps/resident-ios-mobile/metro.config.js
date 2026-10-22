const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

/**
 * Plan OD-14: the app also runs on localhost web as a test target. Modules with no browser implementation are replaced,
 * for the web platform only, by `web/native-only.js`; every iOS bundle resolves the real modules.
 */
const NATIVE_ONLY_ON_WEB = [
  'expo-media-library', 'expo-apple-authentication', 'expo-notifications', 'react-native-webview', '@expo/ui/swift-ui', '@expo/ui/swift-ui/modifiers',
];
const WEB_STANDINS = { 'expo-secure-store': 'secure-store.js' };
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY_ON_WEB.includes(moduleName)) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'web', 'native-only.js') };
  }
  if (platform === 'web' && WEB_STANDINS[moduleName]) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'web', WEB_STANDINS[moduleName]) };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
