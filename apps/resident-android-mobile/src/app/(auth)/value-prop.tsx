import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OnboardingAmbientBackground } from '@/components/onboarding/onboarding-ambient-background';
import { OnboardingProgressDots } from '@/components/onboarding/onboarding-progress-dots';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const FEATURES: { title: string; body: string; icon: IoniconName }[] = [
  {
    title: 'Report Incidents',
    body: 'Notify authorities about non-emergency community issues.',
    icon: 'megaphone-outline',
  },
  {
    title: 'Request Documents',
    body: 'Apply for barangay clearances and certificates from your phone.',
    icon: 'document-text-outline',
  },
  {
    title: 'Stay Informed',
    body: 'Get trusted updates directly from your barangay administrators.',
    icon: 'notifications-outline',
  },
];

export default function ValuePropScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <OnboardingAmbientBackground tint={theme.primary} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <ThemedText type="title" style={styles.title}>
              Empower Your Community Connection
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.description}>
              A unified platform to access essential civic services, report local issues, and stay
              informed with trusted updates directly from your community administrators.
            </ThemedText>
          </Animated.View>

          <View style={styles.featureList}>
            {FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.title}
                entering={FadeInDown.duration(400)
                  .delay(150 + index * 90)
                  .springify()
                  .damping(16)}>
                <ThemedView type="backgroundElement" style={styles.featureCard}>
                  <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}1F` }]}>
                    <Ionicons name={feature.icon} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.featureCopy}>
                    <ThemedText type="smallBold">{feature.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {feature.body}
                    </ThemedText>
                  </View>
                </ThemedView>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <Animated.View
          entering={FadeInDown.duration(400).delay(150 + FEATURES.length * 90)}
          style={[styles.footer, { borderTopColor: theme.backgroundElement }]}>
          <OnboardingProgressDots
            step={2}
            activeColor={theme.primary}
            inactiveColor={theme.backgroundSelected}
          />
          <PrimaryButton label="Next →" onPress={() => router.push('/(auth)/personalization')} />
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
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: Spacing.two,
  },
  featureList: {
    gap: Spacing.two,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    padding: Spacing.four,
    gap: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
