/**
 * The `drive_type` Postgres enum (0035_medical_drives.sql) reflected in TypeScript —
 * the generated `Database` types don't include Postgres enums at all (see the empty
 * `Enums` block in ../types/database.ts), so this hand-maintained union is the single
 * source of truth for both the mobile Health screen and the admin web Health screen.
 * Keep in sync with the `create type public.drive_type as enum (...)` list and the
 * `v_prefix := case v_drive.type ...` block inside `register_for_drive` if either changes.
 */
export const DRIVE_TYPES = [
  'vaccination',
  'maternal_care',
  'blood_drive',
  'medicine',
  'dental',
  'optical',
  'emergency_kit',
  'screening',
  'consultation',
  'minor_surgical',
  'others',
] as const;

export type DriveType = (typeof DRIVE_TYPES)[number];

/** Display label, brand color, and applicant-number prefix per drive type. */
export const DRIVE_TYPE_CONFIG: Record<DriveType, { label: string; color: string; prefix: string }> = {
  vaccination: { label: 'Vaccination', color: '#3B82F6', prefix: 'VAC' },
  maternal_care: { label: 'Maternal Care', color: '#8B5CF6', prefix: 'MAT' },
  blood_drive: { label: 'Blood Drive', color: '#EF4444', prefix: 'BLD' },
  medicine: { label: 'Medicine Distribution', color: '#22C55E', prefix: 'MED' },
  dental: { label: 'Dental Care', color: '#EAB308', prefix: 'DEN' },
  optical: { label: 'Optical Care', color: '#EC4899', prefix: 'OPT' },
  emergency_kit: { label: 'Emergency Kit', color: '#6366F1', prefix: 'EMK' },
  screening: { label: 'Medical Screening', color: '#F97316', prefix: 'SCR' },
  consultation: { label: 'Medical Consultation', color: '#06B6D4', prefix: 'CON' },
  minor_surgical: { label: 'Minor Surgical Drive', color: '#92400E', prefix: 'SRG' },
  others: { label: 'Others', color: '#6B7280', prefix: 'DRV' },
};
