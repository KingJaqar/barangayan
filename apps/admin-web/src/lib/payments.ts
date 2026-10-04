import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
export async function markPaymentCollected(client: SupabaseClient<Database>, requestId: string): Promise<{error:string|null;paymentId:string|null;wasCreate:boolean}> {
 const {data:before}=await client.from('payments').select('id').eq('service_request_id',requestId).in('status',['pending','paid']).maybeSingle();
 const {data,error}=await client.rpc('collect_pickup_payment',{p_request_id:requestId});
 return {error:error?.message??null,paymentId:data??null,wasCreate:!before};
}
