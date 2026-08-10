import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own colored header (matching the reference screenshot) —
          the native Stack header would otherwise show a stray "index" title above it. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="terms-privacy" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
    </Stack>
  );
}
