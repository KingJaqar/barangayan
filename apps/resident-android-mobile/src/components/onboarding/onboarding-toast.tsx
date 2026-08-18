import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AUTO_DISMISS_MS = 2200;

/**
 * Centered "preference changed" confirmation used only by the Personalization
 * onboarding step (scheme / accent color taps) — same centered-card + dimmed-backdrop
 * language as the app's other confirmation surfaces (see ActionSuccessModal), but
 * lighter: it springs in, auto-dismisses on its own, and a backdrop tap dismisses it
 * early, so it never blocks a resident who's still experimenting with colors. Purely
 * presentational — callers keep owning when a change actually happened.
 */
export function OnboardingToast({
  visible,
  message,
  onHide,
}: {
  visible: boolean;
  message: string;
  onHide: () => void;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    progress.value = withSpring(1, { damping: 14, stiffness: 220 });
    const timer = setTimeout(onHide, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onHide}>
        <Animated.View
          style={[styles.card, { backgroundColor: theme.backgroundElement }, cardStyle]}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}26` }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
          </View>
          <ThemedText type="smallBold">{message}</ThemedText>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: Spacing.four,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
