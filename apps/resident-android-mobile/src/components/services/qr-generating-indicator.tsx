import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Smooth, purpose-built loading state for the window while create-payment-source mints
 * (or resumes) a QR Ph intent — replaces a static "Generating…" line with a rotating
 * ring around a gently breathing QR icon, so the wait reads as active progress instead
 * of a frozen screen. Same visual slot/size as the QR image it's standing in for (see
 * qrCard's minHeight in the payment screen), so nothing reflows once the real QR lands.
 */
export function QrGeneratingIndicator() {
  const theme = useTheme();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [rotation, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.ringFrame}>
        <Animated.View
          style={[styles.ring, { borderColor: `${theme.primary}26`, borderTopColor: theme.primary }, ringStyle]}
        />
        <Animated.View style={iconStyle}>
          <Ionicons name="qr-code-outline" size={40} color={theme.primary} />
        </Animated.View>
      </View>
      <ThemedText type="smallBold" style={{ color: theme.primary }}>
        Generating your QR code…
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        Just a moment while we set up your payment.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  ringFrame: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
  },
  caption: {
    textAlign: 'center',
  },
});
