import { z } from 'zod';

/** Registration form — used by both apps/mobile and (eventually) apps/web's resident portal. */
export const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    mobileNumber: z.string().optional(),
    email: z.string().email('Enter a valid email address'),
    homeAddress: z.string().optional(),
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
