import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFloatingTabInset as readFloatingTabInset } from '../hooks/use-floating-tab-inset';

const screen = vi.hoisted(() => ({ pathname: '/home', bottom: 0 }));

vi.mock('expo-router', () => ({ usePathname: () => screen.pathname }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: screen.bottom, left: 0 }),
}));

describe('floating tab screen clearance', () => {
  beforeEach(() => {
    screen.pathname = '/home';
    screen.bottom = 0;
  });

  it.each([0, 24])('keeps the same viewport mode across root destinations with a %i bottom safe area', (bottom) => {
    screen.bottom = bottom;
    const homeInset = readFloatingTabInset();
    expect(homeInset).toBeGreaterThan(64 + bottom);

    for (const pathname of ['/services', '/drrm', '/home/emergency-info', '/maps', '/health', '/reports', '/settings', '/announcements', '/home']) {
      screen.pathname = pathname;
      // Every section and its subtabs keep the same floating bar clearance.
      expect(readFloatingTabInset(), pathname).toBe(homeInset);
    }
  });

  it.each([
    '/services/clearance', '/services/request/clearance', '/services/requests/request-id',
    '/services/payment/request-id', '/services/payment/qrph/request-id',
    '/services/payment/pickup/request-id', '/services/payment/success',
    '/home/emergency-info/qr-guide', '/home/emergency-info/scan', '/index/emergency-info/qr-guide',
    '/maps/hotline-directory', '/maps/preparedness-guide', '/health/register',
    '/reports/new', '/reports/incident-id', '/settings/profile', '/settings/valid-id',
    '/settings/change-password', '/settings/location-verification', '/settings/email-verification',
    '/settings/about', '/settings/terms-privacy', '/settings/help', '/settings/help/article-id',
    '/search', '/login', '/complete-profile', '/unknown',
  ])(
    'reserves no bottom tab space on the excluded screen %s', (pathname) => {
      screen.pathname = pathname;
      expect(readFloatingTabInset()).toBe(0);
    },
  );

  it('restores clearance when returning from details or switching to another section', () => {
    screen.bottom = 24;
    const sectionInset = readFloatingTabInset();
    for (const [pathname, visible] of [
      ['/services', true], ['/services/clearance', false], ['/services/request/clearance', false],
      ['/services/clearance', false], ['/services', true], ['/home/emergency-info', true],
      ['/home/emergency-info/qr-guide', false], ['/home/emergency-info', true],
      ['/settings', true], ['/settings/profile', false], ['/settings', true],
      ['/search', false], ['/announcements', true], ['/home', true],
    ] as const) {
      screen.pathname = pathname;
      expect(readFloatingTabInset(), pathname).toBe(visible ? sectionInset : 0);
    }
  });
});
