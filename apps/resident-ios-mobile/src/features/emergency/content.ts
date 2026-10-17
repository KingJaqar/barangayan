import type { IconName } from '@expo/ui';
import type { z } from 'zod';
import type { emergencyInformationRow } from '../../data/schemas';

export type EmergencyRow = z.infer<typeof emergencyInformationRow>;

/** A tenant colour is used only when it is a plain six-digit hex value; anything else falls back to the theme. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
export function safeColor(value: string): string | null {
  return HEX_COLOR.test(value) ? value : null;
}

/** Ionicons names written by operators (Android's icon set) mapped to SF Symbols; unknown names get the fallback. */
const SYMBOLS: Record<string, IconName> = {
  'home-outline': 'house', 'shield-outline': 'shield', 'checkmark-circle-outline': 'checkmark.circle', 'call-outline': 'phone',
  'flame-outline': 'flame', 'shield-checkmark-outline': 'checkmark.shield', 'medkit-outline': 'cross.case', 'water-outline': 'drop',
  'warning-outline': 'exclamationmark.triangle', 'alert-circle-outline': 'exclamationmark.circle', 'car-outline': 'car', 'people-outline': 'person.2',
  'information-circle-outline': 'info.circle', 'flash-outline': 'bolt', 'thunderstorm-outline': 'cloud.bolt', 'business-outline': 'building.2',
};
export function symbolFor(icon: string, fallback: IconName): IconName {
  return SYMBOLS[icon] ?? fallback;
}

/** One guideline: its title, the operator summary and the readable steps. Non-text steps are dropped. */
export type Guideline = { id: string; title: string; summary: string; steps: string[]; icon: string; color: string | null; background: string | null };
/** One dialable entry of a hotline; `dial` is null for a number that is not safe to hand to the dialer. */
export type HotlineNumber = { label: string; number: string; dial: string | null };
export type Hotline = { id: string; title: string; note: string; numbers: HotlineNumber[]; icon: string; color: string | null; background: string | null };

/**
 * The value handed to the phone dialer, or null when it is not a plain phone number. Only digits, a
 * leading `+` and common separators are accepted (3–15 digits, so national short codes work), which keeps
 * dial-string control characters such as `*`, `#`, `,` and `;` out of the `tel:` link. The dialer asks the
 * resident to confirm; nothing here places a call.
 */
export function dialTarget(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[0-9 ().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 15) return null;
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

const byOrder = <T extends { sort_order: number; id: string }>(a: T, b: T) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);

export function guidelinesFrom(rows: readonly EmergencyRow[]): Guideline[] {
  return rows.filter((row) => row.category === 'guidelines').sort(byOrder).map((row) => ({
    id: row.id, title: row.title, summary: row.body.trim(),
    steps: Array.isArray(row.content) ? row.content.filter((step): step is string => typeof step === 'string' && step.trim().length > 0) : [],
    icon: row.icon, color: safeColor(row.icon_color), background: safeColor(row.icon_bg),
  }));
}

export function hotlinesFrom(rows: readonly EmergencyRow[]): Hotline[] {
  return rows.filter((row) => row.category === 'hotlines').sort(byOrder).map((row) => {
    const entries = Array.isArray(row.content) ? row.content : [];
    const numbers = entries.flatMap((entry): HotlineNumber[] => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const { label, number } = entry as { label?: unknown; number?: unknown };
      if (typeof number !== 'string' || !number.trim()) return [];
      return [{ label: typeof label === 'string' && label.trim() ? label.trim() : 'Hotline', number: number.trim(), dial: dialTarget(number) }];
    });
    return { id: row.id, title: row.title, note: row.body.trim(), numbers, icon: row.icon, color: safeColor(row.icon_color), background: safeColor(row.icon_bg) };
  });
}
