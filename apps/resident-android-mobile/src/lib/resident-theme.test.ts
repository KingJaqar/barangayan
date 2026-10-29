import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS } from '../../../../packages/shared/src/constants/theme-colors';
import { getResidentTheme } from '../constants/resident-theme';

function contrast(first: string, second: string): number {
  const luminance = (hex: string) => [1, 3, 5].reduce((sum, start, index) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe.each(['light', 'dark'] as const)('resident %s contrast', (mode) => {
  it.each([...ACCENT_COLORS, '#FFFFFF', '#000000', '#FFFF00', '#777777', '#010101'])('preserves %s and derives readable controls', (accent) => {
    const theme = getResidentTheme(mode, accent);
    expect(theme.accent).toBe(accent);
    expect(contrast(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.onCallFill, theme.callFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.onAccentPressed, theme.accentPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.onDangerFill, theme.dangerFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.onDangerFill, theme.dangerFillPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accentText, theme.accentSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accentText, theme.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accentText, theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.muted, theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.controlBorder, theme.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.controlBorder, theme.card)).toBeGreaterThanOrEqual(3);
    for (const [ink, surface] of [[theme.danger, theme.dangerSoft], [theme.success, theme.successSoft], [theme.warning, theme.warningSoft], [theme.info, theme.infoSoft]]) {
      expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps status semantics independent of accent and handles invalid legacy colors locally', () => {
    const first = getResidentTheme(mode, '#2563EB');
    const second = getResidentTheme(mode, '#ffffff');
    expect(first.success).toBe(second.success);
    expect(first.danger).toBe(second.danger);
    expect(first.dangerFill).toBe(second.dangerFill);
    for (const invalid of ['', '#fff', 'red', '#GGGGGG', '#FFFFFF00']) {
      expect(getResidentTheme(mode, invalid).accent).toBe('#0F6E5B');
    }
  });
});
