'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/hooks/use-sign-out';

/** Shared by the drawer and direct page; switching never changes an account's role. */
export function RegistrationAccountNotice({ next, onClose }: { next: string; onClose?: () => void }) {
  const { signOut, pending } = useSignOut('local', next);
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Resident account required">
      <h2 className="text-lg font-semibold">Use your resident account</h2>
      <p className="text-sm text-muted-foreground">Sign in with your resident account to register for this medical drive. This account cannot make resident registrations.</p>
      <p className="text-sm text-muted-foreground">Continuing signs you out of this app, including its other browser tabs. After signing in, you’ll return to this drive.</p>
      <Button type="button" className="h-auto min-h-11 whitespace-normal px-4" loading={pending} loadingLabel="Signing out…" onClick={() => void signOut()}>Sign out and switch account</Button>
      {onClose ? <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Keep browsing</Button>
        : <Link className="text-center text-sm font-semibold underline" href="/health">Back to medical drives</Link>}
    </section>
  );
}
