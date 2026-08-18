import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Centered confirmation for a successful cancel action (cancel payment / cancel
 * request) — same centered-card visual language as PaymentSuccessModal, but generic
 * over title/message so it can be reused for any "you just did X, here's confirmation"
 * moment instead of a plain Alert.alert(), which reads as an OS-level dialog rather
 * than something that belongs to the app.
 *
 * The card springs/fades in on mount (Reanimated) purely for polish — dismissal stays
 * manual via the "OK" button, which is what actually clears the caller's local state.
 */
export function ActionSuccessModal({
  visible,
  title,
  message,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      scale.value = 0.85;
      opacity.value = 0;
    }
  }, [visible, scale, opacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { backgroundColor: theme.backgroundElement }, cardAnimatedStyle]}>
          <View style={[styles.checkOuter, { backgroundColor: `${theme.primary}26` }]}>
            <View style={[styles.checkInner, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={32} color={theme.onPrimary} />
            </View>
          </View>
          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
            {message}
          </ThemedText>
          <View style={styles.buttonRow}>
            <PrimaryButton label="OK" onPress={onConfirm} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  checkOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  checkInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  caption: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  buttonRow: {
    width: '100%',
  },
});
