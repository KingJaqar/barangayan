import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* Needs session/profile (via useAuth/useProfile inside), so it has to nest under
          AuthProvider — everything below, including React Navigation's own DarkTheme/
          DefaultTheme, resolves through this instead of the raw OS scheme, so "App
          Theme" in Settings is genuinely app-wide, not just our own ThemedView/ThemedText
          components. */}
      <ThemePreferenceProvider>
        <ThemedRoot />
      </ThemePreferenceProvider>
    </AuthProvider>
  );
}

function ThemedRoot() {
  const { scheme } = useThemePreference();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SplashGatedNavigator />
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
  const { session, isPasswordRecovery, isOnboarding, isGuest } = useAuth();
  const holdInAuthGroup = isPasswordRecovery || isOnboarding;

  // Deliberately NOT symmetric (authReachable is not just "!appReachable"). Guest
  // browsing ("I'll Sign In Later") needs (app) reachable with no session, AND (auth)
  // to stay reachable too (a guest has no session, so `!session` already covers this —
  // isGuest doesn't need to appear in this half at all). That's what keeps the existing
  // auto-redirect behavior intact: the moment a guest actually logs in, session becomes
  // truthy, authReachable flips to false while (auth)/login is the active route, and
  // Stack.Protected redirects them into (app) automatically — same mechanism the
  // Onboarding/Recovery flows already rely on, no extra plumbing needed. If this were
  // written as `!appReachable` instead, isGuest would make (auth) permanently
  // unreachable the instant guest mode starts, breaking guest -> login entirely.
  const appReachable = (!!session || isGuest) && !holdInAuthGroup;
  const authReachable = !session || holdInAuthGroup;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={appReachable}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={authReachable}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
