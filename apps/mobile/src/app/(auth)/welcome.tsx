import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.primary }]}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          <Image
            style={styles.logo}
            source={require('@/assets/logo/barangayan-logo-1024.png')}
            contentFit="contain"
          />
          <ThemedText type="title" style={[styles.title, { color: theme.onPrimary }]}>
            Barangayan
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.onPrimary }]}>
            Welcome to your barangay, digitized.
          </ThemedText>
        </ThemedView>

        <PrimaryButton
          label="Next →"
          variant="secondary"
          onPress={() => router.push('/(auth)/value-prop')}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
});
