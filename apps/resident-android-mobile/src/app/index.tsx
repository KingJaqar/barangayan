import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { EmergencyEntryLink } from '@/components/emergency-entry-link';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { nativeCallbackPending, setupDestination } from '@/lib/setup-navigation';

export default function RootIndexRedirect() {
  const { session, isGuest, signedOutEntry, isPasswordRecovery, setupRoute, setup, isLoading, restorationError } = useAuth();
  // A cold-started Google callback is handed to /auth/callback by the root navigator;
  // redirecting from here first would drop it on the signed-out entry screen.
  const nativeUrl = Linking.useLinkingURL();
  const theme = useTheme();
  if (restorationError || nativeCallbackPending(nativeUrl)) return null;
  // Shown once the splash lifts during a slow restoration: emergency routes stay reachable.
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} />
        <ThemedText accessibilityLiveRegion="polite">Restoring your session…</ThemedText>
        <EmergencyEntryLink style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }
  if (isPasswordRecovery) return <Redirect href="/(auth)/forgot-password" />;
  if (session) {
    return <Redirect href={setupDestination(setupRoute, setup)} />;
  }
  return <Redirect href={isGuest ? '/home' : signedOutEntry ? '/(auth)/login' : '/(auth)/auth-choice'} />;
}
