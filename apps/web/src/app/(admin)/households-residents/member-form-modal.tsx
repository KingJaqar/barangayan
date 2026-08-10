'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { householdMemberSchema, HOUSEHOLD_MEMBER_RELATIONS, HOUSEHOLD_MEMBER_ROLES } from '@barangayan/shared';

const inputCls =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

const RELATION_OPTIONS = HOUSEHOLD_MEMBER_RELATIONS.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }));
const ROLE_OPTIONS = HOUSEHOLD_MEMBER_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }));

type Member = {
  id: string;
  name: string;
  relation: string;
  role: string;
};

export function MemberFormModal({
  mode,
  profileId,
  memberId,
  members,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  profileId: string;
  memberId?: string;
  members: Member[];
  onClose: () => void;
  onSubmit: (values: { name: string; relation: string; role: string }) => Promise<void>;
}) {
  const router = useRouter();
  const existing = mode === 'edit' && memberId ? members.find((m) => m.id === memberId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [relation, setRelation] = useState<(typeof HOUSEHOLD_MEMBER_RELATIONS)[number]>(
    existing?.relation ? (existing.relation as (typeof HOUSEHOLD_MEMBER_RELATIONS)[number]) : HOUSEHOLD_MEMBER_RELATIONS[0],
  );
  const [role, setRole] = useState<(typeof HOUSEHOLD_MEMBER_ROLES)[number]>(
    existing?.role ? (existing.role as (typeof HOUSEHOLD_MEMBER_ROLES)[number]) : HOUSEHOLD_MEMBER_ROLES[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = householdMemberSchema.safeParse({
      profile_id: profileId,
      name,
      relation,
      role,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ name, relation, role });
      router.refresh();
    } catch {
      // error already surfaced by caller / toast
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">{mode === 'add' ? 'Add Household Member' : 'Edit Household Member'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Full Name *</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Relation *</span>
            <select
              className={inputCls}
              value={relation}
              onChange={(e) => setRelation(e.target.value as (typeof HOUSEHOLD_MEMBER_RELATIONS)[number])}>
              {RELATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Role *</span>
            <select
              className={inputCls}
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof HOUSEHOLD_MEMBER_ROLES)[number])}>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : mode === 'add' ? 'Add Member' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
