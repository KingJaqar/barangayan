/**
 * Localhost web test target only (plan OD-14): stands in for the iOS Keychain-backed `expo-secure-store`, which has no browser
 * equivalent. Values live in this browser profile's localStorage under a prefix, so a test session survives a reload. It gives
 * none of the Keychain's protection and is never part of an iOS bundle (see metro.config.js).
 */
const PREFIX = 'resident-ios-web-test.';

module.exports = {
  __esModule: true,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  isAvailableAsync: async () => typeof localStorage !== 'undefined',
  getItemAsync: async (key) => localStorage.getItem(PREFIX + key),
  setItemAsync: async (key, value) => { localStorage.setItem(PREFIX + key, value); },
  deleteItemAsync: async (key) => { localStorage.removeItem(PREFIX + key); },
};
