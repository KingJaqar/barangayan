import { z } from 'zod';

/**
 * Admin-side create/edit form for a document_types row (apps/admin-web's Documents page).
 * feeCentavos stays an integer here — the form UI converts a peso input to centavos
 * before validating, same direction as formatCentavosAsPHP's inverse.
 */
export const documentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  feeCentavos: z.number().int().min(0, 'Fee cannot be negative'),
  processingTargetHours: z.number().int().min(1, 'Must be at least 1 hour'),
  requirements: z.array(z.string().min(1)).default([]),
  isActive: z.boolean().default(true),
});
export type DocumentTypeInput = z.infer<typeof documentTypeSchema>;
