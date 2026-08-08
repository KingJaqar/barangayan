import { Stack } from 'expo-router';

export default function MapsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
