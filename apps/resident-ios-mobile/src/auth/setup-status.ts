import { residentSetupFailure, type Database, type ResidentSetupFailure } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * Versioned, provider-aware setup status for iOS (`get_resident_account_setup_status_v2`,
 * migration 0122). The strict legacy v1 shape stays untouched for Android/web. Unknown
 * contract versions, origins or provider values fail closed instead of being guessed.
 */
export const setupStatusSchema = z.object({
  contractVersion: z.literal(2),
  registrationOrigin: z.enum(['email_otp', 'google', 'apple', 'legacy']),
  profileComplete: z.boolean(),
  /** null = unresolved legacy provenance; never treated as "no password". */
  passwordSet: z.boolean().nullable(),
  identityProviders: z.array(z.string()),
  hasGoogleIdentity: z.boolean(),
  hasAppleIdentity: z.boolean(),
  emailIsPrivateRelay: z.boolean(),
}).strict();
export type SetupStatus = z.infer<typeof setupStatusSchema>;

export type SetupFailure = ResidentSetupFailure;
export type SetupLoad =
  | { state: 'loading' }
  | { state: 'error'; failure: SetupFailure }
  | { state: 'ready'; status: SetupStatus };

export class SetupStatusError extends Error {
  readonly failure: SetupFailure;
  constructor(error?: { code?: string; status?: number; name?: string }) {
    const failure = residentSetupFailure(error);
    super(failure.message);
    this.name = 'SetupStatusError';
    this.failure = failure;
  }
}

type RpcClient = Pick<SupabaseClient<Database>, 'rpc'>;
/** Caller-only RPC: no user id argument and no invented default on transport or shape failure. */
export async function fetchSetupStatus(client: RpcClient, timeoutMs = 10_000): Promise<SetupStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await client.rpc('get_resident_account_setup_status_v2').abortSignal(controller.signal);
    if (error) throw new SetupStatusError(controller.signal.aborted ? { name: 'AbortError' } : error);
    const parsed = setupStatusSchema.safeParse(data);
    if (!parsed.success) throw new SetupStatusError({ code: '55000' });
    return parsed.data;
  } catch (error) {
    if (error instanceof SetupStatusError) throw error;
    throw new SetupStatusError(controller.signal.aborted ? { name: 'AbortError' } : error instanceof Error ? { name: error.name } : undefined);
  } finally { clearTimeout(timer); }
}

export type OwnedSetup = { uid: string; value: SetupLoad } | null;

/** A refresh over this user's earlier server-confirmed status keeps it while reloading. */
export function isBackgroundRefresh(previous: OwnedSetup, uid: string) {
  return previous?.uid === uid && previous.value.state === 'ready';
}

/**
 * A failed background read keeps the confirmed status and reports a retryable refresh error.
 * Deleted/forbidden accounts and ended sessions never keep earlier access.
 */
export function refreshFailureOutcome(background: boolean, failure: SetupFailure):
  { type: 'keep_status'; message: string } | { type: 'replace_with_error' } {
  if (background && failure.kind !== 'forbidden' && failure.kind !== 'session_expired') return { type: 'keep_status', message: failure.message };
  return { type: 'replace_with_error' };
}
