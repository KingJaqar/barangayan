import { ZodError } from 'zod';

export class PublicError extends Error {}

export function residentError(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((issue) => issue.message).join('\n');
  if (error instanceof PublicError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (['PGRST301', 'bad_jwt', 'refresh_token_not_found', 'session_not_found'].includes(code)) return 'Your session has expired. Sign in again.';
  if (code === '23505') return 'This may already have been submitted. Refresh your records before trying again.';
  if (code === '42501') return 'You do not have access to this action. Refresh or contact your barangay.';
  if (code === 'P0002') return 'This activity is no longer available.';
  if (code === 'P0003') return 'There are no remaining slots for this activity.';
  if (code === 'P0004') return 'You are already registered for this activity.';
  if (['P0010', 'P0011', 'P0012'].includes(code)) return 'This action is not available for your account or barangay.';
  if (code === 'invalid_credentials') return 'The email or password is incorrect.';
  if (code.includes('rate_limit')) return 'Please wait a moment before trying again.';
  // Raw provider errors can contain private data, URLs or internal SQL details.
  return 'Unable to complete this action. Check your connection and retry. If you submitted a form, refresh your records first.';
}
