import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/hooks/use-auth';
import { nativeCallbackPending, setupDestination } from '@/lib/setup-navigation';

export default function RootIndexRedirect() {
  const { session, isGuest, isPasswordRecovery, setupRoute, setup, isLoading, restorationError } = useAuth();
  // A cold-started Google callback is handed to /auth/callback by the root navigator;
  // redirecting from here first would drop it on the signed-out entry screen.
  const nativeUrl = Linking.useLinkingURL();
  if (isLoading || restorationError || nativeCallbackPending(nativeUrl)) return null;
  if (isPasswordRecovery) return <Redirect href="/(auth)/forgot-password" />;
  if (session) {
    return <Redirect href={setupDestination(setupRoute, setup)} />;
  }
  return <Redirect href={isGuest ? '/home' : '/(auth)/auth-choice'} />;
}
