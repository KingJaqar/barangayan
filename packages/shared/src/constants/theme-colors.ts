/**
 * The "App Theme" accent palette — shared by the mobile app's Onboarding Personalization
 * screen, its Settings screen, and the web admin panel's Theme page. All three write/read
 * the same `profiles.accent_color` column, so this lives in packages/shared rather than
 * being duplicated per app. First entry matches
 * apps/resident-android-mobile/src/hooks/use-theme-preference.tsx's DEFAULT_ACCENT_COLOR.
 *
 * `accent_color` is a free-form hex string, not an enum constrained to this list — the
 * web admin Theme page also lets the admin type/pick any custom hex color, which is
 * persisted the same way. This array is just the curated quick-pick swatches.
 */
export const ACCENT_COLORS = [
  '#0F6E5B', // Barangay green (default)
  '#2563EB', // Blue
  '#DC2626', // Red
  '#7C3AED', // Purple
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#CA8A04', // Amber
  '#4F46E5', // Indigo
  '#16A34A', // Emerald
  '#0891B2', // Cyan
  '#9333EA', // Violet
  '#E11D48', // Rose
  '#65A30D', // Lime
  '#C026D3', // Fuchsia
  '#B45309', // Bronze
  '#334155', // Slate
  '#0369A1', // Sky
  '#B91C1C', // Crimson
  '#166534', // Forest
] as const;
