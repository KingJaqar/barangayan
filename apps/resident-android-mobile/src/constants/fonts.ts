import { Platform } from 'react-native';

import { FONT_OPTIONS as SHARED_FONT_OPTIONS, DEFAULT_FONT_ID } from '@barangayan/shared';

/**
 * The Settings screen's font-style picker — up to 10 of the web admin Theme page's
 * FONT_OPTIONS (packages/shared/src/constants/theme-fonts.ts), so the same `id` persisted
 * to `profiles.font_preference` (0075 migration) means the same font on both apps. Dropped
 * 'garamond' and 'courier-new' to stay within the 10-option cap this screen asks for.
 */
export const MOBILE_FONT_OPTIONS = SHARED_FONT_OPTIONS.filter((f) => f.id !== 'garamond' && f.id !== 'courier-new');

export { DEFAULT_FONT_ID };

/**
 * Maps a FONT_OPTIONS id to a font family React Native can actually render. Unlike the web
 * (CSS font stacks with automatic fallback), RN needs one concrete family name per platform:
 * iOS ships real system faces for most of these names (Georgia, Verdana, Trebuchet MS, ...),
 * Android does not — none of the RN_FONT_FAMILIES below are custom-bundled, so Android falls
 * back to its built-in Roboto/Noto generic families ('sans-serif', 'serif', 'monospace' and
 * their weight/width variants) as the closest visual approximation for each choice.
 */
const RN_FONT_FAMILIES: Record<string, { ios?: string; android?: string }> = {
  system: {},
  inter: {},
  arial: { ios: 'Arial', android: 'sans-serif' },
  helvetica: { ios: 'Helvetica Neue', android: 'sans-serif' },
  'segoe-ui': { ios: undefined, android: 'sans-serif-medium' },
  verdana: { ios: 'Verdana', android: 'sans-serif' },
  tahoma: { ios: undefined, android: 'sans-serif-condensed' },
  'trebuchet-ms': { ios: 'Trebuchet MS', android: 'sans-serif-light' },
  georgia: { ios: 'Georgia', android: 'serif' },
  'times-new-roman': { ios: 'Times New Roman', android: 'serif' },
};

/** Returns the RN `fontFamily` value for a font id, or undefined to fall through to the
 * OS default (system/inter, or an unrecognized id). */
export function getMobileFontFamily(id: string): string | undefined {
  const entry = RN_FONT_FAMILIES[id];
  if (!entry) return undefined;
  return Platform.select({ ios: entry.ios, android: entry.android, default: undefined });
}
