import { z } from 'zod';
import type { DataScope } from '../../data/scope';
import type { ProtectedDrafts } from '../../lib/protected-drafts';
import type { ConcernFields } from './concern-form';
import type { ConcernAttempt } from './concern-submit';

/**
 * The unsent concern of one account, kept in Keychain-backed protected storage (plan P12-T04).
 * It holds the typed answers, the pinned position and, once a filing was sent, the attempt id with
 * the paths of the photos already uploaded. Photo bytes are deliberately not stored: unsent photos
 * are chosen again, and uploaded ones are referenced by their immutable paths.
 */
const DRAFT_KIND = 'concern-report';
const DRAFT_VERSION = 1;

const fieldsSchema: z.ZodType<ConcernFields> = z.object({
  categoryId: z.string(), zoneId: z.string(), title: z.string(), description: z.string(), address: z.string(), specificArea: z.string(),
});
const positionSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) });
const attemptSchema: z.ZodType<ConcernAttempt> = z.object({ id: z.string().uuid(), paths: z.array(z.string()).max(5) });
const draftSchema = z.object({ fields: fieldsSchema, position: positionSchema.nullable(), attempt: attemptSchema.nullable() });
export type ConcernDraft = z.infer<typeof draftSchema>;

export async function loadConcernDraft(store: ProtectedDrafts, scope: DataScope): Promise<ConcernDraft | null> {
  return (await store.read(scope, DRAFT_KIND, DRAFT_VERSION, draftSchema))?.value ?? null;
}
export const saveConcernDraft = (store: ProtectedDrafts, scope: DataScope, draft: ConcernDraft) => store.save(scope, DRAFT_KIND, DRAFT_VERSION, draft);
export const clearConcernDraft = (store: ProtectedDrafts, scope: DataScope) => store.remove(scope, DRAFT_KIND);
