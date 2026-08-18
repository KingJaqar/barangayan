import type { Ionicons } from '@expo/vector-icons';

/**
 * document_types.name -> Ionicons glyph. Keyed by lowercase exact match (names are
 * freeform strings — no slug/category column exists in the schema) with a substring
 * fallback for near-misses, then a generic default. Add an entry here whenever a new
 * document type name needs a specific icon; unmapped names still render correctly via
 * the fallback, so this never blocks adding new document_types rows.
 */
const DOCUMENT_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  'barangay clearance': 'shield-checkmark-outline',
  'barangay id': 'card-outline',
  'business permit': 'briefcase-outline',
  'certificate of indigency': 'heart-outline',
  'certificate of residency': 'home-outline',
  'blotter report copy': 'document-lock-outline',
};

const DEFAULT_DOCUMENT_ICON: keyof typeof Ionicons.glyphMap = 'document-text-outline';

export function getDocumentIcon(name: string): keyof typeof Ionicons.glyphMap {
  const key = name.trim().toLowerCase();
  if (DOCUMENT_ICON_MAP[key]) return DOCUMENT_ICON_MAP[key];

  // Loose substring fallback so a real-world name variation ("Barangay Business Permit
  // Renewal") still lands on a sensible icon instead of the generic default.
  const match = Object.keys(DOCUMENT_ICON_MAP).find((k) => key.includes(k) || k.includes(key));
  return match ? DOCUMENT_ICON_MAP[match] : DEFAULT_DOCUMENT_ICON;
}
