import { createSupabaseServerClient } from '@/lib/supabase/server';

import { DocumentTypeCatalog } from './document-type-catalog';
import { DocumentTypeForm } from './document-type-form';
import { ShippingFeeCard } from './shipping-fee-card';

// Admin CRUD for document_types — previously "no client insert/update/delete policy"
// per the 0002 migration's comment; this is that deferred admin UI, now unlocked by the
// 0007 migration's "admins can manage document types in their barangay" RLS policy.
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('*')
    .is('deleted_at', null)
    .order('name');

  return (
    <div className="mx-auto max-w-4xl">
      {/* Section 1: header + description */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-sm text-zinc-500">Manage the barangay&apos;s document request catalog and fees.</p>
      </div>

      {/* Section 2: shipping fee + add item form */}
      <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <ShippingFeeCard barangayId={profile?.barangay_id ?? ''} />

        <div className="my-4 border-t border-black/5 dark:border-white/5" />

        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Add Document Type</h2>
        <DocumentTypeForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      {/* Sections 3 + 4: filter controls / search bar, and existing items */}
      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Existing Document Types</h2>
      <DocumentTypeCatalog documentTypes={documentTypes ?? []} />
    </div>
  );
}
