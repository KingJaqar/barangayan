import { contrastRatio, isValidHex, mixColors, sameColor } from './color-math';

/** Semantic colors from the Design System Handoff Rev 2.1 §5. Status colors never change with accent preferences. */
const lightColors = {
  canvas: '#F7F8F7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSelected: '#E8F4EF',
  textPrimary: '#171D1A',
  textSecondary: '#45534E',
  textTertiary: '#61716B',
  border: '#CDD8D2',
  primary: '#0D6B59',
  onPrimary: '#FFFFFF',
  success: '#147A3E',
  warning: '#8A5A00',
  danger: '#B42318',
  info: '#075BAA',
  focus: '#0A70D1',
  overlay: 'rgba(23,29,26,0.36)',
};
export type Colors = typeof lightColors;
const darkColors: Colors = {
  canvas: '#101614',
  surface: '#18201D',
  surfaceRaised: '#202A26',
  surfaceSelected: '#16382F',
  textPrimary: '#F3F7F4',
  textSecondary: '#B9C7C0',
  textTertiary: '#8EA19A',
  border: '#3A4A43',
  primary: '#35C7A0',
  onPrimary: '#06251D',
  success: '#5DDB8B',
  warning: '#FFD37A',
  danger: '#FF8B82',
  info: '#7FC4FF',
  focus: '#88C7FF',
  overlay: 'rgba(0,0,0,0.52)',
};

/** The shared default accent (profiles.accent_color default); it renders with the handoff's own primary tokens. */
export const DEFAULT_ACCENT = '#0F6E5B';
export type Scheme = 'light' | 'dark';
export const basePalette = (scheme: Scheme): Colors => (scheme === 'dark' ? darkColors : lightColors);

const MIN_TEXT_CONTRAST = 4.5;
const WHITE = '#FFFFFF';
const BLACK = '#000000';

/**
 * Applies a resident's accent to action/selection tokens only. The stored color is never
 * changed: when it would be unreadable on this scheme's surfaces, a darker (light) or lighter
 * (dark) tone of the same hue is rendered instead, so the preference stays selectable and visible.
 * Success, warning, danger and info keep their fixed meanings.
 */
export function derivePalette(scheme: Scheme, accent: string | null): Colors {
  const base = basePalette(scheme);
  if (!accent || !isValidHex(accent) || sameColor(accent, DEFAULT_ACCENT)) return base;
  const toward = scheme === 'dark' ? WHITE : BLACK;
  const foregrounds = scheme === 'dark' ? [BLACK, WHITE] : [WHITE, BLACK];
  let primary = accent.toUpperCase();
  let onPrimary = foregrounds[0];
  for (let step = 0; step <= 20; step++) {
    primary = mixColors(accent, toward, step / 20);
    onPrimary = foregrounds.reduce((best, candidate) => (contrastRatio(primary, candidate) > contrastRatio(primary, best) ? candidate : best));
    const readableOnSurfaces = Math.min(contrastRatio(primary, base.surface), contrastRatio(primary, base.canvas)) >= MIN_TEXT_CONTRAST;
    if (readableOnSurfaces && contrastRatio(primary, onPrimary) >= MIN_TEXT_CONTRAST) break;
  }
  const surfaceSelected = mixColors(base.surface, primary, scheme === 'dark' ? 0.25 : 0.12);
  // Keep the fixed blue focus ring unless the accent is too close to it to read as a boundary.
  const focus = contrastRatio(primary, base.focus) >= 1.5 ? base.focus : base.textPrimary;
  return { ...base, primary, onPrimary, surfaceSelected, focus };
}
