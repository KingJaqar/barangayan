import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { finishGoogleAuth } from '@/lib/google-auth';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
export default function AuthCallback() {
  const url = Linking.useURL();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    void finishGoogleAuth(url).then(() => router.replace('/')).catch(cause => setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please retry.'));
  }, [url, router]);
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}><ThemedText>{error ?? 'Completing Google sign-in…'}</ThemedText>{error && <PrimaryButton label="Return to login" onPress={() => router.replace('/(auth)/login')} />}</View>;
}
