'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HouseholdMember } from '@/hooks/use-family-members';

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'] as const;
const ROLES = ['Head of Family', 'Student', 'Employed', 'Unemployed', 'Retired', 'Minor'] as const;

/** Web port of family-member-modal.tsx (rebuilt on shadcn Dialog, matching the plan's
 * component-origin legend for family-member-modal). Handles both add and edit — `initial`
 * null means add.
 *
 * Save/remove contract (feedback plan RW-LT-05): `onSave` / `onDelete` return
 * Promise<boolean>, where true means the existing write succeeded. The dialog awaits the
 * callback, keeps its inputs and stays open on false or a rejection, and shows the
 * pending state until it settles. It never notifies: the consuming screen owns the single
 * terminal notification. Closing the dialog does not cancel the write; a result that
 * arrives after the dialog was closed or reopened for another member is ignored here. */
export function FamilyMemberDialog({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial: HouseholdMember | null;
  onClose: () => void;
  onSave: (member: { id?: string; name: string; relation: string; role: string }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<string>(RELATIONS[0]);
  const [role, setRole] = useState<string>(ROLES[0]);
  const [pending, setPending] = useState<'save' | 'remove' | null>(null);
  // Synchronous guard against repeated activation, and a counter that invalidates a
  // result belonging to an earlier opening of the dialog.
  const busyRef = useRef(false);
  const openingRef = useRef(0);

  useEffect(() => {
    openingRef.current += 1;
    busyRef.current = false;
    if (open) {
      // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
      // react-hooks/set-state-in-effect.
      Promise.resolve().then(() => {
        setName(initial?.name ?? '');
        setRelation(initial?.relation && (RELATIONS as readonly string[]).includes(initial.relation) ? initial.relation : RELATIONS[0]);
        setRole(initial?.role && (ROLES as readonly string[]).includes(initial.role) ? initial.role : ROLES[0]);
        setPending(null);
      });
    }
  }, [open, initial]);

  const isEdit = !!initial;

  async function run(kind: 'save' | 'remove', write: () => Promise<boolean>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(kind);
    const opening = openingRef.current;
    let ok = false;
    try {
      ok = await write();
    } catch {
      ok = false;
    }
    if (opening !== openingRef.current) return;
    busyRef.current = false;
    setPending(null);
    if (ok) onClose();
  }

  function handleSubmit() {
    if (!name.trim()) return;
    void run('save', () => onSave({ id: initial?.id, name: name.trim(), relation, role }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Family Member' : 'Add Family Member'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member-name">Full Name</Label>
            <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Relation</Label>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={relation === opt}
                  onClick={() => setRelation(opt)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${relation === opt ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={role === opt}
                  onClick={() => setRole(opt)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${role === opt ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={pending !== null}
              loading={pending === 'remove'}
              loadingLabel="Removing…"
              onClick={() => {
                if (initial?.id) {
                  const id = initial.id;
                  void run('remove', () => onDelete(id));
                }
              }}>
              Remove
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!name.trim() || pending === 'remove'}
            loading={pending === 'save'}
            loadingLabel={isEdit ? 'Updating…' : 'Adding…'}
            onClick={handleSubmit}>
            {isEdit ? 'Update' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
