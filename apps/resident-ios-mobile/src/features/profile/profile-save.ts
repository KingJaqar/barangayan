import type { Database, Tables } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toDataError } from '../../data/outcome';
import { reconcileConflict, type ProfilePatch } from './profile-form';

type ProfileRow = Tables<'profiles'>;
export type SaveOutcome =
  /** The patch was written; `base` is the row it was written against. */
  | { kind: 'saved'; base: ProfileRow }
  /** A field this form edits changed elsewhere; nothing was written and the resident must review `latest`. */
  | { kind: 'review'; latest: ProfileRow }
  /** The row changed again between the retry's read and its write; nothing was written. */
  | { kind: 'changed-again' };

/**
 * Optimistic profile save (plan §3 conditional writes). The update matches no row when
 * `updated_at` is no longer the value the form was based on, so a stale editor can never
 * overwrite another device's change. Zero matched rows means nothing was written, which
 * makes one retry against the newer row safe when only unrelated columns changed.
 * A transport failure after sending is thrown as an unknown commit for the caller to report.
 */
export async function saveProfile(
  client: SupabaseClient<Database>, base: ProfileRow, patch: ProfilePatch, gate: <T>(work: () => PromiseLike<T>) => Promise<T> = (work) => Promise.resolve(work()),
): Promise<SaveOutcome> {
  async function write(snapshot: ProfileRow) {
    const { data, error, status } = await gate(async () => client.from('profiles').update(patch)
      .eq('id', base.id).eq('barangay_id', base.barangay_id).eq('updated_at', snapshot.updated_at).select('id'));
    if (error) throw toDataError(error, { status, write: true });
    return (data?.length ?? 0) === 1;
  }
  if (await write(base)) return { kind: 'saved', base };
  const { data: latest, error } = await client.from('profiles').select('*').eq('id', base.id).maybeSingle();
  if (error) throw toDataError(error);
  if (!latest) throw toDataError({ code: 'PGRST116' });
  if (reconcileConflict(base, latest) === 'review') return { kind: 'review', latest };
  return (await write(latest)) ? { kind: 'saved', base: latest } : { kind: 'changed-again' };
}
