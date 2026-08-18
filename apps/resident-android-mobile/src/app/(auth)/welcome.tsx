import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { OnboardingAmbientBackground } from '@/components/onboarding/onboarding-ambient-background';
import { OnboardingProgressDots } from '@/components/onboarding/onboarding-progress-dots';
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
      <OnboardingAmbientBackground tint={theme.onPrimary} />

      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          <Animated.View entering={FadeIn.duration(500)}>
            <Image
              style={styles.logo}
              source={require('@/assets/logo/barangayan-logo-1024.png')}
              contentFit="contain"
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(450).delay(120)}>
            <ThemedText type="title" style={[styles.title, { color: theme.onPrimary }]}>
              Barangayan
            </ThemedText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(450).delay(220)}>
            <ThemedText style={[styles.subtitle, { color: theme.onPrimary }]}>
              Welcome to your barangay, digitized.
            </ThemedText>
          </Animated.View>
        </ThemedView>

        <Animated.View entering={FadeInDown.duration(450).delay(320)} style={styles.footer}>
          <OnboardingProgressDots
            step={1}
            activeColor={theme.onPrimary}
            inactiveColor="rgba(255,255,255,0.35)"
          />
          <PrimaryButton
            label="Next →"
            variant="secondary"
            onPress={() => router.push('/(auth)/value-prop')}
          />
        </Animated.View>
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
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  footer: {
    gap: Spacing.four,
    backgroundColor: 'transparent',
  },
});
