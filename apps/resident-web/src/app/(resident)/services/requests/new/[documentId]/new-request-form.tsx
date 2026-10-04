'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tables } from '@barangayan/shared';
import { ResidentServiceForm } from '@/components/services/resident-service-form';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export function NewRequestForm({doc}:{doc:Tables<'document_types'>;residentName:string|null;residentMobile:string|null}){
 const router=useRouter(); const [client]=useState(createSupabaseBrowserClient);
 return <ResidentServiceForm key={doc.id} doc={doc} client={client} onSubmitted={id=>router.replace('/services/payment/'+id)}/>;
}
