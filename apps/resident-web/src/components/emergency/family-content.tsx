'use client';

import { ChevronRight, Plus, QrCode, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HouseholdAttendance } from '@barangayan/shared';
import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/shared/auth-gate';
import { FamilyMemberDialog } from '@/components/emergency/family-member-dialog';
import { HouseholdQrDialog } from '@/components/emergency/household-qr-dialog';
import { EmergencyPageHeader } from '@/components/emergency/emergency-page-header';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { useFamilyMembers, type HouseholdMember } from '@/hooks/use-family-members';
import { notifyHouseholdOutcome } from '@/lib/household-feedback';
import { householdTime } from '@/lib/household';
import { beginAttempt } from '@/lib/notify';
import styles from './emergency.module.css';

function AttendanceStatus({ person, unavailable }: { person: HouseholdAttendance['people'][number] | undefined; unavailable: boolean }) {
  const stay = person?.current_stay;
  const departure = person?.latest_departure;
  return <p className="mt-2 text-xs text-foreground" data-household-attendance>
    {!person ? 'Attendance unavailable. Refresh to try again.' : stay
      ? `Checked in at ${stay.center_name} · Arrived ${householdTime(stay.checked_in_at)}`
      : departure?.checked_out_at
        ? `Last departure from ${departure.center_name} · ${householdTime(departure.checked_out_at)}` : 'No recorded check-in'}
    {person && unavailable ? ' · Last known status' : ''}
  </p>;
}

export function FamilyContent(props: { profileId: string | null; residentName: string | null; accountUnavailable?: boolean }) {
  if (!props.profileId) return <AuthGate title="Log In to Manage Your Household"
    description="Log in or create an account to manage your family list and show staff your Family QR." next="/emergency/family" />;
  if (props.accountUnavailable) return <p role="alert">An active resident profile is required. Complete your account setup or sign in with your resident account.</p>;
  return <ResidentFamily key={props.profileId} profileId={props.profileId} residentName={props.residentName} />;
}

function ResidentFamily({ profileId, residentName }: { profileId: string; residentName: string | null }) {
  const family = useFamilyMembers(profileId, true);
  const { members, isInitialLoading, isRefreshing, isReady, error, errorAnnounced, refetch,
    addMember, updateMember, removeMember, lastWriteFailure, attendance, attendanceError, canEdit, privateHidden, writeMessage, beginEdit, sessionVersion } = family;
  const [showQr, setShowQr] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  useEffect(() => {
    void Promise.resolve().then(() => { setShowQr(false); setShowMemberDialog(false); setEditingMember(null); });
  }, [privateHidden, sessionVersion]);
  if (privateHidden) return <p role="alert">Your session or account changed. Sign in again or refresh this page to load your household.</p>;

  async function finish(action: 'add' | 'update' | 'remove', write: () => Promise<boolean>) {
    const attempt = beginAttempt(`household-${action}`);
    const ok = await write();
    notifyHouseholdOutcome(action, ok, ok ? null : lastWriteFailure(), attempt);
    if (ok) refetch();
    return ok;
  }
  function handleSave(input: { id?: string; name: string; relation: string; role: string }) {
    const { id, ...updates } = input;
    return id ? finish('update', async () => (await updateMember(id, updates)) !== null)
      : finish('add', async () => (await addMember(updates)) !== null);
  }
  const handleDelete = (id: string) => finish('remove', () => removeMember(id));
  const stale = attendanceError || !!error || isRefreshing;
  const holder = attendance?.people.find(person => person.kind === 'holder');
  return (
    <div className={styles.content}>
      <EmergencyPageHeader title={isReady && residentName ? `Household: ${residentName.trim().split(' ').at(-1)} Family` : 'Your Household'} />
      <section className={styles.qrCard}>
        <div className={styles.qrCopy}>
          <span className={styles.qrIcon}><QrCode size={28} strokeWidth={1.5} /></span>
          <div><h2>My QR Code</h2><p className={styles.sectionDescription}>Show staff this Family QR and confirm who is present.</p></div>
        </div>
        <Button type="button" variant="outline" className={styles.secondaryButton} disabled={!isReady || !!error}
          onClick={() => setShowQr(true)}>Show My Code <QrCode size={16} aria-hidden /></Button>
      </section>
      <div className={styles.toolbar}>
        <h2 className="text-base font-bold">Family Members</h2>
        <div className="flex flex-wrap items-center gap-3">
          <PendingHint pending={isRefreshing} className="gap-1.5 text-xs text-muted-foreground"><RotateCw size={12} className="rw-spinner" /> Updating</PendingHint>
          {isReady ? <span className={styles.count}>{members.length + 1} {members.length ? 'people' : 'person'}</span> : null}
          <Button type="button" size="sm" variant="outline" disabled={isRefreshing} onClick={() => refetch('household')} aria-label="Refresh household"><RotateCw size={14} /></Button>
        </div>
      </div>
      {isReady && error ? <InlineReadError announce={!errorAnnounced} tone="warning"
        message="Could not refresh your household. Showing the last verified list and attendance. Editing is paused until a successful refresh."
        onRetry={() => refetch('household')} retrying={isRefreshing} /> : null}
      {isReady && attendanceError && !error ? <InlineReadError tone="warning" message="Could not update attendance. Any displayed status is last known."
        onRetry={() => refetch('attendance')} retrying={isRefreshing} /> : null}
      {writeMessage ? <p role="status" className="text-sm text-muted-foreground">{writeMessage}</p> : null}
      {isInitialLoading ? <div aria-busy><Skeleton className="h-[68px] rounded-xl" /></div>
        : !isReady ? <InlineReadError announce={!errorAnnounced} message="We couldn't load your household members. Check your connection and resident account, then try again."
          onRetry={() => refetch('household members')} /> : (
          <div className={styles.memberGrid}>
            <div className={styles.member}>
              <div className={styles.memberCopy}><div>
                <p className={styles.memberName}>{holder?.name ?? residentName ?? 'Account holder'}</p>
                <p className="text-xs text-muted-foreground">Account holder · Edit details in Settings &gt; Profile</p>
                <AttendanceStatus person={holder} unavailable={stale} />
              </div></div>
            </div>
            {members.map(member => <button key={member.id} type="button" disabled={!canEdit}
              onClick={() => { beginEdit(); setEditingMember(member); setShowMemberDialog(true); }} className={styles.member}>
              <div className={styles.memberCopy}><div>
                <p className={styles.memberName}>{member.name}</p>
                <p className="text-xs text-muted-foreground">{[member.relation, member.role].filter(Boolean).join(' · ')}</p>
                <AttendanceStatus person={attendance?.people.find(person => person.member_id === member.id)} unavailable={stale} />
              </div></div><ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </button>)}
          </div>
        )}
      <LoadingStatus active={isInitialLoading} label="Loading family members…" />
      {isReady ? <Button type="button" disabled={!canEdit || members.length >= 30} className={`${styles.primaryButton} ${styles.addMember}`}
        onClick={() => { beginEdit(); setEditingMember(null); setShowMemberDialog(true); }}><Plus size={18} /> Add Family Member</Button> : null}
      {members.length >= 30 ? <p className="text-sm text-muted-foreground">A household can have up to 30 additional members.</p> : null}
      <FamilyMemberDialog open={showMemberDialog} initial={editingMember} disabled={!canEdit} message={writeMessage}
        onClose={() => { setShowMemberDialog(false); setEditingMember(null); }} onSave={handleSave} onDelete={handleDelete} />
      {showQr && isReady && !error ? <HouseholdQrDialog onClose={() => setShowQr(false)} profileId={profileId} residentName={residentName ?? 'Your Household'} /> : null}
    </div>
  );
}
