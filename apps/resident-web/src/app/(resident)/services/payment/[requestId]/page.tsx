import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { PaymentMethodForm } from './payment-method-form';

/**
 * State 1 of the payment flow: method selection. Ported from mobile's
 * services/payment/[requestId].tsx.
 */
export default async function PaymentMethodPage({ params }: { params: Promise<{ requestId: string }> }) {
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
      <PaymentMethodForm requestId={requestId} referenceNumber={request.reference_number} documentName={request.document_types?.name ?? 'Document Request'} feeCentavos={request.document_types?.fee_centavos ?? 0} />
    </div>
  );
}
