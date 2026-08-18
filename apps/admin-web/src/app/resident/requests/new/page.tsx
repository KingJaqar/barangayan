import { createSupabaseServerClient } from '@/lib/supabase/server';

import { NewRequestForm } from './new-request-form';

export default async function NewRequestPage() {
  const supabase = await createSupabaseServerClient();

  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, name, description, fee_centavos, processing_target_hours, requirements')
    .eq('is_active', true)
    .order('name');

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Request a Document</h1>
        <p className="text-sm text-zinc-500">Choose a document type and add any notes for the barangay staff.</p>
      </div>

      <NewRequestForm documentTypes={documentTypes ?? []} />
    </div>
  );
}
