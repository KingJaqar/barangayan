import { z } from 'zod';

export const announcementSchema = z.object({
  title:                z.string().min(1, 'Title is required').max(200),
  body:                 z.string().min(1, 'Body is required').max(2000),
  // Expanded write-up shown in the resident app's Announcement Modal. Optional — falls
  // back to `body` in the UI when omitted.
  detailed_description: z.string().max(5000, 'Detailed description is too long').optional().or(z.literal('')),
  category:             z.enum(['general', 'emergency', 'health', 'events']),
  image_url:            z.string().url('Must be a valid URL').optional().or(z.literal('')),
  published_at:         z.string().datetime().optional(), // ISO string; defaults to now() on insert
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;
