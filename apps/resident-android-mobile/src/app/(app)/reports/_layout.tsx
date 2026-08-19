import { Stack } from 'expo-router';

export default function ReportsLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* Submit new incident — builds its own header (Profile-screen style), same fix as index.
          Lateral push, same as the equivalent "next step" pushes in Services/_layout —
          it's a forward step the resident can back-swipe out of. */}
      <Stack.Screen name="new" options={{ headerShown: false, animation: 'slide_from_right' }} />

      {/* Incident detail / tracking — builds its own header (Request Tracking-screen style), same fix as above. */}
      <Stack.Screen name="[incidentId]" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
