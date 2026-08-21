'use client';

/**
 * Right-side sliding panel for the Documents segment — opened from documents-list.tsx
 * without a full navigation, so the catalog stays visible/interactive behind it. Built
 * on the exact same shell as services/requests/request-drawer.tsx (Radix Dialog,
 * `modal={false}`, no overlay, `forceMount` + framer-motion driving the slide, outside-
 * interaction suppressed so clicking a different document card — handled by
 * documents-list.tsx re-selecting an id — never races Radix's own click-outside-closes
 * behavior). Widened from that drawer's max-w-lg to max-w-2xl per the redesign brief:
 * this panel carries the *entire* document-request flow, not just a read-only tracker.
 *
 * Per the redesign brief, "the whole flow of processing a document" — requirements →
 * request form → payment method → payment confirmation — happens inside this one panel
 * instead of five separate page navigations. The standalone routes each step was ported
 * from (/services/[documentId], /services/requests/new/[documentId],
 * /services/payment/[requestId] and its qrph/pickup/success children) are left intact
 * for deep links, guest SEO, and back-button/refresh — this panel is just the primary
 * interaction from the catalog now.
 *
 * Step transitions only ever move forward once a database row exists: request-form-step
 * is the only step with a Back control, because it's the only step reachable before the
 * service_requests insert happens. Every step after that (payment-method, pickup, qrph)
 * has already created or mutated a row that residents have no UPDATE policy to undo, so
 * "back" from there would either duplicate the request or silently desync the UI from
 * what's actually stored — see request-form-step.tsx's and payment-method-step.tsx's own
 * comments.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DetailsStep } from './details-step';
import { PaymentMethodStep } from './payment-method-step';
import { PickupStep } from './pickup-step';
import { QrphStep } from './qrph-step';
import { RequestFormStep } from './request-form-step';
import { SuccessStep } from './success-step';
import type { DocumentType, ModalStep, SuccessPayload } from './types';

const STEP_LABEL: Record<ModalStep, string> = {
  details: 'Document Details',
  form: 'Request Form',
  'payment-method': 'Payment Method',
  pickup: 'Pay at Pickup',
  qrph: 'QR PH Payment',
  success: 'Payment Successful',
};

// Coarse 4-stage progress used for the dots under the header — pickup/qrph/success all
// land on stage 4 ("Confirm") since which of them applies isn't known until the resident
// picks a payment method in stage 3.
const STEP_STAGE: Record<ModalStep, number> = {
  details: 0,
  form: 1,
  'payment-method': 2,
  pickup: 3,
  qrph: 3,
  success: 3,
};
const STAGE_LABELS = ['Details', 'Request', 'Payment', 'Confirm'];

function ModalSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <span className="block h-6 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-28 w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <span className="block h-20 w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

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
  /** Fires once the slide-in reaches its resting position (not on the slide-out) — lets
   * the background grid hold off collapsing to a single column until the panel has
   * actually finished animating in, so the two motions don't visually compete. */
  onOpenAnimationComplete?: () => void;
}) {
  const [doc, setDoc] = useState<DocumentType | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; mobile_number: string | null } | null>(null);

  const [step, setStep] = useState<ModalStep>('details');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<SuccessPayload | null>(null);

  // Refetches the document and resets the whole flow whenever a different document is
  // selected — including while the panel is already open, so clicking another card in
  // the background grid swaps this panel's content instead of requiring a close/reopen.
  useEffect(() => {
    if (!documentId) {
      Promise.resolve().then(() => setDoc(null));
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setDocLoading(true);
      setDoc(null);
      setStep('details');
      setRequestId(null);
      setReferenceNumber(null);
      setSuccessPayload(null);
    });

    const supabase = createSupabaseBrowserClient();
    supabase
      .from('document_types')
      .select('*')
      .eq('id', documentId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setDoc((data as DocumentType) ?? null);
        setDocLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Fetched once per session (not per document) — every document shares the same
  // resident profile, so there's no reason to refetch it on every card click.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const { data } = await supabase.from('profiles').select('full_name, mobile_number').eq('id', user.id).single();
      if (!cancelled) setProfile(data ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const stage = STEP_STAGE[step];
  const canGoBack = step === 'form';

  function handleBack() {
    if (step === 'form') setStep('details');
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal={false}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            {/* No Overlay: the background catalog stays fully lit and interactive while
                the panel is open — clicking another card just swaps its content. */}
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
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 300 }}
                onAnimationComplete={(definition) => {
                  if ((definition as { x?: number })?.x === 0) onOpenAnimationComplete?.();
                }}>
                <div className="flex shrink-0 flex-col gap-3 border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {canGoBack ? (
                        <button
                          type="button"
                          onClick={handleBack}
                          className="-ml-1.5 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          aria-label="Back">
                          <ChevronLeft size={18} />
                        </button>
                      ) : null}
                      <DialogPrimitive.Title className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                        <FileText size={14} className="shrink-0" /> {STEP_LABEL[step]}
                      </DialogPrimitive.Title>
                    </div>
                    <DialogPrimitive.Description className="sr-only">
                      Requirements, request form, and payment for the selected document.
                    </DialogPrimitive.Description>
                    <DialogPrimitive.Close className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                      <X size={18} />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {STAGE_LABELS.map((label, i) => (
                      <div key={label} className="flex flex-1 items-center gap-1.5">
                        <span className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stage ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {docLoading || !doc ? (
                    <ModalSkeleton />
                  ) : (
                    <>
                      {step === 'details' ? (
                        <DetailsStep doc={doc} isAuthenticated={isAuthenticated} onRequest={() => setStep('form')} />
                      ) : null}

                      {step === 'form' ? (
                        <RequestFormStep
                          doc={doc}
                          residentName={profile?.full_name ?? null}
                          residentMobile={profile?.mobile_number ?? null}
                          onBack={handleBack}
                          onSubmitted={(id, refNumber) => {
                            setRequestId(id);
                            setReferenceNumber(refNumber);
                            setStep('payment-method');
                          }}
                        />
                      ) : null}

                      {step === 'payment-method' && requestId && referenceNumber ? (
                        <PaymentMethodStep
                          requestId={requestId}
                          referenceNumber={referenceNumber}
                          documentName={doc.name}
                          feeCentavos={doc.fee_centavos}
                          onMethodChosen={(method) => setStep(method === 'pickup' ? 'pickup' : 'qrph')}
                        />
                      ) : null}

                      {step === 'pickup' && requestId && referenceNumber ? (
                        <PickupStep
                          requestId={requestId}
                          barangayId={doc.barangay_id}
                          referenceNumber={referenceNumber}
                          documentName={doc.name}
                          feeCentavos={doc.fee_centavos}
                          onDone={onClose}
                        />
                      ) : null}

                      {step === 'qrph' && requestId && referenceNumber ? (
                        <QrphStep
                          requestId={requestId}
                          referenceNumber={referenceNumber}
                          documentName={doc.name}
                          documentFeeCentavos={doc.fee_centavos}
                          onPaid={(payload) => {
                            setSuccessPayload(payload);
                            setStep('success');
                          }}
                          onCancelled={() => setStep('payment-method')}
                          onBack={() => setStep('payment-method')}
                        />
                      ) : null}

                      {step === 'success' && requestId && referenceNumber && successPayload ? (
                        <SuccessStep requestId={requestId} referenceNumber={referenceNumber} payload={successPayload} onClose={onClose} />
                      ) : null}
                    </>
                  )}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
