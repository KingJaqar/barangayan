'use client';

import { useAccentController } from '@/components/theme/accent-controller';
import { useFontController } from '@/components/theme/font-controller';
import { useThemeController } from '@/components/theme/theme-controller';

/**
 * Combines theme/accent/font's own resetX() calls into the one thing every logout path
 * needs — call this synchronously before signing out (see resident-shell.tsx's
 * handleLogout, settings-sidebar.tsx's logout row, and delete-account-form.tsx).
 *
 * Why this exists: theme/accent/font live in plain localStorage keyed by app, not by
 * account, so a browser that just signed out otherwise keeps rendering the *previous*
 * resident's picks in guest mode — nothing about auth state ever touched that storage.
 * This resets all three back to their guest defaults (OS-preferred theme, DEFAULT_ACCENT,
 * DEFAULT_FONT_ID) the moment a resident logs out, so guest mode never leaks a signed-out
 * account's appearance.
 */
export function useResetPreferencesOnLogout(): () => void {
  const { resetTheme } = useThemeController();
  const { resetAccent } = useAccentController();
  const { resetFont } = useFontController();

  return () => {
    resetTheme();
    resetAccent();
    resetFont();
  };
}
