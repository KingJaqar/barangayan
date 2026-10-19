import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Legacy consumers do not subscribe. Until queried, prefer the static accessible state. */
export function useResidentReducedMotion(enabled: boolean) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !changed) setReduced(value);
    }).catch(() => {
      // Failure to read an optional motion preference must never enable geometric motion.
    });
    return () => { active = false; subscription.remove(); };
  }, [enabled]);
  return reduced;
}
