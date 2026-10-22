import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFloatingTabLayout } from './use-floating-tab-layout';

const FLOATING_SCREENS = new Set([
  '/home', '/services', '/drrm', '/maps', '/health', '/reports', '/announcements', '/settings',
  '/home/emergency-info',
]);

/**
 * Shared visibility and scroll clearance for the bottom tabs.
 * Section subtabs use the same pathname; detail and form routes get no bar.
 * Includes the measured bar, 12dp bottom offset, top gap and Android safe area.
 */
export function useFloatingTabInset(ignoreMapHide = false) {
  const pathname = usePathname();
  const { bottom } = useSafeAreaInsets();
  const { barHeight, keyboardVisible, mapNavHidden } = useFloatingTabLayout();
  const hidden = !ignoreMapHide && mapNavHidden && (pathname === '/drrm' || pathname === '/home/emergency-info');
  return FLOATING_SCREENS.has(pathname) && !keyboardVisible && !hidden ? barHeight + 8 + Math.max(bottom, 12) : 0;
}
