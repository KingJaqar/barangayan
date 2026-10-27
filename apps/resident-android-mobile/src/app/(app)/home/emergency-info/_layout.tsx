import { Stack } from 'expo-router';
import { Fonts } from '@/constants/theme';

export default function EmergencyInfoLayout() {
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontFamily: Fonts.gideonRoman, fontWeight: '400' } }}>
      {/* index.tsx builds its own tab-bar header — same fix as Settings/Maps. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="qr-guide" options={{ headerShown: false }} />
    </Stack>
  );
}
