import {
  EMAIL_REGEX, EMPLOYMENT_STATUSES, EMPLOYMENT_STATUSES_WITH_OCCUPATION, MOBILE_NUMBER_REGEX, NAME_REGEX, SEXES,
  residentDetailsStepSchema, type EmploymentStatus, type Sex, type Tables,
} from '@barangayan/shared';
import { parseBirthday } from './birthday';

type ProfileRow = Tables<'profiles'>;
/** The profile fields a resident edits on this screen, as text so a half-typed value is representable. */
export type ProfileDraft = {
  firstName: string; middleName: string; lastName: string; suffix: string;
  sex: Sex | ''; birthDate: string; mobileNumber: string; email: string;
  houseNo: string; street: string; city: string;
  employmentStatus: EmploymentStatus | ''; occupation: string;
};
export type DraftField = keyof ProfileDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;
/** The columns written by one profile save. `full_name` and `home_address` are derived by the database. */
export type ProfilePatch = {
  first_name: string; middle_name: string | null; last_name: string; suffix: string | null;
  sex: Sex; birth_date: string; mobile_number: string; email: string;
  house_no: string; street: string; employment_status: EmploymentStatus; occupation: string | null;
  city?: string | null;
};

const sexOf = (value: string | null): Sex | '' => SEXES.find((option) => option === value) ?? '';
const statusOf = (value: string | null): EmploymentStatus | '' => EMPLOYMENT_STATUSES.find((option) => option === value) ?? '';

export function draftFrom(profile: ProfileRow): ProfileDraft {
  return {
    firstName: profile.first_name ?? '', middleName: profile.middle_name ?? '', lastName: profile.last_name ?? '', suffix: profile.suffix ?? '',
    sex: sexOf(profile.sex), birthDate: profile.birth_date ?? '', mobileNumber: profile.mobile_number ?? '', email: profile.email ?? '',
    houseNo: profile.house_no ?? '', street: profile.street ?? '', city: profile.city ?? '',
    employmentStatus: statusOf(profile.employment_status), occupation: profile.occupation ?? '',
  };
}

export function sameDraft(left: ProfileDraft, right: ProfileDraft): boolean {
  return (Object.keys(left) as DraftField[]).every((field) => left[field] === right[field]);
}

export const usesOccupation = (status: EmploymentStatus | ''): boolean => status !== '' && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(status);

/** Changing the status clears an occupation the new status does not use (A37-027). */
export function withEmploymentStatus(draft: ProfileDraft, status: EmploymentStatus): ProfileDraft {
  return { ...draft, employmentStatus: status, occupation: usesOccupation(status) ? draft.occupation : '' };
}

const nameIssue = (value: string) => NAME_REGEX.test(value) ? undefined : 'Letters only — no numbers or symbols';
/** Live feedback for one field once it has a value; an empty field is judged on submit. */
export function fieldIssue(field: DraftField, value: string, today = new Date()): string | undefined {
  if (!value.trim()) return undefined;
  switch (field) {
    case 'firstName': case 'lastName': case 'middleName': case 'suffix': return nameIssue(value);
    case 'mobileNumber': return MOBILE_NUMBER_REGEX.test(value) ? undefined : 'Enter an 11-digit mobile number (for example 09171234567)';
    case 'email': return EMAIL_REGEX.test(value.trim()) ? undefined : 'Enter a valid email address';
    case 'birthDate': return parseBirthday(value, today) ? undefined : 'Enter a real date of birth that is not in the future';
    default: return undefined;
  }
}

const REQUIRED: Partial<Record<DraftField, string>> = {
  firstName: 'First name is required', lastName: 'Last name is required', sex: 'Select your sex', birthDate: 'Date of birth is required',
  mobileNumber: 'Mobile number is required', email: 'Email is required', houseNo: 'House or unit number is required', street: 'Street is required',
  city: 'City or municipality is required', employmentStatus: 'Select your employment status',
};

/**
 * Validates every field for a save. `cityLocked` is true when the barangay has a configured
 * locality: the city is then server-owned and is neither required nor written.
 */
export function validateDraft(draft: ProfileDraft, options: { cityLocked: boolean; today?: Date }):
  { ok: true; patch: ProfilePatch } | { ok: false; errors: DraftErrors } {
  const today = options.today ?? new Date();
  const errors: DraftErrors = {};
  for (const field of Object.keys(REQUIRED) as DraftField[]) {
    if (field === 'city' && options.cityLocked) continue;
    if (!draft[field].trim()) errors[field] = REQUIRED[field];
  }
  for (const field of ['firstName', 'lastName', 'middleName', 'suffix', 'mobileNumber', 'email', 'birthDate'] as const) {
    if (!errors[field]) { const issue = fieldIssue(field, draft[field], today); if (issue) errors[field] = issue; }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const parsed = residentDetailsStepSchema.safeParse({
    firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), middleName: draft.middleName.trim() || undefined, suffix: draft.suffix.trim() || undefined,
    sex: draft.sex || undefined, mobileNumber: draft.mobileNumber.trim(), houseNo: draft.houseNo.trim(), street: draft.street.trim(),
    employmentStatus: draft.employmentStatus || undefined, occupation: usesOccupation(draft.employmentStatus) ? draft.occupation.trim() || undefined : undefined,
    birthDate: draft.birthDate,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && key in draft && !errors[key as DraftField]) errors[key as DraftField] = issue.message;
    }
    return { ok: false, errors: Object.keys(errors).length ? errors : { firstName: 'Check the highlighted fields.' } };
  }
  const details = parsed.data;
  return {
    ok: true,
    patch: {
      first_name: details.firstName, middle_name: details.middleName ?? null, last_name: details.lastName, suffix: details.suffix ?? null,
      sex: details.sex, birth_date: details.birthDate, mobile_number: details.mobileNumber, email: draft.email.trim(),
      house_no: details.houseNo, street: details.street, employment_status: details.employmentStatus, occupation: details.occupation ?? null,
      ...(options.cityLocked ? {} : { city: draft.city.trim() || null }),
    },
  };
}

/**
 * After a stale-row refusal (the conditional update matched no row, so nothing was written),
 * decides whether the newer row only differs in fields this form does not edit. If so the
 * save can be retried against it; if a field this form edits changed elsewhere, the
 * resident must review the latest values.
 */
export function reconcileConflict(base: ProfileRow, latest: ProfileRow): 'retry' | 'review' {
  return sameDraft(draftFrom(base), draftFrom(latest)) ? 'retry' : 'review';
}

export function initials(profile: Pick<ProfileRow, 'first_name' | 'last_name' | 'full_name'>, fallback = '?'): string {
  const first = profile.first_name?.trim()[0] ?? profile.full_name.trim()[0];
  const last = profile.last_name?.trim()[0];
  return ((first ?? '') + (last ?? '')).toUpperCase() || fallback;
}
