import { z } from 'zod';

// Explicit projection strips legacy or unexpected private fields before resident
// confirmation state is populated during a coordinated client/schema release.
export const residentDriveRegistrationResultSchema = z.object({
  registration_id: z.string().uuid(),
  applicant_number: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'attended', 'cancelled']),
});
export type ResidentDriveRegistrationResult = z.infer<typeof residentDriveRegistrationResultSchema>;

export const RESIDENT_DRIVE_REGISTRATION_COLUMNS = 'id,drive_id,user_id,applicant_number,age,is_pwd,comorbidities,prior_dose_date,status,created_at,updated_at' as const;

/**
 * Submission shape for registering in a Medical/Vaccination Drive (Module 10).
 * The database snapshots the existing weighted eligibility score from these
 * inputs in administrator-protected storage; clients never submit a score.
 */
export const driveRegistrationSchema = z.object({
  driveId: z.string().uuid(),
  age: z.number().int().min(0).max(130),
  isPwd: z.boolean(),
  comorbidities: z.array(z.string()).default([]),
  /** For multi-dose vaccines — omitted/undefined for a first dose. */
  priorDoseDate: z.string().date().optional(),
});

export type DriveRegistrationInput = z.infer<typeof driveRegistrationSchema>;
