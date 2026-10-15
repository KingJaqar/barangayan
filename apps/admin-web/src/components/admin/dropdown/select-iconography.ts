import {
  Accessibility, Activity, ALargeSmall, Archive, Armchair, ArrowDownWideNarrow, BadgeCheck,
  BookOpen, BriefcaseBusiness, Building2, CalendarDays, CircleCheck, CircleHelp,
  CircleMinus, CircleX, ClipboardCheck, ClipboardList, Clock, Coins, Copy,
  DoorClosed, DoorOpen, Droplet, FileCheck, FileText, FileX, Flame, Glasses,
  GraduationCap, HandCoins, Hash, Heart, House, IdCard, Info, Landmark, Leaf, Mail,
  MapPin, Mars, Megaphone, Package, PenLine, Phone, Pill, QrCode, ReceiptText,
  Recycle, RotateCcw, Rows3, Scissors, Search, Shield, ShieldCheck, ShieldUser,
  SmilePlus, SquareCheck, Stethoscope, Store, Syringe, Tag, Trash2,
  TriangleAlert, UserCheck, UserRound, UserRoundCog, Users, Venus,
  VenusAndMars, Wallet, type LucideIcon,
} from 'lucide-react';
import type { SortDescriptor } from '@/lib/admin-tables/sort-definitions';

/** UI metadata only: values, labels, ordering and save rules belong to the caller. */
export const SELECT_FIELD_ICONS = {
  category: Tag, people: UserRound, date: CalendarDays, document: FileText,
  status: Activity, page: Rows3, sort: ArrowDownWideNarrow, payment: Wallet,
  sex: VenusAndMars, employment: BriefcaseBusiness, health: Stethoscope,
  announcement: Megaphone, faq: CircleHelp, hub: Shield, availability: Building2,
  waste: Trash2, zone: MapPin, center: Building2, id: IdCard, idPresence: IdCard,
  officialRole: BadgeCheck, relation: Users, memberRole: House,
  workflow: ClipboardList, pwd: Accessibility, boolean: CircleHelp, qrIcon: QrCode,
};

export type AdminSelectKind = keyof typeof SELECT_FIELD_ICONS;

const SORT_ICONS: Readonly<Record<string, LucideIcon>> = {
  reference: Hash, number: Hash, resident: UserRound, reporter: UserRound,
  name: UserRound, first_name: UserRound, last_name: UserRound, head: House,
  document: FileText, title: FileText, status: Activity, payment_status: Wallet,
  method: HandCoins, amount: Coins, email: Mail, email_verification: BadgeCheck,
  id_status: IdCard, category: Tag, confirmations: UserCheck, registrations: Users,
  stock: Package, drive: Stethoscope, age: CalendarDays, priority: ClipboardList,
  relation: Users, role: BadgeCheck, checked_in: UserCheck, center: Building2,
  archived: Archive,
};

export function selectSortIcon(sort: SortDescriptor): LucideIcon {
  if (Object.hasOwn(SORT_ICONS, sort.key)) return SORT_ICONS[sort.key];
  return sort.category === 'text' ? ALargeSmall : sort.category === 'date' ? CalendarDays : sort.category === 'boolean' ? CircleCheck : Hash;
}

const BOOLEAN_ICONS = { true: CircleCheck, false: CircleMinus };
export const SELECT_OPTION_ICONS: Partial<Record<AdminSelectKind, Readonly<Record<string, LucideIcon>>>> = {
  status: {
    submitted: FileText, open: DoorOpen, in_progress: Clock,
    ready_for_pickup: Package, completed: CircleCheck, cancelled: CircleX,
    pending: Clock, paid: BadgeCheck, waived: CircleMinus, failed: CircleX,
    expired: FileX, refunded: RotateCcw, resolved: CircleCheck,
    withdrawn: RotateCcw, unresolved: TriangleAlert, confirmed: ClipboardCheck,
    attended: UserCheck, active: CircleCheck, inactive: CircleMinus, ...BOOLEAN_ICONS,
  },
  boolean: BOOLEAN_ICONS,
  pwd: BOOLEAN_ICONS,
  payment: { pickup: HandCoins, qrph: QrCode },
  sex: { male: Mars, female: Venus },
  employment: {
    employed: BriefcaseBusiness, unemployed: Search, student: GraduationCap,
    self_employed: Store, retired: Armchair,
  },
  health: {
    vaccination: Syringe, maternal_care: Heart, blood_drive: Droplet,
    medicine: Pill, dental: SmilePlus, optical: Glasses, emergency_kit: ShieldCheck,
    screening: ClipboardCheck, consultation: Stethoscope, minor_surgical: Scissors,
    others: CircleHelp,
  },
  announcement: { general: Info, emergency: TriangleAlert, health: Heart, events: CalendarDays },
  faq: { general: CircleHelp, services: FileText, emergency: TriangleAlert, health: Heart, billing: ReceiptText, account: UserRound },
  hub: { guidelines: BookOpen, hotlines: Phone },
  availability: { available: DoorOpen, unavailable: DoorClosed, unknown: CircleHelp },
  waste: { biodegradable: Leaf, recyclable: Recycle, residual: Trash2, special: TriangleAlert, bulk: Package },
  idPresence: { with_id: FileCheck, without_id: FileX },
  officialRole: {
    admin: ShieldUser, staff: UserRoundCog, barangay_captain: Landmark,
    kagawad: Users, sk_chairman: GraduationCap, secretary: PenLine,
    treasurer: Coins, health_worker: Stethoscope, tanod: Shield, clerk: ClipboardList,
  },
  memberRole: { head: House, member: UserRound },
  workflow: { general: FileText, business: Store, indigency: House, first_time_job_seeker: BriefcaseBusiness, certified_true_copy: Copy },
  qrIcon: {
    'qr-code-outline': QrCode, 'help-circle-outline': CircleHelp,
    'warning-outline': TriangleAlert, 'shield-checkmark-outline': ShieldCheck,
    'flame-outline': Flame, 'call-outline': Phone, 'location-outline': MapPin,
    'people-outline': Users, 'home-outline': House, 'checkbox-outline': SquareCheck,
  },
};

/** Record field keys are confirmed by record-config; presentation stays in the UI. */
export function recordSelectKind(key: string): AdminSelectKind {
  switch (key) {
    case 'payment_method': case 'method': return 'payment';
    case 'sex': return 'sex';
    case 'employment_status': return 'employment';
    case 'type': return 'health';
    case 'relation': return 'relation';
    case 'role': return 'memberRole';
    case 'official_role': return 'officialRole';
    case 'is_pwd': return 'pwd';
    default: return 'status';
  }
}
