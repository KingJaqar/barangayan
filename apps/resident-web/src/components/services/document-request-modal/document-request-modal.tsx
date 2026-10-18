'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ResidentActionGuard } from '@/components/auth/resident-action-guard';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading';
import { drawerTransition } from '@/lib/motion';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DetailsStep } from './details-step';
import { RequestFormStep } from './request-form-step';
import { RequestPaymentJourney } from '../request-payment-journey';
import type { DocumentType } from './types';
import styles from './document-request-modal.module.css';

const STAGE_LABELS = ['Details', 'Request', 'Payment'];

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
  const contentRef = useRef<HTMLDivElement>(null);
  const resetScroll = useCallback(() => contentRef.current?.scrollTo({ top: 0 }), []);
  const [read, setRead] = useState<ServiceRead | null>(null);
  const [step, setStep] = useState<'details' | 'form' | 'payment'>('details');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // Only a read for the currently selected document is shown, so switching documents goes
  // straight to the loading state instead of flashing the previous service.
  const current = read && read.id === documentId ? read : null;
  const doc = current?.status === 'ready' ? current.doc : null;
  const pending = open && documentId !== null && current === null;

  // A different document starts from its details; never carry a request/payment step over.
  useEffect(() => {
    let active = true;
    // Microtask-wrapped (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (!active) return;
      setStep('details');
      setRequestId(null);
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
                className={`${styles.sheet} pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background text-foreground shadow-2xl sm:max-w-xl md:max-w-2xl`}
                initial={{ x: '100%' }}
                animate={{ x: 0, transition: drawerTransition.enter }}
                exit={{ x: '100%', transition: drawerTransition.exit }}
                onAnimationComplete={(definition) => {
                  // Lets the catalog grid collapse to one column only after the panel has
                  // finished sliding in, so the two motions never compete.
                  if ((definition as { x?: number })?.x === 0) onOpenAnimationComplete?.();
                }}>
                <div className={styles.header}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={styles.eyebrow}><FileText size={13} aria-hidden /> Document services</p>
                      <DialogPrimitive.Title className="mt-2 text-base font-semibold tracking-tight sm:text-lg">
                        {stepLabel}
                      </DialogPrimitive.Title>
                    </div>
                    <DialogPrimitive.Description className="sr-only">
                      Requirements, request and confirmed payment for your document.
                    </DialogPrimitive.Description>
                    <DialogPrimitive.Close className={styles.close}>
                      <X size={18} />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                  <ol aria-label="Document request progress" className={styles.progress}>
                    {STAGE_LABELS.map((label, i) => (
                      <li key={label} aria-current={i === stage ? 'step' : undefined} data-reached={i <= stage}>
                        <span aria-hidden>{String(i + 1).padStart(2, '0')}</span> {label}
                        <span className="sr-only">{i < stage ? ' completed' : i === stage ? ' current step' : ' upcoming'}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div key={step} ref={contentRef} className={styles.body}>
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
                onRequest={() => setStep('form')}
              />
            ) : step === 'form' ? (
              <ResidentActionGuard key={doc.id} action="document" next={`/services/requests/new/${doc.id}`} onClose={onClose}>
                <RequestFormStep
                  key={doc.id}
                  doc={doc}
                  onBack={() => setStep('details')}
                  onSubmitted={(id) => {
                    setRequestId(id);
                    setStep('payment');
                  }}
                />
              </ResidentActionGuard>
            ) : requestId ? (
              <RequestPaymentJourney key={requestId} requestId={requestId} onStepChange={resetScroll} />
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
