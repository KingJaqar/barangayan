import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Barangayan',
  slug: 'barangayan-resident-ios',
  version: '1.0.0',
  platforms: ['ios'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ...(process.env.IOS_URL_SCHEME ? { scheme: process.env.IOS_URL_SCHEME } : {}),
  ios: {
    supportsTablet: false,
    ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}),
  },
  plugins: [
    'expo-router',
    ['expo-secure-store', { faceIDPermission: false }],
    ['expo-splash-screen', { backgroundColor: '#0F6E5B', image: './assets/barangayan-logo-1024.png', imageWidth: 96 }],
  ],
  experiments: { typedRoutes: true },
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
