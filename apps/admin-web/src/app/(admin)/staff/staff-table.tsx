'use client';

import { OFFICIAL_ROLES, OFFICIAL_ROLE_LABELS, type OfficialRole, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { OfficialWithProfile } from './page';
import { StaffForm } from './staff-form';
import { TABS, type Tab } from './types';

function RoleBadge({ role }: { role: string }) {
  const color = role === 'admin' ? '#0F6E5B' : '#2563EB';
  const label = OFFICIAL_ROLE_LABELS[role as OfficialRole] ?? role;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${color}1A`, color }}>
      {label}
    </span>
  );
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export function StaffTable({
  rows,
  currentUserId,
  barangayId,
  tab,
  role,
  q,
}: {
  rows: OfficialWithProfile[];
  currentUserId: string;
  barangayId: string;
  tab: Tab;
  role: string;
  q: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [nameOrder, setNameOrder] = useState<'asc' | 'desc'>('asc');
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState(q);

  // Re-sync the box with the URL when the server sends a different `q` (back/forward, or a
  // navigation from elsewhere). Adjusting state during render is React's recommended way to
  // do this — an effect would render the stale value first, then immediately render again.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setSearchText(q);
  }

  // Keep the latest tab/role around for the debounced search effect below, without making
  // that effect re-fire (and re-push a redundant URL) whenever tab/role change on their
  // own — those already navigate immediately through their own handlers.
  const tabRef = useRef(tab);
  const roleRef = useRef(role);
  useEffect(() => {
    tabRef.current = tab;
    roleRef.current = role;
  }, [tab, role]);

  function navigate(next: { tab?: string; role?: string; q?: string }) {
    const nextQ = next.q ?? q;
    const nextRole = next.role ?? role;
    const params = new URLSearchParams({
      tab: next.tab ?? tab,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextRole ? { role: nextRole } : {}),
    });
    router.push(`/staff?${params.toString()}`);
  }

  // Real-time search: push the URL (and let the server re-filter) a short moment after the
  // user stops typing, instead of waiting for a submit click.
  useEffect(() => {
    if (searchText === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        tab: tabRef.current,
        ...(searchText ? { q: searchText } : {}),
        ...(roleRef.current ? { role: roleRef.current } : {}),
      });
      router.push(`/staff?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const sortedRows = [...rows].sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name) * (nameOrder === 'asc' ? 1 : -1));

  async function updateProfile(row: OfficialWithProfile, patch: Partial<Tables<'profiles'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('profiles').update(patch).eq('id', row.profile.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function updateOfficial(row: OfficialWithProfile, patch: Partial<Tables<'barangay_officials'>>) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('barangay_officials').update(patch).eq('id', row.id);
    if (!error) router.refresh();
    return { error: error?.message ?? null };
  }

  async function removeStaff(row: OfficialWithProfile) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('barangay_officials')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', row.id);
    if (error) {
      toast.showError(`Failed to remove: ${error.message}`);
      return;
    }
    toast.showSuccess('Staff account removed.');
    router.refresh();
  }

  // Every editable cell is locked for the signed-in admin's own row — self-editing role or
  // removing yourself here would be an easy way to accidentally lock yourself out.
  const notSelf = (r: OfficialWithProfile) => r.profile.id !== currentUserId;

  const columns: EditableDataTableColumn<OfficialWithProfile>[] = [
    {
      header: 'Name',
      render: (r) => <span className="font-medium">{r.profile.full_name}</span>,
      edit: {
        type: 'text',
        getValue: (r) => r.profile.full_name,
        canEdit: notSelf,
        onSave: (r, value) => {
          const next = String(value).trim();
          if (!next) return Promise.resolve({ error: 'Name cannot be empty.' });
          return updateProfile(r, { full_name: next });
        },
      },
    },
    {
      header: 'Role',
      render: (r) => <RoleBadge role={r.official_role} />,
      // Auto-measuring off the header cell would size this to whatever's currently in
      // view (e.g. a table full of "Staff" badges) and clip a longer role like "Barangay
      // Health Worker" the moment one shows up — pin it a bit wider than that instead.
      // Kept modest (not the full longest-label width) so Email/Mobile/Actions still have
      // comfortable room too; still user-resizable afterward.
      initialWidth: 150,
      edit: {
        type: 'select',
        options: OFFICIAL_ROLES.map((role) => ({ value: role, label: OFFICIAL_ROLE_LABELS[role] })),
        getValue: (r) => r.official_role,
        canEdit: notSelf,
        onSave: (r, value) => updateOfficial(r, { official_role: String(value) as OfficialRole }),
      },
    },
    {
      header: 'Email',
      render: (r) => r.profile.email ?? '—',
    },
    {
      header: 'Mobile',
      render: (r) => r.profile.mobile_number ?? '—',
      edit: {
        type: 'text',
        getValue: (r) => r.profile.mobile_number ?? '',
        canEdit: notSelf,
        onSave: (r, value) => updateProfile(r, { mobile_number: String(value) || null }),
      },
    },
    {
      header: 'Address',
      render: (r) => r.profile.home_address ?? '—',
      // Same reasoning as Role above — addresses run long, so give this column more room
      // than its header text alone would claim, without hogging so much that Actions gets
      // squeezed out on narrower viewports.
      initialWidth: 190,
      edit: {
        type: 'text',
        getValue: (r) => r.profile.home_address ?? '',
        canEdit: notSelf,
        onSave: (r, value) => updateProfile(r, { home_address: String(value) || null }),
      },
    },
    {
      header: 'Hired',
      render: (r) => formatDateShort(r.date_hired),
    },
    {
      header: 'Actions',
      render: (r) =>
        r.profile.id === currentUserId ? (
          <span className="text-xs text-zinc-400">current user</span>
        ) : (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <ConfirmButton
              label="🗑"
              confirmLabel="Remove?"
              onConfirm={() => removeStaff(r)}
              title="Remove staff account"
              className="rounded-full px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
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
            value={role}
            onChange={(e) => navigate({ role: e.target.value })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All roles</option>
            {OFFICIAL_ROLES.map((r) => (
              <option key={r} value={r}>
                {OFFICIAL_ROLE_LABELS[r]}
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
              placeholder="Search name, email, mobile, address…"
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
            disabled={!barangayId}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            + Add Staff
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

      {addOpen && <StaffForm barangayId={barangayId} onClose={() => setAddOpen(false)} />}

      {/* Section 6: table display — columns are user-resizable (drag the divider in each
          header cell). */}
      <EditableDataTable
        rows={sortedRows}
        rowKey={(r) => r.id}
        emptyLabel="No staff accounts yet — invite one above."
        columns={columns}
        resizableColumns
        thickBorders
      />
    </>
  );
}
