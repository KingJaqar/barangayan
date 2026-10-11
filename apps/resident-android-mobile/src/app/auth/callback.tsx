import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { finishGoogleAuth, pendingGoogleAuth } from '@/lib/google-auth';
import { useAuth } from '@/hooks/use-auth';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { SetupOwner } from '@/lib/setup-request';
import { useTheme } from '@/hooks/use-theme';
import { callbackNavigation, reauthReturnTarget, setupAllowsApp, setupDestination, type ReauthTarget } from '@/lib/setup-navigation';
export default function AuthCallback() {
  // Read the latest native intent when this screen mounts after a browser return.
  const url = Linking.useLinkingURL(), router = useRouter(), theme = useTheme();
  const { session, setupRoute, setup, setSetupIntent, refreshCompletion, isPasswordRecovery, isLoading } = useAuth();
  const owner = useRef(new SetupOwner());
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [reauthTarget, setReauthTarget] = useState<ReauthTarget | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (isLoading) return;
    const scope = owner.current, owns = scope.ticket();
    void (async () => {
      const pending = await pendingGoogleAuth();
      if (!url && !pending) throw new Error('No Google sign-in is pending. Start sign-in again.');
      const result = await finishGoogleAuth(url ?? undefined);
      if (!owns()) return;
      // Settings reauthentication returns to the action it was started for. That
      // screen re-verifies purpose, owner and the session's Auth timestamp itself.
      if (result.intent === 'reauthenticate') setReauthTarget(reauthReturnTarget(result.purpose));
      else await setSetupIntent(result.intent === 'sign_up' ? 'google_signup' : result.intent === 'sign_in' ? 'sign_in' : 'settings_profile', result.userId ?? undefined);
      await refreshCompletion();
      if (owns()) { setError(null); setFinished(true); }
    })().catch(cause => { if (owns()) setError(cause instanceof Error ? cause.message : 'Unable to complete Google sign-in. Retry.'); });
    return () => { scope.invalidate(); };
  }, [url, attempt, setSetupIntent, refreshCompletion, isLoading]);
  const userId = session?.user.id;
  const destination = setupDestination(setupRoute, setup);
  const appAllowed = setupAllowsApp(setupRoute, setup);
  useEffect(() => {
    const next = callbackNavigation({ finished, recovery: isPasswordRecovery, signedIn: !!userId, statusLoading: setupRoute.destination === 'status_loading',
      reauthTarget, appAllowed, canGoBack: router.canGoBack(), destination });
    if (next.type === 'back') router.back();
    else if (next.type === 'replace') router.replace(next.href);
  }, [finished, userId, setupRoute.destination, appAllowed, destination, isPasswordRecovery, router, reauthTarget]);
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: theme.background }}>
    <ThemedText accessibilityLiveRegion="polite">{error ?? 'Completing Google sign-in…'}</ThemedText>
    {error && <PrimaryButton label="Retry completing sign-in" onPress={() => { setError(null); setAttempt(value => value + 1); }} />}
    {/* A failed Settings reauthentication leaves the original resident signed in. */}
    {error && (userId ? <PrimaryButton label="Return to the app" variant="secondary" onPress={() => router.replace(destination)} />
      : <PrimaryButton label="Return to login" variant="secondary" onPress={() => router.replace('/(auth)/login')} />)}
  </View>;
}
