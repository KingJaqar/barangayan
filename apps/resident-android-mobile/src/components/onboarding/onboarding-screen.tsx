import { StatusBar } from 'expo-status-bar';
import { type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { OnboardingProgressDots } from './onboarding-progress-dots';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

export function OnboardingScreen({ children, step, onNext, centered = false }: PropsWithChildren<{
  step: 1 | 2 | 3; onNext: () => void; centered?: boolean;
}>) {
  const theme = useTheme();
  const { scheme } = useThemePreference();
  return (
    <ThemedView style={styles.container}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)} style={[styles.content, centered && styles.centered]}>
            {children}
          </Animated.View>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
          <OnboardingProgressDots step={step} activeColor={theme.primary} inactiveColor={theme.backgroundSelected} />
          <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>{step === 3 ? 'Get started' : 'Continue'}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
export const onboardingStyles = StyleSheet.create({
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 1.2, marginBottom: 12 },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8, fontWeight: '600' },
  description: { fontSize: 16, lineHeight: 24, fontWeight: '400', marginTop: 12 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', marginBottom: 12 },
});
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  scroll: { flex: 1 }, scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 32, gap: 32 },
  centered: { justifyContent: 'center' },
  footer: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, gap: 20, borderTopWidth: StyleSheet.hairlineWidth },
  button: { minHeight: 54, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
