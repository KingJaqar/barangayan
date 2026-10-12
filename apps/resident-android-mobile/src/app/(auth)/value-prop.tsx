import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { OnboardingScreen, onboardingStyles } from '@/components/onboarding/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const FEATURES: { title: string; body: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { title: 'Report incidents', body: 'Let your barangay know about non-emergency issues.', icon: 'megaphone-outline' },
  { title: 'Request documents', body: 'Apply for clearances and certificates from your phone.', icon: 'document-text-outline' },
  { title: 'Stay informed', body: 'Keep up with trusted updates from your barangay.', icon: 'notifications-outline' },
];
export default function ValuePropScreen() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <OnboardingScreen step={2} onNext={() => router.push('/(auth)/personalization')}>
      <View>
        <ThemedText themeColor="textSecondary" style={onboardingStyles.eyebrow}>YOUR COMMUNITY, CONNECTED</ThemedText>
        <ThemedText type="title" style={onboardingStyles.title}>A little less effort. A lot more connection.</ThemedText>
        <ThemedText themeColor="textSecondary" style={onboardingStyles.description}>Take care of everyday barangay needs, wherever you are.</ThemedText>
      </View>
      <View>
        {FEATURES.map((feature, index) => (
          <View key={feature.title} style={[styles.feature, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
            <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}><Ionicons name={feature.icon} size={24} color={theme.primary} accessible={false} /></View>
            <View style={styles.copy}>
              <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>{feature.body}</ThemedText>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 20 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 6 }, featureTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
});
