import { z } from 'zod';

/** 5 options surfaced by the Register/Profile "Employment Status" field. */
export const EMPLOYMENT_STATUSES = ['employed', 'unemployed', 'student', 'self_employed', 'retired'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Occupation is only meaningful (and only collected by the UI) for these two statuses. */
export const EMPLOYMENT_STATUSES_WITH_OCCUPATION: readonly EmploymentStatus[] = ['employed', 'self_employed'];

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

// ─── Field-format regexes ────────────────────────────────────────────────────
// Exported so the Register screen (and any other consumer) can run the exact
// same rule live, as-you-type, instead of duplicating a second copy of each
// pattern that could drift out of sync with what safeParse below enforces.

/** Letters and spaces only — no digits, no punctuation. Used by name parts. */
export const NAME_REGEX = /^[A-Za-z\s]+$/;

/** PH local mobile format: 11 digits starting with 09 (the "+63 9XX XXX XXXX"
 * numbers written without the country code) — e.g. 09171234567. */
export const MOBILE_NUMBER_REGEX = /^09\d{9}$/;

/** Same shape used by Profile screen's inline save-time check (profile.tsx). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** At least one uppercase letter, one digit, and one special (non-alphanumeric) character. */
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

/** Registration form — used by both apps/resident-android-mobile and (eventually) apps/admin-web's resident portal. */
export const registerSchema = z
  .object({
    // Full Name split into structured parts (Register/Profile field-split) — first/last
    // required, middle/suffix optional. full_name is composed from these by a DB trigger
    // (migration 0081); the app never needs to build the composed string itself.
    firstName: z
      .string()
      .min(1, 'First name is required')
      .regex(NAME_REGEX, 'First name must contain letters only'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .regex(NAME_REGEX, 'Last name must contain letters only'),
    middleName: z.string().regex(NAME_REGEX, 'Middle name must contain letters only').optional(),
    suffix: z.string().regex(NAME_REGEX, 'Suffix must contain letters only').optional(),
    sex: z.enum(SEXES, { errorMap: () => ({ message: 'Select your sex' }) }),
    mobileNumber: z
      .string()
      .min(1, 'Mobile number is required')
      .regex(MOBILE_NUMBER_REGEX, 'Enter an 11-digit mobile number (e.g. 09171234567)'),
    email: z
      .string()
      .min(1, 'Email is required')
      .regex(EMAIL_REGEX, 'Enter a valid email address'),
    // Home Address fields collected during registration. "Barangay" is deliberately
    // not one of these fields: it's already profiles.barangay_id (assigned
    // automatically at registration), so the UI displays barangays.name read-only.
    houseNo: z.string().min(1, 'House No. is required'),
    street: z.string().min(1, 'Street is required'),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES, { errorMap: () => ({ message: 'Select employment status' }) }),
    // Always optional, per spec — the UI only *shows* this field for Employed/
    // Self-Employed (see EMPLOYMENT_STATUSES_WITH_OCCUPATION), but never requires it.
    occupation: z.string().optional(),
    // YYYY-MM-DD, picked via the calendar UI — never free-typed, so the format is
    // guaranteed. Required — Date of Birth is one of the mandatory registration fields.
    birthDate: z
      .string({ required_error: 'Date of birth is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date of birth')
      .refine((d) => d <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        PASSWORD_COMPLEXITY_REGEX,
        'Password must include an uppercase letter, a number, and a special character',
      ),
    confirmPassword: z.string(),
    barangayId: z.string().uuid(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** In-app Settings > Change Password — requires the current password (unlike
 * newPasswordSchema, which is only used after an OTP-verified recovery session). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        PASSWORD_COMPLEXITY_REGEX,
        'Password must include an uppercase letter, a number, and a special character',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
