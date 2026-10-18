import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FLOATING_SCREENS = new Set([
  '/home', '/services', '/drrm', '/maps', '/health', '/reports', '/announcements', '/settings',
  '/home/emergency-info',
]);

/**
 * Shared visibility and scroll clearance for the bottom tabs.
 * Section subtabs use the same pathname; detail and form routes get no bar.
 * Includes the 64px tabs, border, top gap and Android safe area.
 */
export function useFloatingTabInset() {
  const pathname = usePathname();
  const { bottom } = useSafeAreaInsets();
  return FLOATING_SCREENS.has(pathname) ? 74 + Math.max(bottom, 8) : 0;
}
