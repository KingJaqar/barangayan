'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { needsResidentProfile, residentCompletionDestination } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DetailsStep } from './details-step';
import { RequestFormStep } from './request-form-step';
import { RequestPaymentJourney } from '../request-payment-journey';
import type { DocumentType } from './types';
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
  const [doc, setDoc] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'form' | 'payment'>('details');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  async function requestDocument() {
    if (!doc || checkingProfile.current) return;
    checkingProfile.current = true;
    try {
      const client = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw new Error('Unable to check your account. Please retry.');
      const destination = `/services/requests/new/${doc.id}`;
      if (!user) {
        onClose();
        router.push(`/login?next=${encodeURIComponent(destination)}`);
      } else if (await needsResidentProfile(client, user.id)) {
        onClose();
        router.push(residentCompletionDestination(destination));
      } else {
        setStep('form');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to check your profile. Please retry.');
    } finally {
      checkingProfile.current = false;
    }
  }
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setDoc(null);
      setError(null);
      setStep('details');
      setRequestId(null);
      if (!documentId) return;
      const { data, error } = await createSupabaseBrowserClient()
        .from('document_types')
        .select('*')
        .eq('id', documentId)
        .single();
      if (active) {
        setDoc(data);
        setError(error ? 'Could not load this service. Retry.' : null);
        onOpenAnimationComplete?.();
      }
    });
    return () => {
      active = false;
    };
  }, [documentId, retry, onOpenAnimationComplete]);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      modal={false}
    >
      {open ? (
        <Dialog.Portal>
          <Dialog.Content
            onInteractOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-5">
              <Dialog.Title>
                {step === 'details'
                  ? 'Document Details'
                  : step === 'form'
                    ? 'Request Form'
                    : 'Assessment and Payment'}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Requirements, request and confirmed payment for your document.
              </Dialog.Description>
              <Dialog.Close aria-label="Close" className="min-h-12 min-w-12">
                ✕
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {error ? (
                <div role="alert">
                  {error}
                  <button type="button" onClick={() => setRetry((value) => value + 1)}>
                    Retry loading service
                  </button>
                </div>
              ) : !doc ? (
                <p role="status">Loading service…</p>
              ) : step === 'details' ? (
                <DetailsStep doc={doc} isAuthenticated={isAuthenticated} onRequest={() => void requestDocument()} />
              ) : step === 'form' ? (
                <RequestFormStep
                  key={doc.id}
                  doc={doc}
                  residentName={null}
                  residentMobile={null}
                  onBack={() => setStep('details')}
                  onSubmitted={(id) => {
                    setRequestId(id);
                    setStep('payment');
                  }}
                />
              ) : requestId ? (
                <RequestPaymentJourney key={requestId} requestId={requestId} onDone={onClose} />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
