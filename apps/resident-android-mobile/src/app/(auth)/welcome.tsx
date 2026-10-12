import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { OnboardingScreen, onboardingStyles } from '@/components/onboarding/onboarding-screen';
import { ThemedText } from '@/components/themed-text';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <OnboardingScreen step={1} centered onNext={() => router.push('/(auth)/value-prop')}>
      <Image style={styles.logo} source={require('@/assets/logo/barangayan-logo-1024.png')} contentFit="contain" accessibilityLabel="Barangayan logo" />
      <View>
        <ThemedText themeColor="textSecondary" style={onboardingStyles.eyebrow}>WELCOME TO BARANGAYAN</ThemedText>
        <ThemedText type="title" style={[onboardingStyles.title, styles.title]}>Your barangay, closer to you.</ThemedText>
        <ThemedText themeColor="textSecondary" style={onboardingStyles.description}>Everyday services, local updates, and your community. All in one place.</ThemedText>
      </View>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({ logo: { width: 88, height: 88 }, title: { fontSize: 36, lineHeight: 42 } });
