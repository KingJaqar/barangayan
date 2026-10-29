import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, useState, type ReactNode } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import {
  NotificationPreferencesProvider,
  useNotificationPreferences,
} from '@/hooks/use-notification-preferences';
import { useNotificationRealtime } from '@/hooks/use-notification-realtime';
import { usePushRegistration } from '@/hooks/use-push-registration';
import { FontPreferenceProvider } from '@/hooks/use-font-preference';
import { ProfileProvider, useProfile } from '@/hooks/use-profile';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { NotificationTapHandler } from '@/components/notification-tap-handler';
import { View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { EmergencyEntryLink } from '@/components/emergency-entry-link';
import { markNativeCallbackHandedOff, nativeCallbackPending, setupAllowsApp } from '@/lib/setup-navigation';
import { useTheme } from '@/hooks/use-theme';

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
 * Keeps the push-notification machinery alive for the whole app session: the device's push registration follows the session
 * (`usePushRegistration`) and the realtime channels present the Health alerts. Renders nothing of its own.
 */
function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { pushEnabled } = useNotificationPreferences();
  const userId = session?.user.id ?? null;

  usePushRegistration(userId, pushEnabled);
  useNotificationRealtime(pushEnabled, userId, profile?.barangay_id ?? null);

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

// Session restoration can wait on a token refresh while offline. After this long the splash
// lifts so the public evacuation-centers entry is reachable (DRRM routing plan R6).
const SLOW_RESTORATION_MS = 3000;
const PUBLIC_EMERGENCY_PATH = '/emergency-centers';

// Gates (app) vs (auth) on real Supabase session state — Expo Router's current
// recommended auth pattern (Stack.Protected), not a manual redirect effect. The splash
// overlay stays up until the initial session check resolves, so the app never flashes
// signed-out content before we actually know the answer.
function SplashGatedNavigator() {
  return <><RootNavigator /><NotificationTapHandler /><RestorationOverlay /></>;
}

/** Route-sensitive restoration chrome stays outside the stable navigation subtree. */
function RestorationOverlay() {
  const { isLoading, restorationError, retryRestoration } = useAuth();
  const theme = useTheme();
  // The public emergency screen is never covered by the splash or the restoration error.
  const onPublicEmergency = usePathname() === PUBLIC_EMERGENCY_PATH;
  const [restorationSlow, setRestorationSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setRestorationSlow(true), SLOW_RESTORATION_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <>
      <AnimatedSplashOverlay ready={!isLoading || onPublicEmergency || restorationSlow} />
      {!isLoading && restorationError && !onPublicEmergency ? <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: theme.background }}><ThemedText accessibilityLiveRegion="polite">{restorationError}</ThemedText><PrimaryButton label="Retry session restoration" onPress={retryRestoration} /><EmergencyEntryLink /></View> : null}
    </>
  );
}

function RootNavigator() {
  const { session, isPasswordRecovery, isGuest, setupRoute, setup, isLoading } = useAuth();
  const nativeUrl = Linking.useLinkingURL();
  const router = useRouter();
  useEffect(() => {
    // Other/malformed links use the existing Router handling.
    if (isLoading || !nativeCallbackPending(nativeUrl)) return;
    // Android may restore the previous task route on process death, and a cold start
    // into the existing task starts Expo Router at the root. Hand the actual native
    // callback to its existing validated, deduplicated handler.
    markNativeCallbackHandedOff(nativeUrl);
    router.replace('/auth/callback');
  }, [isLoading, nativeUrl, router]);
  // Recovery retains its own auth stack; resident setup comes from fresh server
  // state and creation origin, including after a cold restart or token refresh.
  const holdInAuthGroup = isPasswordRecovery;

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
  const appReachable = !holdInAuthGroup && (session ? setupAllowsApp(setupRoute, setup) : isGuest);
  const authReachable = !session || holdInAuthGroup;

  return (
    <Stack screenOptions={{ headerShown: false, headerTitleStyle: { fontFamily: Fonts.gideonRoman, fontWeight: '400' } }}>
      {/* Unconditionally reachable — it only redirects into whichever of (app)/(auth) is
          actually reachable below, so it doesn't need its own guard. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/callback" />
      {/* Public emergency entry: outside every guard, so emergency access never depends on
          authentication (DRRM routing plan R6, invariant 9). */}
      <Stack.Screen name="emergency-centers" />
      <Stack.Protected guard={!!session && !holdInAuthGroup && !appReachable}>
        <Stack.Screen name="account-setup" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !holdInAuthGroup && appReachable}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>

      <Stack.Protected guard={appReachable}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={authReachable}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
