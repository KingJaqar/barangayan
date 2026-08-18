import { z } from 'zod';

export const aboutUsSchema = z.object({
  mission: z.string().max(2000).optional().default(''),
  vision: z.string().max(2000).optional().default(''),
  history: z.string().max(5000).optional().default(''),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().max(20).optional().default(''),
  address: z.string().max(500).optional().default(''),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export type AboutUsFormValues = z.infer<typeof aboutUsSchema>;

export const developerProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  role: z.string().min(1, 'Role is required').max(100),
  bio: z.string().max(500).optional().default(''),
  photo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  sort_order: z.number().int().optional().default(0),
});

export type DeveloperProfile = z.infer<typeof developerProfileSchema>;
