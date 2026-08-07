/**
 * The one real "App Theme" accent palette — green/blue/red/purple — shared by the mobile
 * app's Onboarding Personalization screen, its Settings screen, and the web admin panel's
 * Theme page. All three write/read the same `profiles.accent_color` column, so this lives
 * in packages/shared rather than being duplicated per app. First entry matches
 * apps/mobile/src/hooks/use-theme-preference.tsx's DEFAULT_ACCENT_COLOR.
 */
export const ACCENT_COLORS = ['#0F6E5B', '#2563EB', '#DC2626', '#7C3AED'] as const;
