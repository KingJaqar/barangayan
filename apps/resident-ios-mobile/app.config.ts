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
    deploymentTarget: '16.4',
    // Sign in with Apple capability (entitlement requested by the config plugin; provisioning is not part of this plan).
    usesAppleSignIn: true,
    // HTTPS only; local networking stays allowed so development builds can reach a LAN dev server.
    infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true } },
    ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}),
  },
  plugins: [
    'expo-router',
    'expo-apple-authentication',
    'expo-web-browser',
    ['expo-secure-store', { faceIDPermission: false }],
    // Foreground (When In Use) only: no Always/background keys, no motion permission (plan §3, §6.7).
    ['expo-location', {
      locationWhenInUsePermission: 'Barangayan uses your location while the app is open to find nearby evacuation centers and confirm your home location. You can also choose a location manually.',
      locationAlwaysAndWhenInUsePermission: false,
      locationAlwaysPermission: false,
      motionUsagePermission: false,
      isIosBackgroundLocationEnabled: false,
    }],
    ['expo-splash-screen', { backgroundColor: '#0F6E5B', image: './assets/barangayan-logo-1024.png', imageWidth: 96 }],
  ],
  experiments: { typedRoutes: true },
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
