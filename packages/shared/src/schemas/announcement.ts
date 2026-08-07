import { z } from 'zod';

export const announcementSchema = z.object({
  title:        z.string().min(1, 'Title is required').max(200),
  body:         z.string().min(1, 'Body is required').max(2000),
  category:     z.enum(['general', 'emergency', 'health', 'events']),
  image_url:    z.string().url('Must be a valid URL').optional().or(z.literal('')),
  published_at: z.string().datetime().optional(), // ISO string; defaults to now() on insert
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;
