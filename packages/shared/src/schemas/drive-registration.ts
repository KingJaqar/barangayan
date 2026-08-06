import { z } from 'zod';

/**
 * Submission shape for registering in a Medical/Vaccination Drive (Module 10).
 * Fields feed the Priority Queue with Weighted Eligibility Scoring (AGENTS.md §3) — the
 * server computes the actual score from these plus the drive's configured
 * PriorityWeightRule[]; the client never submits a pre-computed score.
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
