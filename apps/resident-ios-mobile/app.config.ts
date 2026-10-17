import type { ExpoConfig } from 'expo/config';

/** `NSCameraUsageDescription` is a single key: it must explain every use (profile and ID photos, QR check-in scanning). */
const CAMERA_PURPOSE = 'Barangayan uses the camera when you choose to take a photo of yourself or of your ID, and to scan an evacuation center QR code to check in.';

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
    // The Photos picker needs no library permission and microphone is never used; only the camera purpose is declared.
    ['expo-image-picker', {
      photosPermission: false,
      cameraPermission: CAMERA_PURPOSE,
      microphonePermission: false,
    }],
    // Saving a QR image (QR PH payment, evacuation center code) uses add-only Photos access (OD-09); the app never reads the library through this module.
    ['expo-media-library', {
      photosPermission: false,
      savePhotosPermission: 'Barangayan saves a QR code (your QR PH payment code or an evacuation center check-in code) to your Photos only when you choose Save to Photos.',
    }],
    // QR check-in scanning. The camera has one Info.plist purpose string shared with the photo picker above, so both plugins name both uses.
    ['expo-camera', { cameraPermission: CAMERA_PURPOSE, microphonePermission: false, recordAudioAndroid: false }],
    ['expo-splash-screen', { backgroundColor: '#0F6E5B', image: './assets/barangayan-logo-1024.png', imageWidth: 96 }],
  ],
  experiments: { typedRoutes: true },
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
