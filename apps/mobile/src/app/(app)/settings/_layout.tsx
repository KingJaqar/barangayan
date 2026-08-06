import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own colored header (matching the reference screenshot) —
          the native Stack header would otherwise show a stray "index" title above it. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
