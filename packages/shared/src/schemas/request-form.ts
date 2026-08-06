import { z } from 'zod';

/**
 * Submission shape for the Document/Service Request Form (Module 1) and, when
 * `appointmentSlot` is set, the shared appointment-scheduling flow (pickup or health
 * center) it's paired with. `documentTypeId` always points at a barangay-scoped
 * `document_types` row — never a hardcoded document name.
 */
export const requestFormSchema = z.object({
  documentTypeId: z.string().uuid(),
  requesterNotes: z.string().max(1000).optional(),
  appointmentSlot: z
    .object({
      date: z.string().date(),
      timeSlot: z.string(), // e.g. "09:00-09:30", validated server-side against daily slot limits
    })
    .optional(),
});

export type RequestFormInput = z.infer<typeof requestFormSchema>;
