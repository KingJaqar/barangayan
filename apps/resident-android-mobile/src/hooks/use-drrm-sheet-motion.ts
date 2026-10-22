import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

/** Owns only DRRM modal presentation. Interrupted exits never unmount a reopened modal. */
export function useDrrmSheetMotion(visible: boolean, picker: boolean, slide: boolean, measured: boolean) {
  const reduced = useResidentReducedMotion(true);
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState(false);
  const panel = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const refined = picker || slide;

  useEffect(() => { if (visible) setMounted(true); }, [visible]);
  useEffect(() => {
    if (!mounted && !visible) return;
    // Native Modal.onShow and layout must finish before the first slide/fade starts.
    if (visible && refined && (!shown || !measured)) return;
    const reducedDuration = refined ? 80 : 100;
    const duration = reduced ? reducedDuration : picker ? (visible ? 200 : 140) : slide ? (visible ? 300 : 240) : (visible ? 240 : 180);
    const easing = !refined ? Easing.bezier(0.23, 1, 0.32, 1) : !visible ? Easing.in(Easing.cubic) : Easing.bezier(0.22, 1, 0.36, 1);
    const animation = Animated.parallel([
      Animated.timing(panel, { toValue: Number(visible), duration, easing, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: Number(visible), duration: reduced ? reducedDuration : refined && visible ? 180 : 160, easing, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished && !visible) { setMounted(false); setShown(false); }
    });
    return () => animation.stop();
  }, [visible, mounted, refined, shown, measured, picker, slide, reduced, panel, scrim]);

  return { mounted, panel, scrim, reduced, onShow: () => setShown(true) };
}
