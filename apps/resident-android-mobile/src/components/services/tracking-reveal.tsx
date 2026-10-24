import { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';

/** One native opacity transition on mount. Data ticks never restart the animation. */
export function TrackingReveal({ children, style, reducedMotion: reduced, ...props }: ViewProps & { reducedMotion: boolean }) {
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { opacity.setValue(1); return; }
    const animation = Animated.timing(opacity, {
      toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduced]);
  return <Animated.View {...props} style={[style, { opacity }]}>{children}</Animated.View>;
}
