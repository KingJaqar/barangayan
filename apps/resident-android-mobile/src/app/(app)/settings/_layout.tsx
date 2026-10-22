import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

export default function SettingsLayout() {
  const { session } = useAuth();
  const reducedMotion = useResidentReducedMotion(true);
  const verificationAnimation = reducedMotion ? 'none' : 'slide_from_right';

  return (
    <Stack>
      {/* index.tsx builds its own colored header (matching the reference screenshot) —
          the native Stack header would otherwise show a stray "index" title above it. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Logout removes account routes from history and returns to the guest overview. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="email-verification" options={{ headerShown: false, animation: verificationAnimation }} />
        <Stack.Screen
          name="profile"
          options={{ headerShown: false, animation: verificationAnimation }}
        />
        <Stack.Screen
          name="valid-id"
          options={{ headerShown: false, animation: verificationAnimation, gestureEnabled: false }}
        />
        <Stack.Screen
          name="change-password"
          options={{ headerShown: false, animation: verificationAnimation }}
        />
        <Stack.Screen
          name="location-verification"
          options={{ headerShown: false, animation: verificationAnimation }}
        />
      </Stack.Protected>
      <Stack.Screen
        name="help"
        options={{ headerShown: false, animation: verificationAnimation }}
      />
      <Stack.Screen
        name="help/[articleId]"
        options={{ headerShown: false, animation: verificationAnimation }}
      />
      <Stack.Screen
        name="terms-privacy"
        options={{ headerShown: false, animation: verificationAnimation }}
      />
      <Stack.Screen
        name="about"
        options={{ headerShown: false, animation: verificationAnimation }}
      />
    </Stack>
  );
}
