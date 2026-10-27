'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { idVerificationState, residentProfileComplete } from '@barangayan/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { ProfileCompletionNotice, ResidentVerificationNotice } from './resident-action-notices';
import { RegistrationAccountNotice } from '@/components/health/registration-account-notice';

type Eligibility = { incomplete: boolean; unverified: boolean; driveAccountBlocked: boolean };

/** Mounted only for an open action sheet. A failed/unfinished check never mounts its form. */
export function ResidentActionGuard({ action, next, onClose, children }: {
  action: 'drive' | 'document' | 'report';
  next: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const [result, setResult] = useState<Eligibility | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    async function check() {
      setError(false);
      setResult(null);
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (!active) return;
        if (authError) throw authError;
        if (!user) {
          router.push(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        const { data: profile, error: profileError } = await client.from('profiles')
          .select('*').eq('id', user.id).abortSignal(controller.signal).maybeSingle();
        if (profileError || (action === 'drive' && !profile)) throw profileError ?? new Error('Account unavailable');
        if (active) setResult({
          driveAccountBlocked: action === 'drive' && (profile?.role !== 'resident' || !!profile?.deleted_at),
          // Retain the existing completion checks for documents and reports.
          incomplete: !residentProfileComplete(profile, { includeAdmin: true }),
          unverified: action === 'document' && idVerificationState(profile) !== 'verified',
        });
      } catch {
        if (active) setError(true);
      } finally {
        clearTimeout(timer);
      }
    }
    void Promise.resolve().then(() => { if (active) void check(); });
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [action, next, router, retry]);

  if (error) return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm">
      <p>We couldn&apos;t check your account. Check your connection, then try again.</p>
      <Button type="button" size="sm" onClick={() => setRetry(value => value + 1)}>Retry account check</Button>
    </div>
  );
  if (!result) return <LoadingStatus active label="Checking your account…" />;
  if (result.driveAccountBlocked) return <RegistrationAccountNotice next={next} onClose={onClose} />;
  if (!result.incomplete && !result.unverified) return children;

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/45" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[61] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg"
          onPointerDownOutside={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}>
          <Dialog.Title className="text-lg font-semibold">Before you continue</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {result.incomplete && result.unverified ? 'Complete your profile and verify your valid ID to request a document.'
              : result.unverified ? 'Verify your valid ID to request a document.'
                : `Complete your profile to ${action === 'drive' ? 'register for a medical drive' : action === 'report' ? 'submit an incident report' : 'request a document'}.`}
          </Dialog.Description>
          {result.incomplete ? <ProfileCompletionNotice actionLabel="Complete Profile" embedded /> : null}
          {result.unverified ? (
            <ResidentVerificationNotice message="Open Valid ID in Settings and have your ID verified before requesting a document." />
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
