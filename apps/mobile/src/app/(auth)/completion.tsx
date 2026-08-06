import { SafeAreaView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function CompletionScreen() {
  const { setOnboarding } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          You're all set.
        </ThemedText>
        <ThemedText themeColor="textSecondary">Explore the services of Barangayan.</ThemedText>
      </View>

      <View style={styles.footer}>
        {/* Clearing isOnboarding is what actually lets Stack.Protected route into (app) —
            the session has been active since verifyOtp succeeded on the OTP screen. */}
        <PrimaryButton label="Go to Home" onPress={() => setOnboarding(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  title: {
    fontSize: 28,
  },
  footer: {
    padding: Spacing.four,
  },
});
