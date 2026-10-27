export type RegistrationFailure = {
  kind: 'account' | 'rejected' | 'unconfirmed';
  message: string;
  checkRegistrations?: boolean;
};

/** Only known public errors get specific copy. Never render database error text. */
export function healthRegistrationFailure(error: unknown): RegistrationFailure {
  const record = error && typeof error === 'object' ? error : {};
  const code = 'code' in record && typeof record.code === 'string' ? record.code : '';
  const detail = 'message' in record && typeof record.message === 'string' ? record.message : '';
  if (code === 'P0010') return { kind: 'account', message: 'Sign in with your resident account to register for this medical drive.' };
  if (code === '42501' && detail === 'resident_profile_completion_required') {
    return { kind: 'rejected', message: 'Complete your resident profile in Settings before registering.' };
  }
  const messages: Record<string, string> = {
    P0001: 'Your session has ended. Sign in again to register.',
    P0002: 'This medical drive is no longer available.',
    P0003: 'This medical drive has no remaining slots.',
    P0004: 'You are already registered for this medical drive. Open My Registrations to view your registration.',
    P0005: 'Registration for this medical drive has closed.',
    P0011: 'You can only register for medical drives in your own barangay.',
  };
  if (Object.hasOwn(messages, code)) return { kind: 'rejected', message: messages[code], checkRegistrations: code === 'P0004' };
  if (code === '22023') {
    const validation: Record<string, string> = {
      invalid_age: 'Please enter a valid age (0–130).',
      invalid_prior_dose_date: 'The prior dose date cannot be in the future.',
      invalid_comorbidities: 'Review your selected comorbidities before registering.',
    };
    return { kind: 'rejected', message: Object.hasOwn(validation, detail) ? validation[detail] : 'Review your registration details before trying again.' };
  }
  if (/^(22|23|28|42|P0)/.test(code)) {
    return { kind: 'rejected', message: 'Your registration was not accepted. Refresh the page and check your account before trying again.' };
  }
  // A lost or malformed reply may follow a committed registration.
  return { kind: 'unconfirmed', message: "We couldn't confirm your registration. Check My Registrations before trying again.", checkRegistrations: true };
}
