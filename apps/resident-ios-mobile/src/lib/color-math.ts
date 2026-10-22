/** Pure color helpers for appearance preferences (hex validation, HSV conversion, WCAG contrast). */

export type Hsv = { h: number; s: number; v: number };
const HEX = /^#[0-9a-fA-F]{6}$/;

export const isValidHex = (value: string): boolean => HEX.test(value);
/** Canonical stored form: `#RRGGBB`, uppercase. */
export const normalizeHex = (value: string): string => value.toUpperCase();
export const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = toRgb(hex).map((channel) => channel / 255) as Rgb;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - chroma;
  const sector = Math.floor(hue / 60);
  const [r, g, b]: Rgb = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][sector % 6] as Rgb;
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}
/** WCAG 2.x contrast ratio between two solid `#RRGGBB` colors. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** White or black, whichever reads better as a mark drawn directly on the solid `#RRGGBB` background. */
export function readableForeground(background: string): '#FFFFFF' | '#000000' {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000') ? '#FFFFFF' : '#000000';
}

/** Linear sRGB-channel blend: `amount` 0 returns `from`, 1 returns `to`. */
export function mixColors(from: string, to: string, amount: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex(a.map((channel, index) => channel + (b[index] - channel) * clamp(amount, 0, 1)) as Rgb);
}
