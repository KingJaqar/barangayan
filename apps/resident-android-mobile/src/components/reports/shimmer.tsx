import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * A single shimmering skeleton block — replaces the old static
 * `backgroundSelected`-filled boxes with a soft opacity pulse loop
 * (hardware-accelerated, UI-thread only) so loading states read as
 * "content is on its way" rather than a dead placeholder.
 */
export function Shimmer({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: theme.backgroundSelected },
        style,
        animatedStyle,
      ]}
    />
  );
}

/** Thin wrapper so skeleton groups fade out together once real content is ready. */
export function ShimmerGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  group: {
    gap: 8,
  },
});
