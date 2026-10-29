import { z } from 'zod';

export const announcementSchema = z.object({
  title:                z.string().min(1, 'Title is required').max(200),
  body:                 z.string().min(1, 'Body is required').max(2000),
  // Expanded write-up shown in the resident app's Announcement Modal. Optional — falls
  // back to `body` in the UI when omitted.
  detailed_description: z.string().max(5000, 'Detailed description is too long').optional().or(z.literal('')),
  category:             z.enum(['general', 'emergency', 'health', 'events']),
  image_url:            z.string().url('Must be a valid URL').optional().or(z.literal('')),
  published_at:         z.string().datetime({ offset: true }).optional(), // ISO string; PostgREST returns an explicit UTC offset
  alert_expires_at:     z.string().datetime({ offset: true, message: 'Enter a valid advisory expiry date and time.' }).nullable().optional(),
}).superRefine((value, context) => {
  if (value.alert_expires_at == null) return;
  if (value.category !== 'emergency') {
    context.addIssue({ code: 'custom', path: ['alert_expires_at'], message: 'Clear advisory expiry before choosing a non-emergency category.' });
  }
  if (!value.published_at || Date.parse(value.alert_expires_at) <= Date.parse(value.published_at)) {
    context.addIssue({ code: 'custom', path: ['alert_expires_at'], message: 'Advisory expiry must be after publication.' });
  }
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;
