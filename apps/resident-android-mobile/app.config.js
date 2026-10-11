// Opt-in identity for local Phase 2 development-device qualification.
// app.json remains the source of the application's normal configuration.
module.exports = ({ config }) => {
  if (process.env.BARANGAYAN_PHASE2_DEV_BUILD !== '1') return config;
  return {
    ...config,
    android: { ...config.android, package: 'com.barangayan.resident.dev' },
    plugins: [...(config.plugins ?? []), ['expo-dev-client', { launchMode: 'most-recent' }]],
  };
};
