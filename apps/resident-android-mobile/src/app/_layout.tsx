import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, type ReactNode } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import {
  NotificationPreferencesProvider,
  useNotificationPreferences,
} from '@/hooks/use-notification-preferences';
import { useNotificationRealtime } from '@/hooks/use-notification-realtime';
import { FontPreferenceProvider } from '@/hooks/use-font-preference';
import { ProfileProvider, useProfile } from '@/hooks/use-profile';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { registerPushToken } from '@/lib/push-notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    GideonRoman: require('@/assets/fonts/GideonRoman-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
      {/* ProfileProvider sits inside AuthProvider so it can access the session for its
          initial fetch, and outside ThemePreferenceProvider / ThemedRoot so every screen
          in the tree shares one cached profile — avatar updates propagate immediately. */}
      <ProfileProvider>
      {/* Needs both session (AuthProvider) and profile (ProfileProvider), and must stay
          outside ThemePreferenceProvider since it has no dependency on theme state. */}
      <NotificationPreferencesProvider>
      <NotificationProvider>
      {/* Needs session/profile (via useAuth/useProfile inside), so it has to nest under
          AuthProvider — everything below, including React Navigation's own DarkTheme/
          DefaultTheme, resolves through this instead of the raw OS scheme, so "App
          Theme" in Settings is genuinely app-wide, not just our own ThemedView/ThemedText
          components. */}
      <ThemePreferenceProvider>
      {/* Font style, same session-scoping rules as accent color — needs profile/session,
          nests wherever in this tree as long as it's above ThemedText's consumers. */}
      <FontPreferenceProvider>
        <ThemedRoot />
      </FontPreferenceProvider>
      </ThemePreferenceProvider>
      </NotificationProvider>
      </NotificationPreferencesProvider>
      </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Keeps the push-notification delivery engine alive for the whole app session: registers
 * this device's token whenever a real session exists and push is enabled, and opens the
 * realtime channels that turn DB events into local notifications. Renders nothing of its
 * own — purely a side-effect wrapper around the two notification hooks.
 */
function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { pushEnabled } = useNotificationPreferences();

  useEffect(() => {
    if (session && pushEnabled) {
      registerPushToken().catch((error) => console.warn('Failed to register push token:', error));
    }
  }, [session, pushEnabled]);

  useNotificationRealtime(pushEnabled, session?.user.id ?? null, profile?.barangay_id ?? null);

  return children;
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
  const { session, isPasswordRecovery, isGuest, isRegistering } = useAuth();
  // isRegistering holds the resident in (auth) through the brief window where signUp()'s
  // returned session would otherwise satisfy appReachable and bounce them into (app)
  // before register.tsx signs that session back out and shows its success modal.
  const holdInAuthGroup = isPasswordRecovery || isRegistering;

  // Deliberately NOT symmetric (authReachable is not just "!appReachable"). Guest
  // browsing ("I'll Sign In Later") needs (app) reachable with no session, AND (auth)
  // to stay reachable too (a guest has no session, so `!session` already covers this —
  // isGuest doesn't need to appear in this half at all). That's what keeps the existing
  // auto-redirect behavior intact: the moment a guest actually logs in, session becomes
  // truthy, authReachable flips to false while (auth)/login is the active route, and
  // Stack.Protected redirects them into (app) automatically — same mechanism the
  // Recovery flow already relies on, no extra plumbing needed. If this were written as
  // `!appReachable` instead, isGuest would make (auth) permanently unreachable the
  // instant guest mode starts, breaking guest -> login entirely.
  const appReachable = (!!session || isGuest) && !holdInAuthGroup;
  const authReachable = !session || holdInAuthGroup;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Unconditionally reachable — it only redirects into whichever of (app)/(auth) is
          actually reachable below, so it doesn't need its own guard. */}
      <Stack.Screen name="index" />

      <Stack.Protected guard={appReachable}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={authReachable}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
