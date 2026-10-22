import { z } from 'zod';
import { replyError, type FunctionReply } from './function-call';

export const DELETE_CONTRACT_VERSION = 2;

/** The truthful state the server reports; `completed` is the only terminal success. */
const replySchema = z.object({
  contractVersion: z.literal(DELETE_CONTRACT_VERSION),
  state: z.enum(['requested', 'profile_erased', 'storage_cleaned', 'auth_revoked', 'completed', 'needs_attention']),
});

export type DeleteOutcome =
  /** Everything finished: records erased or de-identified, files removed, sign-in revoked. */
  | { status: 'completed'; message: string }
  /** The server stopped part-way. Nothing is hidden: the resident can retry, and a retry converges. */
  | { status: 'partial'; message: string }
  | { status: 'reauthenticate'; message: string }
  /** The session no longer works. After an unconfirmed attempt this usually means the deletion finished. */
  | { status: 'session-ended'; message: string }
  | { status: 'unavailable'; message: string }
  /** No reply: the request may or may not have run. */
  | { status: 'unknown'; message: string }
  | { status: 'failed'; message: string };

/** Server error codes the delete function reports (supabase/functions/delete-my-account). */
const CODE_MESSAGES: Record<string, Pick<DeleteOutcome, 'status' | 'message'>> = {
  fresh_authentication_required: { status: 'reauthenticate', message: 'For your security, confirm it is you again, then delete your account. Your confirmation lasts a few minutes.' },
  apple_authorization_required: { status: 'reauthenticate', message: 'Confirm with Apple again so your Apple sign-in can be disconnected as part of the deletion.' },
  apple_revocation_unavailable: { status: 'unavailable', message: 'Your Apple sign-in cannot be disconnected from here right now, so nothing was deleted. Try again later or contact your barangay.' },
  apple_revocation_failed: { status: 'failed', message: 'Apple did not confirm disconnecting your sign-in, so nothing was deleted. Confirm with Apple again and retry.' },
};

export async function runDelete(request: () => Promise<FunctionReply>): Promise<DeleteOutcome> {
  const reply = await request();
  if (reply.kind === 'unreachable') {
    return { status: 'unknown', message: 'We could not confirm whether your account was deleted. Do not assume either way: try again. If you are logged out, the deletion finished.' };
  }
  if (reply.kind === 'http') {
    const error = replyError(reply.body);
    const known = error ? CODE_MESSAGES[error] : undefined;
    if (known) return known;
    if (reply.status === 401) return { status: 'session-ended', message: 'Your session has ended. If you were deleting your account, it may have finished: a deleted account cannot log in.' };
    if (reply.status === 404) return { status: 'unavailable', message: 'Account deletion is not available yet. Nothing was deleted.' };
    if (reply.status === 409 || reply.status === 502) return { status: 'partial', message: 'Your deletion started but did not finish. Some of your data may remain. Try again to finish it; nothing is hidden from you.' };
    return { status: 'failed', message: 'Your account could not be deleted right now. Nothing has been reported as deleted. Please try again.' };
  }
  const parsed = replySchema.safeParse(reply.data);
  if (!parsed.success) return { status: 'unknown', message: 'The server answered in an unexpected way, so we cannot tell whether your account was deleted. Try again.' };
  if (parsed.data.state === 'completed') return { status: 'completed', message: 'Your account has been deleted.' };
  return { status: 'partial', message: 'Your deletion started but did not finish. Some of your data may remain. Try again to finish it; nothing is hidden from you.' };
}
