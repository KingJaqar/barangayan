import type { Database, Json } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { DataError, toDataError } from '../../data/outcome';

export const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'] as const;
export const ROLES = ['Head of Family', 'Student', 'Employed', 'Unemployed', 'Retired', 'Minor'] as const;
/** Mirrors the server's list limit (`save_resident_household_if_unchanged`). */
export const MAX_MEMBERS = 30;
const NAME_MAX = 200;

export type Member = { id: string; name: string; relation: string; role: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storedMember = z.object({ id: z.string(), name: z.string(), relation: z.string(), role: z.string().nullish() });
const savedList = z.array(z.object({ id: z.string().uuid(), name: z.string(), relation: z.string(), role: z.string().nullish() }));

/**
 * Reads `profiles.household_members`. Entries that are not objects with a name are
 * dropped and counted, never invented; the count lets the screen say the list was
 * partly unreadable instead of showing a silently shorter household.
 */
export function readMembers(value: Json | null | undefined): { members: Member[]; unreadable: number } {
  if (!Array.isArray(value)) return { members: [], unreadable: 0 };
  const members: Member[] = [];
  let unreadable = 0;
  for (const entry of value) {
    const parsed = storedMember.safeParse(entry);
    if (!parsed.success || !parsed.data.name.trim()) { unreadable++; continue; }
    members.push({ id: parsed.data.id, name: parsed.data.name, relation: parsed.data.relation, role: parsed.data.role?.trim() || null });
  }
  return { members, unreadable };
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type MemberDraft = { name: string; relation: string; role: string };
export function validateMember(draft: MemberDraft): Partial<Record<keyof MemberDraft, string>> {
  const errors: Partial<Record<keyof MemberDraft, string>> = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Enter the member’s name';
  else if (name.length > NAME_MAX) errors.name = `Use ${NAME_MAX} characters or fewer`;
  else if (/[\u0000-\u001f\u007f]/.test(name)) errors.name = 'Remove special control characters';
  if (!draft.relation) errors.relation = 'Choose a relationship';
  if (!draft.role) errors.role = 'Choose a role';
  return errors;
}

export function sameMembers(left: readonly Member[], right: readonly Member[]): boolean {
  return left.length === right.length && left.every((member, index) => {
    const other = right[index];
    return member.id === other.id && member.name === other.name && member.relation === other.relation && member.role === other.role;
  });
}

/**
 * Whole-list payload. Existing stable IDs are kept; an entry whose stored ID is not a UUID
 * (older clients) cannot be sent as-is, so it receives a new one — the mirror trigger
 * already gave such an entry a throwaway canonical ID, so no attendance record is lost.
 */
function listPayload(members: readonly Member[], newId: () => string): Member[] {
  return members.map((member) => ({ ...member, id: UUID.test(member.id) ? member.id.toLowerCase() : newId() }));
}

export type HouseholdSave = { kind: 'saved'; members: Member[] } | { kind: 'changed' } | { kind: 'unconfirmed' };

/**
 * Conditional whole-list save (migration 0123). `expected` must be the row's raw
 * `household_members` as last read, so a list changed elsewhere is refused (`PT409`)
 * before anything is written. A transport failure after sending is `unconfirmed`: the
 * caller reloads before offering another save.
 */
export async function saveHousehold(client: SupabaseClient<Database>, members: readonly Member[], expected: Json | null, newId: () => string): Promise<HouseholdSave> {
  const payload = listPayload(members, newId);
  if (payload.length > MAX_MEMBERS) throw new DataError('validation', `A household can have up to ${MAX_MEMBERS} members.`);
  const { data, error, status } = await client.rpc('save_resident_household_if_unchanged', {
    p_members: payload.map(({ id, name, relation, role }) => ({ id, name: name.trim(), relation, ...(role ? { role } : {}) })),
    p_expected: expected ?? [],
  });
  if (error) {
    if (error.code === 'PT409') return { kind: 'changed' };
    const failure = toDataError(error, { status, write: true });
    if (failure.kind === 'unknown-commit') return { kind: 'unconfirmed' };
    throw failure;
  }
  const parsed = savedList.safeParse(data);
  if (!parsed.success) return { kind: 'unconfirmed' };
  return { kind: 'saved', members: parsed.data.map((member) => ({ id: member.id, name: member.name, relation: member.relation, role: member.role?.trim() || null })) };
}
