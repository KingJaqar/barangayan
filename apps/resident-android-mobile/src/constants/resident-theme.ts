type RGB = readonly [number, number, number];

function rgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mix(color: string, surface: string, amount: number): string {
  const source = rgb(color);
  return `#${rgb(surface).map((channel, index) => Math.round(source[index] + (channel - source[index]) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [red, green, blue] = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function foreground(background: string): string {
  return contrast('#000000', background) > contrast('#ffffff', background) ? '#000000' : '#ffffff';
}

function readable(color: string, surface: string, text: string): string {
  if (contrast(color, surface) >= 4.5) return color;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step += 1) {
    const middle = (low + high) / 2;
    if (contrast(mix(color, text, middle), surface) >= 4.5) high = middle;
    else low = middle;
  }
  return mix(color, text, high);
}

/** Opt-in resident roles. Saved preferences and the legacy palette stay unchanged. */
export function getResidentTheme(mode: 'light' | 'dark', selectedAccent: string) {
  const dark = mode === 'dark';
  const card = dark ? '#17191C' : '#FFFFFF';
  const surface = dark ? '#24272B' : '#F4F4F4';
  const text = dark ? '#F5F5F5' : '#222222';
  const muted = dark ? '#BDC0C5' : '#6A6A6A';
  const accent = /^#[\da-f]{6}$/i.test(selectedAccent) ? selectedAccent : '#0F6E5B';
  const accentSoft = mix(accent, card, dark ? 0.82 : 0.90);
  const accentPressed = mix(accent, '#000000', 0.22);
  const tone = (color: string) => {
    const soft = mix(color, card, 0.90);
    return { ink: readable(readable(readable(color, card, text), surface, text), soft, text), soft };
  };
  const danger = tone('#D93A3A');
  const dangerFill = '#8F1D1D';
  const success = tone('#0F6E5B');
  const warning = tone('#B86E00');
  const info = tone('#2563EB');
  return {
    card, surface, text, muted, accent, accentSoft, accentPressed,
    onAccent: foreground(accent),
    accentNeedsOutline: contrast(accent, card) < 3,
    onAccentPressed: foreground(accentPressed),
    accentText: readable(readable(readable(accent, card, text), surface, text), accentSoft, text),
    border: dark ? '#34373C' : '#EBEBEB',
    controlBorder: dark ? '#868C95' : '#767676',
    pressed: dark ? '#30343A' : '#EBEBEB',
    scrim: 'rgba(0,0,0,0.40)',
    danger: danger.ink, dangerSoft: danger.soft, onDanger: foreground(danger.ink),
    dangerFill, dangerFillPressed: '#D93A3A', onDangerFill: foreground(dangerFill),
    dangerFillNeedsOutline: contrast(dangerFill, card) < 3,
    success: success.ink, successSoft: success.soft,
    warning: warning.ink, warningSoft: warning.soft,
    info: info.ink, infoSoft: info.soft,
  };
}

export const ResidentLayout = {
  screenPadding: 20,
  panelRadius: 16,
  controlRadius: 12,
  overlayRadius: 24,
  rowPadding: 16,
  controlHeight: 48,
} as const;
