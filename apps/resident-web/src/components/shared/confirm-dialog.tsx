'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}

/**
 * Built on the existing Dialog primitive rather than pulling in @radix-ui/react-alert-dialog
 * (not an installed dependency in this app — see the plan's §11 package.json, which lists
 * only @radix-ui/react-dialog/label/slot). Functionally the same "are you sure?" gate the
 * plan's Phase 3 cancel flows need (mirrors admin-web's ConfirmButton, migrated onto this
 * app's Dialog instead of a new Radix primitive).
 */
export function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm, destructive = true }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Never mind
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={handleConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
