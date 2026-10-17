import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DataError, toDataError } from '../../data/outcome';
import type { Persist } from './preferences';

/**
 * Writes appearance columns to the resident's own profile row. The row must be matched exactly
 * once: zero rows means the profile is gone or not writable, which is reported as a failure so
 * the optimistic change is rolled back instead of silently kept.
 */
export function persistPreferences(client: SupabaseClient<Database>, userId: string): Persist {
  return async (columns) => {
    const { data, error, status } = await client.from('profiles').update(columns).eq('id', userId).select('id');
    if (error) throw toDataError(error, { status, write: true });
    if ((data?.length ?? 0) !== 1) throw new DataError('not-found');
  };
}
