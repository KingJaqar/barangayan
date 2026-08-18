import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function ReportsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* Submit new incident — native header with back arrow */}
      <Stack.Screen
        name="new"
        options={{
          title: 'Report an Incident',
          headerTintColor: Colors.light.primary,
          headerBackTitle: 'Back',
        }}
      />

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
