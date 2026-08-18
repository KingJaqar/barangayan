/* eslint-disable react-hooks/immutability -- Reanimated shared-value mutation in
   press-feedback handlers (see AnimatedCenterCard in home/emergency-info/index.tsx for
   the same sanctioned pattern) is not the "mutating immutable render output" case this
   rule targets. */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { OnboardingAmbientBackground } from '@/components/onboarding/onboarding-ambient-background';
import { OnboardingProgressDots } from '@/components/onboarding/onboarding-progress-dots';
import { OnboardingToast } from '@/components/onboarding/onboarding-toast';
import { PrimaryButton } from '@/components/primary-button';
import { SegmentedControl } from '@/components/segmented-control';
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function handleSchemeChange(option: 'light' | 'dark') {
    setThemePreference(option);
    setToastMessage(`${option === 'light' ? 'Light' : 'Dark'} mode enabled`);
  }

  function handleAccentChange(color: string) {
    setAccentColor(color);
    setToastMessage('Accent color updated');
  }

  return (
    <ThemedView style={styles.container}>
      <OnboardingAmbientBackground tint={theme.primary} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <ThemedText type="title" style={styles.title}>
              Make it yours.
            </ThemedText>
            <ThemedText themeColor="textSecondary">Customize your experience.</ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(120)}>
            <ThemedText type="small" style={styles.sectionLabel}>
              APPEARANCE
            </ThemedText>
            <SegmentedControl
              segments={[
                { key: 'light', label: 'Light' },
                { key: 'dark', label: 'Dark' },
              ]}
              activeKey={scheme}
              onChange={(key) => handleSchemeChange(key as 'light' | 'dark')}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <ThemedText type="small" style={styles.sectionLabel}>
              ACCENT COLOR
            </ThemedText>
            <View style={styles.swatchRow}>
              {ACCENT_COLORS.map((color) => (
                <AccentSwatch
                  key={color}
                  color={color}
                  selected={accentColor === color}
                  ringColor={theme.text}
                  onPress={() => handleAccentChange(color)}
                />
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(260)}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              You can change this anytime in Settings.
            </ThemedText>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.footer}>
          <OnboardingProgressDots
            step={3}
            activeColor={theme.primary}
            inactiveColor={theme.backgroundSelected}
          />
          <PrimaryButton label="Next →" onPress={() => router.push('/(auth)/auth-choice')} />
        </Animated.View>
      </SafeAreaView>

      <OnboardingToast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
    </ThemedView>
  );
}

function AccentSwatch({
  color,
  selected,
  ringColor,
  onPress,
}: {
  color: string;
  selected: boolean;
  ringColor: string;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  function handlePressIn() {
    pressScale.value = withSpring(0.9, { damping: 14, stiffness: 260 });
  }

  function handlePressOut() {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 260 });
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.swatchPressable}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Animated.View
        style={[
          styles.swatch,
          { backgroundColor: color },
          selected && [styles.swatchSelected, { borderColor: ringColor }],
          pressStyle,
        ]}>
        {selected && (
          <Animated.View
            entering={ZoomIn.springify().damping(14)}
            exiting={ZoomOut.duration(120)}
            style={styles.checkBadge}>
            <Ionicons name="checkmark" size={16} color="#ffffff" />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
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
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  sectionLabel: {
    marginBottom: Spacing.two,
    opacity: 0.6,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  swatchPressable: {
    padding: Spacing.one,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    // borderColor applied inline (theme.text) — a fixed black border would be invisible
    // against a dark-mode background.
    borderWidth: 3,
  },
  checkBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: Spacing.one,
  },
  footer: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
});
