/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { ACCENT_COLORS as SHARED_ACCENT_COLORS } from '@barangayan/shared';
import { Platform } from 'react-native';

// primary/onPrimary/accentRed sampled directly from the design file (see the plan's
// Design Reference Review) — #0F6E5B is the button/active-state green, #93000A is the
// locked red accent for the Maps (Emergency & DRRM) section's active tab/toggle state.
//
// accentOrange/accentGreen back the Reports bottom-tab's "active reports" / "resolved
// reports" live-count badges (white text on a dark fill, per the design brief) — picked
// dark enough for white text to clear WCAG AA at the badges' small size, and deliberately
// NOT theme.primary/ACCENT_COLORS, for the same reason status-badge.tsx's STATUS_GREEN
// isn't theme.primary either: status semantics must stay fixed regardless of the user's
// chosen App Theme accent color. accentOrange is also kept visually distinct from
// accentRed (the announcements badge) — the two used to be easy to mistake for each
// other at the badges' small size.
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    primary: '#0F6E5B',
    onPrimary: '#ffffff',
    accentRed: '#93000A',
    accentOrange: '#C2410C',
    accentGreen: '#166534',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    primary: '#0F6E5B',
    onPrimary: '#ffffff',
    accentRed: '#93000A',
    accentOrange: '#C2410C',
    accentGreen: '#166534',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Re-exported from packages/shared (now also read by the web admin's Theme page) —
// kept as a named export here so existing mobile imports (Onboarding Personalization,
// Settings) don't need to change. See theme-colors.ts's own comment for why this lives
// in shared. The first entry matches use-theme-preference.tsx's DEFAULT_ACCENT_COLOR.
export const ACCENT_COLORS = SHARED_ACCENT_COLORS;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** Custom Gideon Roman serif */
    gideonRoman: 'GideonRoman',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    gideonRoman: 'GideonRoman',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    gideonRoman: 'GideonRoman',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
