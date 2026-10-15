'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';

import { OFFICIAL_ROLES, OFFICIAL_ROLE_LABELS, type OfficialRole, type Tables } from '@barangayan/shared';
import { useState } from 'react';

import { ProfileTableSummary } from '@/components/admin/profile-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { PROFILE_TABLE_CONFIGS } from '@/lib/admin-tables/profile-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { OfficialWithProfile } from './types';
import { StaffForm } from './staff-form';
import { TABS } from './types';

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
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));
}

export function StaffTable({ result, summary, requestedState, barangayId, currentUserId }: {
  result: QueryOutcome<BrowseResult<OfficialWithProfile>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string; currentUserId: string;
}) {
  const browse = useConfiguredTableBrowse(PROFILE_TABLE_CONFIGS.staff, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const [addOpen, setAddOpen] = useState(false);

  async function updateProfile(row: OfficialWithProfile, patch: Partial<Tables<'profiles'>>) {
    const profileRecord = row.profile as unknown as Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const isNoop = Object.keys(patch).every((key) => profileRecord[key] === patchRecord[key]);

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', row.profile.id)
      .select('id, full_name, email, mobile_number, home_address, updated_at')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No staff profile was updated. Check that you still have access to this account.' };

    if (!isNoop) {
      logAdminAction({
        action: 'update',
        entityType: 'staff',
        entityId: updated.id,
        entityLabel: updated.full_name,
        changes: {
          before: Object.fromEntries(Object.keys(patch).map((key) => [key, profileRecord[key]])),
          after: patch,
        },
      }).catch(() => {});
    }
    browse.refresh();
    return { error: null, row: updated };
  }

  async function updateOfficial(row: OfficialWithProfile, patch: Partial<Tables<'barangay_officials'>>) {
    const rowRecord = row as unknown as Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const isNoop = Object.keys(patch).every((key) => rowRecord[key] === patchRecord[key]);

    const supabase = createSupabaseBrowserClient();
    const { data: updated, error } = await supabase
      .from('barangay_officials')
      .update(patch)
      .eq('id', row.id)
      .select('id, official_role, date_hired, is_active, deleted_at, updated_at')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updated) return { error: 'No staff record was updated. Check that you still have access to this account.' };

    if (!isNoop) {
      logAdminAction({
        action: 'update',
        entityType: 'staff',
        entityId: updated.id,
        entityLabel: row.profile.full_name,
        changes: {
          before: Object.fromEntries(Object.keys(patch).map((key) => [key, rowRecord[key]])),
          after: patch,
        },
      }).catch(() => {});
    }
    browse.refresh();
    return { error: null, row: updated };
  }

  // Every editable cell is locked for the signed-in admin's own row — self-editing role or
  // removing yourself here would be an easy way to accidentally lock yourself out.
  const notSelf = (r: OfficialWithProfile) => r.profile.id !== currentUserId;

  const lifecycle = useRecordWorkspace<OfficialWithProfile>('staff', browse.refresh, browse.settle, { currentUserId });

  const columns: EditableDataTableColumn<OfficialWithProfile>[] = [
    {
      id: 'name', header: 'Name',
      initialWidth: 190,
      minWidth: 160,
      wrap: 'break-word',
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
      id: 'role', header: 'Role',
      render: (r) => <RoleBadge role={r.official_role} />,
      // Auto-measuring off the header cell would size this to whatever's currently in
      // view (e.g. a table full of "Staff" badges) and clip a longer role like "Barangay
      // Health Worker" the moment one shows up — pin it a bit wider than that instead.
      // Kept modest (not the full longest-label width) so Email/Mobile/Actions still have
      // comfortable room too; still user-resizable afterward.
      initialWidth: 188,
      minWidth: 170,
      wrap: 'nowrap',
      edit: {
        type: 'select',
        options: OFFICIAL_ROLES.map((role) => ({ value: role, label: OFFICIAL_ROLE_LABELS[role] })),
        getValue: (r) => r.official_role,
        canEdit: notSelf,
        onSave: (r, value) => updateOfficial(r, { official_role: String(value) as OfficialRole }),
        commitOnChange: true,
      },
    },
    {
      id: 'email', header: 'Email',
      initialWidth: 245,
      minWidth: 190,
      wrap: 'break-word',
      render: (r) => <span className="break-all text-zinc-700 dark:text-zinc-200">{r.profile.email ?? '—'}</span>,
    },
    {
      id: 'mobile', header: 'Mobile',
      initialWidth: 142,
      minWidth: 120,
      wrap: 'nowrap',
      render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{r.profile.mobile_number ?? '—'}</span>,
      edit: {
        type: 'text',
        getValue: (r) => r.profile.mobile_number ?? '',
        canEdit: notSelf,
        onSave: (r, value) => updateProfile(r, { mobile_number: String(value) || null }),
      },
    },
    {
      id: 'address', header: 'Address',
      render: (r) => <span className="text-zinc-600 dark:text-zinc-300">{r.profile.home_address ?? '—'}</span>,
      // Same reasoning as Role above — addresses run long, so give this column more room
      // than its header text alone would claim, without hogging so much that Actions gets
      // squeezed out on narrower viewports.
      initialWidth: 190,
      minWidth: 160,
      wrap: 'break-word',
      edit: {
        type: 'text',
        getValue: (r) => r.profile.home_address ?? '',
        canEdit: notSelf,
        onSave: (r, value) => updateProfile(r, { home_address: String(value) || null }),
      },
    },
    {
      id: 'hired', header: 'Hired',
      initialWidth: 122,
      minWidth: 108,
      wrap: 'nowrap',
      render: (r) => <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{formatDateShort(r.date_hired)}</span>,
    },
    lifecycle.column,
  ];

  return <div className="min-w-0">
    <RecordArchiveLink name="staff" beforeOpen={browse.settle} />
    <ProfileTableSummary name="staff" summary={summary} onRetry={browse.refresh} />

    {addOpen && <fieldset disabled={browse.pending}><StaffForm barangayId={barangayId} onChanged={browse.refresh} onClose={() => setAddOpen(false)} /></fieldset>}
    <ProfileTablePanel label="Staff Members" browse={browse}
      category={<label className="table-browse-field">Official role <AdminSelect kind="people" aria-label="Official role" value={state.filters.role} onValueChange={nextValue => void browse.commit({ filters: { role: nextValue } })}>
        <option value="">All roles</option>{OFFICIAL_ROLES.map(role => <option key={role} value={role}>{OFFICIAL_ROLE_LABELS[role]}</option>)}
      </AdminSelect></label>}
      filters={<SegmentedFilter label="Account type" value={state.filters.tab}
        options={TABS.map(tab => ({ value: tab.key, label: tab.label }))} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={!addOpen && <button type="button" disabled={browse.pending || !barangayId}
        onClick={() => void browse.settle().then(saved => { if (saved) setAddOpen(true); })}>+ Add Staff</button>}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} columns={columns} rowKey={row => row.id}
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: browse.config.sorts, onChange: (sort, dir) => void browse.commit({ sort, dir }) }}
         emptyLabel={browse.pending ? 'Updating results…' : 'No staff accounts found.'}
        resizableColumns pinLastColumn density="compact" tableMinWidth={1215} />
    </ProfileTablePanel>
    {lifecycle.view}

  </div>;
}
