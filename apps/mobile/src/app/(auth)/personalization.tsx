import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT_COLORS, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

// Real, not presentational — wired straight into ThemePreferenceProvider. There's no
// session yet at this point in the flow, so setThemePreference/setAccentColor apply
// locally for this app session only (same "guest" behavior the provider already gives
// Settings' guest view); it becomes a persisted account preference automatically the
// moment registration creates a real profile row. Shares ACCENT_COLORS with Settings so a
// color picked here still shows as the selected swatch there.
export default function PersonalizationScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { scheme, accentColor, setThemePreference, setAccentColor } = useThemePreference();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Make it yours.
        </ThemedText>
        <ThemedText themeColor="textSecondary">Customize your experience.</ThemedText>

        <ThemedView type="backgroundElement" style={styles.schemeRow}>
          {(['light', 'dark'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setThemePreference(option)}
              style={[styles.schemeOption, scheme === option && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" style={styles.capitalize}>
                {option}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedText type="small" style={styles.sectionLabel}>
          ACCENT COLOR
        </ThemedText>
        <View style={styles.swatchRow}>
          {ACCENT_COLORS.map((color) => (
            <Pressable key={color} onPress={() => setAccentColor(color)} style={styles.swatchPressable}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  accentColor === color && [styles.swatchSelected, { borderColor: theme.text }],
                ]}
              />
            </Pressable>
          ))}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          You can change this anytime in Settings.
        </ThemedText>
      </View>

      <ThemedView style={styles.footer}>
        <PrimaryButton label="Next →" onPress={() => router.push('/(auth)/auth-choice')} />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  schemeRow: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
    gap: Spacing.half,
    marginTop: Spacing.three,
  },
  schemeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  sectionLabel: {
    marginTop: Spacing.three,
    opacity: 0.6,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  swatchPressable: {
    padding: Spacing.one,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchSelected: {
    // borderColor applied inline (theme.text) — a fixed black border would be invisible
    // against a dark-mode background.
    borderWidth: 3,
  },
  note: {
    marginTop: Spacing.two,
  },
  footer: {
    padding: Spacing.four,
  },
});
