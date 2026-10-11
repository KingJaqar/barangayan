import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type ResidentEmailVerificationState = 'pending' | 'verified';
async function verificationCaller(client: SupabaseClient<Database>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Transport already has a timeout. Also bound SDK/storage/lock waits around
    // this session read. Its late result cannot continue the caller's workflow.
    return await Promise.race([client.auth.getUser(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Unable to confirm your session. Check your connection and retry.')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}
/** Server verifies the caller/address/code; the existing app session is retained. */
export async function residentEmailVerification(
  client: SupabaseClient<Database>, ownerId: string, action: 'send' | 'verify', code?: string,
): Promise<ResidentEmailVerificationState> {
  if (action === 'verify' && !/^\d{6}$/.test(code ?? '')) throw new Error('Enter the six-digit email code.');
  const before = await verificationCaller(client);
  if (before.error || before.data.user?.id !== ownerId) throw new Error('Your session changed. Sign in again to verify your email.');
  const { data, error } = await client.functions.invoke('verify-resident-email', {
    body: action === 'send' ? { action } : { action, code }, timeout: 30000,
  });
  const after = await verificationCaller(client);
  if (after.error || after.data.user?.id !== ownerId) throw new Error('Your session changed. Sign in again to verify your email.');
  if (error) {
    const status = error instanceof FunctionsHttpError ? error.context.status as number : 503;
    const messages: Record<number, string> = {
      400: 'This code is invalid or expired. Request a new code.',
      401: 'Sign in again to verify your email.',
      403: 'This account cannot verify a resident email.',
      409: 'Your profile email must match your sign-in email. Reload Profile and check it before retrying.',
      429: 'Please wait before trying again.',
    };
    throw new Error(messages[status] ?? 'Unable to verify your email. Check your connection and retry.');
  }
  if (data?.status !== 'pending' && data?.status !== 'verified') throw new Error('Unable to confirm verification status. Reload and retry.');
  return data.status;
}
