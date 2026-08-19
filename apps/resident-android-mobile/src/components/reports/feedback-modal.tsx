import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FeedbackKind = 'success' | 'error';

/**
 * Centered, dead-center pop-up used for "you just did X" feedback across the Reports
 * & Announcements flows (submit a report, confirm a report, withdraw a report) —
 * replaces bare `Alert.alert` / `notify()` calls with the app's own card language
 * (same DNA as `ActionSuccessModal` in services) instead of an OS-level dialog.
 *
 * Auto-dismisses after `autoDismissMs` (default 2200ms) — no manual "OK" tap needed,
 * matching the brief's "auto-dismisses smoothly after 2–3 seconds" spec.
 */
export function FeedbackModal({
  visible,
  kind,
  title,
  message,
  onDismiss,
  autoDismissMs = 2200,
}: {
  visible: boolean;
  kind: FeedbackKind;
  title: string;
  message?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}) {
  const theme = useTheme();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSuccess = kind === 'success';
  const accent = isSuccess ? theme.primary : theme.accentRed;
  const icon = isSuccess ? 'checkmark' : 'close';

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 26, stiffness: 220, mass: 0.8, overshootClamping: true });
      opacity.value = withTiming(1, { duration: 180 });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onDismiss, autoDismissMs);
    } else {
      scale.value = 0.85;
      opacity.value = 0;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.card, { backgroundColor: theme.backgroundElement }, cardAnimatedStyle]}>
          <View style={[styles.iconOuter, { backgroundColor: `${accent}1F` }]}>
            <View style={[styles.iconInner, { backgroundColor: accent }]}>
              <Ionicons name={icon} size={26} color={theme.onPrimary} />
            </View>
          </View>
          <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
            {title}
          </ThemedText>
          {message ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
              {message}
            </ThemedText>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  iconOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  iconInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    textAlign: 'center',
    lineHeight: 19,
  },
});
