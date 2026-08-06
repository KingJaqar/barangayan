import { Stack } from 'expo-router';

export default function HealthLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
