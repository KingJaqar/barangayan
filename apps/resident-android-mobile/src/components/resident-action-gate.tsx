import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { GuestAuthCalloutScreen } from './guest-auth-callout-screen';
import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';

/** Block mounting submission forms until the resident is signed in and their profile is checked. */
export function ResidentActionGate({ children }: { children: ReactNode }) {
  const { session, needsCompletion, completionError, refreshCompletion } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  if (!session) {
    return <GuestAuthCalloutScreen
      title="Log In Required"
      tabName="this service"
      message="You need to log in before you can submit reports, requests, or registrations."
      description="Guests can still browse public information."
    />;
  }
  if (needsCompletion === false) return children;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const next = `${pathname}${query.size ? `?${query}` : ''}`;
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
    <ThemedText accessibilityRole="alert">{needsCompletion ? 'Complete your resident profile before using this service. You can keep browsing information without completing it.' : completionError ?? 'Checking your resident profile…'}</ThemedText>
    {needsCompletion && <PrimaryButton label="Complete profile" onPress={() => router.push({ pathname: '/complete-profile', params: { next } })} />}
    {completionError && <PrimaryButton label="Retry profile check" onPress={() => { void refreshCompletion().catch(() => {}); }} />}
    <PrimaryButton label="Browse information" variant="secondary" onPress={() => router.replace('/home')} />
  </View>;
}
