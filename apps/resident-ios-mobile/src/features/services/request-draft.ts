import { serviceSubmissionSchema } from '@barangayan/shared';
import { z } from 'zod';
import type { DataScope } from '../../data/scope';
import type { ProtectedDrafts } from '../../lib/protected-drafts';
import { emptyFields, type FormFields } from './request-form';

/**
 * The unsent form of one service, kept in Keychain-backed protected storage (plan P08-T05).
 * It holds the typed answers and, once a request was sent, the exact payload with its
 * idempotency key, so a restart after a lost reply retries the same operation instead of
 * creating a second request. Selected file bytes are deliberately not stored: files are
 * chosen again, and files already uploaded are referenced by their immutable paths in the payload.
 */
const DRAFT_VERSION = 1;
const kindOf = (documentTypeId: string) => `service-request-${documentTypeId}`;

const fieldsSchema: z.ZodType<FormFields> = z.object({
  purposeCode: z.string(), explanation: z.string(), notes: z.string(), businessName: z.string(), address: z.string(), isRenter: z.boolean(),
  recordReference: z.string(), copies: z.string(), totalPages: z.string(), appearance: z.boolean(),
});
const draftSchema = z.object({ fields: fieldsSchema, attempt: serviceSubmissionSchema.nullable() });
export type RequestDraft = z.infer<typeof draftSchema>;

export const blankDraft = (): RequestDraft => ({ fields: emptyFields(), attempt: null });

export async function loadRequestDraft(store: ProtectedDrafts, scope: DataScope, documentTypeId: string): Promise<RequestDraft> {
  const found = await store.read(scope, kindOf(documentTypeId), DRAFT_VERSION, draftSchema);
  return found?.value ?? blankDraft();
}

export function saveRequestDraft(store: ProtectedDrafts, scope: DataScope, documentTypeId: string, draft: RequestDraft): Promise<void> {
  return store.save(scope, kindOf(documentTypeId), DRAFT_VERSION, draft);
}

export function clearRequestDraft(store: ProtectedDrafts, scope: DataScope, documentTypeId: string): Promise<void> {
  return store.remove(scope, kindOf(documentTypeId));
}
