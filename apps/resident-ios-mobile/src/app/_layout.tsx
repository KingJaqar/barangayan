import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Action, Body, confirmDestructive, Loading, Screen } from '../components/ui';
import { readConfiguration } from '../lib/config';
import { ResidentProvider, useResident } from '../lib/runtime';
import { SetupEnforcer } from '../features/auth/setup-enforcer';
import { useColors } from '../lib/theme';

// Keep the splash until the first authoritative session decision; module scope so it runs before the first render.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });
// A slow restoration (for example an offline token refresh) lifts the splash to an in-app progress state.
const SLOW_RESTORATION_MS = 3000;

function HideSplash() {
  useEffect(() => { SplashScreen.hide(); }, []);
  return null;
}
export function ErrorBoundary({ retry }: { retry: () => Promise<void> }) {
  return <Screen><HideSplash /><Body>Something went wrong. Your action has not been confirmed.</Body><Action label="Try again" onPress={() => void retry()} /></Screen>;
}
export default function Layout() {
  const configuration = useMemo(() => readConfiguration(), []);
  const dark = useColorScheme() === 'dark';
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hide(), SLOW_RESTORATION_MS);
    return () => clearTimeout(timer);
  }, []);
  return <SafeAreaProvider><ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
    {!configuration.success ? <Screen><HideSplash /><Body heading>Barangayan is unavailable</Body><Body>This installation needs its barangay connection configured. Please contact the person who provided this app.</Body></Screen> :
      <ResidentProvider config={configuration.data} fallback={(state) => <RestorationState {...state} />}><HideSplash /><Navigator /></ResidentProvider>}
  </ThemeProvider></SafeAreaProvider>;
}
function RestorationState({ error, retry, clear }: { error: boolean; retry: () => void; clear: () => void }) {
  if (!error) return <Screen><Loading label="Restoring your session…" /></Screen>;
  async function confirmClear() {
    if (await confirmDestructive({ title: 'Sign out on this device?', message: 'Your saved session on this iPhone will be removed. You can sign in again afterwards.', confirmLabel: 'Sign out on this device' })) clear();
  }
  return <Screen><HideSplash /><Body heading>Session not restored</Body><Body>Unable to restore your secure session. Check your connection, unlock your device, and try again.</Body>
    <Action label="Retry session restoration" onPress={retry} /><Action label="Sign out on this device" secondary destructive onPress={() => void confirmClear()} /></Screen>;
}
function Navigator() {
  const { recovery } = useResident();
  const colors = useColors();
  return <>
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!recovery}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="auth/choice" options={{ headerShown: false }} />
        <Stack.Screen name="auth/otp" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Log in' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Create account' }} />
        <Stack.Screen name="auth/callback" options={{ title: 'Signing in', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="account-setup" options={{ title: 'Set up your account', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="complete-profile" options={{ title: 'Complete your profile' }} />
        <Stack.Screen name="emergency" options={{ title: 'Emergency information' }} />
        <Stack.Screen name="requests" options={{ title: 'My requests' }} />
        <Stack.Screen name="request/[id]" options={{ title: 'Request details' }} />
        <Stack.Screen name="services/request/[id]" options={{ title: 'Request a document' }} />
        <Stack.Screen name="health/register/[id]" options={{ title: 'Drive registration' }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Recovery stays reachable while the recovery guard hides everything else; aliases resolve to it. */}
      <Stack.Screen name="auth/recovery" options={{ title: 'Recover your account', gestureEnabled: false }} />
      <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="recovery" options={{ headerShown: false }} />
    </Stack>
    <SetupEnforcer />
  </>;
}
