import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACCENT_COLORS = ['#0F6E5B', '#6C5CE7', '#F39C12', '#E84393'];

// Presentational for now — the app follows the OS color scheme (useColorScheme), and
// there's no per-user theme-preference storage yet. Matches the design's own copy
// ("You can change this anytime in Settings.") — real persistence is a Settings-tab
// concern, not part of this Auth-flow task.
export default function PersonalizationScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [accent, setAccent] = useState(ACCENT_COLORS[0]);

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
              onPress={() => setScheme(option)}
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
            <Pressable key={color} onPress={() => setAccent(color)} style={styles.swatchPressable}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  accent === color && styles.swatchSelected,
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
    borderWidth: 3,
    borderColor: '#000',
  },
  note: {
    marginTop: Spacing.two,
  },
  footer: {
    padding: Spacing.four,
  },
});
