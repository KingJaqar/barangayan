import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const FEATURES = [
  { title: 'Report Incidents', body: 'Notify authorities about non-emergency community issues.' },
  { title: 'Request Documents', body: 'Apply for barangay clearances and certificates from your phone.' },
  { title: 'Stay Informed', body: 'Get trusted updates directly from your barangay administrators.' },
];

export default function ValuePropScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Empower Your Community Connection
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.description}>
          A unified platform to access essential civic services, report local issues, and stay
          informed with trusted updates directly from your community administrators.
        </ThemedText>

        <ThemedView style={styles.featureList}>
          {FEATURES.map((feature) => (
            <ThemedView key={feature.title} type="backgroundElement" style={styles.featureCard}>
              <ThemedText type="smallBold">{feature.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {feature.body}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      </ScrollView>

      <ThemedView style={styles.footer}>
        <PrimaryButton label="Next →" onPress={() => router.push('/(auth)/personalization')} />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  featureList: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  featureCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  footer: {
    padding: Spacing.four,
  },
});
