'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RECORD_CONFIG, fieldValue, recordLabel, validateRecordPatch, type RecordData } from '@/lib/admin-tables/record-config';
import type { AdminRecordDatabase } from '@/lib/admin-tables/record-schema';
import type { TableName } from '@/lib/admin-tables/table-configs';
import { logAdminAction } from './admin-audit-actions';

export async function mutateAdminRecord(name: TableName, id: string, operation: 'save' | 'archive' | 'restore' | 'delete', expected: string, input?: unknown) {
  try {
    if (!Object.hasOwn(RECORD_CONFIG, name) || !['save', 'archive', 'restore', 'delete'].includes(operation)
      || !/^[0-9a-f-]{36}$/i.test(id) || !expected || Number.isNaN(Date.parse(expected))) throw new Error('Invalid record action. Reload the details.');
    const session = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) throw new Error('Your session expired. Sign in again.');
    const { data: actor, error: actorError } = await session.from('profiles').select('role,deleted_at').eq('id', user.id).single();
    if (actorError || actor?.role !== 'admin' || actor.deleted_at) throw new Error('An active administrator account is required.');
    const db = session as unknown as SupabaseClient<AdminRecordDatabase>;
    const { data, error } = await db.from(`admin_${name}_records`).select('row').eq('id', id).maybeSingle();
    if (error) throw new Error('Could not load current details. Retry the action.');
    if (!data) throw new Error('This record is unavailable or you no longer have permission.');
    const row = data.row as unknown as RecordData;
    const patch = operation === 'save' ? validateRecordPatch(name, row, input) : {};
    const result = await db.rpc('admin_mutate_record', { p_screen: name, p_id: id, p_operation: operation, p_patch: patch as Json, p_expected: expected });
    if (result.error) {
      if (result.error.code === '23503') throw new Error('This record has related records. Resolve those records before deleting it.');
      if (result.error.code === '40001') throw new Error('This record changed. Reload the details before trying again.');
      if (result.error.code === '23505') throw new Error('A record with these values already exists.');
      if (result.error.code === '42501') throw new Error('You do not have permission for this action, or this field requires its dedicated workflow.');
      throw new Error(result.error.message);
    }
    if (!result.data) throw new Error('No record was changed. Reload the details and check your access.');
    await logAdminAction({ action: operation === 'delete' ? 'delete' : 'update',
      entityType: RECORD_CONFIG[name].entity, entityId: id, entityLabel: recordLabel(row),
      ...(operation === 'save' ? { changes: { before: Object.fromEntries(Object.keys(patch).map(key => [key,
        fieldValue(row, RECORD_CONFIG[name].fields.find(field => field.key === key)!)])), after: patch } } : {}), metadata: { operation } }).catch(() => {});
    return { error: null };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : 'The action failed. Please retry.' }; }
}
