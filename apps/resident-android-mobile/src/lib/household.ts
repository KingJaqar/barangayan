import type { Json } from '@barangayan/shared';
import { supabase } from '@/lib/supabase';

export type ProfileHouseholdMember = { id: string; name: string; relation: string; role?: string };
export class HouseholdError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate the whole list: never turn an unreadable roster into an empty save. */
export function readHouseholdMembers(value: Json | undefined): ProfileHouseholdMember[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) throw new HouseholdError('Your family list could not be read. Reload it before editing.');
  const members = value.map(member => {
    if (!member || typeof member !== 'object' || Array.isArray(member)
      || typeof member.id !== 'string' || !uuid.test(member.id)
      || typeof member.name !== 'string' || !member.name.trim() || member.name.trim().length > 200
      || typeof member.relation !== 'string' || !member.relation.trim() || member.relation.trim().length > 100
      || (member.role != null && (typeof member.role !== 'string' || member.role.trim().length > 50))) {
      throw new HouseholdError('Your family list could not be read. Reload it before editing.');
    }
    return { id: member.id.toLowerCase(), name: member.name, relation: member.relation,
      ...(typeof member.role === 'string' && member.role.trim() ? { role: member.role } : {}) };
  });
  if (new Set(members.map(member => member.id)).size !== members.length) throw new HouseholdError('Your family list could not be read. Reload it before editing.');
  return members;
}

/** Bound SDK/auth waits as well as fetch, with cancellation and no automatic retry. */
export async function householdRequest<T>(work: (signal: AbortSignal) => PromiseLike<T>, signal?: AbortSignal, milliseconds = 15_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  try {
    const deadline = new Promise<never>((_, reject) => {
      cancel = () => { controller.abort(); reject(new HouseholdError('This request ended. Reload your family information before trying again.')); };
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(cancel, milliseconds);
    });
    return await Promise.race([deadline, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new HouseholdError('This request ended. Reload your family information before trying again.');
      return work(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

/** Caller-derived conditional save. The raw snapshot is kept intact for jsonb equality. */
export async function saveHouseholdMembers(members: ProfileHouseholdMember[], expected: Json, signal?: AbortSignal) {
  const payload = members.map(member => ({ id: member.id, name: member.name.trim(), relation: member.relation.trim(), ...(member.role?.trim() ? { role: member.role.trim() } : {}) }));
  const normalized = readHouseholdMembers(payload);
  const { data, error } = await householdRequest(abort => supabase.rpc('save_resident_household_if_unchanged', { p_members: payload, p_expected: expected }).abortSignal(abort), signal);
  if (error) {
    if (error.message === 'attendance_lifecycle_conflict') throw new HouseholdError('This person is checked in. Ask staff to check them out before removing them.');
    if (error.code === 'PT409') throw new HouseholdError('Your family list changed elsewhere. Reload it and review your changes before saving again.');
    throw new HouseholdError('Could not confirm your family changes. Reload the family list before trying again.');
  }
  if (!Array.isArray(data)) throw new HouseholdError('Could not confirm your family changes. Reload the family list before trying again.');
  const saved = readHouseholdMembers(data);
  if (JSON.stringify(saved) !== JSON.stringify(normalized)) throw new HouseholdError('Could not confirm your family changes. Reload the family list before trying again.');
  return { members: saved, snapshot: data };
}

export function attendanceTime(value: string): string {
  return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
