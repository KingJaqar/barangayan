import { Easing } from 'react-native';

/** Health calendar motion; long request lists use a UI-thread disclosure instead. */
export const disclosureMotion = {
  slide: { duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: false, isInteraction: false },
  fade: { duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false },
};
