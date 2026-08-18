import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shimmering placeholder block for async-loading screens — same Reanimated idiom as
 * QrGeneratingIndicator's rotating ring (useSharedValue + withRepeat + useAnimatedStyle),
 * just driving opacity instead of rotation/scale. Screens compose their own skeleton
 * *layout* out of these primitives locally; this file only owns the shimmer mechanism.
 */
export function SkeletonBlock({
  width,
  height,
  borderRadius = Spacing.two,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.5,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.backgroundSelected },
        shimmerStyle,
        style,
      ]}
    />
  );
}

/** Thin fixed-size spacer for skeleton layouts, so composed skeletons don't need to reach
 * into the real screen's `styles` object (kept purely local/presentational). */
export function SkeletonGap({ size = Spacing.two }: { size?: number }) {
  return <View style={{ height: size, width: size }} />;
}
