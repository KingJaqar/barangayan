import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import type { QueryOutcome } from './browse';

/** Action lookups are independent of the bounded main table. Fetch complete
 * options under one deadline; never present a capped/failed batch as complete. */
interface OptionRows {
  profiles: { id: string; full_name: string };
  document_types: { id: string; name: string; contract_version: number };
}
export async function pilotOptions<T extends keyof OptionRows>(db: SupabaseClient<Database>, table: T,
  barangayId: string, role?: 'resident' | 'admin' | 'requester', activeOnly = false): Promise<QueryOutcome<OptionRows[T][]>> {
  const signal = AbortSignal.timeout(15000);
  const rows: OptionRows[T][] = [];
  try {
    for (let start = 0; ; start += 500) {
      const read = async () => {
        if (table === 'profiles') {
          let query = db.from('profiles').select('id,full_name').eq('barangay_id', barangayId).is('deleted_at', null).order('full_name').order('id');
          if (role === 'requester') query = query.in('role', ['resident', 'admin']);
          else if (role) query = query.eq('role', role);
          return query.range(start, start + 499).retry(false).abortSignal(signal);
        }
        let query = db.from('document_types').select('id,name,contract_version').eq('barangay_id', barangayId).is('deleted_at', null).order('name').order('id');
        if (activeOnly) query = query.eq('is_active', true);
        return query.range(start, start + 499).retry(false).abortSignal(signal);
      };
      const { data, error } = await read();
      if (error || !data) throw new Error('lookup failed');
      rows.push(...data as unknown as OptionRows[T][]);
      if (data.length < 500) return { status: 'success', value: rows };
    }
  } catch {
    return { status: 'error', code: 'query-failed', message: 'Could not load complete form and filter options. Retry options.' };
  }
}
