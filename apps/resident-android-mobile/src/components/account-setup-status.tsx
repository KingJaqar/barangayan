import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function AccountSetupStatus({ state, notice, onRetry, onRecover, onSignOut }: {
  state: 'loading' | 'error' | 'recovery';
  notice: string | null;
  onRetry: () => Promise<void>;
  onRecover: () => void;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const [takingLong, setTakingLong] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const loading = state === 'loading' || retrying;

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTakingLong(true), 12_000);
    return () => clearTimeout(timer);
  }, [loading, retrying]);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setTakingLong(false);
    try { await onRetry(); } finally { setRetrying(false); }
  }

  const title = loading ? 'Getting things ready' : state === 'recovery' ? 'Let’s recover your password' : 'Let’s try that again';
  const description = loading
    ? takingLong ? 'This is taking a little longer than usual. You can try checking again.' : 'We’re checking your account setup. You’ll be on your way shortly.'
    : state === 'recovery' ? 'We couldn’t confirm your password history. Recover your password to keep your existing account secure.' : 'We couldn’t load your account setup. Please check your connection and try again.';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.main}>
            <View style={[styles.iconTile, { backgroundColor: theme.backgroundElement }]} importantForAccessibility="no-hide-descendants">
              {loading ? (
                <Image
                  source={require('@/assets/logo/barangayan-logo-1024.png')}
                  style={styles.logo}
                  contentFit="contain"
                  accessibilityLabel="Barangayan logo"
                />
              ) : (
                <Ionicons name={state === 'recovery' ? 'lock-closed-outline' : 'cloud-offline-outline'} size={32} color={theme.primary} />
              )}
            </View>
            <View style={styles.copy} accessibilityLiveRegion="polite">
              <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.description}>{description}</ThemedText>
            </View>
            {loading && <ActivityIndicator size="small" color={theme.primary} accessibilityLabel="Checking your account setup" style={styles.spinner} />}
            {(!loading || takingLong) && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: retrying }}
                disabled={retrying}
                onPress={state === 'recovery' ? onRecover : () => { void retry(); }}
                style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed || retrying ? 0.7 : 1 }]}>
                <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>{state === 'recovery' ? 'Recover password' : 'Try again'}</ThemedText>
              </Pressable>
            )}
            {notice && <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary" style={styles.notice}>{notice}</ThemedText>}
          </View>
          <Pressable accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText style={styles.signOutLabel}>Sign out</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 24 },
  content: { flex: 1, width: '100%', maxWidth: 360, alignSelf: 'center' },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  iconTile: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logo: { width: 52, height: 52 },
  copy: { gap: 12, width: '100%' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 23, fontWeight: '400', textAlign: 'center' },
  spinner: { marginTop: 28 },
  button: { alignSelf: 'stretch', minHeight: 52, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  buttonLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  notice: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 20 },
  signOut: { minHeight: 48, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 12, justifyContent: 'center' },
  signOutLabel: { fontSize: 14, lineHeight: 22, fontWeight: '600', textDecorationLine: 'underline' },
});
