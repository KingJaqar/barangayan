import { z } from 'zod';

export const staffSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(200),
  role: z.enum(['admin', 'staff']),
  mobile_number: z.string().max(50).optional().or(z.literal('')),
  home_address: z.string().max(500).optional().or(z.literal('')),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

export const staffInviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  full_name: z.string().min(1, 'Full name is required').max(200),
  role: z.enum(['admin', 'staff']),
  mobile_number: z.string().max(50).optional().or(z.literal('')),
  home_address: z.string().max(500).optional().or(z.literal('')),
});

export type StaffInviteValues = z.infer<typeof staffInviteSchema>;
