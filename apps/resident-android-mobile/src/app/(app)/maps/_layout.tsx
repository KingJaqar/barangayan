import { Stack } from 'expo-router';
import { Fonts } from '@/constants/theme';

export default function MapsLayout() {
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontFamily: Fonts.gideonRoman, fontWeight: '400' } }}>
      {/* index.tsx builds its own header — same fix as Settings. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
