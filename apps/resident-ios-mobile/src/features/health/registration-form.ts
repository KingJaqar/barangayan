import { driveRegistrationSchema } from '@barangayan/shared';
import { parseCalendarDate } from '../profile/birthday';

/** The comorbidity options of the registration form, in display order. "None" is separate: it excludes every condition. */
export const CONDITIONS = ['Hypertension', 'Diabetes', 'Immunocompromised', 'Pregnant', 'Allergy'] as const;
export type Condition = (typeof CONDITIONS)[number];
export type ConditionState = { conditions: readonly Condition[]; none: boolean };
export const NO_CONDITIONS: ConditionState = { conditions: [], none: false };

/** Choosing "None" clears the conditions; choosing any condition clears "None". Choosing a selected option clears it. */
export function toggleCondition(state: ConditionState, option: Condition | 'None'): ConditionState {
  if (option === 'None') return state.none ? NO_CONDITIONS : { conditions: [], none: true };
  const selected = state.conditions.includes(option);
  return { none: false, conditions: selected ? state.conditions.filter((item) => item !== option) : CONDITIONS.filter((item) => item === option || state.conditions.includes(item)) };
}

export const DOSES = [
  { value: 'first', label: '1st dose' },
  { value: 'second', label: '2nd dose' },
  { value: 'booster', label: 'Booster' },
] as const;
export type Dose = (typeof DOSES)[number]['value'];

export const MAX_AGE = 130;

/**
 * Whole years on `today`, comparing date-only parts. A missing, malformed, future or implausible (over 130) birth date
 * gives null, so the resident is asked for an age instead of a wrong one being submitted.
 */
export function ageFromBirthDate(birthDate: string | null | undefined, today: string): number | null {
  const born = parseCalendarDate(birthDate);
  const now = parseCalendarDate(today);
  if (!born || !now) return null;
  const years = now.year - born.year - (now.month < born.month || (now.month === born.month && now.day < born.day) ? 1 : 0);
  return years >= 0 && years <= MAX_AGE ? years : null;
}

export type RegistrationDraft = {
  /** Age taken from the profile's date of birth, or null when the resident must type it. */
  profileAge: number | null;
  ageText: string;
  isPwd: boolean;
  conditions: ConditionState;
  dose: Dose;
  /** `YYYY-MM-DD` of the actual previous dose; only used for the 2nd dose and booster. */
  priorDoseDate: string | null;
  consent: boolean;
  /** The barangay's calendar date. */
  today: string;
};
export type RegistrationErrors = { age?: string; priorDose?: string; consent?: string };
export type RegistrationPayload = { driveId: string; age: number; isPwd: boolean; comorbidities: string[]; priorDoseDate?: string };

/**
 * Checks the answers with the same limits the server enforces (age 0–130, a previous dose that has happened, required
 * consent) and builds the submission. A first dose sends no previous-dose date; a 2nd dose or booster needs the real date,
 * and no date is ever invented for it.
 */
export function validateRegistration(driveId: string, draft: RegistrationDraft): { errors: RegistrationErrors } | { payload: RegistrationPayload } {
  const errors: RegistrationErrors = {};
  let age = draft.profileAge;
  if (age === null) {
    const text = draft.ageText.trim();
    age = /^\d{1,3}$/.test(text) ? Number(text) : null;
    if (age === null || age > MAX_AGE) {
      errors.age = text ? `Enter a whole number of years from 0 to ${MAX_AGE}.` : 'Enter your age in years.';
      age = null;
    }
  }
  let priorDoseDate: string | undefined;
  if (draft.dose !== 'first') {
    const parts = parseCalendarDate(draft.priorDoseDate);
    if (!draft.priorDoseDate || !parts) errors.priorDose = 'Choose the date of your previous dose.';
    else if (draft.priorDoseDate > draft.today) errors.priorDose = 'The previous dose date cannot be in the future.';
    else priorDoseDate = draft.priorDoseDate;
  }
  if (!draft.consent) errors.consent = 'Accept the health-data consent to register.';
  if (errors.age || errors.priorDose || errors.consent || age === null) return { errors };
  const payload = { driveId, age, isPwd: draft.isPwd, comorbidities: [...draft.conditions.conditions], ...(priorDoseDate ? { priorDoseDate } : {}) };
  const checked = driveRegistrationSchema.safeParse(payload);
  return checked.success ? { payload: checked.data } : { errors: { age: `Enter a whole number of years from 0 to ${MAX_AGE}.` } };
}
