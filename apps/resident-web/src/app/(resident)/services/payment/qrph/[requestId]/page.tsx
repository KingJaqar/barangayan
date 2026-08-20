import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { QrphPayment } from './qrph-payment';

/**
 * State 2b of the payment flow — only reachable once PAYMENT_SETTLEMENT_READY is true.
 * Ported from mobile's services/payment/qrph/[requestId].tsx.
 *
 * Payment doesn't depend on admin having moved the request to "Processing" — any
 * non-terminal request can be paid the moment the resident lands here (see
 * create-payment-source's own comment, migration 0064).
 */
export default async function QrphPaymentPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: request } = await supabase
    .from('service_requests')
    .select('*, document_types(name, fee_centavos)')
    .eq('id', requestId)
    .eq('resident_id', user.id)
    .single();

  if (!request) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl">
      <QrphPayment
        requestId={requestId}
        referenceNumber={request.reference_number}
        documentName={request.document_types?.name ?? 'Document Request'}
        documentFeeCentavos={request.document_types?.fee_centavos ?? 0}
      />
    </div>
  );
}
