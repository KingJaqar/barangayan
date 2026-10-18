export const REGISTRATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'attended', label: 'Attended' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUS_OPTIONS)[number]['value'];
export type Tab = 'all' | RegistrationStatus;

export function registrationStatusLabel(status: string): string {
  return REGISTRATION_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  ...REGISTRATION_STATUS_OPTIONS.map(({ value, label }) => ({ key: value, label })),
];

export type ApplicantRow = {
  id: string;
  drive_id: string;
  user_id: string;
  applicant_number: string;
  age: number;
  is_pwd: boolean;
  comorbidities: string[];
  prior_dose_date: string | null;
  priority_score: number;
  status: RegistrationStatus;
  created_at: string;
  updated_at: string;
  medical_drives: { id: string; title: string; type: string; drive_date: string; location: string } | null;
  profiles: { full_name: string; email: string | null } | null;
};
