import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { useTheme } from '@/hooks/use-theme';

export function ShimmerSkeleton({
  theme,
  height = 12,
  width = '100%',
  style,
  borderRadius = 6,
}: {
  theme: ReturnType<typeof useTheme>;
  height?: number;
  width?: number | string;
  style?: ViewStyle;
  borderRadius?: number;
}) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.7,
  }));

  return (
    <Animated.View
      style={[
        { height, width: width as any, backgroundColor: theme.backgroundSelected, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}
