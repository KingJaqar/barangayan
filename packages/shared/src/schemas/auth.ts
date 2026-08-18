import { z } from 'zod';

/** Registration form — used by both apps/resident-android-mobile and (eventually) apps/admin-web's resident portal. */
export const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    mobileNumber: z.string().optional(),
    email: z.string().email('Enter a valid email address'),
    homeAddress: z.string().optional(),
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
