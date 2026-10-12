import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { OnboardingScreen, onboardingStyles } from '@/components/onboarding/onboarding-screen';
import { OnboardingToast } from '@/components/onboarding/onboarding-toast';
import { ThemedText } from '@/components/themed-text';
import { ACCENT_COLORS } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

const COLOR_NAMES = ['Barangay green', 'Blue', 'Red', 'Purple', 'Orange', 'Teal', 'Pink', 'Amber', 'Indigo', 'Emerald', 'Cyan', 'Violet', 'Rose', 'Lime', 'Fuchsia', 'Bronze', 'Slate', 'Sky', 'Crimson', 'Forest'];
const APPEARANCES = ['light', 'dark'] as const;

export default function PersonalizationScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { scheme, accentColor, setThemePreference, setAccentColor } = useThemePreference();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hideToast = useCallback(() => setToastMessage(null), []);

  return (
    <OnboardingScreen step={3} onNext={() => router.push('/(auth)/auth-choice')}>
      <View>
        <ThemedText themeColor="textSecondary" style={onboardingStyles.eyebrow}>A PERSONAL TOUCH</ThemedText>
        <ThemedText type="title" style={onboardingStyles.title}>Make it yours.</ThemedText>
        <ThemedText themeColor="textSecondary" style={onboardingStyles.description}>Choose the look that feels right for you.</ThemedText>
      </View>
      <View>
        <ThemedText style={onboardingStyles.sectionTitle}>Appearance</ThemedText>
        <View style={styles.appearanceRow}>
          {APPEARANCES.map((option) => {
            const selected = scheme === option;
            const label = option === 'light' ? 'Light' : 'Dark';
            return (
              <Pressable key={option} accessibilityRole="radio" accessibilityLabel={`${label} appearance`} accessibilityState={{ checked: selected }}
                onPress={() => { setThemePreference(option); setToastMessage(`${label} mode enabled`); }}
                style={({ pressed }) => [styles.appearance, { borderColor: selected ? theme.text : theme.backgroundSelected, backgroundColor: selected ? theme.backgroundElement : theme.background, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name={option === 'light' ? 'sunny-outline' : 'moon-outline'} size={24} color={theme.text} accessible={false} />
                <View style={styles.appearanceLabel}>
                  <ThemedText style={styles.optionLabel}>{label}</ThemedText>
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={theme.text} accessible={false} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View>
        <ThemedText style={onboardingStyles.sectionTitle}>Accent color</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.colorHint}>A touch of color for buttons and highlights.</ThemedText>
        <View style={styles.swatchRow}>
          {ACCENT_COLORS.map((color, index) => {
            const selected = accentColor.toLowerCase() === color.toLowerCase();
            return (
              <Pressable key={color} accessibilityRole="radio" accessibilityLabel={COLOR_NAMES[index] ?? color} accessibilityState={{ checked: selected }}
                onPress={() => { setAccentColor(color); setToastMessage('Accent color updated'); }}
                style={({ pressed }) => [styles.swatchPressable, { borderColor: selected ? theme.text : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.swatch, { backgroundColor: color }]}>
                  {selected && <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={18} color="#ffffff" accessible={false} />
                  </Animated.View>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.note}>
        <ThemedText themeColor="textSecondary" style={styles.colorHint}>You can change these anytime in Settings.</ThemedText>
        <OnboardingToast visible={toastMessage !== null} message={toastMessage ?? ''} onHide={hideToast} />
      </View>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  appearanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  appearance: { flex: 1, minWidth: 120, padding: 16, gap: 24, borderRadius: 16, borderWidth: 2 },
  appearanceLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionLabel: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  colorHint: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  swatchPressable: { width: 48, height: 48, borderWidth: 2, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  checkBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  note: { gap: 12, minHeight: 76 },
});
