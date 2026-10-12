'use client';

import { ChevronRight, Plus, QrCode, RotateCw, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/shared/auth-gate';
import { FamilyMemberDialog } from '@/components/emergency/family-member-dialog';
import { HouseholdQrDialog } from '@/components/emergency/household-qr-dialog';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint, Skeleton } from '@/components/ui/loading';
import { useFamilyMembers, type HouseholdMember } from '@/hooks/use-family-members';
import { notifyHouseholdOutcome } from '@/lib/household-feedback';
import { beginAttempt } from '@/lib/notify';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Web port of family-content.tsx — household roster CRUD + "My QR Code". Uses
 * useFamilyMembers (jsonb-backed, see that hook's doc comment for why). Guests see
 * EmergencyAuthGate instead — see emergency/family/page.tsx's doc comment. */
export function FamilyContent({ profileId, residentName }: { profileId: string | null; residentName: string | null }) {
  const { members, isInitialLoading, isRefreshing, isReady, error, refetch, addMember, updateMember, removeMember, lastWriteFailure } =
    useFamilyMembers(profileId);
  const [showQr, setShowQr] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);

  if (!profileId) {
    return (
      <AuthGate
        title="Log In to Manage Your Household"
        description="Your family roster and QR check-in codes are tied to your account. Log in or create one to add family members."
        next="/emergency/family"
      />
    );
  }

  const householdName = residentName ? `${residentName.trim().split(' ').at(-1)} Family` : 'Your Household';

  // The dialog awaits these and keeps itself open (inputs retained) when they resolve
  // false; this screen owns the single terminal notification for each attempt.
  async function finish(action: 'add' | 'update' | 'remove', write: () => Promise<boolean>): Promise<boolean> {
    const attempt = beginAttempt(`household-${action}`);
    let ok = false;
    try {
      ok = await write();
    } catch {
      ok = false;
    }
    const failure = ok ? null : lastWriteFailure();
    notifyHouseholdOutcome(action, ok, failure, attempt);
    // A lost response may still have been applied: re-read (read-only) so the list shows
    // the truth. Never repeat the write.
    if (failure === 'unconfirmed') refetch();
    return ok;
  }

  function handleSave(input: { id?: string; name: string; relation: string; role: string }): Promise<boolean> {
    const { id } = input;
    return id
      ? finish('update', async () => (await updateMember(id, { name: input.name, relation: input.relation, role: input.role })) !== null)
      : finish('add', async () => (await addMember(input)) !== null);
  }

  function handleDelete(id: string): Promise<boolean> {
    return finish('remove', () => removeMember(id));
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div>
        <h1 className="text-lg font-bold">Household: {householdName}</h1>
        <p className="text-sm text-muted-foreground">View and manage your family members.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <QrCode size={20} strokeWidth={1.75} />
            </span>
            <p className="font-semibold">My QR Code</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowQr(true)}>
            Show My Code
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Present this QR code at evacuation centers for quick family check-in.</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Family Members</h2>
        <div className="flex items-center gap-3">
          {/* Quiet refresh hint: decorative, shown only after 120 ms, never announced. */}
          <PendingHint pending={isRefreshing} className="gap-1.5 text-xs text-muted-foreground">
            <RotateCw size={12} className="rw-spinner" /> Updating
          </PendingHint>
          {isReady ? <span className="text-xs font-medium text-muted-foreground">{members.length} Total</span> : null}
        </div>
      </div>

      {isReady && error ? (
        <InlineReadError
          tone="warning"
          message="Couldn't update your household list. Showing the last loaded list, which may be out of date."
          onRetry={refetch}
          retrying={isRefreshing}
        />
      ) : null}

      {isInitialLoading ? (
        <div aria-busy className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-xl" />
          ))}
        </div>
      ) : !isReady ? (
        <InlineReadError message="We couldn't load your household members. Check your connection, then try again." onRetry={refetch} />
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-4 py-10">
          <Users size={36} className="text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No family members added yet.</p>
          <Button
            type="button"
            onClick={() => {
              setEditingMember(null);
              setShowMemberDialog(true);
            }}>
            <Plus size={16} /> Add Family Member
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setEditingMember(member);
                setShowMemberDialog(true);
              }}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                  {getInitials(member.name)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{member.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{member.relation}</span>
                    {member.role ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{member.role}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <LoadingStatus active={isInitialLoading} label="Loading family members…" />

      {isReady && members.length > 0 ? (
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setEditingMember(null);
            setShowMemberDialog(true);
          }}>
          <Plus size={18} /> Add Family Member
        </Button>
      ) : null}

      <FamilyMemberDialog
        open={showMemberDialog}
        initial={editingMember}
        onClose={() => {
          setShowMemberDialog(false);
          setEditingMember(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <HouseholdQrDialog open={showQr} onClose={() => setShowQr(false)} profileId={profileId} residentName={residentName ?? 'Your Household'} />
    </div>
  );
}
