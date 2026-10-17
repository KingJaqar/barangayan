'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { RecordArchiveLink, useRecordWorkspace } from '@/components/admin/record-workspace';

import {
  EMPLOYMENT_STATUSES,
  SEXES,
  type Database,
  type EmploymentStatus,
  type IdVerificationStatus,
  type Sex,
} from '@barangayan/shared';
import { useEffect, useId, useMemo, useState } from 'react';
import { FileCheck2, History, Mail, MapPin, Phone, UserRound, Users } from 'lucide-react';
import styles from '@/components/admin/resident-record.module.css';

import { ProfileTableSummary } from '@/components/admin/profile-table-summary';
import { ProfileTablePanel } from '@/components/admin/profile-table-panel';
import { SegmentedFilter } from '@/components/admin/segmented-filter';
import { useConfiguredTableBrowse } from '@/hooks/use-pilot-table-browse';
import { formatAdminTimestamp } from '@/lib/admin-tables/pilot-config';
import { PROFILE_TABLE_CONFIGS } from '@/lib/admin-tables/profile-config';
import type { BrowseResult, BrowseState } from '@/lib/admin-tables/browse-state';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { EditableDataTable, type EditableDataTableColumn } from '@/components/admin/editable-data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { ResidentRow } from './types';
import { TABS } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { ResidentIdReview, ResidentIdStatusCell, idStatusLabel } from './resident-id-review';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

type ServiceRequest = {
  id: string;
  reference_number: string;
  status: string;
  created_at: string;
  document_types: { name: string } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function verificationColor(status: string) {
  if (status === 'verified') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
  if (status === 'pending') return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30';
  if (status === 'unverified') return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
  return 'text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800';
}

// ─── Add Resident Form ─────────────────────────────────────────────────────────

function AddResidentForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobile] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/admin/residents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), mobileNumber, homeAddress }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      toast.showError(`Failed to add resident: ${body.error ?? 'Unknown error'}`);
      return;
    }

    toast.showSuccess(`Invite sent to ${email.trim()}.`);
    setEmail('');
    setFullName('');
    setMobile('');
    setHomeAddress('');
    onClose();
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} grid-cols-1 sm:grid-cols-2`}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Email *</span>
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Full Name *</span>
        <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Mobile Number</span>
        <input className={inputClass} value={mobileNumber} onChange={(e) => setMobile(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Home Address</span>
        <input className={inputClass} value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
      </label>
      <p className="col-span-1 text-xs text-zinc-500 sm:col-span-2">
        The resident receives an email invite to set their own password — no password is ever stored here.
      </p>
      <div className="col-span-1 flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting || !email.trim() || !fullName.trim()}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Sending invite…">Send Invite</LoadingButtonContent>
        </button>
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Resident Detail Modal ─────────────────────────────────────────────────────

export function ResidentDetailContent({
  resident,
  onIdStatusChange,
}: {
  resident: ResidentRow | null;
  onClose: () => void;
  onIdStatusChange?: (id: string, status: IdVerificationStatus | null) => void;
}) {
  const sectionId = useId();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [idStatus, setIdStatus] = useState(resident?.id_verification_status ?? null);
  // Reset the panel's per-resident state the moment a different resident (or none) is
  // selected, so the previous resident's requests/photos never flash in the new panel.
  // Adjusting state during render is React's recommended way to do this.
  const [prevResidentId, setPrevResidentId] = useState(resident?.id ?? null);
  if (prevResidentId !== (resident?.id ?? null)) {
    setPrevResidentId(resident?.id ?? null);
    setRequests(null);
    setIdStatus(resident?.id_verification_status ?? null);
  }

  useEffect(() => {
    if (!resident) return;
    let cancelled = false;

    // Service request history
    supabase
      .from('service_requests')
      .select('id, reference_number, status, created_at, document_types(name)')
      .eq('resident_id', resident.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setRequests((data as unknown as ServiceRequest[]) ?? []); });

    return () => { cancelled = true; };
  }, [resident, supabase]);

  if (!resident) return null;

  const verStatus = resident.email_verification_status;
  const members = resident.household_members ?? [];

  return (
      <div
        className={styles.profile}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Resident overview */}
        <div className={styles.identity}>
          <div className={styles.identityMain}>
            {/* Avatar */}
            {resident.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resident.avatar_url}
                alt={resident.full_name}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatar}>
                {resident.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 break-words">
              <p className={styles.eyebrow}>Resident overview</p>
              <h2 className={styles.name}>{resident.full_name}</h2>
              <p className={styles.contact}><Mail size={14} aria-hidden="true" />{resident.email ?? 'No email on file'}</p>
              <p className={styles.contact}><Phone size={14} aria-hidden="true" />{resident.mobile_number ?? 'No mobile number'}</p>
            </div>
          </div>
          <div className={styles.badges}>
            <span className={styles.badge}>Email · {verStatus}</span>
            <span className={styles.badge}>{idStatusLabel(idStatus)}</span>
            {resident.location_verified === false && (
              <span
                title="This resident's device location at signup fell outside the barangay boundary. Soft flag only — did not block registration."
                className={styles.badge}>
                ⚠ Location Outside Boundary
              </span>
            )}
          </div>
        </div>

        <nav className={styles.navigation} aria-label="Resident record sections">
          <a href={`#${sectionId}-personal`}><UserRound size={14} aria-hidden="true" />Overview</a>
          <a href={`#${sectionId}-household`}><Users size={14} aria-hidden="true" />Household</a>
          <a href={`#${sectionId}-verification`}><FileCheck2 size={14} aria-hidden="true" />ID review</a>
          <a href={`#${sectionId}-history`}><History size={14} aria-hidden="true" />History</a>
        </nav>
        <div className={styles.sections}>
          {/* Personal details */}
          <section id={`${sectionId}-personal`} className={styles.section}>
            <h3 className={styles.sectionHeading}><UserRound size={16} aria-hidden="true" />Personal details</h3>
            <dl className={styles.details}>
              <div>
                <dt className={styles.muted}>Address</dt>
                <dd className="font-medium">{resident.home_address ?? '—'}</dd>
              </div>
              <div>
                <dt className={styles.muted}>Birthday</dt>
                <dd className="font-medium">{fmtDate(resident.birth_date)}</dd>
              </div>
              <div className="col-span-2">
                <dt><MapPin size={13} aria-hidden="true" />Verified location · Settings</dt>
                <dd className="font-medium">
                  {resident.verified_location ? (
                    <>
                      {resident.verified_location_address ?? 'Verified (no address on file)'}
                      <span className={styles.coordinates}>
                        {(resident.verified_location as { lat: number; lng: number }).lat.toFixed(5)},{' '}
                        {(resident.verified_location as { lat: number; lng: number }).lng.toFixed(5)}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div><dt>Sex</dt><dd>{resident.sex ? SEX_LABELS[resident.sex as Sex] ?? resident.sex : '—'}</dd></div>
              <div><dt>Employment status</dt><dd>{resident.employment_status ? EMPLOYMENT_STATUS_LABELS[resident.employment_status as EmploymentStatus] ?? resident.employment_status : '—'}</dd></div>
              <div><dt>Occupation</dt><dd>{resident.occupation ?? '—'}</dd></div>
              <div>
                <dt className={styles.muted}>ID Type</dt>
                <dd className="font-medium">{resident.id_type ?? '—'}</dd>
              </div>
              <div>
                <dt className={styles.muted}>Joined</dt>
                <dd className="font-medium">{formatAdminTimestamp(resident.created_at)}</dd>
              </div>
            </dl>
          </section>

          {/* Household members */}
          <section id={`${sectionId}-household`} className={styles.section}>
            <h3 className={styles.sectionHeading}><Users size={16} aria-hidden="true" />Household members <span>{members.length}</span></h3>
            {members.length === 0 ? (
              <p className={styles.empty}>No household members recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div key={m.id} className={styles.listRow}>
                    <div className={styles.memberAvatar}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-zinc-500">
                        {m.relation} · {m.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <ResidentIdReview key={resident.id} resident={resident} sectionId={sectionId}
            onStatusChange={(id, status) => { setIdStatus(status); onIdStatusChange?.(id, status); }} />

          {/* Service request history */}
          <section id={`${sectionId}-history`} className={styles.section}>
            <h3 className={styles.sectionHeading}><History size={16} aria-hidden="true" />Request history</h3>
            {requests === null ? (
              <p className={styles.empty}>Loading…</p>
            ) : requests.length === 0 ? (
              <p className={styles.empty}>No service requests yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className={styles.listRow}
                  >
                    <div>
                      <p className="font-medium">{r.document_types?.name ?? 'Document Request'}</p>
                      <p className="text-xs text-zinc-500">
                        #{r.reference_number} · {formatAdminTimestamp(r.created_at)}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
  );
}

// Sex / Employment Status labels (mirrors resident/profile/profile-form.tsx and the
// mobile Profile screen — kept local to each app rather than shared, same convention
// those two already follow).
const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};

const SEX_OPTIONS = [{ label: '—', value: '' }, ...SEXES.map((s) => ({ label: SEX_LABELS[s], value: s }))];

const EMPLOYMENT_STATUS_OPTIONS = [
  { label: '—', value: '' },
  ...EMPLOYMENT_STATUSES.map((s) => ({ label: EMPLOYMENT_STATUS_LABELS[s], value: s })),
];

// ─── Main Component ────────────────────────────────────────────────────────────

export function ResidentDirectory({ result, summary, requestedState, barangayId }: {
  result: QueryOutcome<BrowseResult<ResidentRow>>; summary: QueryOutcome<Summary>; requestedState: BrowseState;
  barangayId: string;
}) {
  const browse = useConfiguredTableBrowse(PROFILE_TABLE_CONFIGS.residents, requestedState, result, true);
  const { state, value } = browse;
  const activeSort = browse.config.sorts.find(sort => sort.key === state.sort)!;
  const [addOpen, setAddOpen] = useState(false);

  const supabase = createSupabaseBrowserClient();

  async function updateField(r: ResidentRow, patch: ProfileUpdate) {
    const rRecord = r as unknown as Record<string, unknown>;
    const patchRecord = patch as Record<string, unknown>;
    const isNoop = Object.keys(patch).every((key) => rRecord[key] === patchRecord[key]);

    if (isNoop) return { error: null };

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', r.id)
      .select('id, full_name, updated_at')
      .maybeSingle();
    if (error) {
      return { error: error.message };
    }
    if (!updated) {
      return { error: 'No resident was updated. Check that you still have access to this barangay.' };
    }
    logAdminAction({
      action: patch.id_verification_status !== undefined ? 'status_change' : 'update',
      entityType: 'resident',
      entityId: updated.id,
      entityLabel: updated.full_name,
      changes: {
        before: Object.fromEntries(Object.keys(patch).map((key) => [key, rRecord[key]])),
        after: patch,
      },
    }).catch(() => {});
    browse.refresh();
    return { error: null, row: updated };
  }

  const lifecycle = useRecordWorkspace<ResidentRow>('residents', browse.refresh, browse.settle, { editHandle: browse.editHandle, extra: (row, close) => <ResidentDetailContent resident={row} onClose={close} onIdStatusChange={browse.refresh} /> });

  const columns: EditableDataTableColumn<ResidentRow>[] = [
    {
      id: 'first_name', header: 'First Name', initialWidth: 180, minWidth: 150, wrap: 'break-word',
      render: (r) => <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{r.full_name.charAt(0).toUpperCase()}</span><span className="font-medium">{r.first_name ?? '—'}</span></div>,
      edit: { type: 'text', getValue: (r) => r.first_name ?? '', onSave: (r, value) => updateField(r, { first_name: String(value).trim() || null }) },
    },
    { id: 'last_name', header: 'Last Name', initialWidth: 140, minWidth: 118, wrap: 'break-word', render: (r) => r.last_name ?? '—', edit: { type: 'text', getValue: (r) => r.last_name ?? '', onSave: (r, value) => updateField(r, { last_name: String(value).trim() || null }) } },
    { id: 'middle_name', header: 'Middle Name', initialWidth: 140, minWidth: 118, wrap: 'break-word', render: (r) => r.middle_name ?? '—', edit: { type: 'text', getValue: (r) => r.middle_name ?? '', onSave: (r, value) => updateField(r, { middle_name: String(value).trim() || null }) } },
    { id: 'suffix', header: 'Suffix', initialWidth: 90, minWidth: 78, wrap: 'nowrap', render: (r) => r.suffix ?? '—', edit: { type: 'text', getValue: (r) => r.suffix ?? '', onSave: (r, value) => updateField(r, { suffix: String(value).trim() || null }) } },
    { id: 'sex', header: 'Sex', initialWidth: 160, minWidth: 156, wrap: 'nowrap', render: (r) => r.sex ? (SEX_LABELS[r.sex as Sex] ?? r.sex) : '—', edit: { type: 'select', selectKind: 'sex', options: SEX_OPTIONS, getValue: (r) => r.sex ?? '', onSave: (r, value) => updateField(r, { sex: String(value) || null }), commitOnChange: true } },
    { id: 'email', header: 'Email', frozen: true, initialWidth: 220, minWidth: 170, wrap: 'break-word', render: (r) => <span className="text-zinc-600 dark:text-zinc-400">{r.email ?? '—'}</span>, edit: { type: 'text', getValue: (r) => r.email ?? '', onSave: (r, value) => updateField(r, { email: String(value).trim() || null }) } },
    { id: 'mobile', header: 'Mobile', initialWidth: 142, minWidth: 124, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{r.mobile_number ?? '—'}</span>, edit: { type: 'text', getValue: (r) => r.mobile_number ?? '', onSave: (r, value) => updateField(r, { mobile_number: String(value).trim() || null }) } },
    { id: 'house_no_', header: 'House No.', initialWidth: 110, minWidth: 92, wrap: 'nowrap', render: (r) => r.house_no ?? '—', edit: { type: 'text', getValue: (r) => r.house_no ?? '', onSave: (r, value) => updateField(r, { house_no: String(value).trim() || null }) } },
    { id: 'street', header: 'Street', initialWidth: 180, minWidth: 140, wrap: 'break-word', render: (r) => r.street ?? '—', edit: { type: 'text', getValue: (r) => r.street ?? '', onSave: (r, value) => updateField(r, { street: String(value).trim() || null }) } },
    { id: 'city', header: 'City', initialWidth: 140, minWidth: 112, wrap: 'break-word', render: (r) => r.city ?? '—', edit: { type: 'text', getValue: r => r.city ?? '', onSave: (r, value) => updateField(r, { city: String(value).trim() || null }) } },
    { id: 'birthday', header: 'Birthday', initialWidth: 130, minWidth: 118, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{fmtDate(r.birth_date)}</span>, edit: { type: 'date', getValue: (r) => r.birth_date ?? '', onSave: (r, value) => updateField(r, { birth_date: String(value) || null }) } },
    { id: 'employment_status', header: 'Employment Status', initialWidth: 170, minWidth: 142, wrap: 'nowrap', render: (r) => r.employment_status ? (EMPLOYMENT_STATUS_LABELS[r.employment_status as EmploymentStatus] ?? r.employment_status) : '—', edit: { type: 'select', selectKind: 'employment', options: EMPLOYMENT_STATUS_OPTIONS, getValue: (r) => r.employment_status ?? '', onSave: (r, value) => updateField(r, { employment_status: String(value) || null }), commitOnChange: true } },
    { id: 'occupation', header: 'Occupation', initialWidth: 170, minWidth: 135, wrap: 'break-word', render: (r) => r.occupation ?? '—', edit: { type: 'text', getValue: (r) => r.occupation ?? '', onSave: (r, value) => updateField(r, { occupation: String(value).trim() || null }) } },
    { id: 'id_type', header: 'ID Type', initialWidth: 150, minWidth: 120, wrap: 'nowrap', render: (r) => r.id_type ?? '—' },
    { id: 'id_status', header: 'ID Status', initialWidth: 180, minWidth: 150, wrap: 'nowrap', render: (r) => <ResidentIdStatusCell resident={r} onStatusChange={browse.refresh} /> },
    { id: 'household', header: 'Household', initialWidth: 100, minWidth: 88, wrap: 'nowrap', render: (r) => <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{r.household_members?.length ?? 0}</span> },
    { id: 'email_verification', header: 'Email Verif.', initialWidth: 135, minWidth: 116, wrap: 'nowrap', render: (r) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${verificationColor(r.email_verification_status)}`}>{r.email_verification_status}</span> },
    { id: 'location_verified', header: 'Location Verified', initialWidth: 230, minWidth: 175, wrap: 'break-word', render: (r) => r.verified_location ? <span className="text-green-700 dark:text-green-400">{r.verified_location_address ?? 'Verified (no address on file)'}</span> : <span className="text-zinc-400">Not verified</span> },
    { id: 'joined', header: 'Joined', initialWidth: 176, minWidth: 156, wrap: 'nowrap', render: (r) => <span className="tabular-nums text-zinc-500">{formatAdminTimestamp(r.created_at)}</span> },
    lifecycle.column,
  ];

  return <div  className="min-w-0">
    <RecordArchiveLink name="residents" beforeOpen={browse.settle} />
    <ProfileTableSummary name="residents" summary={summary} onRetry={browse.refresh} />

    {addOpen && <fieldset disabled={browse.pending}><AddResidentForm onCreated={browse.refresh} onClose={() => setAddOpen(false)} /></fieldset>}
    <ProfileTablePanel label="Resident Directory" browse={browse}
      category={<label className="table-browse-field">ID presence <AdminSelect kind="idPresence" aria-label="ID presence" value={state.filters.verification} onValueChange={nextValue => void browse.commit({ filters: { verification: nextValue } })}>
        <option value="">All ID status</option><option value="with_id">With uploaded ID</option><option value="without_id">Without uploaded ID</option>
      </AdminSelect></label>}
      filters={<SegmentedFilter label="Resident verification" value={state.filters.tab}
        options={TABS.map(tab => ({ value: tab.key, label: tab.label }))} onChange={tab => void browse.commit({ filters: { tab } })} />}
      actions={!addOpen && <button type="button" disabled={browse.pending || !barangayId}
        onClick={() => void browse.settle().then(saved => { if (saved) setAddOpen(true); })}>+ Add Resident</button>}>
      <EditableDataTable contextMenuColumnId="actions" rows={value?.rows ?? []} columns={columns} rowKey={row => row.id}
        editHandleRef={browse.editHandle} onEditingChange={browse.onEditingChange}
        sorting={{ descriptor: activeSort, direction: state.dir, choices: browse.config.sorts, onChange: (sort, dir) => void browse.commit({ sort, dir }) }}
        onRowClick={row => lifecycle.open(row)} emptyLabel={browse.pending ? 'Updating results…' : 'No residents found.'}
        resizableColumns density="compact" tableMinWidth={2840} cellOverflow="hidden" />
    </ProfileTablePanel>
    {lifecycle.view}

  </div>;
}
