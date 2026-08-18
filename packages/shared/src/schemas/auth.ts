import { z } from 'zod';

/** 5 options surfaced by the Register/Profile "Employment Status" field. */
export const EMPLOYMENT_STATUSES = ['employed', 'unemployed', 'student', 'self_employed', 'retired'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Occupation is only meaningful (and only collected by the UI) for these two statuses. */
export const EMPLOYMENT_STATUSES_WITH_OCCUPATION: readonly EmploymentStatus[] = ['employed', 'self_employed'];

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

/** Registration form — used by both apps/resident-android-mobile and (eventually) apps/admin-web's resident portal. */
export const registerSchema = z
  .object({
    // Full Name split into structured parts (Register/Profile field-split) — first/last
    // required, middle/suffix optional. full_name is composed from these by a DB trigger
    // (migration 0081); the app never needs to build the composed string itself.
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    middleName: z.string().optional(),
    suffix: z.string().optional(),
    sex: z.enum(SEXES, { errorMap: () => ({ message: 'Select your sex' }) }),
    mobileNumber: z.string().optional(),
    email: z.string().email('Enter a valid email address'),
    // Home Address split into structured parts — "Barangay" is deliberately not one of
    // these fields: it's already profiles.barangay_id (assigned automatically at
    // registration, AGENTS.md §0), so the UI displays barangays.name read-only instead
    // of collecting a second, potentially-inconsistent value.
    houseNo: z.string().min(1, 'House No. is required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES, { errorMap: () => ({ message: 'Select employment status' }) }),
    // Always optional, per spec — the UI only *shows* this field for Employed/
    // Self-Employed (see EMPLOYMENT_STATUSES_WITH_OCCUPATION), but never requires it.
    occupation: z.string().optional(),
    // YYYY-MM-DD, picked via the calendar UI — never free-typed, so the format is
    // guaranteed. Optional: birthday can still be filled in later from the Profile screen.
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid birth date')
      .refine((d) => d <= new Date().toISOString().slice(0, 10), 'Birth date cannot be in the future')
      .optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
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
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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
