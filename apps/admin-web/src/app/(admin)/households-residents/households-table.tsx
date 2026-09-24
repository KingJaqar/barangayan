'use client';

import type { Tables } from '@barangayan/shared';
import { Eye, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { HouseholdMemberRow } from './page';
import { RELATION_OPTIONS as RELATION_FILTER_OPTIONS, TABS, type Tab } from './types';

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

export function HouseholdsTable({
  rows,
  barangayId,
  tab,
  relation,
  q,
}: {
  rows: HouseholdMemberRow[];
  barangayId: string;
  tab: Tab;
  relation: string;
  q: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<HouseholdMemberRow | null>(null);
  const [nameOrder, setNameOrder] = useState<'asc' | 'desc'>('asc');
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState(q);
  const [channelName] = useState(() => `admin-household-members-${Math.random().toString(36).slice(2)}`);

  // Re-sync the box with the URL when the server sends a different `q` (back/forward, or a
  // navigation from elsewhere). Adjusting state during render is React's recommended way to
  // do this — an effect would render the stale value first, then immediately render again.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setSearchText(q);
  }

  // Keep the latest tab/relation around for the debounced search effect below, without
  // making that effect re-fire (and re-push a redundant URL) whenever tab/relation change
  // on their own — those already navigate immediately through their own handlers.
  const tabRef = useRef(tab);
  const relationRef = useRef(relation);
  useEffect(() => {
    tabRef.current = tab;
    relationRef.current = relation;
  }, [tab, relation]);

  function navigate(next: { tab?: string; relation?: string; q?: string }) {
    const nextQ = next.q ?? q;
    const nextRelation = next.relation ?? relation;
    const params = new URLSearchParams({
      tab: next.tab ?? tab,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextRelation ? { relation: nextRelation } : {}),
    });
    router.push(`/households-residents?${params.toString()}`);
  }

  // Real-time search: push the URL (and let the server re-filter) a short moment after the
  // user stops typing, instead of waiting for a submit click.
  useEffect(() => {
    if (searchText === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        tab: tabRef.current,
        ...(searchText ? { q: searchText } : {}),
        ...(relationRef.current ? { relation: relationRef.current } : {}),
      });
      router.push(`/households-residents?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const sortedRows = [...rows].sort((a, b) => a.name.localeCompare(b.name) * (nameOrder === 'asc' ? 1 : -1));

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
    // Avoid a database write when an editable cell is committed without a change.
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    let changed = false;
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      const prevValue = (row as unknown as Record<string, unknown>)[key as string];
      const nextValue = patch[key];
      before[key as string] = prevValue;
      after[key as string] = nextValue;
      if (prevValue !== nextValue) changed = true;
    }
    if (!changed) return { error: null, row };

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('household_members')
      .update(patch)
      .eq('id', row.id)
      .select('id, profile_id, name, relation, role, is_checked_in, checked_in_at, checked_in_center_id, checked_in_center_name, created_at')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) {
      return { error: 'No household member was updated. Check that you still have access to this barangay.' };
    }

    logAdminAction({
      action: 'update',
      entityType: 'household',
      entityId: updated.id,
      entityLabel: row.name,
      changes: { before, after },
    }).catch(() => {});
    router.refresh();
    return { error: null, row: updated };
  }

  /** Shared hard-delete used by both the table row's inline action and the detail modal —
   * kept as one function so the audit log call is only written once. */
  async function removeMember(row: HouseholdMemberRow): Promise<boolean> {
    const supabase = createSupabaseBrowserClient();
    const { data: deleted, error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', row.id)
      .select('id, name, relation, role')
      .maybeSingle();
    if (error) {
      toast.showError(`Failed to remove member: ${error.message}`);
      return false;
    }
    if (!deleted) {
      toast.showError('Failed to remove member: no household member was deleted. Check that you still have access to this barangay.');
      return false;
    }

    logAdminAction({
      action: 'delete',
      entityType: 'household',
      entityId: deleted.id,
      entityLabel: deleted.name,
      metadata: { name: deleted.name, relation: deleted.relation, role: deleted.role },
    }).catch(() => {});

    toast.showSuccess('Household member removed.');
    router.refresh();
    return true;
  }

  const columns: EditableDataTableColumn<HouseholdMemberRow>[] = [
    {
      header: 'Name',
      initialWidth: 210,
      minWidth: 170,
      wrap: 'break-word',
      render: (r) => <span className="font-medium leading-snug">{r.name}</span>,
      edit: {
        type: 'text',
        getValue: (r) => r.name,
        onSave: (r, value) => updateField(r, { name: String(value) }),
      },
    },
    {
      header: 'Resident (Head)',
      initialWidth: 220,
      minWidth: 180,
      wrap: 'break-word',
      render: (r) => <span className="leading-snug">{r.profiles?.full_name ?? '—'}</span>,
    },
    {
      header: 'Relation',
      initialWidth: 130,
      minWidth: 112,
      wrap: 'nowrap',
      render: (r) => r.relation,
      edit: {
        type: 'select',
        options: RELATION_OPTIONS,
        getValue: (r) => r.relation,
        onSave: (r, value) => updateField(r, { relation: String(value) }),
        commitOnChange: true,
      },
    },
    {
      header: 'Role',
      initialWidth: 104,
      minWidth: 92,
      wrap: 'nowrap',
      render: (r) => r.role,
      edit: {
        type: 'select',
        options: ROLE_OPTIONS,
        getValue: (r) => r.role,
        onSave: (r, value) => updateField(r, { role: String(value) }),
        commitOnChange: true,
      },
    },
    {
      header: 'Checked In',
      initialWidth: 118,
      minWidth: 104,
      wrap: 'nowrap',
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            r.is_checked_in
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          {r.is_checked_in ? 'Yes' : 'No'}
        </span>
      ),
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
        commitOnChange: true,
      },
    },
    {
      header: 'Checked-In Center',
      initialWidth: 210,
      minWidth: 170,
      wrap: 'break-word',
      render: (r) => <span className="leading-snug">{r.checked_in_center_name ?? '—'}</span>,
    },
    {
      header: 'Added',
      initialWidth: 176,
      minWidth: 156,
      wrap: 'nowrap',
      render: (r) => <span className="whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{formatDateTimeShort(r.created_at)}</span>,
    },
    {
      header: 'Actions',
      minWidth: 112,
      wrap: 'nowrap',
      overflow: 'visible',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setSelected(r)}
            title={`View household member ${r.name}`}
            aria-label={`View household member ${r.name}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
          </button>
          <ConfirmButton
            label={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            confirmLabel="Remove this member?"
            onConfirm={async () => {
              await removeMember(r);
            }}
            title="Remove household member"
            ariaLabel={`Remove household member ${r.name}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-300 dark:focus-visible:ring-offset-zinc-900"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Section 3: sort/filter/search (left) + Section 5: add button (right) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNameOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
          >
            Name {nameOrder === 'asc' ? '↑' : '↓'}
          </button>

          <select
            value={relation}
            onChange={(e) => navigate({ relation: e.target.value })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All relations</option>
            {RELATION_FILTER_OPTIONS.map((rel) => (
              <option key={rel} value={rel}>
                {rel.charAt(0).toUpperCase() + rel.slice(1)}
              </option>
            ))}
          </select>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: searchText });
            }}
            className="flex items-center gap-2"
          >
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, resident, relation…"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700"
            >
              Search
            </button>
          </form>
        </div>

        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white"
          >
            + Add Member
          </button>
        )}
      </div>

      {/* Section 4: segmented tabs, beneath the sort/filter/search + add row */}
      <div className="mb-4 flex gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ tab: t.key })}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {addOpen && <AddMemberForm barangayId={barangayId} onClose={() => setAddOpen(false)} />}

      {/* Section 6: table display — columns are user-resizable (drag the divider in each
          header cell). */}
      <EditableDataTable
        rows={sortedRows}
        rowKey={(r) => r.id}
        emptyLabel="No household members found."
        columns={columns}
        onRowClick={setSelected}
        resizableColumns
        density="compact"
        tableMinWidth={1280}
        cellOverflow="hidden"
      />

      {selected && (
        <MemberDetailModal row={selected} onClose={() => setSelected(null)} onDelete={removeMember} />
      )}
    </>
  );
}

function AddMemberForm({ barangayId, onClose }: { barangayId: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [residents, setResidents] = useState<{ id: string; full_name: string }[]>([]);
  const [profileId, setProfileId] = useState('');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('other');
  const [role, setRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'resident')
      .eq('barangay_id', barangayId)
      .order('full_name')
      .then(({ data }) => setResidents((data ?? []) as { id: string; full_name: string }[]));
  }, [barangayId]);

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
    const { data: memberId, error: rpcError } = await (supabase as any).rpc('admin_add_household_member', {
      p_profile_id: profileId,
      p_name: name.trim(),
      p_relation: relation,
      p_role: role,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      toast.showError(`Failed to add member: ${rpcError.message}`);
      return;
    }
    if (typeof memberId !== 'string' || !memberId) {
      setSubmitting(false);
      const message = 'The member was not returned after creation. Refresh the page before trying again.';
      setError(message);
      toast.showError(`Failed to add member: ${message}`);
      return;
    }

    const { data: createdMember, error: fetchError } = await supabase
      .from('household_members')
      .select('id, profile_id, name, relation, role, is_checked_in, checked_in_at, checked_in_center_id, checked_in_center_name, created_at')
      .eq('id', memberId)
      .maybeSingle();
    setSubmitting(false);
    if (fetchError || !createdMember) {
      const message = fetchError?.message ?? 'The created member could not be loaded. Refresh the page before trying again.';
      setError(message);
      toast.showError(`Failed to add member: ${message}`);
      return;
    }

    logAdminAction({
      action: 'create',
      entityType: 'household',
      entityId: createdMember.id,
      entityLabel: name.trim(),
      metadata: {
        name: name.trim(),
        resident: residents.find((r) => r.id === profileId)?.full_name ?? null,
        relation,
        role,
      },
    }).catch(() => {});

    toast.showSuccess('Household member added.');
    setProfileId('');
    setName('');
    setRelation('other');
    setRole('member');
    onClose();
    router.refresh();
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-3"
    >
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
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add Member'}
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

function MemberDetailModal({
  row,
  onClose,
  onDelete,
}: {
  row: HouseholdMemberRow;
  onClose: () => void;
  /** Shared hard-delete lifted from the table so the audit log call is only written once. */
  onDelete: (row: HouseholdMemberRow) => Promise<boolean>;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleDelete() {
    setRemoving(true);
    const success = await onDelete(row);
    setRemoving(false);
    if (success) onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-black/10 p-6 dark:border-white/10">
          <div>
            <h2 className="text-xl font-bold">{row.name}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {row.profiles?.full_name ?? 'Unknown resident'} · {row.relation} · {row.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
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
