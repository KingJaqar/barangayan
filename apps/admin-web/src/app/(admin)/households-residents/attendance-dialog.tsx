'use client';

import { useCallback, useState } from 'react';
import { TableDetailDialog } from '@/components/admin/table-detail-dialog';
import { AdminSelect } from '@/components/admin/dropdown/admin-select';
import { inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';
import { useHouseholdAttendance } from '@/hooks/use-household-attendance';
import { attendanceTime, personKey, prepareAttendanceOperation, type AttendanceOperation } from '@/lib/household-attendance';
import { FamilyQrCamera } from './family-qr-camera';

export function AttendanceDialog({ actorId, barangayId, initialProfileId, residents, optionsError, onClose, onIdentityLost, onChanged }: {
  actorId: string; barangayId: string; initialProfileId?: string;
  residents: { id: string; full_name: string }[]; optionsError: string | null;
  onClose: () => void; onIdentityLost: () => void; onChanged: () => void;
}) {
  const attendance = useHouseholdAttendance(actorId, barangayId, initialProfileId, onIdentityLost, onChanged);
  const load = attendance.load;
  const [centerId, setCenterId] = useState('');
  const [residentId, setResidentId] = useState('');
  const [camera, setCamera] = useState(false);
  const [reviewState, setReview] = useState<{ operation: AttendanceOperation; revision: number } | null>(null);
  const review = reviewState?.revision === attendance.revision ? reviewState.operation : null;
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const closeCamera = useCallback(() => setCamera(false), []);
  const decode = useCallback((raw: string) => { setCamera(false); setReview(null); setSelectionError(null); void load(raw); }, [load]);
  const locked = attendance.busy || !!attendance.pending || !!review;
  const center = attendance.centers.find(item => item.id === centerId);
  const household = attendance.household;

  function prepare(selected: string[], kind: 'check_in' | 'check_out') {
    if (!household) return;
    if (kind === 'check_in' && attendance.centersError) { setSelectionError('Refresh active centers before confirming an arrival.'); return; }
    try { setReview({ operation: prepareAttendanceOperation(household, selected, kind, center), revision: attendance.revision }); setSelectionError(null); }
    catch (cause) { setSelectionError(cause instanceof Error ? cause.message : 'Choose the people again.'); }
  }

  return <TableDetailDialog label="Family attendance" onClose={onClose}>
    <div className="ab-card max-h-[85vh] space-y-4 overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">Family attendance</h2>
        <button type="button" className={cancelButtonClass} onClick={onClose}>Close</button></div>
      <p>Confirm the household’s identity in person. Select only people physically present. Times are shown in Asia/Manila.</p>
      <label className="block">Arrival center
        <select className={inputClass} value={centerId} disabled={locked || camera || attendance.centersError}
          onChange={event => { setCenterId(event.target.value); setSelectionError(null); }}>
          <option value="">Choose an active center…</option>
          {attendance.centers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <p>Selected center: <strong>{center?.name ?? 'None — choose a center for arrivals'}</strong></p>
      {attendance.centersError && <p role="alert">Could not load active centers. Refresh to retry. Existing stays can still be checked out.</p>}
      {!attendance.busy && !attendance.centersError && !attendance.centers.length && <p>No active centers are available for arrivals. Existing stays can still be checked out.</p>}
      {camera ? <FamilyQrCamera onDecoded={decode} onClose={closeCamera} />
        : <button type="button" className={submitButtonClass} disabled={locked || !center} onClick={() => setCamera(true)}>Scan Family QR</button>}
      <fieldset disabled={locked || camera} className="space-y-2">
        <legend className="font-medium">Or select from the resident directory</legend>
        {optionsError ? <p role="alert">Resident options are unavailable. Close and refresh the page to retry.</p> : <>
          <label className="block">Resident (account holder)
            <AdminSelect kind="people" className={inputClass} value={residentId} onValueChange={setResidentId}>
              <option value="">Choose a resident…</option>
              {residents.map(resident => <option key={resident.id} value={resident.id}>{resident.full_name}</option>)}
            </AdminSelect>
          </label>
          <button type="button" className={cancelButtonClass} disabled={!residentId} onClick={() => decode(JSON.stringify({ type: 'household', version: '1.0', profileId: residentId }))}>Load household</button>
          {!residents.length && <p>No active residents are available in this barangay.</p>}
        </>}
      </fieldset>
      {attendance.busy && <p role="status">{attendance.pending ? 'Confirming attendance…' : 'Loading current attendance…'}</p>}
      {attendance.error && <p role="alert">{attendance.error}</p>}
      {selectionError && <p role="alert">{selectionError}</p>}
      {attendance.pending && !attendance.busy && <div className="space-y-2">
        <p>The original {attendance.pending.kind === 'check_in' ? 'arrival' : 'departure'} confirmation is unconfirmed. Selection is locked until its result is reconciled. Closing will discard the local retry; no write is replayed automatically.</p>
        <p>{attendance.pending.people.map(person => person.name).join(', ')}{attendance.pending.kind === 'check_in' ? ` at ${attendance.pending.centerName}` : ''}</p>
        <button type="button" className={submitButtonClass} onClick={() => { if (attendance.pending) void attendance.submit(attendance.pending); }}>Retry original confirmation</button>
      </div>}
      {attendance.receipt && <section aria-label="Confirmation receipt" role="status" className="space-y-1">
        <h3 className="font-semibold">{attendance.receipt.value.operation === 'check_in' ? 'Arrival' : 'Departure'} confirmed</h3>
        {attendance.receipt.value.stays.map(stay => {
          const person = attendance.receipt?.operation.people.find(item => item.memberId === stay.member_id);
          return <p key={stay.attendance_id}>{person?.name} — {person?.centerName}: {' '}
          {stay.outcome === 'created' ? 'Arrival recorded' : stay.outcome === 'already_active' ? 'Existing arrival preserved'
            : stay.outcome === 'closed' ? 'Departure recorded' : 'Existing departure preserved'}: {attendanceTime(stay.checked_out_at ?? stay.checked_in_at)}
        </p>; })}
        <p>This receipt acknowledges the original confirmation. Current attendance is shown separately below.</p>
      </section>}
      {attendance.stale && household && <p role="status">Attendance below is last known. Refresh to verify current status before a new confirmation.</p>}
      {household && <AttendancePeople key={attendance.revision} household={household} disabled={locked || attendance.stale || camera}
        onPrepare={prepare} />}
      {review && !attendance.pending && <section aria-label="Review attendance" className="space-y-3">
        <h3 className="font-semibold">Review {review.kind === 'check_in' ? 'arrival' : 'departure'}</h3>
        <p>{review.people.map(person => `${person.name} — ${person.centerName}`).join(', ')}{review.kind === 'check_in' ? ` → ${review.centerName}` : ' → check out their selected active stays'}</p>
        <button type="button" className={submitButtonClass} disabled={attendance.busy || attendance.stale}
          onClick={() => { setReview(null); void attendance.submit(review); }}>Confirm {review.kind === 'check_in' ? 'arrival' : 'departure'}</button>
        <button type="button" className={cancelButtonClass} onClick={() => setReview(null)}>Change selection</button>
      </section>}
      <button type="button" className={cancelButtonClass} disabled={attendance.busy || !!review || camera} onClick={() => void attendance.load()}>Refresh current attendance</button>
    </div>
  </TableDetailDialog>;
}

function AttendancePeople({ household, disabled, onPrepare }: {
  household: NonNullable<ReturnType<typeof useHouseholdAttendance>['household']>; disabled: boolean;
  onPrepare: (selected: string[], kind: 'check_in' | 'check_out') => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="font-semibold">{household.people.length} {household.people.length === 1 ? 'person' : 'people'} — choose who is present</legend>
    {household.people.map(person => <label key={personKey(person)} className="flex items-start gap-3 rounded-lg border border-current/15 p-3">
      <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={selected.includes(personKey(person))}
        onChange={event => setSelected(value => event.target.checked ? [...value, personKey(person)] : value.filter(key => key !== personKey(person)))} />
      <span className="min-w-0 break-words"><strong>{person.name}</strong> — {person.kind === 'holder' ? 'Account holder' : person.relation}
        <span className="block text-sm">{person.current_stay
          ? `${person.current_stay.center_name} · Arrived ${attendanceTime(person.current_stay.checked_in_at)}`
          : person.latest_departure?.checked_out_at ? `Last departure: ${person.latest_departure.center_name} · ${attendanceTime(person.latest_departure.checked_out_at)}`
            : 'No recorded check-in'}</span></span>
    </label>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={submitButtonClass} disabled={!selected.length} onClick={() => onPrepare(selected, 'check_in')}>Review arrival</button>
      <button type="button" className={cancelButtonClass} disabled={!selected.length} onClick={() => onPrepare(selected, 'check_out')}>Review departure</button>
    </div>
  </fieldset>;
}
