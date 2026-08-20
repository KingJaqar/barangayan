'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HouseholdMember } from '@/hooks/use-family-members';

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'] as const;
const ROLES = ['Head of Family', 'Student', 'Employed', 'Unemployed', 'Retired', 'Minor'] as const;

/** Web port of family-member-modal.tsx (rebuilt on shadcn Dialog, matching the plan's
 * component-origin legend for family-member-modal). Handles both add and edit — `initial`
 * null means add. */
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
  onSave: (member: { id?: string; name: string; relation: string; role: string }) => void;
  onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<string>(RELATIONS[0]);
  const [role, setRole] = useState<string>(ROLES[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
      // react-hooks/set-state-in-effect.
      Promise.resolve().then(() => {
        setName(initial?.name ?? '');
        setRelation(initial?.relation && (RELATIONS as readonly string[]).includes(initial.relation) ? initial.relation : RELATIONS[0]);
        setRole(initial?.role && (ROLES as readonly string[]).includes(initial.role) ? initial.role : ROLES[0]);
        setSubmitting(false);
      });
    }
  }, [open, initial]);

  const isEdit = !!initial;

  function handleSubmit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    onSave({ id: initial?.id, name: name.trim(), relation, role });
    setSubmitting(false);
    onClose();
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
              onClick={() => {
                if (initial?.id) onDelete(initial.id);
                onClose();
              }}>
              Remove
            </Button>
          ) : null}
          <Button type="button" disabled={!name.trim() || submitting} loading={submitting} onClick={handleSubmit}>
            {isEdit ? 'Update' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
