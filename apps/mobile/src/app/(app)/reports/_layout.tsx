import { Stack } from 'expo-router';

export default function ReportsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
