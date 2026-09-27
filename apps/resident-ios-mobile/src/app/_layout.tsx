import { Stack } from 'expo-router/stack';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Action, Body, Loading, Screen } from '../components/ui';
import { readConfiguration } from '../lib/config';
import { ResidentProvider, useResident } from '../lib/runtime';

export function ErrorBoundary({ retry }: { retry: () => Promise<void> }) {
  return <Screen><Body>Something went wrong. Your action has not been confirmed.</Body><Action label="Try again" onPress={() => void retry()} /></Screen>;
}
export default function Layout() {
  const configuration = useMemo(() => readConfiguration(), []);
  const dark = useColorScheme() === 'dark';
  return <SafeAreaProvider><ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
    {!configuration.success ? <Screen><Body heading>Barangayan is unavailable</Body><Body>This installation needs its barangay connection configured. Please contact the person who provided this app.</Body></Screen> :
      <ResidentProvider config={configuration.data} fallback={({ error, retry, clear }) => <Screen>{error ? <><Body>Unable to restore your secure session. Check your connection, unlock your device, and try again.</Body><Action label="Try again" onPress={retry} /><Action label="Clear this device’s session" secondary onPress={clear} /></> : <Loading />}</Screen>}><Navigator /></ResidentProvider>}
  </ThemeProvider></SafeAreaProvider>;
}
function Navigator() {
  const { recovery } = useResident();
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Protected guard={!recovery}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      <Stack.Screen name="auth" options={{ title: 'Your account' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack.Protected>
    <Stack.Screen name="recovery" options={{ title: 'Recover your account', gestureEnabled: false }} />
  </Stack>;
}
