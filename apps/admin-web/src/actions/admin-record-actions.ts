'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RECORD_CONFIG, editableFields, fieldValue, recordLabel, validateRecordPatch, type RecordData } from '@/lib/admin-tables/record-config';
import type { AdminRecordDatabase } from '@/lib/admin-tables/record-schema';
import type { TableName } from '@/lib/admin-tables/table-configs';
import { pilotOptions } from '@/lib/admin-tables/queries/pilot-options';
import { logAdminAction } from './admin-audit-actions';

export async function loadAdminRecordOptions(name: TableName, id: string) {
  try {
    if (!Object.hasOwn(RECORD_CONFIG, name)) throw new Error('Invalid record.');
    const session = await createSupabaseServerClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) throw new Error('Your session expired. Sign in again.');
    const db = session as unknown as SupabaseClient<AdminRecordDatabase>;
    const record = await db.from(`admin_${name}_records`).select('tenant_id').eq('id', id).maybeSingle();
    if (record.error || !record.data) throw new Error('This record is unavailable or your access changed.');
    const tenant = record.data.tenant_id;
    const lookups = [...new Set(RECORD_CONFIG[name].fields.flatMap(field => field.lookup ? [field.lookup] : []))];
    const entries = await Promise.all(lookups.map(async lookup => {
      const result = lookup === 'documents' ? await session.from('document_types').select('id,name').eq('barangay_id', tenant).is('deleted_at', null).order('name')
        : lookup === 'categories' ? await session.from('incident_categories').select('id,name').eq('barangay_id', tenant).order('name')
        : null;
      if (!result) {
        const profiles = await pilotOptions(session, 'profiles', tenant, lookup === 'admins' ? 'admin'
          : name === 'requests' || name === 'transactions' ? 'requester' : 'resident');
        if (profiles.status === 'error') throw new Error(profiles.message);
        return [lookup, profiles.value.map(item => ({ value: item.id, label: item.full_name }))] as const;
      }
      if (result.error) throw new Error('Could not load edit options. Please retry.');
      return [lookup, result.data.map(item => ({ value: item.id, label: item.name }))] as const;
    }));
    return { options: Object.fromEntries(entries), error: null };
  } catch (cause) { return { options: null, error: cause instanceof Error ? cause.message : 'Could not load edit options.' }; }
}

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
    const paymentAudited = typeof result.data === 'object' && !Array.isArray(result.data) && (result.data.payment_audited === true || result.data.record_audited === true);
    if (!paymentAudited) await logAdminAction({ action: operation === 'delete' ? 'delete' : 'update',
      entityType: RECORD_CONFIG[name].entity, entityId: id, entityLabel: recordLabel(row),
      ...(operation === 'save' ? { changes: { before: Object.fromEntries(Object.keys(patch).map(key => [key,
        fieldValue(row, editableFields(name, row).find(field => field.key === key)!)])), after: patch } } : {}), metadata: { operation } }).catch(() => {});
    const updated = typeof result.data === 'object' && !Array.isArray(result.data) ? result.data.row : null;
    return { error: null, ...(updated && typeof updated === 'object' && !Array.isArray(updated) && updated.id === id ? { row: updated as unknown as RecordData } : {}) };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : 'The action failed. Please retry.' }; }
}
