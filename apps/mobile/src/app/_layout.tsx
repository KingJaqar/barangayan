import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <SplashGatedNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

// Gates (app) vs (auth) on real Supabase session state — Expo Router's current
// recommended auth pattern (Stack.Protected), not a manual redirect effect. The splash
// overlay stays up until the initial session check resolves, so the app never flashes
// signed-out content before we actually know the answer.
function SplashGatedNavigator() {
  const { isLoading } = useAuth();

  return (
    <>
      <AnimatedSplashOverlay ready={!isLoading} />
      {!isLoading && <RootNavigator />}
    </>
  );
}

function RootNavigator() {
  const { session, isPasswordRecovery, isOnboarding } = useAuth();
  const holdInAuthGroup = isPasswordRecovery || isOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !holdInAuthGroup}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!session || holdInAuthGroup}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
