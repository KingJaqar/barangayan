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
