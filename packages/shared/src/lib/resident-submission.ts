import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import {
  serviceSubmissionSchema,
  supportingAttachmentSchema,
  type ServiceSubmissionInput,
} from '../schemas/service-foundations';
import { serviceFoundationOperations } from './service-foundations';
import { serviceRequestFieldErrors } from './service-request-validation';

export function residentServiceError(failure: unknown, phase: 'validate' | 'pick' | 'upload' | 'submit' = 'submit') {
  const error = failure as { message?: string; code?: string; statusCode?: string | number; issues?: unknown[] } | null;
  if (error?.issues?.length)
    return Object.values(serviceRequestFieldErrors(failure))[0] ?? 'Check the highlighted fields and required attachments, then submit again.';
  const message = error?.message ?? '';
  if (message === 'resident_account_required')
    return 'Your resident profile is unavailable. Reopen your profile, then retry your request.';
  if (message === 'authentication_required' || /sign in again/i.test(message) || ['401', 'PGRST301', 'PGRST303'].includes(String(error?.statusCode ?? error?.code)))
    return 'Your session has expired. Sign in again, then retry your request.';
  if (message.includes('current_approved_ID_required'))
    return 'Your current profile ID must be approved before requesting a document. Open Verify Now.';
  if (/confirmed_(pickup|payable)_amount_required|request_amount_unavailable/.test(message))
    return 'Could not load the request amount. Refresh payment details and try again.';
  if (message.includes('payment_method_locked') || message.includes('active_online_payment_exists'))
    return 'A payment is already in progress. Continue it or cancel it before changing methods.';
  if (message.includes('idempotency_conflict'))
    return 'This attempt already exists with different details. Check My Requests before starting another request.';
  if (message.includes('purpose_explanation'))
    return 'Choose a purpose and provide an explanation for Others.';
  if (message === 'invalid_purpose') return 'Choose one of the available purposes for this document.';
  if (message === 'appearance_acknowledgment_required') return 'Confirm that you understand personal appearance at the Barangay Hall is required.';
  if (message === 'supporting_requirement_missing') return 'Upload the required certifications shown on this form, then submit again.';
  if (message === 'service_contract_unavailable') return 'This document is no longer available for your barangay. Return to Services and select an available document.';
  if (/attachment_not_uploaded|invalid_uploaded_file|invalid_attachment/.test(message))
    return 'One of your attachments could not be verified. Select it again as a JPG, PNG, WEBP or PDF file up to 5 MB.';
  if (message === 'forbidden' || error?.code === '42501' || /row.level security|permission denied/i.test(message))
    return phase === 'upload'
      ? 'This account cannot upload request attachments. Use an active resident account, then select the file again.'
      : 'This account cannot submit document requests. Use an active resident account for this barangay.';
  if (/Network|fetch|connection|timeout|abort/i.test(message) || failure instanceof TypeError)
    return phase === 'submit'
      ? 'We could not confirm your request. Your details are kept here. Reconnect and retry unchanged, or check My Requests.'
      : 'Could not connect while uploading. Your file and details are kept here. Reconnect and try again.';
  // These messages originate in our local recovery and file-picker helpers.
  if (/^(Account changed\.|This attempt may already be submitted\.|Your submission may have succeeded\.|Your profile ID must be verified|Choose a JPG, PNG, WEBP or PDF file|Could not read the file\.|The file must be between)/.test(message)) return message;
  if (phase === 'pick') return 'Could not open the file. Select a JPG, PNG, WEBP or PDF file up to 5 MB.';
  if (phase === 'upload') return 'Could not upload this attachment. Your file is still selected. Check your connection and try again.';
  return 'Could not submit your request. Your details are kept here. Try again, or check My Requests before starting another request.';
}

/** Unique operation identifier, never an authentication credential. */
export function createRequestKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

export function supportingAttachmentMetadata(
  residentId: string,
  input: { uploadId: string; requirementCode: 'dti' | 'hoa' | 'lessor' | 'other'; mimeType: string; sizeBytes: number },
) {
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as Record<string, string>)[input.mimeType];
  return supportingAttachmentSchema.parse({ requirementCode: input.requirementCode,
    path: `${residentId}/${input.uploadId}/${input.requirementCode}.${extension}`, mimeType: input.mimeType, sizeBytes: input.sizeBytes });
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
  const attachment = supportingAttachmentMetadata(user.id, { ...input, sizeBytes: input.bytes.length });
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
  private payload: ServiceSubmissionInput | null = null;
  private requestId: string | null = null;
  private owner: string | null = null;
  /** A client that persisted an unconfirmed attempt passes its key back to retry the same operation. */
  constructor(readonly key: string = createRequestKey()) {}
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
