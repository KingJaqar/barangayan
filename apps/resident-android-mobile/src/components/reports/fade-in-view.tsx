import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Shared-value-driven fade + rise reveal for conditionally-mounted blocks — e.g. the
 * incident form's Zone section, the incident detail screen's action banners, the
 * segment heading when the resident switches tabs.
 *
 * Deliberately NOT `entering`/`exiting`/`layout` (Reanimated's `Animated.View` props).
 * Those reliably get stuck at their pre-animation `visibility: hidden` state on this
 * app's web target and never resolve — confirmed on plain `ScrollView` children too,
 * not just FlatList rows (see the note on `IncidentCard`/`AnnouncementCard`). Driving
 * opacity + translateY off a `useSharedValue` in a mount-time effect sidesteps that bug
 * entirely while still giving the block a soft rise-and-fade instead of a hard pop —
 * same idiom that already powers `Shimmer` and `FeedbackModal`.
 *
 * Only `opacity`/`transform` are touched, so this runs on the UI thread — no JS-driven
 * `width`/`height`/`margin` animation.
 */
export function FadeInView({
  children,
  style,
  duration = 220,
  rise = 8,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fade + rise duration in ms. */
  duration?: number;
  /** Starting vertical offset (px) that eases back to 0. */
  rise?: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(rise);

  useEffect(() => {
    opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration, easing: Easing.out(Easing.quad) });
    // Mount-once reveal — this component is (re)mounted by the caller (conditional
    // render, or a `key` change) whenever a fresh reveal is wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
