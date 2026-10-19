/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useMemo } from 'react';
import { getResidentTheme } from '@/constants/resident-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

export function useTheme() {
  const { scheme, accentColor } = useThemePreference();
  const resident = useMemo(() => getResidentTheme(scheme, accentColor), [scheme, accentColor]);

  return {
    ...Colors[scheme],
    // Real per-account accent color (Settings > App Theme) overrides the constant —
    // onPrimary stays white regardless, it reads fine against all 4 accent swatches.
    primary: accentColor,
    resident,
  };
}
