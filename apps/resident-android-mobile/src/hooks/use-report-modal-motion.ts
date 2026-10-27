import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

/** Shared by news, the location picker and single-photo viewer. Owns presentation only. */
export function useReportModalMotion(visible: boolean, duration = 280, scrimDuration = 200) {
  const reduced = useResidentReducedMotion(true);
  const [mounted, setMounted] = useState(visible);
  const panel = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setMounted(true);
    // Decelerate in, accelerate out — keeps the slide continuous from wherever an interrupted animation stopped.
    const easing = visible ? Easing.bezier(0.16, 1, 0.3, 1) : Easing.bezier(0.4, 0, 1, 1);
    const animation = Animated.parallel([
      Animated.timing(panel, { toValue: Number(visible), duration: reduced ? 100 : visible ? duration + 60 : duration - 60, easing, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: Number(visible), duration: reduced ? 100 : scrimDuration, easing: Easing.linear, useNativeDriver: true }),
    ]);
    // Opening: the Modal window and its content are still being created/laid out on this frame, and a
    // native animation started now burns its first frames on that work (visible stutter). Let them
    // settle for two frames, then run the slide. Closing has nothing to wait for.
    let frame = 0;
    const run = () => animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    if (visible) {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(run); });
    } else {
      run();
    }
    return () => { cancelAnimationFrame(frame); animation.stop(); };
  }, [visible, reduced, duration, scrimDuration, panel, scrim]);
  return { mounted, panel, scrim, reduced };
}
