import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RequestPaymentJourney } from '@/components/services/request-payment-journey';
export default async function PaymentPage({params}:{params:Promise<{requestId:string}>}) {
 const {requestId}=await params;const {user}=await requireUser();const client=await createSupabaseServerClient();
 const {data}=await client.from('service_requests').select('id').eq('id',requestId).eq('resident_id',user.id).single();if(!data)notFound();
 return <div className="mx-auto max-w-xl"><RequestPaymentJourney key={requestId} requestId={requestId} initialStep="method"/></div>;
}
