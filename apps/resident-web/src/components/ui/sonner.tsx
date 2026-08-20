'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Replaces admin-web's hand-rolled ToastProvider/useToast (components/ui/toast.tsx) —
 * resident-web uses sonner directly, per the plan's §1 design-system decision. Call
 * `toast.success(...)` / `toast.error(...)` from 'sonner' anywhere in a Client Component. */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            'group toast rounded-xl border border-border bg-card text-card-foreground shadow-lg',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
