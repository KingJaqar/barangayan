import { PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import { z } from 'zod';

export const SETTINGS_RECOVERY_PASSWORD_HINT = 'Use at least 8 characters, including one capital letter, one number, and one special character.';

// Keep Settings recovery aligned with normal Change Password, without changing
// the existing login/mobile recovery schemas.
export const settingsRecoveryPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    PASSWORD_COMPLEXITY_REGEX,
    'Password must include a capital letter, a number, and a special character',
  ),
  confirmPassword: z.string(),
}).refine(input => input.password === input.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});
