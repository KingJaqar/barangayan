'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';

import { mutateAdminRecord } from '@/actions/admin-record-actions';
import { AttendanceDialog } from './attendance-dialog';
import { useCallback, useState } from 'react';

import { ProfileTableSummary } from '@/components/admin/profile-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { PROFILE_TABLE_CONFIGS } from '@/lib/admin-tables/profile-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { HouseholdMemberRow } from './types';
import { RELATION_OPTIONS as RELATION_FILTER_OPTIONS, TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

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
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(iso));
}

export function HouseholdsTable({ result, summary, requestedState, actorId, barangayId, residents, optionsError }: {
  result: QueryOutcome<BrowseResult<HouseholdMemberRow>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  actorId: string; barangayId: string;
  residents: { id: string; full_name: string }[]; optionsError: string | null;
}) {
  const browse = useConfiguredTableBrowse(PROFILE_TABLE_CONFIGS.households, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const [addOpen, setAddOpen] = useState(false);

  const [attendanceTarget, setAttendanceTarget] = useState<{ profileId?: string } | null>(null);
  const [attendanceAccessLost, setAttendanceAccessLost] = useState(false);
  const closeAttendance = useCallback(() => setAttendanceTarget(null), []);
  const loseAttendanceAccess = useCallback(() => { setAttendanceTarget(null); setAttendanceAccessLost(true); }, []);
  const openAttendance = async (profileId?: string) => {
    if (attendanceAccessLost) return;
    if (await browse.settle()) setAttendanceTarget({ profileId });
  };

  async function updateField(row: HouseholdMemberRow, patch: { name?: string; relation?: string; role?: string }) {
    if (Object.entries(patch).every(([key, value]) => row[key as keyof typeof patch] === value)) return { error: null, row };
    const result = await mutateAdminRecord('households', row.id, 'save', row.updated_at, patch);
    if (!result.error) browse.refresh();
    return result;
  }

  const lifecycle = useRecordWorkspace<HouseholdMemberRow>('households', browse.refresh, browse.settle, { editHandle: browse.editHandle });

  const columns: EditableDataTableColumn<HouseholdMemberRow>[] = [
    {
      id: 'name', header: 'Name', frozen: true,
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
      id: 'head', header: 'Resident (Head)', frozen: true,
      initialWidth: 220,
      minWidth: 180,
      wrap: 'break-word',
      render: (r) => <span className="leading-snug">{r.profiles?.full_name ?? '—'}</span>,
    },
    {
      id: 'relation', header: 'Relation',
      initialWidth: 130,
      minWidth: 112,
      wrap: 'nowrap',
      render: (r) => r.relation,
      edit: {
        type: 'select', selectKind: 'relation',
        options: RELATION_OPTIONS,
        getValue: (r) => r.relation,
        onSave: (r, value) => updateField(r, { relation: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'role', header: 'Role',
      initialWidth: 104,
      minWidth: 92,
      wrap: 'nowrap',
      render: (r) => r.role,
      edit: {
        type: 'select', selectKind: 'memberRole',
        options: ROLE_OPTIONS,
        getValue: (r) => r.role,
        onSave: (r, value) => updateField(r, { role: String(value) }),
        commitOnChange: true,
      },
    },
    {
      id: 'checked_in', header: 'Checked In',
      initialWidth: 148,
      minWidth: 132,
      wrap: 'nowrap',
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            r.is_checked_in
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          {r.is_checked_in ? 'Active stay' : 'No recorded check-in'}
        </span>
      ),
    },
    {
      id: 'center', header: 'Checked-In Center',
      initialWidth: 210,
      minWidth: 170,
      wrap: 'break-word',
      render: (r) => <span className="leading-snug">{r.checked_in_center_name ?? '—'}</span>,
    },
    {
      id: 'added', header: 'Added',
      initialWidth: 176,
      minWidth: 156,
      wrap: 'nowrap',
      render: (r) => <span className="whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{formatDateTimeShort(r.created_at)}</span>,
    },
    { id: 'attendance', header: 'Attendance', render: row => <button type="button" className={cancelButtonClass} disabled={attendanceAccessLost}
      onClick={() => void openAttendance(row.profile_id)}>Manage attendance</button> },
    lifecycle.column,
  ];

  return <div className="min-w-0">
    {attendanceTarget && <AttendanceDialog key={`${actorId}:${attendanceTarget.profileId ?? 'scan'}`} actorId={actorId} barangayId={barangayId}
      initialProfileId={attendanceTarget.profileId} residents={residents} optionsError={optionsError} onClose={closeAttendance} onIdentityLost={loseAttendanceAccess} onChanged={browse.refresh} />}
    {attendanceAccessLost && <p role="alert">Your session or attendance access changed. Reload the page to continue.</p>}
    <button type="button" className={`${submitButtonClass} mb-4`} disabled={attendanceAccessLost} onClick={() => void openAttendance()}>Scan Family QR / Attendance</button>
    <RecordArchiveLink name="households" beforeOpen={browse.settle} />
    <ProfileTableSummary name="households" summary={summary} onRetry={browse.refresh} />
    <div>{optionsError && <div role="alert">{optionsError} <button type="button" onClick={browse.refresh}>Retry options</button></div>}</div>
    {addOpen && <fieldset disabled={browse.pending || !!optionsError}><AddMemberForm residents={residents} onChanged={browse.refresh} onClose={() => setAddOpen(false)} /></fieldset>}
    <ProfileTablePanel label="Additional household members" browse={browse}
      category={<label className="table-browse-field">Relation <AdminSelect kind="relation" aria-label="Relation" value={state.filters.relation} onValueChange={nextValue => void browse.commit({ filters: { relation: nextValue } })}>
        <option value="">All relations</option>{RELATION_FILTER_OPTIONS.map(rel => <option key={rel} value={rel}>{rel.charAt(0).toUpperCase() + rel.slice(1)}</option>)}
      </AdminSelect></label>}
      filters={<SegmentedFilter label="Check-in status" value={state.filters.tab}
        options={TABS.map(tab => ({ value: tab.key, label: tab.label }))} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={!addOpen && <button type="button" disabled={browse.pending || !barangayId || !!optionsError}
        onClick={() => void browse.settle().then(saved => { if (saved) setAddOpen(true); })}>+ Add Member</button>}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} columns={columns} rowKey={row => row.id}
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: browse.config.sorts, onChange: (sort, dir) => void browse.commit({ sort, dir }) }}
        onRowClick={row => lifecycle.open(row)} emptyLabel={browse.pending ? 'Updating results…' : 'No household people found.'}
        resizableColumns density="compact" tableMinWidth={1280} cellOverflow="hidden" />
    </ProfileTablePanel>
    {lifecycle.view}

  </div>;
}

function AddMemberForm({ residents, onClose, onChanged }: {
  residents: { id: string; full_name: string }[]; onClose: () => void; onChanged: () => void;
}) {

  const [profileId, setProfileId] = useState('');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('other');
  const [role, setRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    const toastAttempt = beginAttempt('handleSubmit');
    try {
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
        toast.error(`Failed to add member: ${rpcError.message}`, { id: toastAttempt });
        return;
      }
      if (typeof memberId !== 'string' || !memberId) {
        setSubmitting(false);
        const message = 'The member was not returned after creation. Refresh the page before trying again.';
        setError(message);
        toast.error(`Failed to add member: ${message}`, { id: toastAttempt });
        return;
      }

      const { data: createdMember, error: fetchError } = await supabase
        .from('household_members')
        .select('id, profile_id, name, relation, role, is_checked_in, checked_in_at, checked_in_center_id, checked_in_center_name, created_at, updated_at')
        .eq('id', memberId)
        .maybeSingle();
      setSubmitting(false);
      if (fetchError || !createdMember) {
        const message = fetchError?.message ?? 'The created member could not be loaded. Refresh the page before trying again.';
        setError(message);
        toast.error(`Failed to add member: ${message}`, { id: toastAttempt });
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

      toast.success('Household member added.', { id: toastAttempt });
      setProfileId('');
      setName('');
      setRelation('other');
      setRole('member');
      onClose();
      onChanged();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-1 sm:grid-cols-3`}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Resident (Head) *</span>
        <AdminSelect kind="people" className={inputClass} value={profileId} onValueChange={(nextValue) => setProfileId(nextValue)} required>
          <option value="">Select a resident…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Name *</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Relation</span>
        <AdminSelect kind="relation" className={inputClass} value={relation} onValueChange={(nextValue) => setRelation(nextValue)}>
          {RELATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </AdminSelect>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Role</span>
        <AdminSelect kind="memberRole" className={inputClass} value={role} onValueChange={(nextValue) => setRole(nextValue)}>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </AdminSelect>
      </label>
      {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting || !profileId || !name.trim()}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Adding…">Add Member</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
