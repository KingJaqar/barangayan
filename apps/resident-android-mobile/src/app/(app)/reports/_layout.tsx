import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function ReportsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* Submit new incident — builds its own header (Profile-screen style), same fix as index. */}
      <Stack.Screen name="new" options={{ headerShown: false }} />

      {/* Incident detail / tracking */}
      <Stack.Screen
        name="[incidentId]"
        options={{
          title: 'Incident Report',
          headerTintColor: Colors.light.primary,
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
