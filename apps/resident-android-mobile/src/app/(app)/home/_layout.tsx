import { Stack } from 'expo-router';
import { Fonts } from '@/constants/theme';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontFamily: Fonts.gideonRoman, fontWeight: '400' } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="requests/[requestId]"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="emergency-info"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
