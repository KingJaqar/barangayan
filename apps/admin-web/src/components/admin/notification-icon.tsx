import {
  Building2, CircleHelp, FileText, Heart, Info, LockKeyhole, Mail,
  MapPin, Megaphone, QrCode, ReceiptText, Recycle, Route, ScrollText,
  Settings, UserRoundCog, UsersRound, TriangleAlert, type LucideIcon,
} from 'lucide-react';

import type { ModuleKey } from '@/lib/audit-notifications';

import { HouseholdResidentsIcon } from './household-residents-icon';
import { MedicalApplicantIcon } from './medical-applicant-icon';

const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  services: FileText,
  announcements: Megaphone,
  requests: Mail,
  transactions: ReceiptText,
  residents: UsersRound,
  'incident-reports': TriangleAlert,
  health: Heart,
  'health-applicants': MedicalApplicantIcon,
  'waste-management': Recycle,
  hub: Building2,
  'evacuation-centers': MapPin,
  'evacuation-routing': Route,
  'emergency-qr': QrCode,
  'households-residents': HouseholdResidentsIcon,
  staff: UserRoundCog,
  faq: CircleHelp,
  'terms-privacy': ScrollText,
  'about-us': Info,
  settings: Settings,
  system: LockKeyhole,
};

/** Decorative outline symbol; the adjacent notification text supplies its label. */
export function NotificationIcon({ module, className = 'size-[18px]' }: { module: ModuleKey; className?: string }) {
  const Icon = MODULE_ICONS[module];
  return <Icon aria-hidden="true" className={`shrink-0 ${className}`} strokeWidth={2.25} />;
}

export function NotificationIconBadge({ module, className = '' }: { module: ModuleKey; className?: string }) {
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 ${className}`}>
      <NotificationIcon module={module} className="size-5" />
    </span>
  );
}
