import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import {
  serviceSubmissionSchema,
  supportingAttachmentSchema,
  type ServiceSubmissionInput,
} from '../schemas/service-foundations';
import { serviceFoundationOperations } from './service-foundations';

export function residentServiceError(failure: unknown) {
  const error = failure as { message?: string; issues?: { message: string }[] };
  if (error?.issues?.length) return error.issues[0].message;
  const message = error?.message ?? 'Operation failed. Reconnect and retry unchanged, or check My Requests.';
  if (message.includes('current_approved_ID_required'))
    return 'Your current profile ID must be approved before requesting a document. Open Verify Now.';
  if (/confirmed_(pickup|payable)_amount_required/.test(message))
    return 'Awaiting fee assessment. Staff must confirm the amount before payment.';
  if (message.includes('payment_method_locked') || message.includes('active_online_payment_exists'))
    return 'A payment is already in progress. Continue it or cancel it before changing methods.';
  if (message.includes('idempotency_conflict'))
    return 'This attempt already exists with different details. Check My Requests before starting another request.';
  if (message.includes('purpose_explanation'))
    return 'Choose a purpose and provide an explanation for Others.';
  return message;
}

/** Unique operation identifier, never an authentication credential. */
export function createRequestKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

export async function uploadSupportingEvidence(
  client: SupabaseClient<Database>,
  input: {
    uploadId: string;
    requirementCode: 'dti' | 'hoa' | 'lessor' | 'other';
    mimeType: string;
    bytes: Uint8Array;
  },
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error('Sign in again before uploading.');
  const extension = (
    { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as Record<
      string,
      string
    >
  )[input.mimeType];
  const attachment = supportingAttachmentSchema.parse({
    requirementCode: input.requirementCode,
    path: `${user.id}/${input.uploadId}/${input.requirementCode}.${extension}`,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
  });
  const bucket = client.storage.from('request-attachments');
  const { error: uploadError } = await bucket.upload(attachment.path, input.bytes, {
    contentType: attachment.mimeType,
    upsert: false,
  });
  if (uploadError) {
    const { data: saved } = await bucket.download(attachment.path);
    const bytes = saved ? new Uint8Array(await saved.arrayBuffer()) : null;
    if (
      !bytes ||
      bytes.length !== input.bytes.length ||
      bytes.some((value, index) => value !== input.bytes[index])
    )
      throw uploadError;
  }
  return attachment;
}

/** Holds the exact submitted input across lost replies. Changed retries never create
 * another request. A definite validation/authorization failure permits correction. */
export class ResidentSubmissionAttempt {
  readonly key = createRequestKey();
  private payload: ServiceSubmissionInput | null = null;
  private requestId: string | null = null;
  private owner: string | null = null;
  async submit(client: SupabaseClient<Database>, value: Omit<ServiceSubmissionInput, 'idempotencyKey'>) {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) throw new Error('Sign in again before submitting.');
    if (this.owner && this.owner !== user.id) throw new Error('Account changed. Reopen the request form.');
    this.owner = user.id;
    const next = serviceSubmissionSchema.parse({ ...value, idempotencyKey: this.key });
    if (this.payload && JSON.stringify(next) !== JSON.stringify(this.payload))
      throw new Error(
        'This attempt may already be submitted. Retry unchanged or check My Requests before starting another request.',
      );
    this.payload = next;
    if (!this.requestId) {
      const { data, error } = await serviceFoundationOperations(client).submit(next);
      if (error) {
        if (['22023', '42501'].includes(error.code)) this.payload = null;
        throw error;
      }
      this.requestId = data;
    }
    const { data, error } = await client
      .from('service_requests')
      .select('id, reference_number')
      .eq('id', this.requestId)
      .single();
    if (error || !data)
      throw new Error(
        'Your submission may have succeeded. Retry unchanged to recover its reference, or open My Requests.',
      );
    return data;
  }
}
