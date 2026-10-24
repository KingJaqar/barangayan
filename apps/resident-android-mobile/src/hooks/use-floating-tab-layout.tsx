import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { floatingTabInset } from '@/lib/floating-tab-inset';
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useResidentReducedMotion } from './use-resident-reduced-motion';

const FloatingTabLayoutContext = createContext<{ barHeight: number; keyboardVisible: boolean; setBarHeight: (height: number) => void; mapNavHidden: boolean; setMapNavHidden: (hidden: boolean) => void; mapNavProgress: SharedValue<number> | null }>({
  barHeight: 72,
  keyboardVisible: false,
  setBarHeight: () => {},
  mapNavHidden: false,
  setMapNavHidden: () => {},
  mapNavProgress: null,
});

/** One shell-owned measurement and keyboard subscription for the bar and its consumers. */
export function FloatingTabLayoutProvider({ children }: { children: ReactNode }) {
  const [barHeight, setHeight] = useState(72);
  const [mapNavHidden, setMapNavHidden] = useState(false);
  const mapNavProgress = useSharedValue(0);
  const reducedMotion = useResidentReducedMotion(true);
  useEffect(() => {
    mapNavProgress.value = reducedMotion ? Number(mapNavHidden) : withTiming(Number(mapNavHidden), { duration: 240, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    return () => cancelAnimation(mapNavProgress);
  }, [mapNavHidden, reducedMotion, mapNavProgress]);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const value = useMemo(() => ({
    barHeight,
    keyboardVisible,
    mapNavHidden,
    setMapNavHidden,
    mapNavProgress,
    setBarHeight: (height: number) => {
      if (Number.isFinite(height) && height > 0) setHeight(current => current === height ? current : height);
    },
  }), [barHeight, keyboardVisible, mapNavHidden, mapNavProgress]);
  return <FloatingTabLayoutContext.Provider value={value}><FloatingTabClearance>{children}</FloatingTabClearance></FloatingTabLayoutContext.Provider>;
}

const ClearanceContext = createContext(0);
const VisibleBarClearanceContext = createContext(0);

/** Only this small adapter observes the full pathname; consumers receive scalar changes. */
function FloatingTabClearance({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { bottom } = useSafeAreaInsets();
  const layout = useFloatingTabLayout();
  const inputs = { ...layout, pathname, bottom };
  return <ClearanceContext.Provider value={floatingTabInset(inputs)}>
    <VisibleBarClearanceContext.Provider value={floatingTabInset(inputs, true)}>{children}</VisibleBarClearanceContext.Provider>
  </ClearanceContext.Provider>;
}

export function useFloatingTabClearance(ignoreMapHide: boolean) {
  return useContext(ignoreMapHide ? VisibleBarClearanceContext : ClearanceContext);
}

export function useFloatingTabLayout() {
  return useContext(FloatingTabLayoutContext);
}
