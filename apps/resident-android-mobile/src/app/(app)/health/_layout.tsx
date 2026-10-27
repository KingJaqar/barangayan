import { Stack } from 'expo-router';
import { Fonts } from '@/constants/theme';

export default function HealthLayout() {
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontFamily: Fonts.gideonRoman, fontWeight: '400' } }}>
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
