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
    const animation = Animated.parallel([
      Animated.timing(panel, { toValue: Number(visible), duration: reduced ? 100 : duration, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
      Animated.timing(scrim, { toValue: Number(visible), duration: reduced ? 100 : scrimDuration, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, reduced, duration, scrimDuration, panel, scrim]);
  return { mounted, panel, scrim, reduced };
}
