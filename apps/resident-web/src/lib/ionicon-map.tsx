import {
  AlertTriangle,
  Flame,
  Shield,
  Phone,
  Info,
  QrCode,
  Siren,
  HeartPulse,
  Dog,
  Zap,
  Utensils,
  Users,
  Droplets,
  Wifi,
  MapPin,
  CheckCircle2,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * emergency_information.icon / emergency_qr_content.icon store Ionicons names (admin-web
 * writes them, mobile renders them via @expo/vector-icons' Ionicons) — resident-web uses
 * lucide-react instead (plan §1's design-system decision), so DB icon names need mapping
 * to a lucide component. Covers every icon name actually seeded (migration 0049) plus the
 * evacuation-center facility icons (FACILITY_ICON_MAP, ported from
 * evacuation-center-card.tsx) and reasonable common names an admin might pick. Falls back
 * to `Info` for anything unmapped rather than throwing.
 */
const IONICON_MAP: Record<string, LucideIcon> = {
  'warning-outline': AlertTriangle,
  warning: AlertTriangle,
  'flame-outline': Flame,
  flame: Flame,
  'shield-outline': Shield,
  'shield-checkmark-outline': Shield,
  shield: Shield,
  'call-outline': Phone,
  call: Phone,
  'information-circle-outline': Info,
  'information-circle': Info,
  'qr-code-outline': QrCode,
  'qr-code': QrCode,
  siren: Siren,
  'medkit-outline': HeartPulse,
  medkit: HeartPulse,
  'heart-outline': HeartPulse,
  'paw-outline': Dog,
  'flash-outline': Zap,
  flash: Zap,
  'restaurant-outline': Utensils,
  'people-outline': Users,
  'water-outline': Droplets,
  'wifi-outline': Wifi,
  'location-outline': MapPin,
  'checkmark-outline': CheckCircle2,
};

function resolveIonicon(name: string | null | undefined): LucideIcon {
  if (!name) return Info;
  return IONICON_MAP[name] ?? Info;
}

/**
 * Renders a DB-driven icon name directly to a JSX element, rather than returning a
 * component reference for the caller to instantiate as `<Icon .../>`. eslint's
 * react-hooks/static-components rule flags the latter pattern ("a component was created
 * during render") even when — as here — the "creation" is really just a lookup among a
 * fixed set of already-defined lucide components; returning the element outright sidesteps
 * that false positive instead of fighting it with useMemo (tried, still flagged).
 */
export function renderIonicon(name: string | null | undefined, props?: LucideProps): ReactElement {
  const Icon = resolveIonicon(name);
  return <Icon {...props} />;
}

export const FACILITY_LABELS: Record<string, string> = {
  medical_desk: 'Medical Desk',
  medical: 'Medical',
  pet_friendly: 'Pet Friendly',
  generator: 'Generator',
  catering: 'Catering',
  children: 'Children',
  toilets: 'Toilets',
  internet: 'Internet',
};

/** Facility key -> Ionicon name (ported from evacuation-center-card.tsx's
 * FACILITY_ICON_MAP) — facility keys are storage codes, not Ionicon names, so this maps
 * one to the other before handing off to renderIonicon(). */
export const FACILITY_ICON_NAMES: Record<string, string> = {
  medical_desk: 'medkit-outline',
  medical: 'medkit-outline',
  pet_friendly: 'paw-outline',
  generator: 'flash-outline',
  catering: 'restaurant-outline',
  children: 'people-outline',
  toilets: 'water-outline',
  internet: 'wifi-outline',
};
