import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import type { QueryOutcome } from './browse';

interface OptionRows {
  incident_categories: { id: string; name: string; color: string };
  medical_drives: { id: string; title: string; drive_date: string };
}
/** Complete independent action options. Public drive reads also apply to admins,
 * so the explicit tenant predicate is required in addition to RLS. */
export async function operationsOptions<T extends keyof OptionRows>(db: SupabaseClient<Database>, table: T,
  barangayId: string): Promise<QueryOutcome<OptionRows[T][]>> {
  const rows: OptionRows[T][] = [];
  const signal = AbortSignal.timeout(15000);
  try {
    for (let start = 0; ; start += 500) {
      const read = table === 'incident_categories'
        ? db.from('incident_categories').select('id,name,color').eq('barangay_id', barangayId).order('name').order('id')
        : db.from('medical_drives').select('id,title,drive_date').eq('barangay_id', barangayId)
          .eq('is_active', true).is('deleted_at', null).order('title').order('id');
      const { data, error } = await read.range(start, start + 499).retry(false).abortSignal(signal);
      if (error || !data) throw new Error('lookup failed');
      rows.push(...data as unknown as OptionRows[T][]);
      if (data.length < 500) return { status: 'success', value: rows };
    }
  } catch {
    return { status: 'error', code: 'query-failed', message: 'Could not load complete form and filter options. Retry options.' };
  }
}
