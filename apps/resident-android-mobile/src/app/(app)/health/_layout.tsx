import { Stack } from 'expo-router';

export default function HealthLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* register.tsx builds its own green header. */}
      <Stack.Screen
        name="register"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
