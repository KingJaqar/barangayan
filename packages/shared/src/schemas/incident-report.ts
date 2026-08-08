import { z } from 'zod';

/**
 * Submission shape for the Community Incident Reporting Module (Module 3).
 * `categoryId` always points at a barangay-scoped `incident_categories` row.
 */
export const incidentReportSchema = z.object({
  /** Short human-readable title (required by the DB, absent from the original schema). */
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title must be 100 characters or fewer'),
  categoryId: z.string().uuid('Please select a valid category'),
  description: z.string().max(1000, 'Description must be 1000 characters or fewer').optional(),
  /** Storage-uploaded photo public URLs. 0–5 photos; photos are optional for MVP. */
  photoUrls: z.array(z.string().url()).min(0).max(5),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export type IncidentReportInput = z.infer<typeof incidentReportSchema>;

/** One resident's crowdsourced confirmation of an existing report (Crowdsourced Corroboration / Voting-Based Trust Scoring). */
export const incidentConfirmationSchema = z.object({
  incidentId: z.string().uuid(),
});

export type IncidentConfirmationInput = z.infer<typeof incidentConfirmationSchema>;
