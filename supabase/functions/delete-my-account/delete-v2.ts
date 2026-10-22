// Account deletion contract v2 (resident iOS plan Phase 18, P18-T05). Free of Deno and network imports so the same module is unit-tested.
//
// The sequence is: disconnect Apple (when the account has an Apple sign-in), erase / de-identify the records, remove the Storage
// objects, revoke the sign-in, and only then report `completed`. Every step is idempotent and the database records how far the
// deletion got, so a retry after a failure converges and a partial result is never reported as success.

export const DELETE_CONTRACT_VERSION = 2;

export type StepOutcome = { ok: true } | { ok: false; code: string };
export type EraseOutcome = { ok: true; state: string } | { ok: false; code: string; message?: string };
export type AppleOutcome = 'ok' | 'unavailable' | 'failed';

export type DeleteDeps = {
  hasAppleIdentity: boolean;
  /** One-time Apple authorization code from the fresh confirmation, when the app supplied one. */
  appleAuthorizationCode: string | null;
  revokeApple(code: string): Promise<AppleOutcome>;
  /** `erase_own_account_records()` under the caller's own session (freshness is enforced there). */
  erase(): Promise<EraseOutcome>;
  /** Moves the recorded state forward (service role). Resolves false when the state could not be recorded. */
  setState(state: 'storage_cleaned' | 'auth_revoked' | 'completed' | 'needs_attention', error?: string): Promise<boolean>;
  /** Removes the resident's Storage objects; resolves the buckets that could not be cleared. */
  cleanStorage(): Promise<string[]>;
  /** Revokes the sessions and soft-deletes the sign-in (removes its email, password and linked identities). */
  revokeAuth(): Promise<boolean>;
};

export type Reply = { status: number; body: Record<string, unknown> };

const reply = (status: number, body: Record<string, unknown>): Reply => ({ status, body });
const partial = (error: string): Reply => reply(502, { error });

export async function deleteAccountV2(deps: DeleteDeps): Promise<Reply> {
  // Disconnecting Apple comes first: nothing has been changed yet, so a refusal here leaves the account exactly as it was.
  if (deps.hasAppleIdentity) {
    if (!deps.appleAuthorizationCode) return reply(400, { error: 'apple_authorization_required' });
    const apple = await deps.revokeApple(deps.appleAuthorizationCode);
    if (apple === 'unavailable') return reply(503, { error: 'apple_revocation_unavailable' });
    if (apple === 'failed') return reply(502, { error: 'apple_revocation_failed' });
  }

  const erased = await deps.erase();
  if (!erased.ok) {
    if (erased.code === '42501') return reply(401, { error: 'fresh_authentication_required' });
    if (erased.code === 'P0002') return reply(409, { error: 'account_already_deleted' });
    await deps.setState('needs_attention', `erase:${erased.code}`);
    return partial('erase_failed');
  }
  if (erased.state === 'completed') return reply(200, { contractVersion: DELETE_CONTRACT_VERSION, state: 'completed' });

  const failedBuckets = await deps.cleanStorage();
  if (failedBuckets.length > 0) {
    await deps.setState('needs_attention', `storage:${failedBuckets.join(',')}`);
    return partial('storage_cleanup_incomplete');
  }
  if (!(await deps.setState('storage_cleaned'))) return partial('state_not_recorded');

  if (!(await deps.revokeAuth())) {
    await deps.setState('needs_attention', 'auth_revocation');
    return partial('auth_revocation_failed');
  }
  if (!(await deps.setState('auth_revoked'))) return partial('state_not_recorded');

  // The final write is what makes the result truthful: without it the deletion is reported as unfinished.
  if (!(await deps.setState('completed'))) return partial('state_not_recorded');
  return reply(200, { contractVersion: DELETE_CONTRACT_VERSION, state: 'completed' });
}
