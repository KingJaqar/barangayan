'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function PaymentConfirmedDialog({ open, onConfirm }: { open: boolean; onConfirm: () => void }) {
  return <Dialog open={open}>
    <DialogContent showCloseButton={false} onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
      <DialogTitle>Payment successful</DialogTitle>
      <DialogDescription>Your payment has been confirmed.</DialogDescription>
      <Button onClick={onConfirm}>OK</Button>
    </DialogContent>
  </Dialog>;
}
