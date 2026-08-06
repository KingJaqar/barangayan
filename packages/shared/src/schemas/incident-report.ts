import { z } from 'zod';

/**
 * Submission shape for the Community Incident Reporting Module (Module 3).
 * `categoryId` always points at a barangay-scoped `incident_categories` row.
 */
export const incidentReportSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().min(1).max(1000),
  photoUrls: z.array(z.string().url()).min(1).max(5),
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
