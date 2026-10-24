const FLOATING_SCREENS = new Set([
  '/home', '/services', '/drrm', '/maps', '/health', '/reports', '/announcements', '/settings',
  '/home/emergency-info',
]);

/** Scalar clearance shared by the shell adapter; root-to-root navigation keeps its value. */
export function floatingTabInset({ pathname, bottom, barHeight, keyboardVisible, mapNavHidden }: {
  pathname: string; bottom: number; barHeight: number; keyboardVisible: boolean; mapNavHidden: boolean;
}, ignoreMapHide = false) {
  const hidden = !ignoreMapHide && mapNavHidden && (pathname === '/maps' || pathname === '/drrm' || pathname === '/home/emergency-info');
  return FLOATING_SCREENS.has(pathname) && !keyboardVisible && !hidden ? barHeight + 8 + Math.max(bottom, 12) : 0;
}
