import { Stack } from 'expo-router';

export default function EmergencyInfoLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own tab-bar header — same fix as Settings/Maps. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="qr-guide" options={{ headerShown: false }} />
    </Stack>
  );
}
