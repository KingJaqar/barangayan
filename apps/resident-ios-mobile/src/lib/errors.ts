import { ZodError } from 'zod';
import { classifyFailure, DataError, type FailureKind } from '../data/outcome';

export class PublicError extends Error {}

/** Code-specific copy from the existing contracts; codes win over the generic kind copy. */
const CODE_MESSAGES: Record<string, string> = {
  '23505': 'This may already have been submitted. Refresh your records before trying again.',
  P0002: 'This activity is no longer available.',
  P0003: 'There are no remaining slots for this activity.',
  P0004: 'You are already registered for this activity.',
  P0010: 'This action is not available for your account or barangay.',
  P0011: 'This action is not available for your account or barangay.',
  P0012: 'This action is not available for your account or barangay.',
  invalid_credentials: 'The email or password is incorrect.',
};

const KIND_MESSAGES: Record<FailureKind, string> = {
  cancelled: 'This action was cancelled.',
  offline: 'You appear to be offline. Check your connection and try again.',
  timeout: 'The server took too long to respond. Check your connection and try again.',
  session: 'Your session has expired. Sign in again.',
  authorization: 'You do not have access to this action. Refresh or contact your barangay.',
  'not-found': 'This record is no longer available.',
  conflict: 'This may already have been submitted. Refresh your records before trying again.',
  'rate-limited': 'Please wait a moment before trying again.',
  validation: 'Some details were not accepted. Check your entries and try again.',
  schema: 'The app received an unexpected response. Update the app or try again later.',
  http: 'The server could not complete this action. Try again later.',
  'unknown-commit': 'We could not confirm whether this was saved. Refresh your records before trying again.',
  // Raw provider errors can contain private data, URLs or internal SQL details.
  unknown: 'Unable to complete this action. Check your connection and retry. If you submitted a form, refresh your records first.',
};

export function residentError(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((issue) => issue.message).join('\n');
  if (error instanceof PublicError) return error.message;
  const code = error instanceof DataError ? error.code ?? '' : error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (code.includes('rate_limit')) return KIND_MESSAGES['rate-limited'];
  return KIND_MESSAGES[classifyFailure(error)];
}
