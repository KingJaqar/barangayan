import { z } from 'zod';

export const emergencyInformationSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  body:        z.string().min(1, 'Body is required').max(1000),
  category:    z.enum(['guidelines', 'hotlines']),
  icon:        z.string().optional(),
  icon_color:  z.string().optional(),
  icon_bg:     z.string().optional(),
  content:     z.array(z.union([z.string(), z.object({ label: z.string(), number: z.string() })])).optional(),
  sort_order:  z.number().int().optional(),
  is_active:   z.boolean().optional(),
  published_at: z.string().datetime().optional(),
});

export type EmergencyInformationFormValues = z.infer<typeof emergencyInformationSchema>;
