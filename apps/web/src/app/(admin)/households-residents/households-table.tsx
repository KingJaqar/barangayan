'use client';

import type { Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { HouseholdMemberRow } from './page';

const CHECKED_IN_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const RELATION_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'other', label: 'Other' },
];

const ROLE_OPTIONS = [
  { value: 'head', label: 'Head' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'other', label: 'Other' },
];

function formatDateTimeShort(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function HouseholdsTable({ rows, barangayId }: { rows: HouseholdMemberRow[]; barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<HouseholdMemberRow | null>(null);
  const [channelName] = useState(() => `admin-household-members-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, router]);

  async function updateField(row: HouseholdMemberRow, patch: Partial<Tables<'household_members'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('household_members').update(patch).eq('id', row.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function removeMember(row: HouseholdMemberRow) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('household_members').delete().eq('id', row.id);
    if (error) {
      toast.showError(`Failed to remove member: ${error.message}`);
      return;
    }
    toast.showSuccess('Household member removed.');
    router.refresh();
  }

  const columns: EditableDataTableColumn<HouseholdMemberRow>[] = [
    {
      header: 'Name',
      render: (r) => <span className="font-medium">{r.name}</span>,
      edit: {
        type: 'text',
        getValue: (r) => r.name,
        onSave: (r, value) => updateField(r, { name: String(value) }),
      },
    },
    {
      header: 'Resident (Head)',
      render: (r) => r.profiles?.full_name ?? '—',
    },
    {
      header: 'Relation',
      render: (r) => r.relation,
      edit: {
        type: 'select',
        options: RELATION_OPTIONS,
        getValue: (r) => r.relation,
        onSave: (r, value) => updateField(r, { relation: String(value) }),
      },
    },
    {
      header: 'Role',
      render: (r) => r.role,
      edit: {
        type: 'select',
        options: ROLE_OPTIONS,
        getValue: (r) => r.role,
        onSave: (r, value) => updateField(r, { role: String(value) }),
      },
    },
    {
      header: 'Checked In',
      render: (r) => (r.is_checked_in ? 'Yes' : 'No'),
      edit: {
        type: 'select',
        options: CHECKED_IN_OPTIONS,
        getValue: (r) => String(r.is_checked_in),
        onSave: (r, value) => {
          const next = value === 'true';
          if (next === r.is_checked_in) return Promise.resolve({ error: null });
          const patch: Partial<Tables<'household_members'>> = { is_checked_in: next };
          if (!next) {
            patch.checked_in_at = null;
            patch.checked_in_center_id = null;
            patch.checked_in_center_name = null;
          }
          return updateField(r, patch);
        },
      },
    },
    {
      header: 'Checked-In Center',
      render: (r) => r.checked_in_center_name ?? '—',
    },
    {
      header: 'Added',
      render: (r) => formatDateTimeShort(r.created_at),
    },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelected(r)} className="rounded-full px-2 py-1 text-xs font-medium text-[#0F6E5B] hover:underline">
            View
          </button>
          <ConfirmButton
            label="🗑"
            confirmLabel="Remove this member?"
            onConfirm={() => removeMember(r)}
            title="Remove household member"
            className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <AddMemberForm barangayId={barangayId} />
      <EditableDataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No household members found."
        columns={columns}
        onRowClick={setSelected}
      />

      {selected && (
        <MemberDetailModal
          row={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function AddMemberForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [residents, setResidents] = useState<{ id: string; full_name: string }[]>([]);
  const [profileId, setProfileId] = useState('');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('other');
  const [role, setRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'resident')
      .eq('barangay_id', barangayId)
      .order('full_name')
      .then(({ data }) => setResidents((data ?? []) as { id: string; full_name: string }[]));
  }, [open, barangayId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profileId || !name.trim()) {
      setError('Select a resident and enter a name.');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc('admin_add_household_member', {
      p_profile_id: profileId,
      p_name: name.trim(),
      p_relation: relation,
      p_role: role,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      toast.showError(`Failed to add member: ${rpcError.message}`);
      return;
    }
    toast.showSuccess('Household member added.');
    setProfileId('');
    setName('');
    setRelation('other');
    setRole('member');
    setOpen(false);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mb-4 rounded-full bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
        + Add Member
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Resident (Head) *</span>
        <select className={inputClass} value={profileId} onChange={(e) => setProfileId(e.target.value)} required>
          <option value="">Select a resident…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Name *</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Relation</span>
        <select className={inputClass} value={relation} onChange={(e) => setRelation(e.target.value)}>
          {RELATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Role</span>
        <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting || !profileId || !name.trim()}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add Member'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

function MemberDetailModal({
  row,
  onClose,
}: {
  row: HouseholdMemberRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);

  async function handleDelete() {
    setRemoving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('household_members').delete().eq('id', row.id);
    setRemoving(false);
    if (error) {
      toast.showError(`Failed to remove: ${error.message}`);
      return;
    }
    toast.showSuccess('Household member removed.');
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-black/10 p-6 dark:border-white/10">
          <div>
            <h2 className="text-xl font-bold">{row.name}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {row.profiles?.full_name ?? 'Unknown resident'} · {row.relation} · {row.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-zinc-400">Resident</dt>
                <dd className="font-medium">{row.profiles?.full_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Relation</dt>
                <dd className="font-medium">{row.relation}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Role</dt>
                <dd className="font-medium">{row.role}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Checked In</dt>
                <dd className="font-medium">{row.is_checked_in ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Checked-In Center</dt>
                <dd className="font-medium">{row.checked_in_center_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Added</dt>
                <dd className="font-medium">{formatDateTimeShort(row.created_at)}</dd>
              </div>
            </dl>
          </section>

          <div className="flex items-center gap-2">
            <ConfirmButton
              label="🗑 Remove Member"
              confirmLabel="Permanently remove this household member?"
              onConfirm={handleDelete}
              disabled={removing}
              title="This action cannot be undone."
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
