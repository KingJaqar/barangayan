'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { needsResidentProfile, residentCompletionDestination } from '@barangayan/shared';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading';
import { drawerTransition } from '@/lib/motion';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { beginAttempt, notify } from '@/lib/notify';
import { DetailsStep } from './details-step';
import { RequestFormStep } from './request-form-step';
import { RequestPaymentJourney } from '../request-payment-journey';
import type { DocumentType } from './types';

const STAGE_LABELS = ['Details', 'Request', 'Payment', 'Confirm'];

// PostgREST's `.single()` code for zero rows.
const NO_ROW = 'PGRST116';

/**
 * Settled read for one document id. `unavailable` is a missing or inactive service;
 * `error` is a returned error or thrown failure, which is worth retrying.
 */
type ServiceRead =
  | { id: string; status: 'ready'; doc: DocumentType }
  | { id: string; status: 'unavailable' }
  | { id: string; status: 'error' };

export function DocumentRequestModal({
  documentId,
  open,
  isAuthenticated,
  onClose,
  onOpenAnimationComplete,
}: {
  documentId: string | null;
  open: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onOpenAnimationComplete?: () => void;
}) {
  const router = useRouter();
  const checkingProfile = useRef(false);
  const profileScope = useRef(0);
  const [read, setRead] = useState<ServiceRead | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'form' | 'payment'>('details');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const currentScope = profileScope;
    const scope = ++currentScope.current;
    void Promise.resolve().then(() => { if (scope === currentScope.current) setRequesting(false); });
    return () => { ++currentScope.current; };
  }, [documentId, open]);

  // Only a read for the currently selected document is shown, so switching documents goes
  // straight to the loading state instead of flashing the previous service.
  const current = read && read.id === documentId ? read : null;
  const doc = current?.status === 'ready' ? current.doc : null;
  const pending = open && documentId !== null && current === null;

  async function requestDocument() {
    if (!doc || checkingProfile.current) return;
    checkingProfile.current = true;
    const attempt = beginAttempt('request-account-check');
    const scope = profileScope.current;
    setRequesting(true);
    setRequestError(null);
    try {
      const client = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw new Error('Unable to check your account. Please retry.');
      if (scope !== profileScope.current) return;
      const destination = `/services/requests/new/${doc.id}`;
      if (!user) {
        onClose();
        router.push(`/login?next=${encodeURIComponent(destination)}`);
      } else {
        const incomplete = await needsResidentProfile(client, user.id);
        if (scope !== profileScope.current) return;
        if (incomplete) {
          onClose();
          router.push(residentCompletionDestination(destination));
        } else setStep('form');
      }
    } catch {
      if (scope !== profileScope.current) return;
      setRequestError('Unable to check your account. Please retry.');
      notify.error("Couldn't check your account. Please try again.", { id: attempt });
    } finally {
      checkingProfile.current = false;
      if (scope === profileScope.current) setRequesting(false);
    }
  }

  // A different document starts from its details; never carry a request/payment step over.
  useEffect(() => {
    let active = true;
    // Microtask-wrapped (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (!active) return;
      setStep('details');
      setRequestId(null);
      setRequestError(null);
    });
    return () => {
      active = false;
    };
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    // `active` drops the response of a selection the resident has already moved away from
    // (or closed), so an older request can never replace the current one.
    let active = true;
    const id = documentId;
    const settle = (next: ServiceRead) => {
      if (!active) return;
      // A failed re-read keeps the service that is already on screen for this document.
      setRead((previous) => (next.status === "error" && previous?.id === id && previous.status === "ready" ? previous : next));
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      // Only a settled failure restarts from loading; a ready service stays visible
      // while it is re-read.
      setRead((previous) => (previous?.id === id && previous.status !== "ready" ? null : previous));
      createSupabaseBrowserClient()
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single()
        .then(
          ({ data, error }) => {
            if (data) settle({ id, status: 'ready', doc: data });
            else if (!error || error.code === NO_ROW) settle({ id, status: 'unavailable' });
            else settle({ id, status: 'error' });
          },
          () => settle({ id, status: 'error' }),
        );
    });
    return () => {
      active = false;
    };
  }, [documentId, retry]);

  const stage = step === 'details' ? 0 : step === 'form' ? 1 : 2;
  const stepLabel = step === 'details' ? 'Requirements and Guidelines' : step === 'form' ? 'Request Document' : 'Payment';

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            {/* No Overlay: the background catalog stays fully lit and interactive while
                the panel is open — clicking another card just swaps its content. Same
                shell, slide and tokens as services/requests/request-drawer.tsx. */}
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}>
              <motion.div
                className="pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 sm:max-w-xl md:max-w-2xl"
                initial={{ x: '100%' }}
                animate={{ x: 0, transition: drawerTransition.enter }}
                exit={{ x: '100%', transition: drawerTransition.exit }}
                onAnimationComplete={(definition) => {
                  // Lets the catalog grid collapse to one column only after the panel has
                  // finished sliding in, so the two motions never compete.
                  if ((definition as { x?: number })?.x === 0) onOpenAnimationComplete?.();
                }}>
                <div className="flex shrink-0 flex-col gap-3 border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between gap-3">
                    <DialogPrimitive.Title className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                      <FileText size={14} className="shrink-0" /> {stepLabel}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      Requirements, request and confirmed payment for your document.
                    </DialogPrimitive.Description>
                    <DialogPrimitive.Close className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                      <X size={18} />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                  <div aria-hidden className="flex items-center gap-1.5">
                    {STAGE_LABELS.map((label, i) => (
                      <span key={label} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stage ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-6">
            {current?.status === 'error' ? (
              <div role="alert" data-slot="service-read-error" className="flex flex-col items-start gap-3 text-sm">
                <p>We couldn&apos;t load this service. Check your connection, then try again.</p>
                <Button type="button" size="sm" onClick={() => setRetry((value) => value + 1)}>
                  Retry loading service
                </Button>
              </div>
            ) : current?.status === 'unavailable' ? (
              <div role="alert" data-slot="service-unavailable" className="flex flex-col items-start gap-3 text-sm">
                <p>This service isn&apos;t available right now. It may have been removed or turned off.</p>
                <Button type="button" size="sm" variant="outline" onClick={onClose}>
                  Back to the catalog
                </Button>
              </div>
            ) : !doc ? (
              <div aria-busy={pending || undefined}>
                <div aria-hidden className="flex flex-col gap-4">
                  <Skeleton className="h-6 w-2/3 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-12 w-48 rounded-full" />
                </div>
                <LoadingStatus active label="Loading service…" />
              </div>
            ) : step === 'details' ? (
              <DetailsStep
                doc={doc}
                isAuthenticated={isAuthenticated}
                requesting={requesting}
                requestError={requestError}
                onRequest={() => void requestDocument()}
              />
            ) : step === 'form' ? (
              <RequestFormStep
                key={doc.id}
                doc={doc}
                onBack={() => setStep('details')}
                onSubmitted={(id) => {
                  setRequestId(id);
                  setStep('payment');
                }}
              />
            ) : requestId ? (
              <RequestPaymentJourney key={requestId} requestId={requestId} />
            ) : null}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
