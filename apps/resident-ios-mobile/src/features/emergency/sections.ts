/**
 * The Emergency hub sections (A20). The route's `section` parameter selects one and is written back, so
 * links, a return from a pushed screen and a re-selection all agree. Android's `tab` values still resolve:
 * `hub` is its combined guidelines/hotlines page, `scan` its QR page.
 */
export const EMERGENCY_SECTIONS = ['guidelines', 'hotlines', 'centers', 'family', 'qr', 'alerts'] as const;
export type EmergencySection = (typeof EMERGENCY_SECTIONS)[number];

export const SECTION_LABEL: Record<EmergencySection, string> = {
  guidelines: 'Guidelines', hotlines: 'Hotlines', centers: 'Centers', family: 'Family', qr: 'QR', alerts: 'Alerts',
};

const ALIASES: Record<string, EmergencySection> = {
  guidelines: 'guidelines', hub: 'guidelines', preparedness: 'guidelines', 'preparedness-guide': 'guidelines',
  hotlines: 'hotlines', 'hotline-directory': 'hotlines',
  centers: 'centers', family: 'family', qr: 'qr', scan: 'qr', 'qr-guide': 'qr', alerts: 'alerts',
};

function single(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first : undefined;
}

/** The section named by `section` (iOS) or `tab` (Android); anything unknown opens Guidelines. */
export function resolveSection(section: unknown, tab: unknown): EmergencySection {
  return ALIASES[single(section) ?? single(tab) ?? ''] ?? 'guidelines';
}
